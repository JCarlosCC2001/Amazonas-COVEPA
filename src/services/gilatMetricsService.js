// =========================================================================================
// 🚀 SERVICIO DE MÉTRICAS Y AUDITORÍA DE RESPUESTA DE GILAT
// =========================================================================================
// Archivo: src/services/gilatMetricsService.js
//
// PROPÓSITO:
// Calcula y consolida en tiempo real los indicadores clave de desempeño (KPIs),
// tiempos de respuesta (SLA Turnaround), velocidad diaria y productividad individual
// de los auditores y revisores certificados de Gilat Networks.
// =========================================================================================

import { supabase } from '../lib/supabase'
import { esRevisorGilat, esRegistroSoloComentario } from './auditoriaSyncService'
import { getSitiosCatalogMap, getLimaDateStr } from './dashboardService'

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

// Helper para verificar si un estado corresponde a solicitud de revisión
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

// Horario contractual (hora de Lima): 9:00 a 19:00. Se usa como referencia secundaria,
// ya que técnicos y revisores suelen trabajar fuera de ese horario (la medición principal es tiempo real).
const CONTRATO_HORA_INICIO = 9
const CONTRATO_HORA_FIN = 19
const LIMA_OFFSET_MS = -5 * 3600 * 1000 // Lima = UTC-5 (sin horario de verano)

function horasEnHorarioContrato(inicio, fin) {
  const a = inicio.getTime() + LIMA_OFFSET_MS
  const b = fin.getTime() + LIMA_OFFSET_MS
  if (!(b > a)) return 0
  const dayMs = 86400000
  let total = 0
  for (let dayStart = Math.floor(a / dayMs) * dayMs; dayStart < b; dayStart += dayMs) {
    const s = Math.max(a, dayStart + CONTRATO_HORA_INICIO * 3600000)
    const e = Math.min(b, dayStart + CONTRATO_HORA_FIN * 3600000)
    if (e > s) total += e - s
  }
  return total / 3600000
}

const promedio = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

function percentil(arr, p) {
  if (!arr || arr.length === 0) return 0
  const s = [...arr].sort((a, b) => a - b)
  const idx = (s.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

// Cache en memoria para evitar consultas masivas repetidas
let gilatMetricsCache = null
let gilatMetricsCacheTime = 0
const GILAT_CACHE_TTL = 3 * 60 * 1000 // 3 minutos

/**
 * Obtiene el consolidado analítico de validaciones y respuesta de Gilat
 *
 * @param {boolean} [force=false] Forzar recarga ignorando el cache en memoria
 * @returns {Promise<{
 *   kpis: {
 *     totalDictaminadas: number,
 *     totalValidadas: number,
 *     totalRechazadas: number,
 *     tasaAprobacion: number,
 *     tiempoPromedioHoras: number,
 *     tiempoPromedioDias: number,
 *     colaEsperaActual: number,
 *     dictaminadasHoy: number,
 *     velocidadDiariaPromedio: number,
 *     descartadas: number,
 *     mayorEspera: { id_obs: string, id_sitio: string, localidad: string, waitHrs: number, waitDays: number, entryDate: string } | null
 *   },
 *   serieDiaria: Array<{
 *     dateStr: string,
 *     diaSemana: string,
 *     label: string,
 *     validadas: number,
 *     rechazadas: number,
 *     total: number,
 *     revisorLider: string,
 *     isToday: boolean
 *   }>,
 *   rankingAuditores: Array<{
 *     nombre: string,
 *     total: number,
 *     validadas: number,
 *     rechazadas: number,
 *     tasaAprobacion: number,
 *     cuotaPorcentaje: number,
 *     tiempoPromedioHoras: number | null,
 *     tiempoPromedioDias: number | null,
 *     diasActivos: number,
 *     ritmoDiario: string,
 *     ultimaFecha: string | null,
 *     activoHoy: boolean,
 *     activoEstaSemana: boolean
 *   }>,
 *   colaDetalle: Array<{
 *     id_obs: string,
 *     id_sitio: string,
 *     localidad: string,
 *     item: string,
 *     sub_item: string,
 *     subsistema: string,
 *     estado_covepa: string,
 *     waitHrs: number,
 *     waitDays: number,
 *     entryDate: string | null
 *   }>
 * }>}
 */
export async function fetchGilatMetrics(force = false) {
  if (!force && gilatMetricsCache && (Date.now() - gilatMetricsCacheTime < GILAT_CACHE_TTL)) {
    return gilatMetricsCache
  }

  const [sitiosMap] = await Promise.all([
    getSitiosCatalogMap()
  ])

  // 1. Paginación segura para cargar todas las observaciones relevantes
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

  // 2. Cargar historial de transiciones de estado para calcular turnaround de respuesta
  // Optimización: Solo consultar los últimos 45 días para evitar descargar la tabla completa histórica
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 45)
  const cutoffIso = cutoffDate.toISOString()

  const allHist = []
  let fromHist = 0
  while (true) {
    const { data, error } = await supabase
      .from('historial_estados_observaciones')
      .select('id, id_obs, id_sitio, estado_anterior, estado_nuevo, usuario_nombre, created_at, comentario')
      .gte('created_at', cutoffIso)
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

  // Mapear historial por id_obs, descartando eventos de solo comentario o sin cambio de estado
  const obsHistory = {}
  allHist.forEach(h => {
    if (esRegistroSoloComentario(h)) return

    if (!obsHistory[h.id_obs]) obsHistory[h.id_obs] = []
    obsHistory[h.id_obs].push(h)
  })

  // 3. Medición de Tiempos de Respuesta mediante CICLOS (máquina de estados por observación)
  // A) Tiempo Gilat (T2): desde la ÚLTIMA entrada a 'En Revisión' hasta el PRIMER cambio a
  //    'Validado', 'Rechazado' o 'Documentación'. Cada ciclo se cierra una sola vez (se consume).
  // B) Tiempo COVEPA (T1): desde 'Solicitando Revisión' (o 'Documentación' devuelta por Gilat)
  //    hasta que COVEPA la pasa a 'En Revisión' (o a 'Documentación').
  const obsById = new Map(allObs.map(o => [o.id_obs, o]))
  const auditorTimes = {}
  const allGilatTimes = []
  const allGilatTimesContrato = []
  const allCovepaTimes = []
  const allCovepaTimesContrato = []
  let ciclosGilatExcluidosCovepa = 0

  Object.entries(obsHistory).forEach(([id_obs, events]) => {
    const obsMatch = obsById.get(id_obs)
    let gOpen = null // Ciclo Gilat abierto (entrada a En Revisión)
    let cOpen = null // Ciclo COVEPA abierto (Solicitando / Documentación)
    let lastGilatCycle = null
    const gilatCycles = []

    const cerrarCovepa = (ev) => {
      if (!cOpen) return
      const ini = new Date(cOpen.created_at)
      const fin = new Date(ev.created_at)
      const dtHrs = (fin - ini) / (1000 * 3600)
      if (dtHrs >= 0) {
        allCovepaTimes.push(dtHrs)
        allCovepaTimesContrato.push(horasEnHorarioContrato(ini, fin))
      }
      cOpen = null
    }

    for (let i = 0; i < events.length; i++) {
      const ev = events[i]
      const st = ev.estado_nuevo

      if (isEnRevision(st)) {
        // COVEPA cierra su ciclo al pasar la observación a En Revisión
        cerrarCovepa(ev)
        // Solo abre ciclo Gilat si no hay uno abierto (un registro repetido no reinicia el reloj)
        if (!gOpen) gOpen = ev
      } else if (isDictamenGilat(st)) {
        if (gOpen) {
          const ini = new Date(gOpen.created_at)
          const fin = new Date(ev.created_at)
          const dtHrs = (fin - ini) / (1000 * 3600)
          if (dtHrs >= 0) {
            const cycle = {
              hrs: dtHrs,
              hrsContrato: horasEnHorarioContrato(ini, fin),
              usuario: ev.usuario_nombre,
              estadoCierre: st,
              auditor: esRevisorGilat(ev.usuario_nombre) ? ev.usuario_nombre : null
            }
            gilatCycles.push(cycle)
            lastGilatCycle = cycle
          }
          gOpen = null // El ciclo se consume: un dictamen posterior no vuelve a medirse
        }
        if (isDocumentacion(st)) {
          // Solicitando -> Documentación cierra el ciclo COVEPA; Documentación abre uno nuevo
          // (COVEPA debe responder y devolverla a En Revisión)
          cerrarCovepa(ev)
          cOpen = ev
        } else {
          cOpen = null
        }
      } else if (isSolicitando(st)) {
        gOpen = null // Si regresa a solicitud, el ciclo de Gilat en curso queda descartado
        if (!cOpen) cOpen = ev
      } else {
        // Cualquier otro estado (Pendiente, Descartado, Crítico, Pre-validado): descarta ciclos abiertos
        gOpen = null
        cOpen = null
      }
    }

    // Atribución del último ciclo con el revisor vigente de la observación (el historial guarda
    // al usuario COVEPA de sesión, no siempre al auditor Gilat que dictaminó)
    if (lastGilatCycle && !lastGilatCycle.auditor && obsMatch) {
      const mismoEstado = String(obsMatch.estado_covepa || '').trim().toLowerCase() ===
        String(lastGilatCycle.estadoCierre || '').trim().toLowerCase()
      if (mismoEstado && esRevisorGilat(obsMatch.revisor)) {
        lastGilatCycle.auditor = obsMatch.revisor
      } else if (mismoEstado && obsMatch.revisor && !esRevisorGilat(obsMatch.revisor)) {
        lastGilatCycle.esDictamenCovepa = true
      }
    }

    gilatCycles.forEach(c => {
      if (c.esDictamenCovepa) {
        ciclosGilatExcluidosCovepa++
        return
      }
      allGilatTimes.push(c.hrs)
      allGilatTimesContrato.push(c.hrsContrato)
      if (c.auditor) {
        if (!auditorTimes[c.auditor]) auditorTimes[c.auditor] = []
        auditorTimes[c.auditor].push(c.hrs)
      }
    })
  })


  // 4. Filtrar observaciones dictaminadas por revisores de Gilat
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

  // 5. Análisis de Colas de Espera Diferenciadas
  // A) Cola Gilat: Observaciones actualmente en 'En Revisión' (esperando dictamen formal de Gilat)
  const enColaGilat = allObs.filter(o => isEnRevision(o.estado_covepa))

  // B) Cola COVEPA: Observaciones en 'Solicitando Revisión' o 'Documentación' (en gestión interna de COVEPA)
  const enColaCovepa = allObs.filter(o => isSolicitando(o.estado_covepa) || isDocumentacion(o.estado_covepa))

  const now = new Date()
  const hoyLima = getLimaDateStr(now)

  const buildColaItems = (obsList, findEventFn, origenCola) => {
    return obsList.map(o => {
      const hist = obsHistory[o.id_obs] || []
      const ev = findEventFn(hist)
      const entryDate = ev ? new Date(ev.created_at) : (o.fecha_subsanacion ? new Date(o.fecha_subsanacion) : null)
      const waitHrs = entryDate ? Math.max(0, (now - entryDate) / (1000 * 3600)) : 0
      const sitioInfo = sitiosMap[o.id_sitio] || {}

      return {
        ...o,
        localidad: sitioInfo.localidad || sitioInfo.nombre_nodo || '—',
        waitHrs: Number(waitHrs.toFixed(1)),
        waitDays: Number((waitHrs / 24).toFixed(1)),
        entryDate: entryDate ? entryDate.toISOString() : null,
        origenCola
      }
    }).sort((a, b) => b.waitHrs - a.waitHrs)
  }

  const colaGilatDetalle = buildColaItems(enColaGilat, hist =>
    hist.slice().reverse().find(h => isEnRevision(h.estado_nuevo)),
    'gilat'
  )

  const colaCovepaDetalle = buildColaItems(enColaCovepa, hist =>
    hist.slice().reverse().find(h => isSolicitando(h.estado_nuevo) || isDocumentacion(h.estado_nuevo)),
    'covepa'
  )

  const mayorEspera = colaGilatDetalle.length > 0 ? colaGilatDetalle[0] : null
  const mayorEsperaCovepa = colaCovepaDetalle.length > 0 ? colaCovepaDetalle[0] : null

  // 6. Análisis Diario (Serie Temporal y Velocidad por Día)
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
    const r = o.revisor || 'Desconocido'
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

  // 7. Productividad y Desempeño por Auditor de Gilat
  const auditorsMap = {}
  gilatDictaminadas.forEach(o => {
    const r = o.revisor || 'Gilat Networks'
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
    const times = auditorTimes[a.nombre] || []
    const avgH = times.length > 0 ? (times.reduce((x, y) => x + y, 0) / times.length) : null
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
      tiempoPromedioHoras: avgH !== null ? Number(avgH.toFixed(1)) : null,
      tiempoPromedioDias: avgH !== null ? Number((avgH / 24).toFixed(1)) : null,
      diasActivos,
      ritmoDiario: ritmo,
      ultimaFecha: a.ultimaFecha,
      activoHoy: isHoy,
      activoEstaSemana: isSemana
    }
  }).sort((a, b) => b.total - a.total)

  const avgGilatTurnaround = promedio(allGilatTimes)
  const avgCovepaTurnaround = promedio(allCovepaTimes)

  const cicloTotalHoras = avgGilatTurnaround + avgCovepaTurnaround

  const hoyItem = dailyMap[hoyLima]
  const diasActivosTotales = sortedDates.length || 1
  const velocidadPromedio = Number((totalDictaminadas / diasActivosTotales).toFixed(1))

  const result = {
    kpis: {
      totalDictaminadas,
      totalValidadas,
      totalRechazadas,
      tasaAprobacion,
      tiempoPromedioHoras: Number(avgGilatTurnaround.toFixed(1)),
      tiempoPromedioDias: Number((avgGilatTurnaround / 24).toFixed(1)),
      tiempoMedianaHoras: Number(percentil(allGilatTimes, 0.5).toFixed(1)),
      tiempoP90Horas: Number(percentil(allGilatTimes, 0.9).toFixed(1)),
      tiempoContratoMedianaHoras: Number(percentil(allGilatTimesContrato, 0.5).toFixed(1)),
      ciclosGilatMedidos: allGilatTimes.length,
      ciclosGilatExcluidosCovepa,
      tiempoCovepaMedianaHoras: Number(percentil(allCovepaTimes, 0.5).toFixed(1)),
      tiempoCovepaP90Horas: Number(percentil(allCovepaTimes, 0.9).toFixed(1)),
      tiempoCovepaContratoMedianaHoras: Number(percentil(allCovepaTimesContrato, 0.5).toFixed(1)),
      ciclosCovepaMedidos: allCovepaTimes.length,
      tiempoCovepaHoras: Number(avgCovepaTurnaround.toFixed(1)),
      tiempoCovepaDias: Number((avgCovepaTurnaround / 24).toFixed(1)),
      cicloTotalHoras: Number(cicloTotalHoras.toFixed(1)),
      cicloTotalDias: Number((cicloTotalHoras / 24).toFixed(1)),
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
        waitDays: mayorEspera.waitDays,
        entryDate: mayorEspera.entryDate
      } : null,
      mayorEsperaCovepa: mayorEsperaCovepa ? {
        id_obs: mayorEsperaCovepa.id_obs,
        id_sitio: mayorEsperaCovepa.id_sitio,
        localidad: mayorEsperaCovepa.localidad,
        waitHrs: mayorEsperaCovepa.waitHrs,
        waitDays: mayorEsperaCovepa.waitDays,
        entryDate: mayorEsperaCovepa.entryDate
      } : null
    },
    serieDiaria,
    rankingAuditores,
    colaDetalle: colaGilatDetalle.slice(0, 30),
    colaCovepaDetalle: colaCovepaDetalle.slice(0, 30)
  }

  gilatMetricsCache = result
  gilatMetricsCacheTime = Date.now()
  return result
}

