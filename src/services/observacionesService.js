import { supabase } from '../lib/supabase'

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

  const columns = ['id_obs', 'id_sitio', 'detalle', 'subsistema', 'protocolo', 'item', 'sub_item']
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
  idSitio = ''
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
  page = 1,
  pageSize = 20
} = {}) {
  let query = supabase
    .from('observaciones')
    .select('id_obs,id_sitio,protocolo,subsistema,detalle,item,sub_item,estado_covepa,fecha_subsanacion,comentario_covepa,comentario_inicial,comentario_complementario,comentario_final,acuerdo_subsanacion', { count: 'exact' })

  query = applyQueryFilters(query, { search, protocolo, estadoCovepa, idSitio })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query.order('id_obs').range(from, to)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)
  return { data: data || [], count: count || 0 }
}

// ────────────────────────────────────────────────────────────
// 2. Obtiene los KPIs de COVEPA (Medidores / Indicadores)
// Utiliza head: true en paralelo -> exacto, instantáneo y sin límite de 1,000
// ────────────────────────────────────────────────────────────
export async function fetchObservacionesKPIs(filters = {}) {
  try {
    // Para que los contadores no se reseteen a 0 al hacer clic en un medidor,
    // calculamos los totales ignorando el filtro estadoCovepa si estuviera activo
    const kpiFilters = { ...filters }
    delete kpiFilters.estadoCovepa

    const [qTotal, qPend, qSubidas, qValidadas, qRech, qDesc] = await Promise.all([
      applyQueryFilters(supabase.from('observaciones').select('*', { count: 'exact', head: true }), kpiFilters),
      applyQueryFilters(supabase.from('observaciones').select('*', { count: 'exact', head: true }).or('estado_covepa.eq.Pendiente,estado_covepa.is.null'), kpiFilters),
      applyQueryFilters(supabase.from('observaciones').select('*', { count: 'exact', head: true }).eq('estado_covepa', 'Enviado'), kpiFilters),
      applyQueryFilters(supabase.from('observaciones').select('*', { count: 'exact', head: true }).or('estado_covepa.eq.Validado,and(fecha_subsanacion.not.is.null,estado_covepa.neq.Descartado,estado_covepa.neq.En Revision,estado_covepa.neq.En Revisión,estado_covepa.neq.Enviado,estado_covepa.neq.Rechazado)'), kpiFilters),
      applyQueryFilters(supabase.from('observaciones').select('*', { count: 'exact', head: true }).eq('estado_covepa', 'Rechazado'), kpiFilters),
      applyQueryFilters(supabase.from('observaciones').select('*', { count: 'exact', head: true }).eq('estado_covepa', 'Descartado'), kpiFilters),
    ])

    return {
      total: qTotal.count ?? 0,
      pendientes: qPend.count ?? 0,
      subidas: qSubidas.count ?? 0,
      validadas: qValidadas.count ?? 0,
      rechazadas: qRech.count ?? 0,
      descartadas: qDesc.count ?? 0,
    }
  } catch (err) {
    console.error('Error al calcular KPIs:', err)
    return { total: 0, pendientes: 0, subidas: 0, validadas: 0, rechazadas: 0, descartadas: 0 }
  }
}

// ────────────────────────────────────────────────────────────
// 3. Obtiene los valores únicos para los filtros de la toolbar
// ────────────────────────────────────────────────────────────
export async function fetchFiltrosObservaciones() {
  try {
    const data = await fetchAllRowsInBatches(
      'observaciones',
      'protocolo, estado_covepa, id_sitio'
    )

    const unique = (field) => [...new Set(data.map(d => d[field]).filter(Boolean))].sort()
    return {
      protocolos: unique('protocolo'),
      estadosCovepa: unique('estado_covepa'),
      sitios: unique('id_sitio'),
    }
  } catch (err) {
    console.error('Error al cargar filtros:', err)
    return { protocolos: [], estadosCovepa: [], sitios: [] }
  }
}

// ────────────────────────────────────────────────────────────
// 4. Actualiza los campos editables de COVEPA en una observación
// ────────────────────────────────────────────────────────────
export async function updateObservacionCovepa(idObs, { estado_covepa, fecha_subsanacion, comentario_covepa, revisor, validado_por }) {
  const payload = {}
  if (estado_covepa !== undefined) payload.estado_covepa = estado_covepa
  if (fecha_subsanacion !== undefined) payload.fecha_subsanacion = fecha_subsanacion || null
  if (comentario_covepa !== undefined) payload.comentario_covepa = comentario_covepa
  
  const rev = revisor !== undefined ? revisor : validado_por
  if (rev !== undefined) payload.revisor = rev || null

  const { data, error } = await supabase
    .from('observaciones')
    .update(payload)
    .eq('id_obs', idObs)
    .select()
    .single()

  if (error) {
    // Si la columna revisor aún no fue creada en Supabase (error PGRST204), probar con validado_por o sin ella
    if (error.code === 'PGRST204' && payload.revisor !== undefined) {
      delete payload.revisor
      if (rev !== undefined) payload.validado_por = rev || null
      const retryVal = await supabase.from('observaciones').update(payload).eq('id_obs', idObs).select().single()
      if (!retryVal.error) return retryVal.data

      // Si tampoco existe validado_por, guardar sin ese campo
      delete payload.validado_por
      const retry = await supabase.from('observaciones').update(payload).eq('id_obs', idObs).select().single()
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
  const selectCols = 'id_obs,id_sitio,protocolo,subsistema,detalle,item,sub_item,comentario_inicial,comentario_complementario,comentario_final,acuerdo_subsanacion,estado_covepa,fecha_subsanacion,comentario_covepa'
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
      resumen[row.id_sitio] = { total: 0, pendientes: 0, descartadas: 0, subsanadas: 0, validadas: 0, enRevision: 0, enviadas: 0, rechazadas: 0 }
    }
    const r = resumen[row.id_sitio]
    r.total++

    const rawSt = row.estado_covepa ? row.estado_covepa.trim() : null
    let st = 'Pendiente'
    if (rawSt === 'Descartado') st = 'Descartado'
    else if (rawSt === 'En Revision' || rawSt === 'En Revisión') st = 'En Revision'
    else if (rawSt === 'Validado') st = 'Validado'
    else if (rawSt === 'Enviado') st = 'Enviado'
    else if (rawSt === 'Rechazado') st = 'Rechazado'
    else if (rawSt === 'Pendiente') st = 'Pendiente'
    else if (row.fecha_subsanacion) st = 'Validado'

    if (st === 'Descartado') {
      r.descartadas++
    } else if (st === 'En Revision') {
      r.enRevision++
    } else if (st === 'Validado') {
      r.subsanadas++
      r.validadas++
    } else if (st === 'Enviado') {
      r.enviadas++
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
    .select('id_obs,id_sitio,protocolo,subsistema,detalle,item,sub_item,estado_covepa,fecha_subsanacion,comentario_covepa,acuerdo_subsanacion,comentario_inicial,comentario_complementario,comentario_final')
    .eq('id_sitio', idSitio)

  query = applyQueryFilters(query, filters)
  query = query.order('id_obs')

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}
