import { supabase, handleSupabaseAuthError } from '../lib/supabase.js'
import { fetchPersonal } from './personalService.js'

// ────────────────────────────────────────────────────────────
// 1. Obtener la lista de todo el personal activo (técnicos, conductores, supervisores)
// ────────────────────────────────────────────────────────────
export async function getPersonalActivo() {
  try {
    const list = await fetchPersonal()
    const activeOnly = (list || []).filter(p => p.activo)
    return activeOnly.sort((a, b) => {
      const aIsTec = (a.cargo || '').includes('TÉCNICO') || (a.cargo || '').includes('TECNICO')
      const bIsTec = (b.cargo || '').includes('TÉCNICO') || (b.cargo || '').includes('TECNICO')
      if (aIsTec && !bIsTec) return -1
      if (!aIsTec && bIsTec) return 1
      if (a.cuadrilla && b.cuadrilla) return a.cuadrilla.localeCompare(b.cuadrilla)
      return (a.nombre_completo || '').localeCompare(b.nombre_completo || '')
    })
  } catch (err) {
    console.error('Error fetching personal:', err)
    return []
  }
}

// Alias para compatibilidad
export const getPersonalTecnico = getPersonalActivo

// ────────────────────────────────────────────────────────────
// 2. Obtener programaciones en un rango de fechas con sus sitios y equipo completo
// Diccionario de nombres históricos para resolver asignaciones anteriores mientras se reasignan IDs
export const KNOWN_LEGACY_NAMES = {
  'b0e30c52-ef5e-46cb-8ae1-82e992ec69b4': 'JHONATAN FLORES',
  '9184f892-b8f4-441c-af48-fe801cae68c7': 'DANIEL JAVIER',
  '84624160-b95e-46a0-be80-6aa9cb0974a9': 'ALFONSO CURI',
  'eb9daa58-60db-4c93-b955-9c520a2281a4': 'WILLIAM AVILA',
  'a7533248-7885-4cb7-ab7c-8f97093c2b52': 'GABRIEL FARRO',
  '739fa2c9-5d60-43af-add6-6fb897c8ba7b': 'CRISTIAN ISLA',
  '1': 'JHONATAN FLORES',
  '2': 'ANDER PERALTA',
  '3': 'DANIEL JAVIER',
  '4': 'LINO TICLLA',
  '5': 'ALFONSO CURI',
  '6': 'JHORDITH ZULUETA',
  '7': 'WILLIAM AVILA',
  '8': 'JHORDIN PEREZ',
  '9': 'GABRIEL FARRO',
  '10': 'NILSON VERA',
  '11': 'CRISTIAN ISLA'
}

// ────────────────────────────────────────────────────────────
export async function getProgramaciones(fechaInicio, fechaFin) {
  // 1. Cargar catálogo de personal activo desde la BD EXTERNA
  const allStaff = await getPersonalActivo()

  const staffMap = {}
  ;(allStaff || []).forEach(p => {
    staffMap[p.id] = p
    if (p.id_personal) staffMap[p.id_personal] = p
  })

  // 2. Consultar programaciones sin depender de la tabla personal local
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
        id_personal
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
    // 1. Extraer equipo desde la tabla relacional programacion_personal cruzando con staffMap
    let equipo = (row.asignaciones_personal || [])
      .map(ap => staffMap[ap.id_personal])
      .filter(Boolean)

    let textoNotas = row.notas || ''

    // 2. Fallback de retrocompatibilidad si hubo personal_ids guardados en notas
    if (row.notas && row.notas.startsWith('{') && row.notas.endsWith('}')) {
      try {
        const parsed = JSON.parse(row.notas)
        if (Array.isArray(parsed.personal_ids) && parsed.personal_ids.length > 0) {
          const fromNotas = parsed.personal_ids.map(pid => staffMap[pid]).filter(Boolean)
          if (fromNotas.length > 0 && equipo.length === 0) {
            equipo = fromNotas
          }
        }
        textoNotas = parsed.texto || parsed.notas || ''
      } catch (e) {
        // Fallback a texto estándar
      }
    }

    // 3. Resolver técnico principal
    let tecnicoPrincipal = staffMap[row.id_tecnico] || null
    if (!tecnicoPrincipal && row.id_tecnico) {
      const legacyName = KNOWN_LEGACY_NAMES[row.id_tecnico] || 'Personal por vincular'
      tecnicoPrincipal = {
        id: row.id_tecnico,
        id_personal: row.id_tecnico,
        nombre_completo: legacyName,
        cargo: 'TÉCNICO',
        telefono: null,
        is_legacy_unlinked: true
      }
    }

    if (equipo.length === 0 && tecnicoPrincipal) {
      equipo = [tecnicoPrincipal]
    }

    return {
      ...row,
      personal: tecnicoPrincipal,
      notas: textoNotas,
      equipo
    }
  })
}

// ────────────────────────────────────────────────────────────
// Reasignar un ID de personal antiguo a un id_personal de la base externa
// ────────────────────────────────────────────────────────────
export async function reassignProgramacionStaff(oldId, newIdPersonal) {
  if (!oldId || !newIdPersonal) return false

  // 1. Actualizar programaciones donde id_tecnico = oldId
  const { data: progs } = await supabase
    .from('programaciones')
    .select('id, notas, id_tecnico')

  if (progs) {
    for (const pr of progs) {
      let needsUpdate = false
      const updatePayload = {}
      if (pr.id_tecnico === oldId) {
        updatePayload.id_tecnico = newIdPersonal
        needsUpdate = true
      }
      if (pr.notas && pr.notas.includes(oldId)) {
        updatePayload.notas = pr.notas.replaceAll(oldId, newIdPersonal)
        needsUpdate = true
      }
      if (needsUpdate) {
        await supabase.from('programaciones').update(updatePayload).eq('id', pr.id)
      }
    }
  }

  // 2. Actualizar programacion_personal
  await supabase
    .from('programacion_personal')
    .update({ id_personal: newIdPersonal })
    .eq('id_personal', oldId)

  return true
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
