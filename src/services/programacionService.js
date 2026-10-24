import { supabase, handleSupabaseAuthError } from '../lib/supabase'

// ────────────────────────────────────────────────────────────
// 1. Obtener la lista de todo el personal activo (técnicos, conductores, supervisores)
// ────────────────────────────────────────────────────────────
export async function getPersonalActivo() {
  const { data, error } = await supabase
    .from('personal')
    .select('id, cuadrilla, cargo, nombre_completo, telefono, activo, operador, origen, empresa')
    .eq('activo', true)
    .order('cargo', { ascending: true })

  if (error) {
    handleSupabaseAuthError(error)
    console.error('Error fetching personal:', error)
    return []
  }

  // Ordenar: Técnicos 1-6 primero, luego supervisores, luego conductores
  const list = data || []
  return list.sort((a, b) => {
    const aIsTec = (a.cargo || '').includes('TÉCNICO') || (a.cargo || '').includes('TECNICO')
    const bIsTec = (b.cargo || '').includes('TÉCNICO') || (b.cargo || '').includes('TECNICO')
    if (aIsTec && !bIsTec) return -1
    if (!aIsTec && bIsTec) return 1
    if (a.cuadrilla && b.cuadrilla) return a.cuadrilla.localeCompare(b.cuadrilla)
    return (a.nombre_completo || '').localeCompare(b.nombre_completo || '')
  })
}

// Alias para compatibilidad
export const getPersonalTecnico = getPersonalActivo

// ────────────────────────────────────────────────────────────
// 2. Obtener programaciones en un rango de fechas con sus sitios y equipo completo
// ────────────────────────────────────────────────────────────
export async function getProgramaciones(fechaInicio, fechaFin) {
  // 1. Cargar catálogo de personal activo para mapear integrantes secundarios
  const { data: allStaff } = await supabase
    .from('personal')
    .select('id, nombre_completo, cuadrilla, cargo, telefono, operador, empresa')
    .eq('activo', true)

  const staffMap = {}
  ;(allStaff || []).forEach(p => {
    staffMap[p.id] = p
  })

  // 2. Consultar programaciones
  let query = supabase
    .from('programaciones')
    .select(`
      id,
      id_tecnico,
      fecha,
      notas,
      created_at,
      asignaciones_personal:programacion_personal (
        id,
        id_personal,
        personal:id_personal (
          id,
          nombre_completo,
          cuadrilla,
          cargo,
          telefono,
          operador
        )
      ),
      personal:id_tecnico (
        id,
        nombre_completo,
        cuadrilla,
        cargo,
        telefono
      ),
      sitios:programacion_sitios (
        id,
        id_sitio,
        orden,
        notas_visita
      )
    `)
    .order('fecha', { ascending: true })

  if (fechaInicio) query = query.gte('fecha', fechaInicio)
  if (fechaFin) query = query.lte('fecha', fechaFin)

  const { data, error } = await query

  if (error) {
    handleSupabaseAuthError(error)
    console.error('Error fetching programaciones:', error)
    throw new Error(error.message)
  }

  // 3. Mapear equipo relacional con soporte múltiple personal y notas limpias
  return (data || []).map(row => {
    // 1. Extraer equipo desde la tabla relacional programacion_personal
    let equipo = (row.asignaciones_personal || [])
      .map(ap => ap.personal)
      .filter(Boolean)

    let textoNotas = row.notas || ''

    // 2. Fallback de retrocompatibilidad si hubo personal_ids guardados en notas
    if (equipo.length === 0 && row.notas && row.notas.startsWith('{') && row.notas.endsWith('}')) {
      try {
        const parsed = JSON.parse(row.notas)
        if (Array.isArray(parsed.personal_ids) && parsed.personal_ids.length > 0) {
          equipo = parsed.personal_ids.map(pid => staffMap[pid]).filter(Boolean)
        }
        textoNotas = parsed.texto || parsed.notas || ''
      } catch (e) {
        // Fallback a texto estándar
      }
    }

    // 3. Fallback al técnico principal si equipo sigue vacío
    if (equipo.length === 0 && row.personal) {
      equipo = [row.personal]
    }

    return {
      ...row,
      notas: textoNotas,
      equipo
    }
  })
}

// ────────────────────────────────────────────────────────────
// 3. Crear una nueva jornada / programación con sus sitios y personal asignado
// ────────────────────────────────────────────────────────────
export async function createProgramacion({ personal_ids = [], id_tecnico, fecha, notas = '', sitios = [] }) {
  // Asegurar que tengamos al menos un integrante de personal
  const ids = Array.isArray(personal_ids) && personal_ids.length > 0
    ? personal_ids
    : id_tecnico ? [id_tecnico] : []

  if (ids.length === 0) {
    throw new Error('Debes seleccionar al menos un integrante de personal para la programación.')
  }

  const primaryTecnicoId = ids[0]

  // Serializar payload con la lista completa de personal en notas
  const notasPayload = JSON.stringify({
    personal_ids: ids,
    texto: (notas || '').trim()
  })

  // 1. Insertar la programación en tabla maestra
  const { data: prog, error: progErr } = await supabase
    .from('programaciones')
    .insert([{
      id_tecnico: primaryTecnicoId,
      fecha,
      notas: notasPayload
    }])
    .select()
    .single()

  if (progErr) {
    if (progErr.code === '23505') {
      throw new Error('Ya existe una programación para este personal en esa misma fecha. Puedes agregar más sitios a su jornada existente.')
    }
    throw new Error(progErr.message)
  }

  // 2. Insertar asignaciones de personal en la tabla relacional programacion_personal
  try {
    const personalRows = ids.map(pId => ({
      id_programacion: prog.id,
      id_personal: pId
    }))

    const { error: persErr } = await supabase
      .from('programacion_personal')
      .insert(personalRows)

    if (persErr) {
      console.warn('Advertencia insertando en programacion_personal:', persErr.message)
    }
  } catch (err) {
    console.warn('Error no bloqueante al vincular programacion_personal:', err)
  }

  // 3. Si se pasaron sitios, insertarlos en programacion_sitios
  if (sitios && sitios.length > 0) {
    const sitiosRows = sitios.map((siteId, index) => ({
      id_programacion: prog.id,
      id_sitio: siteId,
      orden: index + 1
    }))

    const { error: sitiosErr } = await supabase
      .from('programacion_sitios')
      .insert(sitiosRows)

    if (sitiosErr) {
      console.error('Error insertando sitios en programacion:', sitiosErr)
    }
  }

  return prog
}

// ────────────────────────────────────────────────────────────
// 4. Actualizar una programación existente (fecha, personal, sitios, notas)
// ────────────────────────────────────────────────────────────
export async function updateProgramacion(idProgramacion, { personal_ids = [], fecha, notas = '', sitios = [] }) {
  const ids = Array.isArray(personal_ids) && personal_ids.length > 0 ? personal_ids : []
  if (ids.length === 0) {
    throw new Error('Debes seleccionar al menos un integrante de personal para la programación.')
  }

  const primaryTecnicoId = ids[0]
  const cleanNotas = typeof notas === 'string' ? notas.trim() : ''

  // 1. Actualizar registro en tabla programaciones
  const notasPayload = JSON.stringify({
    personal_ids: ids,
    texto: cleanNotas
  })

  const { error: progErr } = await supabase
    .from('programaciones')
    .update({
      id_tecnico: primaryTecnicoId,
      fecha,
      notas: notasPayload
    })
    .eq('id', idProgramacion)

  if (progErr) throw new Error(progErr.message)

  // 2. Sincronizar asignaciones en programacion_personal
  try {
    await supabase
      .from('programacion_personal')
      .delete()
      .eq('id_programacion', idProgramacion)

    const personalRows = ids.map(pId => ({
      id_programacion: idProgramacion,
      id_personal: pId
    }))

    const { error: persErr } = await supabase
      .from('programacion_personal')
      .insert(personalRows)

    if (persErr) {
      console.warn('Advertencia actualizando programacion_personal:', persErr.message)
    }
  } catch (err) {
    console.warn('Error no bloqueante al actualizar programacion_personal:', err)
  }

  // 3. Sincronizar sitios en programacion_sitios
  if (sitios && sitios.length > 0) {
    try {
      await supabase
        .from('programacion_sitios')
        .delete()
        .eq('id_programacion', idProgramacion)

      const sitiosRows = sitios.map((siteId, index) => ({
        id_programacion: idProgramacion,
        id_sitio: siteId,
        orden: index + 1
      }))

      const { error: sitiosErr } = await supabase
        .from('programacion_sitios')
        .insert(sitiosRows)

      if (sitiosErr) {
        console.error('Error sincronizando sitios en programación:', sitiosErr)
      }
    } catch (err) {
      console.warn('Error sincronizando programacion_sitios:', err)
    }
  }

  return true
}

// ────────────────────────────────────────────────────────────
// 4. Eliminar una programación completa
// ────────────────────────────────────────────────────────────
export async function deleteProgramacion(idProgramacion) {
  const { error } = await supabase
    .from('programaciones')
    .delete()
    .eq('id', idProgramacion)

  if (error) throw new Error(error.message)
  return true
}

// ────────────────────────────────────────────────────────────
// 5. Agregar un sitio a una programación existente
// ────────────────────────────────────────────────────────────
export async function addSitioToProgramacion(idProgramacion, idSitio, orden = 1) {
  const { data, error } = await supabase
    .from('programacion_sitios')
    .insert([{
      id_programacion: idProgramacion,
      id_sitio: idSitio,
      orden
    }])
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('El sitio ya está agregado a esta programación.')
    }
    throw new Error(error.message)
  }
  return data
}

// ────────────────────────────────────────────────────────────
// 6. Eliminar un sitio de una programación
// ────────────────────────────────────────────────────────────
export async function removeSitioFromProgramacion(idProgramacionSitio) {
  const { error } = await supabase
    .from('programacion_sitios')
    .delete()
    .eq('id', idProgramacionSitio)

  if (error) throw new Error(error.message)
  return true
}

// ────────────────────────────────────────────────────────────
// 7. Obtener resumen de observaciones para una lista de sitios
// Devuelve un mapa: { [id_sitio]: { total, subsanadas, descartadas, pendientes } }
// ────────────────────────────────────────────────────────────
export async function getSitiosObservacionesResumen(sitiosIds = []) {
  if (!sitiosIds || sitiosIds.length === 0) return {}

  // Limitamos o dividimos en chunks si hay muchos
  const uniqueIds = [...new Set(sitiosIds)]
  
  const { data, error } = await supabase
    .from('observaciones')
    .select('id_sitio, estado_covepa, fecha_subsanacion')
    .in('id_sitio', uniqueIds)

  if (error) {
    console.error('Error al obtener conteo de observaciones por sitio:', error)
    return {}
  }

  const resumen = {}
  uniqueIds.forEach(id => {
    resumen[id] = { total: 0, validadas: 0, subsanadas: 0, descartadas: 0, enRevision: 0, enviadas: 0, rechazadas: 0, pendientes: 0 }
  })

  ;(data || []).forEach(row => {
    if (!resumen[row.id_sitio]) {
      resumen[row.id_sitio] = { total: 0, validadas: 0, subsanadas: 0, descartadas: 0, enRevision: 0, enviadas: 0, rechazadas: 0, pendientes: 0 }
    }
    const s = resumen[row.id_sitio]
    s.total++

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
      s.descartadas++
    } else if (st === 'En Revision') {
      s.enRevision++
    } else if (st === 'Validado') {
      s.validadas++
      s.subsanadas++
    } else if (st === 'Enviado') {
      s.enviadas++
    } else if (st === 'Rechazado') {
      s.rechazadas++
    } else {
      s.pendientes++
    }
  })

  return resumen
}

// ────────────────────────────────────────────────────────────
// 8. Obtener observaciones detalladas de un sitio
// ────────────────────────────────────────────────────────────
export async function getObservacionesSitioDetalle(idSitio) {
  // Intentar traer campos con comentario_inicial y revisor
  const selectConRevisor = 'id_obs, id_sitio, detalle, comentario_inicial, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, comentario_covepa, revisor'
  const selectConValidador = 'id_obs, id_sitio, detalle, comentario_inicial, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, comentario_covepa, validado_por'
  const selectSinRevisor = 'id_obs, id_sitio, detalle, comentario_inicial, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, comentario_covepa'

  let { data, error } = await supabase
    .from('observaciones')
    .select(selectConRevisor)
    .eq('id_sitio', idSitio)
    .order('id_obs', { ascending: true })

  if (error && error.code === 'PGRST204') {
    // Si aún se llama validado_por en Supabase
    const fallbackVal = await supabase
      .from('observaciones')
      .select(selectConValidador)
      .eq('id_sitio', idSitio)
      .order('id_obs', { ascending: true })

    if (!fallbackVal.error && fallbackVal.data) {
      return fallbackVal.data.map(row => ({
        ...row,
        revisor: row.revisor || row.validado_por || null
      }))
    }

    // Fallback sin la columna
    const fallback = await supabase
      .from('observaciones')
      .select(selectSinRevisor)
      .eq('id_sitio', idSitio)
      .order('id_obs', { ascending: true })
    if (fallback.error) throw new Error(fallback.error.message)
    return fallback.data || []
  }

  if (error) throw new Error(error.message)
  return data || []
}
