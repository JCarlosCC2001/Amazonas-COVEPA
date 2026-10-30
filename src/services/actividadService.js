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

  // Rango del día calibrado en horario Perú (UTC-5)
  const startIso = new Date(`${fecha}T00:00:00-05:00`).toISOString()
  const endIso = new Date(`${fecha}T23:59:59-05:00`).toISOString()

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

    const obsMap = new Map()
    obsRows.forEach(o => obsMap.set(o.id_obs, o))

    // 4. Reconstrucción integral de la trazabilidad (Ciclo de Vida) por observación
    const lifecycleMap = new Map()
    const getOrCreateLc = (idObs) => {
      if (!lifecycleMap.has(idObs)) {
        lifecycleMap.set(idObs, { solicitado: null, enRevision: null, validado: null, rechazado: null })
      }
      return lifecycleMap.get(idObs)
    }

    // 4.1. Mapear ciclo de vida desde historial
    histRows.forEach(h => {
      const lc = getOrCreateLc(h.id_obs)
      const item = {
        ts: h.created_at,
        hora: formatHoraPeru(h.created_at),
        timeAgo: getTiempoRelativo(h.created_at),
        usuario: h.usuario_nombre || 'Auditor COVEPA',
        comentario: h.comentario || null
      }
      const stNuevo = String(h.estado_nuevo || '').trim()
      const stAnt = String(h.estado_anterior || '').trim()

      if (stNuevo === 'Solicitando Revisión' || stNuevo === 'Solicitando Revision') {
        if (!lc.solicitado || new Date(h.created_at) > new Date(lc.solicitado.ts)) {
          lc.solicitado = item
        }
      } else if ((stAnt === 'Solicitando Revisión' || stAnt === 'Solicitando Revision') && !lc.solicitado) {
        const o = obsMap.get(h.id_obs)
        const tsSol = (o && o.fecha_subsanacion && new Date(o.fecha_subsanacion) <= new Date(h.created_at))
          ? o.fecha_subsanacion
          : null
        lc.solicitado = {
          ts: tsSol,
          hora: formatHoraPeru(tsSol),
          timeAgo: getTiempoRelativo(tsSol),
          usuario: nombreTecnico || 'Técnico de Cuadrilla'
        }
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

    // Enriquecer con registros activos de observaciones
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
    })

    // 4.2. Construir lista cronológica de eventos distinguiendo Solicitud vs Paso a Revisión vs Dictamen
    const events = []
    const addedSolObs = new Set()

    histRows.forEach(h => {
      const o = obsMap.get(h.id_obs)
      const stAnt = String(h.estado_anterior || '').trim()
      const stNue = String(h.estado_nuevo || '').trim()
      const lc = lifecycleMap.get(h.id_obs)

      // 4.2.1. Si venía de Solicitando Revisión o es una solicitud explícita, registrar hito de SOLICITUD
      const veniaDeSolicitud = stAnt === 'Solicitando Revisión' || stAnt === 'Solicitando Revision'
      const esNuevaSolicitud = stNue === 'Solicitando Revisión' || stNue === 'Solicitando Revision'

      if ((veniaDeSolicitud || esNuevaSolicitud) && !addedSolObs.has(h.id_obs)) {
        addedSolObs.add(h.id_obs)
        let tsSol = (o && o.fecha_subsanacion) ? o.fecha_subsanacion : null
        if (!tsSol || new Date(tsSol) > new Date(h.created_at)) {
          tsSol = null
        }

        events.push({
          id: `sol-${h.id_obs}-${tsSol}`,
          id_obs: h.id_obs,
          id_sitio: h.id_sitio,
          localidad: getLoc(h.id_sitio),
          tipo: 'SOLICITUD',
          estado: 'Solicitando Revisión',
          estadoAnterior: 'Pendiente',
          timestamp: tsSol,
          hora: formatHoraPeru(tsSol),
          timeAgo: getTiempoRelativo(tsSol),
          comentario: (o && o.comentario_covepa) || null,
          usuario: nombreTecnico || 'Técnico de Cuadrilla',
          origen: 'campo',
          isSolicitud: true,
          accionLabel: 'Solicitó revisión de campo',
          badgeLabel: '⏳ Solicitó Revisión',
          badgeClass: 'solicitud',
          detalle: o?.detalle || '',
          subsistema: o?.subsistema || '',
          protocolo: o?.protocolo || '',
          lifecycle: lc
        })
      }

      // 4.2.2. Evento del cambio actual registrado en el historial
      const horaEv = formatHoraPeru(h.created_at)
      const timeAgoEv = getTiempoRelativo(h.created_at)
      let tipo = 'CAMBIO'
      let accionLabel = `Se actualizó a: ${stNue}`
      let badgeLabel = stNue
      let badgeClass = 'pendiente'

      if (stNue === 'En Revisión' || stNue === 'En Revision') {
        tipo = 'EN_REVISION'
        accionLabel = 'Pasó a En Revisión (Auditoría)'
        badgeLabel = '🔍 Pasó a En Revisión'
        badgeClass = 'revision'
      } else if (stNue === 'Validado') {
        tipo = 'VALIDADO'
        accionLabel = 'Dictamen: Validada'
        badgeLabel = '✓ Validada'
        badgeClass = 'validado'
      } else if (stNue === 'Rechazado') {
        tipo = 'RECHAZADO'
        accionLabel = 'Dictamen: Rechazada'
        badgeLabel = '✕ Rechazada'
        badgeClass = 'rechazado'
      } else if (stNue === 'Solicitando Revisión' || stNue === 'Solicitando Revision') {
        tipo = 'SOLICITUD'
        accionLabel = 'Solicitó revisión de campo'
        badgeLabel = '⏳ Solicitó Revisión'
        badgeClass = 'solicitud'
      }

      events.push({
        id: h.id || `hist-${h.id_obs}-${h.created_at}`,
        id_obs: h.id_obs,
        id_sitio: h.id_sitio,
        localidad: getLoc(h.id_sitio),
        tipo,
        estado: stNue,
        estadoAnterior: stAnt,
        timestamp: h.created_at,
        hora: horaEv,
        timeAgo: timeAgoEv,
        comentario: h.comentario || (o && o.comentario_covepa) || null,
        usuario: h.usuario_nombre || 'Auditor COVEPA',
        origen: h.origen || 'observaciones',
        isSolicitud: tipo === 'SOLICITUD',
        accionLabel,
        badgeLabel,
        badgeClass,
        detalle: o?.detalle || '',
        subsistema: o?.subsistema || '',
        protocolo: o?.protocolo || '',
        lifecycle: lc
      })
    })

    // 4.3. Observaciones activas que están actualmente solicitando revisión y no estaban en el historial de hoy
    obsRows.forEach(o => {
      const stNorm = String(o.estado_covepa || '').trim()
      const isSol = stNorm === 'Solicitando Revisión' || stNorm === 'Solicitando Revision'

      if (isSol && !addedSolObs.has(o.id_obs)) {
        addedSolObs.add(o.id_obs)
        const ts = o.fecha_subsanacion || new Date().toISOString()
        const lc = lifecycleMap.get(o.id_obs)

        events.push({
          id: `obs-sol-${o.id_obs}-${ts}`,
          id_obs: o.id_obs,
          id_sitio: o.id_sitio,
          localidad: getLoc(o.id_sitio),
          tipo: 'SOLICITUD',
          estado: 'Solicitando Revisión',
          estadoAnterior: 'Pendiente',
          timestamp: ts,
          hora: formatHoraPeru(ts),
          timeAgo: getTiempoRelativo(ts),
          comentario: o.comentario_covepa || null,
          usuario: nombreTecnico || 'Técnico de Cuadrilla',
          origen: 'campo',
          isSolicitud: true,
          accionLabel: 'Solicitó revisión de campo',
          badgeLabel: '⏳ Solicitó Revisión',
          badgeClass: 'solicitud',
          detalle: o.detalle || '',
          subsistema: o.subsistema || '',
          protocolo: o.protocolo || '',
          lifecycle: lc
        })
      }
    })

    // 5. Ordenar cronológicamente (ascendente por timestamp)
    events.sort((a, b) => {
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

  const startIso = new Date(`${fecha}T00:00:00-05:00`).toISOString()
  const endIso = new Date(`${fecha}T23:59:59-05:00`).toISOString()

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
      const isSol = stNuevo === 'Solicitando Revisión' || stNuevo === 'Solicitando Revision'

      recordEvent(h.id_sitio, h.created_at, h.id_obs, h.usuario_nombre, isSol)
    })

    ;(oRes.data || []).forEach(o => {
      const stNorm = String(o.estado_covepa || '').trim()
      const isObsSol = stNorm === 'Solicitando Revisión' || stNorm === 'Solicitando Revision'
      const ts = o.fecha_subsanacion || null

      if (ts) {
        recordEvent(o.id_sitio, ts, o.id_obs, isObsSol ? null : o.revisor, isObsSol)
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

