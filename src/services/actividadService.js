import { supabase } from '../lib/supabase'
import { ASIGNACIONES_BASE } from './sitiosService'
import { getSitiosCatalogMap } from './dashboardService'

/**
 * Formatea un timestamp ISO a hora legible en formato Perú (UTC-5)
 * Ej: "09:41 AM"
 */
export function formatHoraPeru(isoString) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase()
  } catch {
    return '—'
  }
}

/**
 * Retorna el tiempo transcurrido relativo (ej: "Hace 15 min", "Hace 2 h")
 */
export function getTiempoRelativo(isoString) {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return 'Hace un momento'
    if (diffMin === 1) return 'Hace 1 min'
    if (diffMin < 60) return `Hace ${diffMin} min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH === 1) return 'Hace 1 hora'
    if (diffH < 24) return `Hace ${diffH} h`
    const diffD = Math.floor(diffH / 24)
    if (diffD === 1) return 'Ayer'
    return `Hace ${diffD} días`
  } catch {
    return ''
  }
}

/**
 * Obtiene la línea de actividad cronológica de un técnico para una fecha o jornada determinada.
 * Combina eventos de `historial_estados_observaciones` y registros activos de `observaciones`.
 *
 * @param {Object} params
 * @param {string} [params.nombreTecnico] - Nombre completo del técnico
 * @param {string} params.fecha - Fecha en formato 'YYYY-MM-DD'
 * @param {Array<string>} [params.siteIds] - Lista de códigos de sitio asignados
 * @param {string} [params.cuadrilla] - Cuadrilla oficial (ej: 'CUADRILLA 1')
 * @returns {Promise<{ events: Array, summary: Object }>}
 */
export async function getTimelineActividadTecnico({
  nombreTecnico = '',
  fecha,
  siteIds = [],
  cuadrilla = null
}) {
  if (!fecha) return { events: [], summary: { total: 0, solicitudes: 0, sitiosCount: 0, ultimaHora: '—' } }

  const startIso = `${fecha}T00:00:00`
  const endIso = `${fecha}T23:59:59`

  // 1. Determinar lista de sitios asociados
  let resolvedSiteIds = Array.isArray(siteIds) ? [...siteIds] : []

  if (resolvedSiteIds.length === 0 && cuadrilla) {
    const cClean = String(cuadrilla).toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
    resolvedSiteIds = ASIGNACIONES_BASE
      .filter(s => (s.cuadrilla || s.grupo || '').toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim() === cClean)
      .map(s => s.id_site)
  }

  // 2. Obtener catálogo para resolver nombres y localidades de sitios
  let sitiosCatalog = {}
  try {
    sitiosCatalog = await getSitiosCatalogMap()
  } catch (err) {
    console.warn('[TIMELINE] Aviso obteniendo catálogo de sitios:', err)
  }

  const getLoc = (idSitio) => {
    return sitiosCatalog[idSitio]?.localidad ||
      sitiosCatalog[idSitio]?.nombre_nodo ||
      ASIGNACIONES_BASE.find(s => s.id_site === idSitio)?.localidad ||
      ''
  }

  try {
    // 3. Consultas en paralelo a historial y observaciones
    let histQuery = supabase
      .from('historial_estados_observaciones')
      .select('*')
      .gte('created_at', startIso)
      .lte('created_at', endIso)

    if (resolvedSiteIds.length > 0) {
      histQuery = histQuery.in('id_sitio', resolvedSiteIds)
    } else if (nombreTecnico) {
      histQuery = histQuery.ilike('usuario_nombre', `%${nombreTecnico.trim()}%`)
    }

    let obsQuery = null
    if (resolvedSiteIds.length > 0) {
      obsQuery = supabase
        .from('observaciones')
        .select('id_obs, id_sitio, estado_covepa, fecha_subsanacion, revisor, detalle, subsistema, protocolo, comentario_covepa')
        .in('id_sitio', resolvedSiteIds)
        .or(`fecha_subsanacion.gte.${startIso},estado_covepa.eq.Solicitando Revision,estado_covepa.eq.Solicitando Revisión`)
    }

    const [histRes, obsRes] = await Promise.all([
      histQuery.order('created_at', { ascending: true }),
      obsQuery ? obsQuery : Promise.resolve({ data: [] })
    ])

    const histRows = histRes.data || []
    const obsRows = (obsRes && obsRes.data) ? obsRes.data : []

    // 4. Reconstrucción integral de la trazabilidad (Ciclo de Vida) por observación
    // Etapas: 1. Solicitó Revisión -> 2. En Revisión -> 3. Validada / Rechazada
    const lifecycleMap = new Map()
    const getOrCreateLc = (idObs) => {
      if (!lifecycleMap.has(idObs)) {
        lifecycleMap.set(idObs, { solicitado: null, enRevision: null, validado: null, rechazado: null })
      }
      return lifecycleMap.get(idObs)
    }

    // 4.1. Registrar transiciones desde el historial oficial de estados
    histRows.forEach(h => {
      const lc = getOrCreateLc(h.id_obs)
      const item = {
        ts: h.created_at,
        hora: formatHoraPeru(h.created_at),
        timeAgo: getTiempoRelativo(h.created_at),
        usuario: h.usuario_nombre || 'Auditor / Técnico',
        comentario: h.comentario || null
      }
      const stNuevo = String(h.estado_nuevo || '').trim()
      const stAnt = String(h.estado_anterior || '').trim()

      if (stNuevo === 'Solicitando Revisión' || stNuevo === 'Solicitando Revision') {
        if (!lc.solicitado || new Date(h.created_at) > new Date(lc.solicitado.ts)) {
          lc.solicitado = item
        }
      } else if ((stAnt === 'Solicitando Revisión' || stAnt === 'Solicitando Revision') && !lc.solicitado) {
        lc.solicitado = item
      }

      if (stNuevo === 'En Revisión' || stNuevo === 'En Revision') {
        if (!lc.enRevision || new Date(h.created_at) > new Date(lc.enRevision.ts)) {
          lc.enRevision = item
        }
      }

      if (stNuevo === 'Validado') {
        if (!lc.validado || new Date(h.created_at) > new Date(lc.validado.ts)) {
          lc.validado = item
        }
      }

      if (stNuevo === 'Rechazado') {
        if (!lc.rechazado || new Date(h.created_at) > new Date(lc.rechazado.ts)) {
          lc.rechazado = item
        }
      }
    })

    // 4.2. Enriquecer con registros activos de observaciones
    obsRows.forEach(o => {
      const lc = getOrCreateLc(o.id_obs)
      const stNorm = String(o.estado_covepa || '').trim()
      const isSol = stNorm === 'Solicitando Revisión' || stNorm === 'Solicitando Revision'

      if (isSol && !lc.solicitado) {
        const ts = o.fecha_subsanacion || new Date().toISOString()
        lc.solicitado = {
          ts,
          hora: formatHoraPeru(ts),
          timeAgo: getTiempoRelativo(ts),
          usuario: nombreTecnico || 'Técnico de Cuadrilla'
        }
      }

      if ((stNorm === 'En Revisión' || stNorm === 'En Revision') && !lc.enRevision) {
        const ts = o.fecha_subsanacion || new Date().toISOString()
        lc.enRevision = {
          ts,
          hora: formatHoraPeru(ts),
          timeAgo: getTiempoRelativo(ts),
          usuario: o.revisor || 'Auditor COVEPA'
        }
      }

      if (stNorm === 'Validado' && o.fecha_subsanacion && !lc.validado) {
        lc.validado = {
          ts: o.fecha_subsanacion,
          hora: formatHoraPeru(o.fecha_subsanacion),
          timeAgo: getTiempoRelativo(o.fecha_subsanacion),
          usuario: o.revisor || 'Auditor COVEPA'
        }
      }
    })

    // 4.3. Consolidar eventos de línea de tiempo evitando duplicados
    const eventMap = new Map()

    histRows.forEach(h => {
      const isSolicitud = h.estado_nuevo === 'Solicitando Revisión' ||
        h.estado_anterior === 'Solicitando Revisión' ||
        h.estado_nuevo === 'En Revisión'

      const uniqueKey = `hist-${h.id_obs}-${h.created_at}`
      eventMap.set(uniqueKey, {
        id: h.id || uniqueKey,
        id_obs: h.id_obs,
        id_sitio: h.id_sitio,
        localidad: getLoc(h.id_sitio),
        estado: h.estado_nuevo,
        estadoAnterior: h.estado_anterior,
        timestamp: h.created_at,
        hora: formatHoraPeru(h.created_at),
        timeAgo: getTiempoRelativo(h.created_at),
        comentario: h.comentario || null,
        usuario: h.usuario_nombre || nombreTecnico || 'Técnico de Cuadrilla',
        origen: h.origen || 'app_fotos',
        isSolicitud,
        detalle: null,
        subsistema: null,
        lifecycle: lifecycleMap.get(h.id_obs) || { solicitado: null, enRevision: null, validado: null, rechazado: null }
      })
    })

    // 4.4. Observaciones activas que están actualmente solicitando revisión o fueron subsanadas en el día
    obsRows.forEach(o => {
      const stNorm = String(o.estado_covepa || '').trim()
      const isSolicitandoActiva = stNorm === 'Solicitando Revisión' || stNorm === 'Solicitando Revision'

      // Si ya tenemos un evento del historial reciente para esta obs a la misma fecha, enriquecerlo
      let matched = false
      for (const [k, ev] of eventMap.entries()) {
        if (ev.id_obs === o.id_obs) {
          ev.detalle = o.detalle
          ev.subsistema = o.subsistema
          ev.protocolo = o.protocolo
          if (o.comentario_covepa && !ev.comentario) {
            ev.comentario = o.comentario_covepa
          }
          matched = true
          break
        }
      }

      // Si no estaba en historial pero tiene fecha_subsanacion o está solicitando activamente, agregar hito
      if (!matched && (isSolicitandoActiva || o.fecha_subsanacion)) {
        const ts = o.fecha_subsanacion || new Date().toISOString()
        const uniqueKey = `obs-${o.id_obs}-${ts}`
        eventMap.set(uniqueKey, {
          id: uniqueKey,
          id_obs: o.id_obs,
          id_sitio: o.id_sitio,
          localidad: getLoc(o.id_sitio),
          estado: isSolicitandoActiva ? 'Solicitando Revisión' : (stNorm || 'Validado'),
          estadoAnterior: 'Pendiente',
          timestamp: ts,
          hora: formatHoraPeru(ts),
          timeAgo: getTiempoRelativo(ts),
          comentario: o.comentario_covepa || null,
          usuario: o.revisor || nombreTecnico || 'Técnico de Cuadrilla',
          origen: 'campo',
          isSolicitud: isSolicitandoActiva,
          detalle: o.detalle || '',
          subsistema: o.subsistema || '',
          protocolo: o.protocolo || '',
          lifecycle: lifecycleMap.get(o.id_obs) || { solicitado: null, enRevision: null, validado: null, rechazado: null }
        })
      }
    })

    // 5. Ordenar cronológicamente (de la mañana a la tarde: ascendente por timestamp)
    const events = Array.from(eventMap.values()).sort((a, b) => {
      const ta = new Date(a.timestamp).getTime() || 0
      const tb = new Date(b.timestamp).getTime() || 0
      return ta - tb
    })

    // 6. Resumen de métricas del timeline y última solicitud de revisión
    const solicitudes = events.filter(e => e.isSolicitud || e.estado === 'Solicitando Revisión').length
    const sitiosSet = new Set(events.map(e => e.id_sitio).filter(Boolean))
    const ultimaHora = events.length > 0 ? events[events.length - 1].hora : '—'

    let ultimaSolicitud = null
    for (const lc of lifecycleMap.values()) {
      if (lc.solicitado && (!ultimaSolicitud || new Date(lc.solicitado.ts) > new Date(ultimaSolicitud.ts))) {
        ultimaSolicitud = lc.solicitado
      }
    }

    return {
      events,
      summary: {
        total: events.length,
        solicitudes,
        sitiosCount: sitiosSet.size,
        ultimaHora,
        ultimaSolicitud
      }
    }
  } catch (err) {
    console.error('[TIMELINE-ERROR] Error al consultar línea de actividad:', err)
    return {
      events: [],
      summary: { total: 0, solicitudes: 0, sitiosCount: 0, ultimaHora: '—' }
    }
  }
}

/**
 * Obtiene el mapa del último reporte registrado por sitio y cuadrilla para una fecha dada.
 * Retorna tanto la última actividad general como la última solicitud de revisión específica.
 * Retorna {
 *   bySite, byCuadrilla, byUser,
 *   bySiteSolicitud, byCuadrillaSolicitud, byUserSolicitud
 * }
 */
export async function fetchUltimosReportesDelDia(fecha) {
  if (!fecha) {
    return {
      bySite: {},
      byCuadrilla: {},
      byUser: {},
      bySiteSolicitud: {},
      byCuadrillaSolicitud: {},
      byUserSolicitud: {}
    }
  }

  const startIso = `${fecha}T00:00:00`
  const endIso = `${fecha}T23:59:59`

  try {
    const [hRes, oRes] = await Promise.all([
      supabase
        .from('historial_estados_observaciones')
        .select('id_obs, id_sitio, created_at, usuario_nombre, estado_anterior, estado_nuevo')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false }),
      supabase
        .from('observaciones')
        .select('id_obs, id_sitio, fecha_subsanacion, revisor, estado_covepa')
        .or(`fecha_subsanacion.gte.${startIso},estado_covepa.eq.Solicitando Revision,estado_covepa.eq.Solicitando Revisión`)
        .order('fecha_subsanacion', { ascending: false })
    ])

    const bySite = {}
    const byCuadrilla = {}
    const byUser = {}

    const bySiteSolicitud = {}
    const byCuadrillaSolicitud = {}
    const byUserSolicitud = {}

    // Mapeo sitio -> cuadrilla base
    const siteCuadMap = {}
    ASIGNACIONES_BASE.forEach(s => {
      const c = (s.cuadrilla || s.grupo || '').toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
      siteCuadMap[s.id_site] = c
    })

    const recordEvent = (siteId, ts, obs, user, isSolicitud = false) => {
      if (!ts) return

      const payload = {
        ts,
        hora: formatHoraPeru(ts),
        timeAgo: getTiempoRelativo(ts),
        obs,
        user,
        siteId,
        isSolicitud
      }

      // 1. General por sitio
      if (siteId) {
        const existing = bySite[siteId]
        if (!existing || new Date(ts) > new Date(existing.ts)) {
          bySite[siteId] = payload
        }

        const cName = siteCuadMap[siteId]
        if (cName) {
          const existingCuad = byCuadrilla[cName]
          if (!existingCuad || new Date(ts) > new Date(existingCuad.ts)) {
            byCuadrilla[cName] = payload
          }
        }
      }

      // 2. General por usuario
      if (user) {
        const uKey = String(user).trim().toUpperCase()
        const existingUser = byUser[uKey]
        if (!existingUser || new Date(ts) > new Date(existingUser.ts)) {
          byUser[uKey] = payload
        }
      }

      // 3. Específico de Solicitud de Revisión
      if (isSolicitud) {
        if (siteId) {
          const existingSolSite = bySiteSolicitud[siteId]
          if (!existingSolSite || new Date(ts) > new Date(existingSolSite.ts)) {
            bySiteSolicitud[siteId] = payload
          }

          const cName = siteCuadMap[siteId]
          if (cName) {
            const existingSolCuad = byCuadrillaSolicitud[cName]
            if (!existingSolCuad || new Date(ts) > new Date(existingSolCuad.ts)) {
              byCuadrillaSolicitud[cName] = payload
            }
          }
        }

        if (user) {
          const uKey = String(user).trim().toUpperCase()
          const existingSolUser = byUserSolicitud[uKey]
          if (!existingSolUser || new Date(ts) > new Date(existingSolUser.ts)) {
            byUserSolicitud[uKey] = payload
          }
        }
      }
    }

    ;(hRes.data || []).forEach(h => {
      const stNuevo = String(h.estado_nuevo || '').trim()
      const stAnt = String(h.estado_anterior || '').trim()
      const isSol = stNuevo === 'Solicitando Revisión' ||
        stNuevo === 'Solicitando Revision' ||
        ((stAnt === 'Solicitando Revisión' || stAnt === 'Solicitando Revision') && (stNuevo === 'En Revisión' || stNuevo === 'En Revision'))

      recordEvent(h.id_sitio, h.created_at, h.id_obs, h.usuario_nombre, isSol)
    })

    ;(oRes.data || []).forEach(o => {
      const stNorm = String(o.estado_covepa || '').trim()
      const isObsSol = stNorm === 'Solicitando Revisión' || stNorm === 'Solicitando Revision'
      const ts = o.fecha_subsanacion || (isObsSol ? new Date().toISOString() : null)

      if (ts) {
        recordEvent(o.id_sitio, ts, o.id_obs, o.revisor, isObsSol)
      }
    })

    return {
      bySite,
      byCuadrilla,
      byUser,
      bySiteSolicitud,
      byCuadrillaSolicitud,
      byUserSolicitud
    }
  } catch (err) {
    console.error('[REPORTES-ERROR] Error al consultar últimos reportes del día:', err)
    return {
      bySite: {},
      byCuadrilla: {},
      byUser: {},
      bySiteSolicitud: {},
      byCuadrillaSolicitud: {},
      byUserSolicitud: {}
    }
  }
}

