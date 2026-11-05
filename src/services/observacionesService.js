import { supabase } from '../lib/supabase'
import {
  sincronizarAuditoriaObservacion,
  sincronizarComentarioObservacion,
  sincronizarJustificacionDemora,
  sincronizarTiemposEjecucion,
  enviarTiemposYDemoras,
  normalizarEstadoOficial,
  resolverNombreAuditor,
  sincronizarEstadoConControlFotos,
  fetchHistorialObservacion,
  fetchUltimoCambioObservacion,
  registrarHistorialEstado,
  esRevisorGilat
} from './auditoriaSyncService'
import { asegurarProgramacionSitio } from './programacionService'
import { getPeruDateStr, getPeruISOString } from '../utils/helpers'

export {
  sincronizarAuditoriaObservacion,
  sincronizarComentarioObservacion,
  sincronizarJustificacionDemora,
  sincronizarTiemposEjecucion,
  enviarTiemposYDemoras,
  normalizarEstadoOficial,
  resolverNombreAuditor,
  sincronizarEstadoConControlFotos,
  fetchHistorialObservacion,
  fetchUltimoCambioObservacion,
  registrarHistorialEstado,
  esRevisorGilat
}

const PAGE_SIZE_MAX = 1000

// Helper para construir la expresión de búsqueda flexible
// Soporta singular/plural (p. ej. "medidores" -> busca también "medidor")
function buildSearchOr(search) {
  if (!search) return null
  const clean = search.trim()
  if (!clean) return null

  const terms = [clean]
  if (clean.endsWith('es') && clean.length > 4) {
    terms.push(clean.slice(0, -2))
  } else if (clean.endsWith('s') && clean.length > 3) {
    terms.push(clean.slice(0, -1))
  }

  const columns = ['id_obs', 'id_sitio', 'detalle', 'subsistema', 'protocolo', 'item', 'sub_item', 'justificacion_demora']
  const parts = []
  for (const t of terms) {
    for (const col of columns) {
      parts.push(`${col}.ilike.%${t}%`)
    }
  }
  return parts.join(',')
}

// Aplica los filtros activos a una consulta de Supabase (exclusivo para COVEPA)
function applyQueryFilters(query, {
  search = '',
  protocolo = '',
  estadoCovepa = '',
  idSitio = '',
  idSitios = null,
  filtroDemora = ''
} = {}) {
  const searchOr = buildSearchOr(search)
  if (searchOr) query = query.or(searchOr)
  if (protocolo)      query = query.eq('protocolo', protocolo)
  if (estadoCovepa) {
    if (estadoCovepa === 'Pendiente') {
      query = query.or('estado_covepa.eq.Pendiente,estado_covepa.is.null')
    } else {
      query = query.eq('estado_covepa', estadoCovepa)
    }
  }
  if (idSitio)        query = query.eq('id_sitio', idSitio)
  if (idSitios && Array.isArray(idSitios) && idSitios.length > 0) {
    query = query.in('id_sitio', idSitios)
  }
  if (filtroDemora === 'CON_DEMORA') {
    query = query.not('justificacion_demora', 'is', null).neq('justificacion_demora', '')
  } else if (filtroDemora === 'SIN_DEMORA') {
    query = query.or('justificacion_demora.is.null,justificacion_demora.eq.')
  }
  return query
}

// Helper para traer todos los registros de una consulta en bloques de 1,000 en paralelo
async function fetchAllRowsInBatches(tableName, selectColumns, filters = {}) {
  const countQuery = applyQueryFilters(
    supabase.from(tableName).select('*', { count: 'exact', head: true }),
    filters
  )
  const { count, error: countErr } = await countQuery
  if (countErr) throw new Error(countErr.message)

  const total = count || 0
  if (total === 0) return []

  const numBatches = Math.ceil(total / PAGE_SIZE_MAX)
  const promises = []

  for (let i = 0; i < numBatches; i++) {
    const from = i * PAGE_SIZE_MAX
    const to = Math.min((i + 1) * PAGE_SIZE_MAX - 1, total - 1)
    let q = supabase.from(tableName).select(selectColumns)
    q = applyQueryFilters(q, filters)
    q = q.range(from, to)
    promises.push(q)
  }

  const results = await Promise.all(promises)
  const allRows = []
  for (const res of results) {
    if (res.error) throw new Error(res.error.message)
    if (res.data) allRows.push(...res.data)
  }
  return allRows
}

// ────────────────────────────────────────────────────────────
// 1. Obtiene observaciones con filtros aplicados y paginación
// ────────────────────────────────────────────────────────────
export async function fetchObservaciones({ 
  search = '', 
  protocolo = '', 
  estadoCovepa = '', 
  idSitio = '',
  idSitios = null,
  filtroDemora = '',
  page = 1,
  pageSize = 20,
  sortBy = 'id_obs',
  sortOrder = 'asc'
} = {}) {
  let query = supabase
    .from('observaciones')
    .select('id_obs,hito,id_sitio,protocolo,subsistema,detalle,item,sub_item,estado_gilat,estado_covepa,estado_pronatel,comentario_covepa,fecha_subsanacion,revisor,justificacion_demora,fecha_registro_demora,tiempo_ejecucion_real,tiempo_ejecucion_demora', { count: 'exact' })

  query = applyQueryFilters(query, { search, protocolo, estadoCovepa, idSitio, idSitios, filtroDemora })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const isAsc = sortOrder === 'asc'
  const validDbCols = {
    codigo: 'id_obs',
    id_obs: 'id_obs',
    sitio: 'id_sitio',
    id_sitio: 'id_sitio',
    estado: 'estado_covepa',
    estado_covepa: 'estado_covepa',
    fecha: 'fecha_subsanacion',
    fecha_subsanacion: 'fecha_subsanacion',
    revisor: 'revisor',
    demora: 'justificacion_demora',
    justificacion_demora: 'justificacion_demora',
    fecha_demora: 'fecha_registro_demora',
    fecha_registro_demora: 'fecha_registro_demora'
  }

  const dbCol = validDbCols[sortBy] || 'id_obs'
  query = query.order(dbCol, { ascending: isAsc, nullsFirst: false }).range(from, to)

  let { data, count, error } = await query
  if (error && (error.code === 'PGRST204' || error.message?.includes('tiempo_ejecucion'))) {
    // Fallback sin columnas nuevas si aún no se ejecutó la migración SQL
    let fallbackQuery = supabase
      .from('observaciones')
      .select('id_obs,hito,id_sitio,protocolo,subsistema,detalle,item,sub_item,estado_gilat,estado_covepa,estado_pronatel,comentario_covepa,fecha_subsanacion,revisor,justificacion_demora', { count: 'exact' })
    fallbackQuery = applyQueryFilters(fallbackQuery, { search, protocolo, estadoCovepa, idSitio, idSitios, filtroDemora })
    const res = await fallbackQuery.order(dbCol, { ascending: isAsc, nullsFirst: false }).range(from, to)
    data = res.data
    count = res.count
    error = res.error
  }
  if (error) throw new Error(error.message)
  return { data: data || [], count: count || 0 }
}

// ────────────────────────────────────────────────────────────
// 2. Obtiene los KPIs globales de COVEPA (Medidores / Indicadores)
// Siempre calcula los totales globales del proyecto sin verse alterados por filtros de búsqueda o tabla
// Utiliza head: true en paralelo -> exacto, instantáneo y sin límite de 1,000
// ────────────────────────────────────────────────────────────
export async function fetchObservacionesKPIs() {
  try {
    const [qTotal, qPend, qSol, qRev, qValidadas, qRech, qDesc] = await Promise.all([
      supabase.from('observaciones').select('*', { count: 'exact', head: true }),
      supabase.from('observaciones').select('*', { count: 'exact', head: true }).or('estado_covepa.eq.Pendiente,estado_covepa.is.null'),
      supabase.from('observaciones').select('*', { count: 'exact', head: true }).or('estado_covepa.eq.Solicitando Revision,estado_covepa.eq.Solicitando Revisión'),
      supabase.from('observaciones').select('*', { count: 'exact', head: true }).or('estado_covepa.eq.En Revision,estado_covepa.eq.En Revisión'),
      supabase.from('observaciones').select('*', { count: 'exact', head: true }).or('estado_covepa.eq.Validado,estado_covepa.eq.Enviado,and(fecha_subsanacion.not.is.null,estado_covepa.neq.Descartado,estado_covepa.neq.En Revision,estado_covepa.neq.En Revisión,estado_covepa.neq.Solicitando Revision,estado_covepa.neq.Solicitando Revisión,estado_covepa.neq.Rechazado)'),
      supabase.from('observaciones').select('*', { count: 'exact', head: true }).eq('estado_covepa', 'Rechazado'),
      supabase.from('observaciones').select('*', { count: 'exact', head: true }).eq('estado_covepa', 'Descartado'),
    ])

    return {
      total: qTotal.count ?? 0,
      pendientes: qPend.count ?? 0,
      solicitando: qSol.count ?? 0,
      enRevision: qRev.count ?? 0,
      validadas: qValidadas.count ?? 0,
      rechazadas: qRech.count ?? 0,
      descartadas: qDesc.count ?? 0,
    }
  } catch (err) {
    console.error('Error al calcular KPIs globales:', err)
    return { total: 0, pendientes: 0, solicitando: 0, enRevision: 0, validadas: 0, rechazadas: 0, descartadas: 0 }
  }
}

// Caché en memoria para opciones de filtros
let _cachedFiltros = null
let _cachedFiltrosAt = 0
const FILTROS_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutos de caché

export function invalidateFiltrosCache() {
  _cachedFiltros = null
  _cachedFiltrosAt = 0
}

// ────────────────────────────────────────────────────────────
// 3. Obtiene los valores únicos para los filtros de la toolbar
// ────────────────────────────────────────────────────────────
export async function fetchFiltrosObservaciones(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && _cachedFiltros && (now - _cachedFiltrosAt < FILTROS_CACHE_TTL_MS)) {
    return _cachedFiltros
  }

  try {
    const data = await fetchAllRowsInBatches(
      'observaciones',
      'protocolo, estado_covepa, id_sitio'
    )

    const unique = (field) => [...new Set(data.map(d => d[field]).filter(Boolean))].sort()
    const result = {
      protocolos: unique('protocolo'),
      estadosCovepa: unique('estado_covepa'),
      sitios: unique('id_sitio'),
    }
    _cachedFiltros = result
    _cachedFiltrosAt = now
    return result
  } catch (err) {
    console.error('Error al cargar filtros:', err)
    return _cachedFiltros || { protocolos: [], estadosCovepa: [], sitios: [] }
  }
}

// ────────────────────────────────────────────────────────────
// 4. Actualiza y sincroniza los campos de auditoría COVEPA
// (Conectado con el puente de auditoría para la app de fotos de campo)
// ────────────────────────────────────────────────────────────
export async function updateObservacionCovepa(idObs, { estado_covepa, fecha_subsanacion, comentario_covepa, revisor, validado_por, id_sitio, idSitio } = {}, maybeSitio = null) {
  const rev = revisor !== undefined ? revisor : validado_por
  const siteId = idSitio || id_sitio || maybeSitio

  // Si se actualiza el estado de la observación, delegar al puente oficial de auditoría
  if (estado_covepa !== undefined) {
    const res = await sincronizarAuditoriaObservacion(idObs, {
      nuevoEstado: estado_covepa,
      revisor: rev,
      comentarioTexto: comentario_covepa,
      fechaSubsanacion: fecha_subsanacion,
      idSitio: siteId
    })
    return res.data
  }

  // Si sólo se actualiza el comentario sin alterar estado
  if (comentario_covepa !== undefined && estado_covepa === undefined && fecha_subsanacion === undefined) {
    const res = await sincronizarComentarioObservacion(idObs, comentario_covepa, siteId)
    return res.data
  }

  const payload = {}
  if (fecha_subsanacion !== undefined) payload.fecha_subsanacion = fecha_subsanacion || null
  if (comentario_covepa !== undefined) payload.comentario_covepa = comentario_covepa
  if (rev !== undefined) {
    payload.revisor = (rev && esRevisorGilat(rev)) ? String(rev).trim() : null
  }

  let query = supabase
    .from('observaciones')
    .update(payload)
    .eq('id_obs', idObs)

  if (siteId) {
    query = query.eq('id_sitio', siteId)
  }

  const { data, error } = await query
    .select('id_obs, id_sitio, estado_covepa, fecha_subsanacion, revisor, comentario_covepa')
    .single()

  if (error) {
    // Si la columna revisor aún no fue creada en Supabase (error PGRST204), probar con validado_por o sin ella
    if (error.code === 'PGRST204' && payload.revisor !== undefined) {
      delete payload.revisor
      if (rev !== undefined) payload.validado_por = rev || null
      let retryQuery = supabase.from('observaciones').update(payload).eq('id_obs', idObs)
      if (siteId) retryQuery = retryQuery.eq('id_sitio', siteId)
      const retryVal = await retryQuery.select('id_obs, id_sitio, estado_covepa, fecha_subsanacion, revisor, comentario_covepa').single()
      if (!retryVal.error) return retryVal.data

      // Si tampoco existe validado_por, guardar sin ese campo
      delete payload.validado_por
      let retryClean = supabase.from('observaciones').update(payload).eq('id_obs', idObs)
      if (siteId) retryClean = retryClean.eq('id_sitio', siteId)
      const retry = await retryClean.select('id_obs, id_sitio, estado_covepa, fecha_subsanacion, revisor, comentario_covepa').single()
      if (retry.error) throw new Error(retry.error.message)
      return retry.data
    }
    throw new Error(error.message)
  }
  return data
}


// ────────────────────────────────────────────────────────────
// 5. Exporta a CSV todas las observaciones del filtro actual
// ────────────────────────────────────────────────────────────
export async function exportObservacionesCSV(filters = {}) {
  const selectCols = 'id_obs,hito,id_sitio,protocolo,subsistema,detalle,item,sub_item,comentario_inicial,comentario_complementario,comentario_final,acuerdo_subsanacion,estado_gilat,estado_covepa,estado_pronatel,comentario_pronatel,comentario_covepa,fecha_subsanacion,revisor,justificacion_demora,tiempo_ejecucion_real,tiempo_ejecucion_demora'
  const allRows = await fetchAllRowsInBatches('observaciones', selectCols, filters)
  return allRows.sort((a, b) => (a.id_obs || '').localeCompare(b.id_obs || ''))
}

// ────────────────────────────────────────────────────────────
// 6. VISTA AGRUPADA — Paso 1: Resumen por sitio de COVEPA
// ────────────────────────────────────────────────────────────
export async function fetchResumenPorSitio(filters = {}) {
  const data = await fetchAllRowsInBatches('observaciones', 'id_sitio,estado_covepa,fecha_subsanacion', filters)

  const resumen = {}
  for (const row of data) {
    if (!resumen[row.id_sitio]) {
      resumen[row.id_sitio] = { total: 0, pendientes: 0, solicitando: 0, descartadas: 0, subsanadas: 0, validadas: 0, enRevision: 0, rechazadas: 0 }
    }
    const r = resumen[row.id_sitio]
    r.total++

    const rawSt = row.estado_covepa ? row.estado_covepa.trim() : null
    let st = 'Pendiente'
    if (rawSt === 'Descartado') st = 'Descartado'
    else if (rawSt === 'Solicitando Revision' || rawSt === 'Solicitando Revisión') st = 'Solicitando Revisión'
    else if (rawSt === 'En Revision' || rawSt === 'En Revisión') st = 'En Revision'
    else if (rawSt === 'Validado' || rawSt === 'Enviado') st = 'Validado'
    else if (rawSt === 'Rechazado') st = 'Rechazado'
    else if (rawSt === 'Pendiente') st = 'Pendiente'
    else if (row.fecha_subsanacion) st = 'Validado'

    if (st === 'Descartado') {
      r.descartadas++
    } else if (st === 'Solicitando Revisión') {
      r.solicitando++
    } else if (st === 'En Revision') {
      r.enRevision++
    } else if (st === 'Validado') {
      r.subsanadas++
      r.validadas++
    } else if (st === 'Rechazado') {
      r.rechazadas++
    } else {
      r.pendientes++
    }
  }

  return resumen
}

// ────────────────────────────────────────────────────────────
// 7. VISTA AGRUPADA — Paso 2: Detalle de un sitio específico
// ────────────────────────────────────────────────────────────
export async function fetchObservacionesPorSitio(idSitio, filters = {}) {
  let query = supabase
    .from('observaciones')
    .select('id_obs,hito,id_sitio,protocolo,subsistema,detalle,item,sub_item,estado_gilat,estado_covepa,estado_pronatel,comentario_covepa,fecha_subsanacion,revisor,justificacion_demora,tiempo_ejecucion_real,tiempo_ejecucion_demora')
    .eq('id_sitio', idSitio)

  query = applyQueryFilters(query, filters)
  query = query.order('id_obs')

  let { data, error } = await query
  if (error && (error.code === 'PGRST204' || error.message?.includes('tiempo_ejecucion'))) {
    let fallbackQuery = supabase
      .from('observaciones')
      .select('id_obs,hito,id_sitio,protocolo,subsistema,detalle,item,sub_item,estado_gilat,estado_covepa,estado_pronatel,comentario_covepa,fecha_subsanacion,revisor,justificacion_demora')
      .eq('id_sitio', idSitio)
    fallbackQuery = applyQueryFilters(fallbackQuery, filters)
    fallbackQuery = fallbackQuery.order('id_obs')
    const res = await fallbackQuery
    data = res.data
    error = res.error
  }
  if (error) throw new Error(error.message)
  return data || []
}

// ────────────────────────────────────────────────────────────
// 8. TRANSICIÓN MASIVA: Pasar todas las que están 'Solicitando Revisión' a 'En Revisión'
//    Cumple estrictamente la Regla de Auto-Programación:
//    Verifica si existe programación en el día para el sitio; de no existir,
//    genera automáticamente la programación antes de actualizar el estado.
// ────────────────────────────────────────────────────────────
export async function pasarTodasSolicitudesAEnRevision(usuarioInfo = {}) {
  // 1. Consultar todas las observaciones que están solicitando revisión
  const { data: rows, error: fetchErr } = await supabase
    .from('observaciones')
    .select('id_obs, id_sitio, revisor, detalle, subsistema, fecha_subsanacion, estado_covepa')
    .or('estado_covepa.eq.Solicitando Revisión,estado_covepa.eq.Solicitando Revision')

  if (fetchErr) {
    throw new Error(`Error al consultar observaciones solicitando revisión: ${fetchErr.message}`)
  }

  const hoyPeru = getPeruDateStr(new Date())
  const hoyPeruIso = getPeruISOString()

  // Si no hay observaciones en Solicitando Revisión, verificar y sincronizar las que están hoy en 'En Revisión'
  if (!rows || rows.length === 0) {
    const syncHoy = await sincronizarProgramacionesEnRevisionHoy()
    return {
      count: 0,
      items: [],
      codes: [],
      programaciones: syncHoy.results || []
    }
  }

  // 2. Regla de Auto-Programación:
  // Agrupar por sitio y fecha para verificar si existe programación en esa fecha;
  // de no existir, generar automáticamente la programación con la cuadrilla y técnico oficial.
  const sitiosFechasMap = new Map()

  rows.forEach(r => {
    const siteId = (r.id_sitio || '').trim().toUpperCase()
    if (!siteId) return

    let fechaYmd = hoyPeru
    if (r.fecha_subsanacion) {
      try {
        const parsed = getPeruDateStr(r.fecha_subsanacion)
        if (parsed) fechaYmd = parsed
      } catch {
        fechaYmd = hoyPeru
      }
    }

    const key = `${siteId}|${fechaYmd}`
    if (!sitiosFechasMap.has(key)) {
      sitiosFechasMap.set(key, { idSitio: siteId, fecha: fechaYmd, idObs: r.id_obs })
    }
  })

  // Ejecutar asegurarProgramacionSitio para cada sitio en paralelo
  const progResults = await Promise.all(
    [...sitiosFechasMap.values()].map(item =>
      asegurarProgramacionSitio({
        idSitio: item.idSitio,
        idObs: item.idObs,
        fecha: item.fecha
      }).catch(autoProgErr => {
        console.warn(`[AUTO-PROG-BULK-WARN] Error asegurando programación para ${item.idSitio}:`, autoProgErr)
        return null
      })
    )
  )

  const idObsList = rows.map(r => r.id_obs)
  const auditorNombre = usuarioInfo.nombre && !usuarioInfo.nombre.includes('@')
    ? usuarioInfo.nombre
    : resolverNombreAuditor(usuarioInfo, null, 'Coordinador COVEPA')

  // 3. Actualizar estado a 'En Revisión' (asegurando revisor en null)
  const { error: updateErr } = await supabase
    .from('observaciones')
    .update({
      estado_covepa: 'En Revisión',
      revisor: null
    })
    .in('id_obs', idObsList)

  if (updateErr) {
    throw new Error(`Error al actualizar estado a En Revisión: ${updateErr.message}`)
  }

  // Si alguna observación no tenía fecha_subsanacion, asignarle la fecha actual de Perú
  const obsSinFecha = rows.filter(r => !r.fecha_subsanacion).map(r => r.id_obs)
  if (obsSinFecha.length > 0) {
    await supabase
      .from('observaciones')
      .update({ fecha_subsanacion: hoyPeruIso })
      .in('id_obs', obsSinFecha)
  }

  // 4. Registrar trazabilidad en historial_estados_observaciones (no bloqueante)
  rows.forEach(r => {
    // Si la solicitud provino con el nombre del técnico de campo, registrar previamente su evento de solicitud en el historial
    if (r.revisor && !esRevisorGilat(r.revisor)) {
      registrarHistorialEstado({
        idObs: r.id_obs,
        idSitio: r.id_sitio,
        estadoAnterior: 'Pendiente',
        estadoNuevo: 'Solicitando Revisión',
        usuarioNombre: r.revisor,
        usuarioEmail: null,
        usuarioId: null,
        comentario: 'Solicitud de revisión técnica enviada desde campo',
        origen: 'app_fotos',
        fechaExacta: r.fecha_subsanacion || null
      }).catch(err => console.warn('[HISTORIAL-WARN] Error registrando solicitud previa de técnico:', err))
    }

    // Registrar el pase a En Revisión por parte del usuario de oficina (con su nombre completo oficial)
    const solicitanteInfo = (r.revisor && !esRevisorGilat(r.revisor)) ? ` (Solicitado por: ${r.revisor})` : ''
    registrarHistorialEstado({
      idObs: r.id_obs,
      idSitio: r.id_sitio,
      estadoAnterior: r.estado_covepa || 'Solicitando Revisión',
      estadoNuevo: 'En Revisión',
      usuarioNombre: auditorNombre,
      usuarioEmail: usuarioInfo.email || null,
      usuarioId: usuarioInfo.id || null,
      comentario: `Pase masivo a En Revisión (con verificación/generación de programación)${solicitanteInfo}`,
      origen: 'web_erp'
    }).catch(err => console.warn('[HISTORIAL-WARN] Error registrando historial masivo:', err))
  })

  // 5. Emitir evento para refrescar vistas de Programación
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('covepa-programacion-actualizada', {
      detail: { bulk: true, count: idObsList.length, programaciones: progResults }
    }))
  }

  return {
    count: idObsList.length,
    items: rows,
    codes: idObsList,
    programaciones: progResults
  }
}

/**
 * Asegura que todas las observaciones que estén hoy en 'En Revisión' cuenten con su programación en el día.
 */
export async function sincronizarProgramacionesEnRevisionHoy() {
  const hoyPeru = getPeruDateStr(new Date())
  const { data: rows, error } = await supabase
    .from('observaciones')
    .select('id_obs, id_sitio, fecha_subsanacion, estado_covepa')
    .eq('estado_covepa', 'En Revisión')
    .gte('fecha_subsanacion', `${hoyPeru}T00:00:00`)

  if (error || !rows || rows.length === 0) {
    return { count: 0, sitios: [], results: [] }
  }

  const uniqueSites = Array.from(new Set(rows.map(r => (r.id_sitio || '').trim().toUpperCase()).filter(Boolean)))

  // Ejecutar asegurarProgramacionSitio para cada sitio en paralelo
  const results = await Promise.all(
    uniqueSites.map(siteId =>
      asegurarProgramacionSitio({ idSitio: siteId, fecha: hoyPeru })
        .catch(err => {
          console.warn(`[SYNC-HOY-WARN] Error asegurando programación para ${siteId}:`, err)
          return null
        })
    )
  )

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('covepa-programacion-actualizada', {
      detail: { syncHoy: true, sitios: uniqueSites, results }
    }))
  }

  return { count: uniqueSites.length, sitios: uniqueSites, results }
}
