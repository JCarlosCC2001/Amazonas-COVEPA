import { supabase, handleSupabaseAuthError } from '../lib/supabase.js'
import { fetchPersonal, DEFAULT_CUADRILLAS_CONFIG } from './personalService.js'
import { ASIGNACIONES_BASE } from './sitiosService.js'
import { toLocalDateString } from '../utils/helpers.js'

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
  'b0e30c52-ef5e-46cb-8ae1-82e992ec69b4': 'Jhonatan Flores',
  '9184f892-b8f4-441c-af48-fe801cae68c7': 'Daniel Javier',
  '84624160-b95e-46a0-be80-6aa9cb0974a9': 'Alfonso Curi',
  'eb9daa58-60db-4c93-b955-9c520a2281a4': 'William Avila',
  'a7533248-7885-4cb7-ab7c-8f97093c2b52': 'Gabriel Farro',
  '739fa2c9-5d60-43af-add6-6fb897c8ba7b': 'Cristian Isla',
  '1': 'Jhonatan Flores',
  '2': 'Ander Peralta',
  '3': 'Daniel Javier',
  '4': 'Lino Ticlla',
  '5': 'Alfonso Curi',
  '6': 'Jhordith Zulueta',
  '7': 'William Avila',
  '8': 'Jhordin Perez',
  '9': 'Gabriel Farro',
  '10': 'Nilson Vera',
  '11': 'Cristian Isla'
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
      resumen[row.id_sitio] = { total: 0, validadas: 0, subsanadas: 0, descartadas: 0, solicitando: 0, enRevision: 0, rechazadas: 0, pendientes: 0 }
    }
    const s = resumen[row.id_sitio]
    s.total++

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
      s.descartadas++
    } else if (st === 'Solicitando Revisión') {
      s.solicitando++
    } else if (st === 'En Revision') {
      s.enRevision++
    } else if (st === 'Validado') {
      s.validadas++
      s.subsanadas++
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
  // Intentar traer campos con comentario_inicial, revisor, protocolo y subsistema
  const selectConRevisor = 'id_obs, id_sitio, protocolo, subsistema, detalle, comentario_inicial, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, comentario_covepa, revisor'
  const selectConValidador = 'id_obs, id_sitio, protocolo, subsistema, detalle, comentario_inicial, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, comentario_covepa, validado_por'
  const selectSinRevisor = 'id_obs, id_sitio, protocolo, subsistema, detalle, comentario_inicial, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, comentario_covepa'

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


// ────────────────────────────────────────────────────────────
// 9. Asegurar Programación de Sitio (Auto-Programación)
//
// Cada vez que una observación tiene un cambio de estado:
// 1. Verifica si existe una programación para ese día/fecha que incluya ese sitio.
// 2. Si ya existe, continúa con el proceso normal.
// 3. Si NO existe:
//    - Determina la cuadrilla oficial del sitio y su técnico titular.
//    - Si el técnico ya tiene programación ese día, agrega el sitio a su jornada.
//    - Si no tiene programación ese día, genera una nueva programación con ese sitio.
// ────────────────────────────────────────────────────────────
export async function asegurarProgramacionSitio({ idSitio = null, idObs = null, fecha = null } = {}) {
  try {
    let siteId = idSitio ? String(idSitio).trim().toUpperCase() : null

    // Si no se proporcionó idSitio, obtenerlo de la observación
    if (!siteId && idObs) {
      const { data: obsData } = await supabase
        .from('observaciones')
        .select('id_sitio, fecha_subsanacion')
        .eq('id_obs', idObs)
        .maybeSingle()

      if (obsData?.id_sitio) {
        siteId = obsData.id_sitio.trim().toUpperCase()
      }
    }

    if (!siteId) {
      console.warn('[AUTO-PROG] No se pudo determinar id_sitio para asegurar programación.')
      return { success: false, reason: 'site_not_found' }
    }

    // Normalizar la fecha a formato YYYY-MM-DD (hora local)
    let fechaYmd = null
    if (fecha) {
      if (typeof fecha === 'string') {
        const trimmed = fecha.trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          fechaYmd = trimmed
        } else {
          const parsed = new Date(trimmed)
          if (!isNaN(parsed.getTime())) fechaYmd = toLocalDateString(parsed)
        }
      } else if (fecha instanceof Date && !isNaN(fecha.getTime())) {
        fechaYmd = toLocalDateString(fecha)
      }
    }
    if (!fechaYmd) {
      fechaYmd = toLocalDateString(new Date())
    }

    // 1. Consultar programaciones existentes en esa fecha
    const { data: progsFecha, error: errProgs } = await supabase
      .from('programaciones')
      .select(`
        id,
        id_tecnico,
        fecha,
        sitios:programacion_sitios (
          id,
          id_sitio,
          orden
        )
      `)
      .eq('fecha', fechaYmd)

    if (errProgs) {
      console.error('[AUTO-PROG] Error consultando programaciones de la fecha:', errProgs)
      return { success: false, error: errProgs.message }
    }

    // 2. Verificar si el sitio ya está en alguna programación de esa fecha
    const yaExiste = (progsFecha || []).some(prog =>
      (prog.sitios || []).some(s => (s.id_sitio || '').toUpperCase().trim() === siteId)
    )

    if (yaExiste) {
      console.log(`[AUTO-PROG] El sitio ${siteId} ya existe en la programación del día ${fechaYmd}. Continuando normal.`)
      return { success: true, yaExiste: true, fecha: fechaYmd, idSitio: siteId }
    }

    console.log(`[AUTO-PROG] ⚡ El sitio ${siteId} NO existe en la programación de ${fechaYmd}. Generando...`)

    // 3. Determinar la cuadrilla oficial del sitio
    let cuadrillaName = null
    try {
      const { data: scData } = await supabase
        .from('sitios_cuadrillas')
        .select('cuadrilla')
        .eq('id_site', siteId)
        .eq('activo', true)
        .maybeSingle()

      if (scData?.cuadrilla) {
        cuadrillaName = scData.cuadrilla.toUpperCase().trim().replace(/GRUPO/gi, 'CUADRILLA')
      }
    } catch {}

    if (!cuadrillaName) {
      const fallbackSite = (ASIGNACIONES_BASE || []).find(s => s.id_site === siteId)
      if (fallbackSite?.cuadrilla) {
        cuadrillaName = fallbackSite.cuadrilla.toUpperCase().trim().replace(/GRUPO/gi, 'CUADRILLA')
      }
    }

    if (!cuadrillaName) {
      cuadrillaName = 'CUADRILLA 1'
    }

    // 4. Determinar el técnico oficial de esa cuadrilla (excluyendo terminantemente conductores)
    const defaultCfg = DEFAULT_CUADRILLAS_CONFIG[cuadrillaName] || DEFAULT_CUADRILLAS_CONFIG['CUADRILLA 1']
    let idTecnico = defaultCfg?.idTecnico

    try {
      const { data: pcRows } = await supabase
        .from('personal_cuadrillas')
        .select('id_personal, cargo, cuadrilla')
        .eq('cuadrilla', cuadrillaName)
        .eq('activo', true)

      if (pcRows && pcRows.length > 0) {
        const tec = pcRows.find(p => {
          const c = (p.cargo || '').toUpperCase()
          return (c.includes('TÉCN') || c.includes('TECN') || c.includes('SUPERVISOR')) && !c.includes('CONDUCTOR')
        })
        if (tec?.id_personal) idTecnico = tec.id_personal
      }
    } catch {}

    if (!idTecnico) {
      idTecnico = '8359c281-33ce-423e-9823-0e9e09663889' // Carlos Cóndor (Supervisor) fallback
    }

    // 5. Verificar si el técnico titular ya tiene una jornada iniciada en esa fecha
    const progExistenteTecnico = (progsFecha || []).find(p => p.id_tecnico === idTecnico)

    if (progExistenteTecnico) {
      // Caso A: El técnico ya tiene programación, agregamos el sitio a su jornada
      const sitiosExistentes = progExistenteTecnico.sitios || []
      const yaEnLista = sitiosExistentes.some(s => (s.id_sitio || '').toUpperCase().trim() === siteId)

      if (!yaEnLista) {
        const maxOrden = sitiosExistentes.reduce((max, s) => Math.max(max, s.orden || 0), 0)

        const { error: insSitioErr } = await supabase
          .from('programacion_sitios')
          .insert([{
            id_programacion: progExistenteTecnico.id,
            id_sitio: siteId,
            orden: maxOrden + 1
          }])

        if (insSitioErr) {
          console.error('[AUTO-PROG] Error agregando sitio a programación:', insSitioErr)
          return { success: false, error: insSitioErr.message }
        }
      }

      console.log(`[AUTO-PROG] ✅ Sitio ${siteId} agregado a jornada de ${cuadrillaName} para ${fechaYmd}.`)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('covepa-programacion-actualizada', {
          detail: { idSitio: siteId, fecha: fechaYmd, programacionId: progExistenteTecnico.id }
        }))
      }

      return {
        success: true,
        generado: true,
        tipo: 'sitio_agregado',
        cuadrilla: cuadrillaName,
        fecha: fechaYmd,
        programacionId: progExistenteTecnico.id
      }
    } else {
      // Caso B: El técnico no tiene programación esa fecha, creamos una nueva jornada ÚNICAMENTE con el técnico (sin conductor)
      const personalIds = [idTecnico]

      let nuevaProg = null
      try {
        nuevaProg = await createProgramacion({
          personal_ids: personalIds,
          id_tecnico: idTecnico,
          fecha: fechaYmd,
          notas: `Auto-generada por actualización técnica en sitio ${siteId}`,
          sitios: [siteId]
        })
      } catch (createErr) {
        // En caso de concurrencia (código 23505), intentar agregar a la creada en paralelo
        if (createErr.message?.includes('Ya existe una programación') || createErr.code === '23505') {
          const { data: retryProg } = await supabase
            .from('programaciones')
            .select('id, sitios:programacion_sitios(id, id_sitio, orden)')
            .eq('fecha', fechaYmd)
            .eq('id_tecnico', idTecnico)
            .maybeSingle()

          if (retryProg) {
            const sitiosRetry = retryProg.sitios || []
            const yaEnRetry = sitiosRetry.some(s => (s.id_sitio || '').toUpperCase().trim() === siteId)
            if (!yaEnRetry) {
              const maxOrden = sitiosRetry.reduce((max, s) => Math.max(max, s.orden || 0), 0)
              await supabase.from('programacion_sitios').insert([{
                id_programacion: retryProg.id,
                id_sitio: siteId,
                orden: maxOrden + 1
              }])
            }
            nuevaProg = retryProg
          }
        } else {
          throw createErr
        }
      }

      console.log(`[AUTO-PROG] ✅ Nueva jornada creada para ${cuadrillaName} en ${fechaYmd} con sitio ${siteId}.`)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('covepa-programacion-actualizada', {
          detail: { idSitio: siteId, fecha: fechaYmd, programacionId: nuevaProg?.id }
        }))
      }

      return {
        success: true,
        generado: true,
        tipo: 'nueva_programacion',
        cuadrilla: cuadrillaName,
        fecha: fechaYmd,
        programacion: nuevaProg
      }
    }
  } catch (err) {
    console.error('[AUTO-PROG] Error inesperado en asegurarProgramacionSitio:', err)
    return { success: false, error: err.message }
  }
}
