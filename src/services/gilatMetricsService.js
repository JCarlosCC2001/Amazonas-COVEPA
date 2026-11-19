// =========================================================================================
// 🚀 SERVICIO DE MÉTRICAS Y AUDITORÍA DE RESPUESTA DE GILAT Y REACCIÓN COVEPA
// =========================================================================================
// Archivo: src/services/gilatMetricsService.js
//
// PROPÓSITO:
// Calcula y consolida en tiempo real los indicadores clave de desempeño (KPIs),
// tiempos de respuesta de Gilat (T2: último ciclo desde 'En Revisión' hasta dictamen
// 'Validado', 'Rechazado' o 'Documentación') y tiempos de reacción interna de COVEPA
// (T1: desde que el técnico solicita revisión en campo 'Solicitando Revisión' hasta que
// pasa a 'En Revisión' o 'Documentación'), descontando horas muertas nocturnas según el
// horario contractual (09:00 AM a 07:00 PM) con extensión dinámica si la jornada inicia
// antes o termina después en el mismo día.
// =========================================================================================

import { supabase } from '../lib/supabase'
import {
  esRevisorGilat,
  normalizarNombreAuditorGilat,
  esRegistroSoloComentario
} from './auditoriaSyncService'
import { getSitiosCatalogMap, getLimaDateStr } from './dashboardService'

// Metas de referencia SLA
export const SLA_CONFIG = Object.freeze({
  HORA_INICIO_CONTRATO: 9,   // 09:00 AM (Hora Perú)
  HORA_FIN_CONTRATO: 19,     // 07:00 PM (Hora Perú)
  HORAS_JORNADA_CONTRATO: 10, // 10 horas diarias contractuales
  META_REACCION_COVEPA_MINS: 30, // Meta de reacción COVEPA: <= 30 min
  ALERTA_REACCION_COVEPA_MINS: 60,
  META_REVISION_GILAT_HRS: 4,    // Meta de revisión Gilat: <= 4 horas efectivas
  ALERTA_REVISION_GILAT_HRS: 10  // 1 jornada contractual (10h)
})

// Helper para normalizar y verificar si un estado corresponde a 'En Revisión'
const isEnRevision = (st) => {
  if (!st) return false
  const s = String(st).trim().toLowerCase()
  return s === 'en revisión' || s === 'en revision'
}

// Helper para verificar si un estado corresponde al cierre de revisión de Gilat
// (Validado, Rechazado o Documentación)
const isDictamenGilat = (st) => {
  if (!st) return false
  const s = String(st).trim().toLowerCase()
  return s.startsWith('validad') || s.startsWith('rechazad') || s.startsWith('documentaci')
}

// Helper para verificar si un estado corresponde a solicitud de revisión de técnico en campo
const isSolicitando = (st) => {
  if (!st) return false
  const s = String(st).trim().toLowerCase()
  return s.includes('solicitando')
}

// Helper para verificar si un estado corresponde a documentación
const isDocumentacion = (st) => {
  if (!st) return false
  const s = String(st).trim().toLowerCase()
  return s.includes('documentaci')
}

/**
 * Calcula las horas efectivas transcurridas entre dos instantes ISO considerando:
 * - Horario contractual base: 09:00 AM a 07:00 PM (19:00) Hora Perú (UTC-5).
 * - Si el inicio y fin ocurren en el mismo día calendario en Perú (incluso si el técnico o
 *   revisor comenzó horas antes de las 9:00 AM o terminó después de las 7:00 PM), se mide el
 *   tiempo real exacto transcurrido en esa jornada activa.
 * - Si cruza de un día a otro, se descuenta la ventana nocturna inactiva (19:00 PM a 09:00 AM),
 *   pero si en el día inicial comenzó antes de las 09:00 AM o en el día final terminó después de
 *   las 19:00 PM, se respeta esa extensión real de trabajo.
 *
 * @param {string|Date} startIso
 * @param {string|Date} endIso
 * @returns {number} Horas efectivas transcurridas
 */
export function calcularHorasEfectivas(startIso, endIso) {
  const tStart = new Date(startIso).getTime()
  const tEnd = new Date(endIso).getTime()
  if (isNaN(tStart) || isNaN(tEnd) || tEnd <= tStart) return 0

  const rawHrs = (tEnd - tStart) / 3600000

  // Desplazar a hora Perú (UTC-5) para operar sobre días calendario locales
  const PERU_OFFSET_MS = -5 * 3600 * 1000
  const pStart = new Date(tStart + PERU_OFFSET_MS)
  const pEnd = new Date(tEnd + PERU_OFFSET_MS)

  const startDayStr = pStart.toISOString().slice(0, 10)
  const endDayStr = pEnd.toISOString().slice(0, 10)

  // Mismo día en Perú: tiempo real exacto sin recortar madrugadas ni horas extra vespertinas
  if (startDayStr === endDayStr) {
    return rawHrs
  }

  let totalMs = 0
  const firstDayUtc = Date.UTC(pStart.getUTCFullYear(), pStart.getUTCMonth(), pStart.getUTCDate())
  const lastDayUtc = Date.UTC(pEnd.getUTCFullYear(), pEnd.getUTCMonth(), pEnd.getUTCDate())
  const curDay = new Date(firstDayUtc)

  const pStartMs = pStart.getTime()
  const pEndMs = pEnd.getTime()

  while (curDay.getTime() <= lastDayUtc) {
    const dayBaseMs = curDay.getTime()
    const isFirstDay = dayBaseMs === firstDayUtc
    const isLastDay = dayBaseMs === lastDayUtc

    let winStart = dayBaseMs + SLA_CONFIG.HORA_INICIO_CONTRATO * 3600000 // 09:00
    let winEnd = dayBaseMs + SLA_CONFIG.HORA_FIN_CONTRATO * 3600000     // 19:00

    // Si el primer día la actividad comenzó antes de las 09:00 AM, incluir desde esa hora
    if (isFirstDay && pStartMs < winStart) {
      winStart = pStartMs
    }
    // Si el último día la actividad cerró después de las 19:00 PM, incluir hasta esa hora
    if (isLastDay && pEndMs > winEnd) {
      winEnd = pEndMs
    }
    // Si el último día la actividad cerró temprano antes de las 09:00 AM, contar ventana matutina desde 07:30 AM
    if (isLastDay && pEndMs < winStart) {
      winStart = Math.min(pEndMs, dayBaseMs + 7.5 * 3600000)
    }

    const segStart = Math.max(pStartMs, winStart)
    const segEnd = Math.min(pEndMs, winEnd)
    if (segEnd > segStart) {
      totalMs += (segEnd - segStart)
    }

    curDay.setUTCDate(curDay.getUTCDate() + 1)
  }

  if (totalMs <= 0) {
    return Math.min(rawHrs, 0.15)
  }

  return totalMs / 3600000
}

/**
 * Formatea una duración en horas a texto ejecutivo legible (ej: "28 min", "2h 15m", "1.4 días").
 *
 * @param {number|null} hrs
 * @returns {string}
 */
export function formatDuracionHoras(hrs) {
  if (hrs === null || hrs === undefined || isNaN(hrs)) return '—'
  const totalMins = Math.round(hrs * 60)
  if (totalMins < 1) return '< 1 min'
  if (totalMins < 60) return `${totalMins} min`
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// Helper estadístico para calcular promedio, mediana y percentil 90
function computeStats(values) {
  if (!values || values.length === 0) {
    return { count: 0, avg: 0, median: 0, p90: 0 }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const avg = sorted.reduce((acc, v) => acc + v, 0) / sorted.length
  const mid = Math.floor(sorted.length / 2)
  const median = (sorted.length % 2 !== 0)
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
  const p90Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))
  const p90 = sorted[p90Idx]
  return {
    count: sorted.length,
    avg: Number(avg.toFixed(2)),
    median: Number(median.toFixed(2)),
    p90: Number(p90.toFixed(2))
  }
}

// Cache en memoria para evitar consultas masivas repetidas
let gilatMetricsCache = null
let gilatMetricsCacheTime = 0
const GILAT_CACHE_TTL = 2 * 60 * 1000 // 2 minutos

/**
 * Obtiene el consolidado analítico de validaciones y respuesta de Gilat (T2)
 * y tiempos de reacción de COVEPA ante solicitudes de técnicos en campo (T1).
 *
 * @param {boolean} [force=false] Forzar recarga ignorando el cache en memoria
 */
export async function fetchGilatMetrics(force = false) {
  if (!force && gilatMetricsCache && (Date.now() - gilatMetricsCacheTime < GILAT_CACHE_TTL)) {
    return gilatMetricsCache
  }

  const [sitiosMap] = await Promise.all([
    getSitiosCatalogMap()
  ])

  // 1. Paginación segura para cargar todas las observaciones no pendientes
  const allObs = []
  let fromObs = 0
  while (true) {
    const { data, error } = await supabase
      .from('observaciones')
      .select('id_obs, id_sitio, estado_covepa, revisor, fecha_subsanacion, item, sub_item, subsistema')
      .neq('estado_covepa', 'Pendiente')
      .range(fromObs, fromObs + 999)

    if (error) {
      console.error('Error al consultar observaciones para métricas Gilat:', error)
      break
    }
    if (!data || data.length === 0) break
    allObs.push(...data)
    if (data.length < 1000) break
    fromObs += 1000
  }

  const obsMap = {}
  allObs.forEach(o => {
    obsMap[o.id_obs] = o
  })

  // 2. Cargar el historial completo de transiciones de estado ordenado cronológicamente
  const allHist = []
  let fromHist = 0
  while (true) {
    const { data, error } = await supabase
      .from('historial_estados_observaciones')
      .select('id, id_obs, id_sitio, estado_anterior, estado_nuevo, usuario_nombre, origen, created_at, comentario')
      .order('created_at', { ascending: true })
      .range(fromHist, fromHist + 999)

    if (error) {
      console.error('Error al consultar historial de estados para métricas Gilat:', error)
      break
    }
    if (!data || data.length === 0) break
    allHist.push(...data)
    if (data.length < 1000) break
    fromHist += 1000
  }

  // Agrupar historial por id_obs, descartando registros de solo comentario o sin cambio real de estado
  const obsHistory = {}
  allHist.forEach(h => {
    if (esRegistroSoloComentario(h)) return
    if (!obsHistory[h.id_obs]) obsHistory[h.id_obs] = []
    obsHistory[h.id_obs].push(h)
  })

  // =========================================================================================
  // 3. MÁQUINA DE ESTADOS POR OBSERVACIÓN (T1: REACCIÓN COVEPA | T2: REVISIÓN GILAT)
  // =========================================================================================
  // Regla de Negocio Confirmada:
  // - T2 (Gilat): Mide siempre el ÚLTIMO ciclo de cambio de validación desde que la observación
  //   entra a 'En Revisión' hasta que cambia por primera vez a 'Validado', 'Rechazado' o 'Documentación'.
  //   Cada ciclo se consume al cerrarse (no hay doble conteo). Si vuelve a entrar a 'En Revisión'
  //   después de un rechazo o documentación, inicia un nuevo ciclo y prevalece el último ciclo.
  //   Se excluyen del tiempo de Gilat los dictámenes realizados directamente por usuarios COVEPA
  //   sin revisor Gilat asignado.
  // - T1 (COVEPA): Mide el tiempo de reacción interno desde que el técnico solicita revisión en campo
  //   ('Solicitando Revisión') hasta que nuestro equipo la pasa a 'En Revisión' o 'Documentación'.
  // =========================================================================================

  const auditorTimesEff = {}
  const auditorTimesRaw = {}
  const lastGilatCyclesPerObs = []
  const lastCovepaCyclesPerObs = []
  const covepaUserReactions = {}
  let dictaminadasDirectasCovepaCount = 0

  // Mapa del último tiempo T1 por observación para vincularlo con su cierre T2 en la bitácora
  const lastT1ByObs = {}

  Object.entries(obsHistory).forEach(([id_obs, events]) => {
    let openEnRev = null
    let openSol = null
    const obsGilatCycles = []
    const obsCovepaCycles = []
    const obsRow = obsMap[id_obs]
    const sitioInfo = sitiosMap[obsRow?.id_sitio] || {}
    const localidad = sitioInfo.localidad || sitioInfo.nombre_nodo || '—'

    for (let i = 0; i < events.length; i++) {
      const ev = events[i]
      const st = ev.estado_nuevo
      const ant = ev.estado_anterior

      // ── B) T1: Tiempo de Reacción de COVEPA (Campo: Solicitando Revisión -> En Revisión / Documentación) ──
      if (isSolicitando(st)) {
        // Si ya hay un ciclo Solicitando abierto hace menos de 5 min y estado_anterior es null o Solicitando,
        // es un evento duplicado de sincronización (app_fotos + realtime); conservar la hora inicial.
        const isSyncDupe = openSol &&
          (!ant || isSolicitando(ant)) &&
          (new Date(ev.created_at) - new Date(openSol.created_at)) < 5 * 60 * 1000
        if (!isSyncDupe) {
          openSol = ev
        }
      } else if (isEnRevision(st) || isDocumentacion(st)) {
        if (openSol) {
          const rawHrs = (new Date(ev.created_at) - new Date(openSol.created_at)) / 3600000
          const effHrs = calcularHorasEfectivas(openSol.created_at, ev.created_at)
          if (rawHrs >= 0 && rawHrs < 720) {
            const usuarioReaccion = ev.usuario_nombre || 'Auditor COVEPA'
            const tecnicoSolicitante = openSol.usuario_nombre || 'Técnico de Campo'
            const cycleT1 = {
              id_obs,
              id_sitio: obsRow?.id_sitio || ev.id_sitio || '—',
              localidad,
              subsistema: obsRow?.subsistema || 'GENERAL',
              tecnicoSolicitante,
              usuarioReaccion,
              estadoDestino: st,
              from: openSol.created_at,
              to: ev.created_at,
              rawHrs,
              effHrs,
              effMins: Math.round(effHrs * 60),
              rawMins: Math.round(rawHrs * 60)
            }
            obsCovepaCycles.push(cycleT1)
          }
          openSol = null // Consumir ciclo T1
        }
      } else if (!isSolicitando(st)) {
        openSol = null
      }

      // ── A) T2: Tiempo de Revisión de Gilat (En Revisión -> Validado / Rechazado / Documentación) ──
      if (isEnRevision(st)) {
        const isSyncDupe = openEnRev &&
          (!ant || isEnRevision(ant)) &&
          (new Date(ev.created_at) - new Date(openEnRev.created_at)) < 5 * 60 * 1000
        if (!isSyncDupe) {
          // Nuevo ingreso a 'En Revisión' (inicia o reinicia el reloj de este ciclo)
          openEnRev = ev
        }
      } else if (isDictamenGilat(st)) {
        if (openEnRev) {
          const rawHrs = (new Date(ev.created_at) - new Date(openEnRev.created_at)) / 3600000
          const effHrs = calcularHorasEfectivas(openEnRev.created_at, ev.created_at)

          if (rawHrs >= 0 && rawHrs < 720) {
            // Determinar si el dictamen corresponde a Gilat o fue un cambio interno de COVEPA
            const revisorCanon = normalizarNombreAuditorGilat(obsRow?.revisor) ||
              normalizarNombreAuditorGilat(ev.usuario_nombre)

            // Nota: cuando pasa de En Revisión -> Documentación, el sistema limpia obs.revisor = null
            // por regla de negocio; ese cierre de revisión sí pertenece al flujo de revisión.
            const esDictamenDeGilat = Boolean(revisorCanon) || isDocumentacion(st)

            if (esDictamenDeGilat) {
              obsGilatCycles.push({
                id_obs,
                id_sitio: obsRow?.id_sitio || ev.id_sitio || '—',
                localidad,
                subsistema: obsRow?.subsistema || 'GENERAL',
                item: obsRow?.item || '',
                estadoFinal: st,
                revisor: revisorCanon || 'Gilat Networks',
                registradoPor: ev.usuario_nombre || 'Sistema',
                from: openEnRev.created_at,
                to: ev.created_at,
                rawHrs,
                effHrs
              })
            } else {
              dictaminadasDirectasCovepaCount++
            }
          }
          // Consumir estrictamente el ciclo para que cambios posteriores (ej. Documentación -> Validado)
          // sin volver a pasar por 'En Revisión' NO se cuenten dos veces.
          openEnRev = null
        }
      } else {
        // Salió de 'En Revisión' a otro estado no dictaminado (ej. Pendiente, Solicitando Revisión, Descartado, Crítico)
        openEnRev = null
      }
    }

    // Regla confirmada: tomar siempre el ÚLTIMO ciclo de reacción y el ÚLTIMO ciclo de validación por observación
    if (obsCovepaCycles.length > 0) {
      const lastT1 = {
        ...obsCovepaCycles[obsCovepaCycles.length - 1],
        totalCiclosT1: obsCovepaCycles.length
      }
      lastCovepaCyclesPerObs.push(lastT1)
      lastT1ByObs[id_obs] = lastT1

      // Acumular por usuario COVEPA que atendió la solicitud de campo
      const uName = lastT1.usuarioReaccion
      if (!esRevisorGilat(uName)) {
        if (!covepaUserReactions[uName]) {
          covepaUserReactions[uName] = {
            nombre: uName,
            totalAtendidas: 0,
            effMinsList: [],
            rawMinsList: [],
            dentroMeta: 0,
            ultimaAtencion: null
          }
        }
        const entry = covepaUserReactions[uName]
        entry.totalAtendidas++
        entry.effMinsList.push(lastT1.effMins)
        entry.rawMinsList.push(lastT1.rawMins)
        if (lastT1.effMins <= SLA_CONFIG.META_REACCION_COVEPA_MINS) {
          entry.dentroMeta++
        }
        if (!entry.ultimaAtencion || new Date(lastT1.to) > new Date(entry.ultimaAtencion)) {
          entry.ultimaAtencion = lastT1.to
        }
      }
    }

    if (obsGilatCycles.length > 0) {
      const lastT2 = {
        ...obsGilatCycles[obsGilatCycles.length - 1],
        totalCiclos: obsGilatCycles.length,
        t1Asociado: lastT1ByObs[id_obs] || null
      }
      lastGilatCyclesPerObs.push(lastT2)

      const revName = lastT2.revisor
      if (revName && esRevisorGilat(revName)) {
        const canon = normalizarNombreAuditorGilat(revName) || revName
        if (!auditorTimesEff[canon]) auditorTimesEff[canon] = []
        if (!auditorTimesRaw[canon]) auditorTimesRaw[canon] = []
        auditorTimesEff[canon].push(lastT2.effHrs)
        auditorTimesRaw[canon].push(lastT2.rawHrs)
      }
    }
  })

  // =========================================================================================
  // 4. CONSOLIDADO DE OBSERVACIONES DICTAMINADAS POR GILAT
  // =========================================================================================
  const gilatDictaminadas = allObs.filter(o =>
    (o.estado_covepa === 'Validado' || o.estado_covepa === 'Rechazado' || o.estado_covepa === 'Documentación') &&
    esRevisorGilat(o.revisor)
  )

  const descartadasPorGilat = allObs.filter(o =>
    o.estado_covepa === 'Descartado' &&
    esRevisorGilat(o.revisor)
  ).length

  const totalValidadas = gilatDictaminadas.filter(o => o.estado_covepa === 'Validado').length
  const totalRechazadas = gilatDictaminadas.filter(o => o.estado_covepa === 'Rechazado').length
  const totalDictaminadas = gilatDictaminadas.length
  const tasaAprobacion = totalDictaminadas > 0
    ? Number(((totalValidadas / totalDictaminadas) * 100).toFixed(1))
    : 0

  // =========================================================================================
  // 5. COLAS VIVAS DE ESPERA (CON HORA EXACTA DE ENTRADA DESDE EL HISTORIAL)
  // =========================================================================================
  // A) Cola Gilat: Observaciones actualmente en 'En Revisión'
  const enColaGilat = allObs.filter(o => isEnRevision(o.estado_covepa))

  // B) Cola COVEPA: Observaciones en 'Solicitando Revisión' o 'Documentación'
  const enColaCovepa = allObs.filter(o => isSolicitando(o.estado_covepa) || isDocumentacion(o.estado_covepa))

  const now = new Date()
  const nowIso = now.toISOString()
  const hoyLima = getLimaDateStr(now)

  const buildColaItems = (obsList, findEventFn, origenCola) => {
    return obsList.map(o => {
      const hist = obsHistory[o.id_obs] || []
      const ev = findEventFn(hist)
      const entryIso = ev ? ev.created_at : (o.fecha_subsanacion || null)
      const entryDate = entryIso ? new Date(entryIso) : null

      const rawWaitHrs = entryDate ? Math.max(0, (now - entryDate) / 3600000) : 0
      const effWaitHrs = entryDate ? Math.max(0, calcularHorasEfectivas(entryIso, nowIso)) : 0
      const sitioInfo = sitiosMap[o.id_sitio] || {}

      return {
        ...o,
        localidad: sitioInfo.localidad || sitioInfo.nombre_nodo || '—',
        waitHrs: Number(effWaitHrs.toFixed(1)),
        waitHrsCorridas: Number(rawWaitHrs.toFixed(1)),
        waitMins: Math.round(effWaitHrs * 60),
        waitText: formatDuracionHoras(effWaitHrs),
        waitTextCorrido: formatDuracionHoras(rawWaitHrs),
        waitDays: Number((effWaitHrs / SLA_CONFIG.HORAS_JORNADA_CONTRATO).toFixed(1)),
        entryDate: entryDate ? entryDate.toISOString() : null,
        responsableEntrada: ev?.usuario_nombre || o.revisor || '—',
        origenCola
      }
    }).sort((a, b) => b.waitHrsCorridas - a.waitHrsCorridas)
  }

  // En 'En Revisión', buscar la última transición real hacia 'En Revisión'
  const colaGilatDetalle = buildColaItems(
    enColaGilat,
    hist => {
      for (let i = hist.length - 1; i >= 0; i--) {
        if (isEnRevision(hist[i].estado_nuevo)) {
          // Si hay eventos duplicados consecutivos de En Revisión, tomar el primero de esa ráfaga
          let entry = hist[i]
          while (i > 0 && isEnRevision(hist[i - 1].estado_nuevo) &&
            (new Date(entry.created_at) - new Date(hist[i - 1].created_at)) < 5 * 60 * 1000) {
            entry = hist[i - 1]
            i--
          }
          return entry
        }
      }
      return null
    },
    'gilat'
  )

  // En 'Solicitando Revisión' / 'Documentación', buscar la última transición real hacia ese estado
  const colaCovepaDetalle = buildColaItems(
    enColaCovepa,
    hist => {
      for (let i = hist.length - 1; i >= 0; i--) {
        if (isSolicitando(hist[i].estado_nuevo) || isDocumentacion(hist[i].estado_nuevo)) {
          let entry = hist[i]
          while (i > 0 && (isSolicitando(hist[i - 1].estado_nuevo) || isDocumentacion(hist[i - 1].estado_nuevo)) &&
            (new Date(entry.created_at) - new Date(hist[i - 1].created_at)) < 5 * 60 * 1000) {
            entry = hist[i - 1]
            i--
          }
          return entry
        }
      }
      return null
    },
    'covepa'
  )

  const mayorEspera = colaGilatDetalle.length > 0 ? colaGilatDetalle[0] : null
  const mayorEsperaCovepa = colaCovepaDetalle.length > 0 ? colaCovepaDetalle[0] : null

  // =========================================================================================
  // 6. ANÁLISIS DIARIO (SERIE TEMPORAL Y VELOCIDAD POR DÍA)
  // =========================================================================================
  const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const dailyMap = {}

  gilatDictaminadas.forEach(o => {
    const day = getLimaDateStr(o.fecha_subsanacion) || 'Sin fecha'
    if (!dailyMap[day]) {
      dailyMap[day] = { dateStr: day, total: 0, validadas: 0, rechazadas: 0, revisores: {} }
    }
    dailyMap[day].total++
    if (o.estado_covepa === 'Validado') dailyMap[day].validadas++
    if (o.estado_covepa === 'Rechazado') dailyMap[day].rechazadas++
    const r = normalizarNombreAuditorGilat(o.revisor) || o.revisor || 'Gilat Networks'
    dailyMap[day].revisores[r] = (dailyMap[day].revisores[r] || 0) + 1
  })

  const sortedDates = Object.keys(dailyMap).sort()
  const serieDiaria = sortedDates.map(d => {
    const item = dailyMap[d]
    let topRev = ''
    let topCount = 0
    Object.entries(item.revisores).forEach(([r, count]) => {
      if (count > topCount) {
        topCount = count
        topRev = r
      }
    })

    const [yyyy, mm, dd] = d.split('-').map(Number)
    const dt = new Date(yyyy, mm - 1, dd)
    const diaSemana = DIAS_SHORT[dt.getDay()] || ''
    const label = `${dd}/${mm}`

    return {
      dateStr: d,
      diaSemana,
      label,
      validadas: item.validadas,
      rechazadas: item.rechazadas,
      total: item.total,
      revisorLider: topRev,
      isToday: d === hoyLima
    }
  })

  // =========================================================================================
  // 7. PRODUCTIVIDAD Y SLA POR AUDITOR DE GILAT (CON NOMBRES NORMALIZADOS Y MEDIANA)
  // =========================================================================================
  const auditorsMap = {}
  gilatDictaminadas.forEach(o => {
    const r = normalizarNombreAuditorGilat(o.revisor) || o.revisor || 'Gilat Networks'
    if (!auditorsMap[r]) {
      auditorsMap[r] = {
        nombre: r,
        total: 0,
        validadas: 0,
        rechazadas: 0,
        fechas: new Set(),
        ultimaFecha: null
      }
    }
    auditorsMap[r].total++
    if (o.estado_covepa === 'Validado') auditorsMap[r].validadas++
    if (o.estado_covepa === 'Rechazado') auditorsMap[r].rechazadas++
    if (o.fecha_subsanacion) {
      auditorsMap[r].fechas.add(getLimaDateStr(o.fecha_subsanacion))
      if (!auditorsMap[r].ultimaFecha || new Date(o.fecha_subsanacion) > new Date(auditorsMap[r].ultimaFecha)) {
        auditorsMap[r].ultimaFecha = o.fecha_subsanacion
      }
    }
  })

  const rankingAuditores = Object.values(auditorsMap).map(a => {
    const tasa = a.total > 0 ? Number(((a.validadas / a.total) * 100).toFixed(1)) : 0
    const cuota = totalDictaminadas > 0 ? Number(((a.total / totalDictaminadas) * 100).toFixed(1)) : 0
    const effTimes = auditorTimesEff[a.nombre] || []
    const rawTimes = auditorTimesRaw[a.nombre] || []
    const stEff = computeStats(effTimes)
    const stRaw = computeStats(rawTimes)

    const diasActivos = a.fechas.size || 1
    const ritmo = (a.total / diasActivos).toFixed(1)
    const lastDay = a.ultimaFecha ? getLimaDateStr(a.ultimaFecha) : null
    const isHoy = lastDay === hoyLima
    const lastDate = a.ultimaFecha ? new Date(a.ultimaFecha) : null
    const isSemana = lastDate ? (now - lastDate) < (7 * 24 * 3600 * 1000) : false

    return {
      nombre: a.nombre,
      total: a.total,
      validadas: a.validadas,
      rechazadas: a.rechazadas,
      tasaAprobacion: tasa,
      cuotaPorcentaje: cuota,
      ciclosMedidos: stEff.count,
      tiempoPromedioHoras: stEff.count > 0 ? Number(stEff.avg.toFixed(1)) : null,
      tiempoMedianaHoras: stEff.count > 0 ? Number(stEff.median.toFixed(1)) : null,
      tiempoCorridoHoras: stRaw.count > 0 ? Number(stRaw.avg.toFixed(1)) : null,
      tiempoPromedioDias: stEff.count > 0 ? Number((stEff.avg / SLA_CONFIG.HORAS_JORNADA_CONTRATO).toFixed(1)) : null,
      diasActivos,
      ritmoDiario: ritmo,
      ultimaFecha: a.ultimaFecha,
      activoHoy: isHoy,
      activoEstaSemana: isSemana
    }
  }).sort((a, b) => b.total - a.total)

  // =========================================================================================
  // 8. RANKING DE REACCIÓN INTERNA COVEPA (CUANDO TÉCNICO SOLICITA REVISIÓN EN CAMPO)
  // =========================================================================================
  const rankingCovepa = Object.values(covepaUserReactions).map(u => {
    const stEffMins = computeStats(u.effMinsList)
    const stRawMins = computeStats(u.rawMinsList)
    const pctSla = u.totalAtendidas > 0
      ? Number(((u.dentroMeta / u.totalAtendidas) * 100).toFixed(1))
      : 0

    return {
      nombre: u.nombre,
      totalAtendidas: u.totalAtendidas,
      promedioMinutos: Math.round(stEffMins.avg),
      medianaMinutos: Math.round(stEffMins.median),
      p90Minutos: Math.round(stEffMins.p90),
      promedioHoras: Number((stEffMins.avg / 60).toFixed(2)),
      medianaHoras: Number((stEffMins.median / 60).toFixed(2)),
      promedioCorridoHoras: Number((stRawMins.avg / 60).toFixed(2)),
      dentroMeta: u.dentroMeta,
      tasaCumplimientoSla: pctSla,
      ultimaAtencion: u.ultimaAtencion
    }
  }).sort((a, b) => b.totalAtendidas - a.totalAtendidas)

  // =========================================================================================
  // 9. ESTADÍSTICAS GLOBALES T2 (GILAT) Y T1 (COVEPA)
  // =========================================================================================
  const gilatEffList = lastGilatCyclesPerObs.map(c => c.effHrs)
  const gilatRawList = lastGilatCyclesPerObs.map(c => c.rawHrs)
  const covepaEffList = lastCovepaCyclesPerObs.map(c => c.effHrs)
  const covepaRawList = lastCovepaCyclesPerObs.map(c => c.rawHrs)

  const gilatStatsEff = computeStats(gilatEffList)
  const gilatStatsRaw = computeStats(gilatRawList)
  const covepaStatsEff = computeStats(covepaEffList)
  const covepaStatsRaw = computeStats(covepaRawList)

  const gilatDentroSla = lastGilatCyclesPerObs.filter(c => c.effHrs <= SLA_CONFIG.META_REVISION_GILAT_HRS).length
  const tasaSlaGilat = lastGilatCyclesPerObs.length > 0
    ? Number(((gilatDentroSla / lastGilatCyclesPerObs.length) * 100).toFixed(1))
    : 0

  const covepaDentroSla = lastCovepaCyclesPerObs.filter(c => (c.effHrs * 60) <= SLA_CONFIG.META_REACCION_COVEPA_MINS).length
  const tasaSlaCovepa = lastCovepaCyclesPerObs.length > 0
    ? Number(((covepaDentroSla / lastCovepaCyclesPerObs.length) * 100).toFixed(1))
    : 0

  const cicloTotalHoras = Number((gilatStatsEff.avg + covepaStatsEff.avg).toFixed(1))
  const cicloTotalMedianaHoras = Number((gilatStatsEff.median + covepaStatsEff.median).toFixed(1))

  const hoyItem = dailyMap[hoyLima]
  const diasActivosTotales = sortedDates.length || 1
  const velocidadPromedio = Number((totalDictaminadas / diasActivosTotales).toFixed(1))

  // Bitácora de los últimos 50 ciclos cerrados (para auditar observación por observación)
  const ultimosCiclosDetalle = [...lastGilatCyclesPerObs]
    .sort((a, b) => new Date(b.to) - new Date(a.to))
    .slice(0, 50)
    .map(c => ({
      id_obs: c.id_obs,
      id_sitio: c.id_sitio,
      localidad: c.localidad,
      subsistema: c.subsistema,
      estadoFinal: c.estadoFinal,
      revisor: c.revisor,
      fechaEntradaRevision: c.from,
      fechaDictamen: c.to,
      effHrs: Number(c.effHrs.toFixed(2)),
      rawHrs: Number(c.rawHrs.toFixed(2)),
      tiempoGilatTexto: formatDuracionHoras(c.effHrs),
      tiempoGilatCorridoTexto: formatDuracionHoras(c.rawHrs),
      reaccionCovepaTexto: c.t1Asociado ? formatDuracionHoras(c.t1Asociado.effHrs) : '—',
      reaccionCovepaMins: c.t1Asociado ? c.t1Asociado.effMins : null,
      tecnicoSolicitante: c.t1Asociado ? c.t1Asociado.tecnicoSolicitante : '—',
      totalCiclos: c.totalCiclos
    }))

  const result = {
    kpis: {
      totalDictaminadas,
      totalValidadas,
      totalRechazadas,
      tasaAprobacion,
      // T2 Gilat (Horario Efectivo Contractual 9am-7pm + ext vs Corrido 24h)
      tiempoPromedioHoras: Number(gilatStatsEff.avg.toFixed(1)),
      tiempoMedianaHoras: Number(gilatStatsEff.median.toFixed(1)),
      tiempoP90Horas: Number(gilatStatsEff.p90.toFixed(1)),
      tiempoCorridoHoras: Number(gilatStatsRaw.avg.toFixed(1)),
      tiempoPromedioDias: Number((gilatStatsEff.avg / SLA_CONFIG.HORAS_JORNADA_CONTRATO).toFixed(1)),
      tasaSlaGilat,
      totalCiclosGilatMedidos: gilatStatsEff.count,
      dictaminadasDirectasCovepaCount,
      // T1 Reacción COVEPA (Solicitando Revisión -> En Revisión)
      tiempoCovepaHoras: Number(covepaStatsEff.avg.toFixed(1)),
      tiempoCovepaMedianaHoras: Number(covepaStatsEff.median.toFixed(2)),
      tiempoCovepaMinutos: Math.round(covepaStatsEff.avg * 60),
      medianaCovepaMinutos: Math.round(covepaStatsEff.median * 60),
      p90CovepaMinutos: Math.round(covepaStatsEff.p90 * 60),
      tiempoCovepaCorridoHoras: Number(covepaStatsRaw.avg.toFixed(1)),
      tiempoCovepaDias: Number((covepaStatsEff.avg / SLA_CONFIG.HORAS_JORNADA_CONTRATO).toFixed(1)),
      tasaSlaCovepa,
      totalCiclosCovepaMedidos: covepaStatsEff.count,
      // T3 Ciclo Total
      cicloTotalHoras,
      cicloTotalMedianaHoras,
      cicloTotalDias: Number((cicloTotalHoras / SLA_CONFIG.HORAS_JORNADA_CONTRATO).toFixed(1)),
      // Colas activas
      colaEsperaActual: enColaGilat.length,
      colaCovepaActual: enColaCovepa.length,
      dictaminadasHoy: hoyItem ? hoyItem.total : 0,
      velocidadDiariaPromedio: velocidadPromedio,
      descartadas: descartadasPorGilat,
      mayorEspera: mayorEspera ? {
        id_obs: mayorEspera.id_obs,
        id_sitio: mayorEspera.id_sitio,
        localidad: mayorEspera.localidad,
        waitHrs: mayorEspera.waitHrs,
        waitHrsCorridas: mayorEspera.waitHrsCorridas,
        waitText: mayorEspera.waitText,
        waitDays: mayorEspera.waitDays,
        entryDate: mayorEspera.entryDate
      } : null,
      mayorEsperaCovepa: mayorEsperaCovepa ? {
        id_obs: mayorEsperaCovepa.id_obs,
        id_sitio: mayorEsperaCovepa.id_sitio,
        localidad: mayorEsperaCovepa.localidad,
        waitHrs: mayorEsperaCovepa.waitHrs,
        waitHrsCorridas: mayorEsperaCovepa.waitHrsCorridas,
        waitText: mayorEsperaCovepa.waitText,
        waitDays: mayorEsperaCovepa.waitDays,
        entryDate: mayorEsperaCovepa.entryDate
      } : null
    },
    serieDiaria,
    rankingAuditores,
    rankingCovepa,
    ultimosCiclosDetalle,
    colaDetalle: colaGilatDetalle.slice(0, 50),
    colaCovepaDetalle: colaCovepaDetalle.slice(0, 50)
  }

  gilatMetricsCache = result
  gilatMetricsCacheTime = Date.now()
  return result
}
