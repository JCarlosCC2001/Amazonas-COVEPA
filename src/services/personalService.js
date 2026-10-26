import { supabase, supabaseExt, handleSupabaseAuthError } from '../lib/supabase.js'

// Fallback del personal inicial del proyecto por si falla la red
export const PERSONAL_FALLBACK = [
  { id: '1', id_personal: '1', cargo: 'TÉCNICO', nombre: 'JHONATAN', apellido: 'FLORES', nombre_completo: 'JHONATAN FLORES', contacto_1: '929985566', operador_1: 'BITEL', empresa: 'COVEPA', estado: 'Activo', activo: true },
  { id: '2', id_personal: '2', cargo: 'CONDUCTOR', nombre: 'ANDER', apellido: 'PERALTA', nombre_completo: 'ANDER PERALTA', contacto_1: '945551928', empresa: 'COVEPA', estado: 'Activo', activo: true },
  { id: '3', id_personal: '3', cargo: 'TÉCNICO', nombre: 'DANIEL', apellido: 'JAVIER', nombre_completo: 'DANIEL JAVIER', contacto_1: '956188967', operador_1: 'BITEL', empresa: 'COVEPA', estado: 'Activo', activo: true },
  { id: '4', id_personal: '4', cargo: 'CONDUCTOR', nombre: 'LINO', apellido: 'TICLLA', nombre_completo: 'LINO TICLLA', contacto_1: '910493156', empresa: 'COVEPA', estado: 'Activo', activo: true },
  { id: '5', id_personal: '5', cargo: 'TÉCNICO', nombre: 'ALFONSO', apellido: 'CURI', nombre_completo: 'ALFONSO CURI', contacto_1: '952010919', contacto_2: '939507297', operador_1: 'BITEL', operador_2: 'MOVISTAR', empresa: 'COVEPA', estado: 'Activo', activo: true },
  { id: '6', id_personal: '6', cargo: 'CONDUCTOR', nombre: 'JHORDITH', apellido: 'ZULUETA', nombre_completo: 'JHORDITH ZULUETA (TOÑO)', contacto_1: '999389272', empresa: 'COVEPA', estado: 'Activo', activo: true },
  { id: '7', id_personal: '7', cargo: 'SUPERVISOR', nombre: 'WILLIAM', apellido: 'AVILA', nombre_completo: 'WILLIAM AVILA', contacto_1: '951231901', operador_1: 'CLARO', empresa: 'COVEPA', estado: 'Activo', activo: true },
  { id: '8', id_personal: '8', cargo: 'CONDUCTOR', nombre: 'JHORDIN', apellido: 'PEREZ', nombre_completo: 'JHORDIN PEREZ', contacto_1: '921004913', empresa: 'COVEPA', estado: 'Activo', activo: true },
  { id: '9', id_personal: '9', cargo: 'TÉCNICO', nombre: 'GABRIEL', apellido: 'FARRO', nombre_completo: 'GABRIEL FARRO', contacto_1: '931704961', operador_1: 'BITEL', empresa: 'COVEPA', estado: 'Activo', activo: true },
  { id: '10', id_personal: '10', cargo: 'CONDUCTOR', nombre: 'NILSON', apellido: 'VERA', nombre_completo: 'NILSON VERA', contacto_1: '969936764', empresa: 'COVEPA', estado: 'Activo', activo: true },
  { id: '11', id_personal: '11', cargo: 'TÉCNICO', nombre: 'CRISTIAN', apellido: 'ISLA', nombre_completo: 'CRISTIAN ISLA', contacto_1: '923932783', contacto_2: '930996665', operador_1: 'CLARO', operador_2: 'BITEL', empresa: 'COVEPA', estado: 'Activo', activo: true },
  { id: '8359c281-33ce-423e-9823-0e9e09663889', id_personal: '8359c281-33ce-423e-9823-0e9e09663889', cargo: 'SUPERVISOR', nombre: 'CARLOS', apellido: 'CONDOR', nombre_completo: 'CARLOS CONDOR', dni: '73144613', contacto_1: '958086874', email: 'jcarloscc1101@gmail.com', empresa: 'COVEPA', estado: 'Activo', activo: true }
]

// ────────────────────────────────────────────────────────────
// Helper: Mapeo de fila externa (personal) a modelo unificado de frontend
// ────────────────────────────────────────────────────────────
export function mapExternalPerson(p, localMetaMap = {}, profileMap = {}, profileByEmailMap = {}) {
  if (!p) return null

  const id = p.id_personal || p.id
  const nombre = (p.nombre || '').trim()
  const apellido = (p.apellido || '').trim()
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ') || (p.nombre_completo || 'Sin Nombre').trim()

  const phoneParts = [p.contacto_1, p.contacto_2].filter(Boolean)
  const combinedPhone = phoneParts.length > 0 ? phoneParts.join(' / ') : (p.telefono || null)

  const opParts = [p.operador_1, p.operador_2].filter(Boolean)
  const combinedOp = opParts.length > 0 ? opParts.join(' / ') : (p.operador || null)

  const isInactive = (p.estado || '').toUpperCase() === 'INACTIVO'
  const isActivo = !isInactive

  const localMeta = localMetaMap[id] || {}
  const profile = profileMap[id] || (p.email ? profileByEmailMap[p.email.toLowerCase().trim()] : null) || null

  return {
    id,
    id_personal: id,
    nombre,
    apellido,
    nombre_completo: nombreCompleto,
    dni: p.dni || p.documento_identidad || '',
    documento_identidad: p.dni || p.documento_identidad || '',
    cargo: p.cargo || 'SIN CARGO',
    email: p.email ? p.email.toLowerCase().trim() : '',
    empresa: p.empresa || 'COVEPA',
    contacto_1: p.contacto_1 || '',
    contacto_2: p.contacto_2 || '',
    operador_1: p.operador_1 || '',
    operador_2: p.operador_2 || '',
    estado: p.estado || 'Activo',
    activo: isActivo,
    telefono: combinedPhone,
    operador: combinedOp,
    // Metadatos locales de asignación de operación
    cuadrilla: localMeta.cuadrilla || p.cuadrilla || null,
    origen: localMeta.origen || p.origen || null,
    // Cuenta y rol en esta base de datos (COVEPA)
    cuenta_usuario: profile ? {
      id: profile.id,
      email: profile.email,
      rol: profile.rol,
      activo: profile.activo !== false
    } : null
  }
}

// ────────────────────────────────────────────────────────────
// Sincronización transparente de espejo local (non-blocking)
// Garantiza que claves foráneas en programaciones sigan funcionando
// ────────────────────────────────────────────────────────────
async function syncLocalMirror(persons) {
  if (!persons || persons.length === 0) return
  try {
    const rows = persons.map(p => ({
      id: p.id_personal,
      nombre_completo: [p.nombre, p.apellido].filter(Boolean).join(' ') || 'SIN NOMBRE',
      cargo: p.cargo || 'TÉCNICO',
      telefono: [p.contacto_1, p.contacto_2].filter(Boolean).join(' / ') || null,
      operador: [p.operador_1, p.operador_2].filter(Boolean).join(' / ') || null,
      documento_identidad: p.dni || null,
      email: p.email ? p.email.toLowerCase().trim() : null,
      empresa: p.empresa || 'COVEPA',
      activo: (p.estado || '').toUpperCase() !== 'INACTIVO'
    }))

    await supabase.from('personal').upsert(rows, { onConflict: 'id' })
  } catch (err) {
    console.warn('Sincronización de espejo local omitida o no requerida:', err?.message || err)
  }
}

// ────────────────────────────────────────────────────────────
// 1. Obtener todo el personal desde la BASE DE DATOS EXTERNA
// y enriquecer con los perfiles/roles de esta base de datos
// ────────────────────────────────────────────────────────────
export async function fetchPersonal() {
  try {
    // 1. Consultar base de datos externa (tabla personal)
    const { data: extPersonal, error: extErr } = await supabaseExt
      .from('personal')
      .select('*')
      .order('nombre', { ascending: true })

    if (extErr) {
      console.warn('Error consultando base externa, usando BD local como respaldo:', extErr.message)
      return fetchPersonalFallbackLocal()
    }

    if (!extPersonal || extPersonal.length === 0) {
      return fetchPersonalFallbackLocal()
    }

    // 2. Consultar metadatos locales (cuadrillas) y cuentas de usuario en esta base de datos
    let localMetaMap = {}
    let profileMap = {}
    let profileByEmailMap = {}

    try {
      const [metaRes, profRes] = await Promise.all([
        supabase.from('personal').select('id, cuadrilla, origen'),
        supabase.from('perfiles_usuario').select('*')
      ])

      if (metaRes.data) {
        metaRes.data.forEach(m => {
          localMetaMap[m.id] = m
        })
      }

      if (profRes.data) {
        profRes.data.forEach(pr => {
          if (pr.id_personal) profileMap[pr.id_personal] = pr
          if (pr.email) profileByEmailMap[pr.email.toLowerCase().trim()] = pr
        })
      }
    } catch (localErr) {
      console.warn('Error leyendo metadatos locales de personal:', localErr)
    }

    // 3. Mapear todo el personal
    const mapped = extPersonal.map(p =>
      mapExternalPerson(p, localMetaMap, profileMap, profileByEmailMap)
    )

    // Sincronizar espejo local en segundo plano para no bloquear UI
    setTimeout(() => {
      syncLocalMirror(extPersonal)
    }, 100)

    return mapped
  } catch (err) {
    console.error('Error general en fetchPersonal:', err)
    return fetchPersonalFallbackLocal()
  }
}

// Respaldo secundario si la base de datos externa estuviera inaccesible
async function fetchPersonalFallbackLocal() {
  const { data, error } = await supabase
    .from('personal')
    .select('*')
    .order('nombre_completo', { ascending: true })

  if (error || !data || data.length === 0) {
    return PERSONAL_FALLBACK.map(p => mapExternalPerson(p))
  }

  return data.map(p => mapExternalPerson(p))
}

// ────────────────────────────────────────────────────────────
// 2. Registrar nuevo integrante en la BASE DE DATOS EXTERNA
// y asignar cuenta/rol en esta base de datos si fue configurado
// ────────────────────────────────────────────────────────────
export async function createPersonal(payload) {
  // Construir registro para la tabla externa 'personal'
  const extPayload = {
    nombre: payload.nombre ? payload.nombre.trim() : (payload.nombre_completo ? payload.nombre_completo.trim() : ''),
    apellido: payload.apellido ? payload.apellido.trim() : null,
    dni: payload.dni ? payload.dni.trim() : (payload.documento_identidad ? payload.documento_identidad.trim() : null),
    cargo: payload.cargo ? payload.cargo.trim() : 'TÉCNICO',
    email: payload.email ? payload.email.trim().toLowerCase() : null,
    empresa: payload.empresa ? payload.empresa.trim() : 'COVEPA',
    contacto_1: payload.contacto_1 ? payload.contacto_1.trim() : (payload.telefono ? payload.telefono.split('/')[0]?.trim() : null),
    contacto_2: payload.contacto_2 ? payload.contacto_2.trim() : (payload.telefono ? payload.telefono.split('/')[1]?.trim() : null),
    operador_1: payload.operador_1 || null,
    operador_2: payload.operador_2 || null,
    estado: payload.estado || (payload.activo !== false ? 'Activo' : 'Inactivo')
  }

  // 1. Insertar en la BD EXTERNA
  const { data: newPerson, error: extErr } = await supabaseExt
    .from('personal')
    .insert([extPayload])
    .select()
    .single()

  if (extErr) throw new Error(`Error registrando en base externa: ${extErr.message}`)

  const personId = newPerson.id_personal

  // 2. Si se definió asignación de cuenta de ingreso en esta BD local, crearla
  if (payload.email && (payload.rol_cuenta || payload.asignar_cuenta)) {
    try {
      await assignUserAccount({
        id_personal: personId,
        email: payload.email,
        rol: payload.rol_cuenta || 'tecnico',
        activo: payload.cuenta_activa !== undefined ? payload.cuenta_activa : true
      })
    } catch (accErr) {
      console.warn('No se pudo autogenerar perfil local:', accErr)
    }
  }

  // 3. Espejo en la base local (incluyendo cuadrilla y origen si se definieron)
  try {
    await supabase.from('personal').upsert({
      id: personId,
      nombre_completo: [extPayload.nombre, extPayload.apellido].filter(Boolean).join(' '),
      cargo: extPayload.cargo,
      dni: extPayload.dni,
      documento_identidad: extPayload.dni,
      telefono: [extPayload.contacto_1, extPayload.contacto_2].filter(Boolean).join(' / ') || null,
      operador: [extPayload.operador_1, extPayload.operador_2].filter(Boolean).join(' / ') || null,
      cuadrilla: payload.cuadrilla ? payload.cuadrilla.trim().toUpperCase() : null,
      origen: payload.origen ? payload.origen.trim().toUpperCase() : null,
      email: extPayload.email,
      empresa: extPayload.empresa,
      activo: extPayload.estado === 'Activo'
    })
  } catch {
    // Continuar si falla el espejo
  }

  return mapExternalPerson(newPerson)
}

// ────────────────────────────────────────────────────────────
// 3. Actualizar datos de un integrante en la BASE DE DATOS EXTERNA
// y mantener actualizada la asignación de cuenta en esta base local
// ────────────────────────────────────────────────────────────
export async function updatePersonal(id, payload) {
  const extUpdate = {}

  if (payload.nombre !== undefined) extUpdate.nombre = payload.nombre ? payload.nombre.trim() : ''
  if (payload.apellido !== undefined) extUpdate.apellido = payload.apellido ? payload.apellido.trim() : null
  if (payload.dni !== undefined) extUpdate.dni = payload.dni ? payload.dni.trim() : null
  if (payload.documento_identidad !== undefined && payload.dni === undefined) {
    extUpdate.dni = payload.documento_identidad ? payload.documento_identidad.trim() : null
  }
  if (payload.cargo !== undefined) extUpdate.cargo = payload.cargo ? payload.cargo.trim() : null
  if (payload.email !== undefined) extUpdate.email = payload.email ? payload.email.trim().toLowerCase() : null
  if (payload.empresa !== undefined) extUpdate.empresa = payload.empresa ? payload.empresa.trim() : null
  if (payload.contacto_1 !== undefined) extUpdate.contacto_1 = payload.contacto_1 ? payload.contacto_1.trim() : null
  if (payload.contacto_2 !== undefined) extUpdate.contacto_2 = payload.contacto_2 ? payload.contacto_2.trim() : null
  if (payload.operador_1 !== undefined) extUpdate.operador_1 = payload.operador_1 || null
  if (payload.operador_2 !== undefined) extUpdate.operador_2 = payload.operador_2 || null

  if (payload.estado !== undefined) {
    extUpdate.estado = payload.estado
  } else if (payload.activo !== undefined) {
    extUpdate.estado = payload.activo ? 'Activo' : 'Inactivo'
  }

  // Si enviaron un teléfono combinado, desglosarlo
  if (payload.telefono !== undefined && payload.contacto_1 === undefined) {
    const phones = (payload.telefono || '').split('/').map(s => s.trim()).filter(Boolean)
    extUpdate.contacto_1 = phones[0] || null
    extUpdate.contacto_2 = phones[1] || null
  }
  if (payload.operador !== undefined && payload.operador_1 === undefined) {
    const ops = (payload.operador || '').split('/').map(s => s.trim()).filter(Boolean)
    extUpdate.operador_1 = ops[0] || null
    extUpdate.operador_2 = ops[1] || null
  }

  // 1. Actualizar en BD EXTERNA
  const { data: updatedPerson, error: extErr } = await supabaseExt
    .from('personal')
    .update(extUpdate)
    .eq('id_personal', id)
    .select()
    .single()

  if (extErr) throw new Error(`Error actualizando base externa: ${extErr.message}`)

  // 2. Si se actualizaron rol de cuenta o correo, sincronizar con perfiles_usuario en esta BD local
  const finalEmail = extUpdate.email !== undefined ? extUpdate.email : updatedPerson.email
  if (payload.rol_cuenta || payload.cuenta_activa !== undefined || (payload.email && payload.email !== undefined)) {
    try {
      await assignUserAccount({
        id_personal: id,
        email: finalEmail,
        rol: payload.rol_cuenta,
        activo: payload.cuenta_activa
      })
    } catch (accErr) {
      console.warn('Error sincronizando perfil local:', accErr)
    }
  }

  // 3. Sincronizar espejo local
  try {
    const localUpdate = {
      updated_at: new Date().toISOString()
    }
    if (extUpdate.nombre !== undefined || extUpdate.apellido !== undefined) {
      localUpdate.nombre_completo = [updatedPerson.nombre, updatedPerson.apellido].filter(Boolean).join(' ')
    }
    if (extUpdate.cargo !== undefined) localUpdate.cargo = extUpdate.cargo
    if (extUpdate.dni !== undefined) {
      localUpdate.documento_identidad = extUpdate.dni
      localUpdate.dni = extUpdate.dni
    }
    if (finalEmail !== undefined) localUpdate.email = finalEmail
    if (extUpdate.empresa !== undefined) localUpdate.empresa = extUpdate.empresa
    if (extUpdate.contacto_1 !== undefined || extUpdate.contacto_2 !== undefined) {
      localUpdate.telefono = [updatedPerson.contacto_1, updatedPerson.contacto_2].filter(Boolean).join(' / ') || null
    }
    if (extUpdate.operador_1 !== undefined || extUpdate.operador_2 !== undefined) {
      localUpdate.operador = [updatedPerson.operador_1, updatedPerson.operador_2].filter(Boolean).join(' / ') || null
    }
    if (payload.cuadrilla !== undefined) localUpdate.cuadrilla = payload.cuadrilla ? payload.cuadrilla.trim().toUpperCase() : null
    if (payload.origen !== undefined) localUpdate.origen = payload.origen ? payload.origen.trim().toUpperCase() : null
    if (extUpdate.estado !== undefined) localUpdate.activo = extUpdate.estado === 'Activo'

    await supabase.from('personal').update(localUpdate).eq('id', id)
  } catch {
    // Continuar si falla el espejo
  }

  return mapExternalPerson(updatedPerson)
}

// ────────────────────────────────────────────────────────────
// 4. Eliminar integrante del directorio de la BD EXTERNA
// ────────────────────────────────────────────────────────────
export async function deletePersonal(id) {
  const { error: extErr } = await supabaseExt
    .from('personal')
    .delete()
    .eq('id_personal', id)

  if (extErr) throw new Error(`Error eliminando de base externa: ${extErr.message}`)

  // Desvincular de espejo local y de perfiles_usuario en segundo plano
  try {
    await supabase.from('perfiles_usuario').update({ id_personal: null }).eq('id_personal', id)
    await supabase.from('personal').delete().eq('id', id)
  } catch (err) {
    console.warn('Limpieza local no crítica:', err)
  }

  return true
}

// ────────────────────────────────────────────────────────────
// 5. Asignar / Vincular una cuenta de acceso con su ROL
// en ESTA base de datos de este proyecto (perfiles_usuario)
// ────────────────────────────────────────────────────────────
export async function assignUserAccount({ id_personal, email, rol = 'tecnico', activo = true }) {
  if (!email) {
    throw new Error('Se requiere un correo electrónico para asignar cuenta de acceso.')
  }

  const cleanEmail = email.toLowerCase().trim()

  // 1. Buscar si ya existe un perfil con este correo o id_personal en perfiles_usuario
  const { data: existingProf } = await supabase
    .from('perfiles_usuario')
    .select('*')
    .or(`email.eq.${cleanEmail},id_personal.eq.${id_personal}`)
    .maybeSingle()

  let resultProfile = null

  if (existingProf) {
    const { data: updated, error: updErr } = await supabase
      .from('perfiles_usuario')
      .update({
        email: cleanEmail,
        rol: rol || existingProf.rol,
        id_personal,
        activo: activo !== undefined ? activo : existingProf.activo,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingProf.id)
      .select()
      .single()

    if (updErr) throw new Error(`Error actualizando cuenta en BD local: ${updErr.message}`)
    resultProfile = updated
  } else {
    // Insertar nuevo registro de perfil
    const { data: inserted, error: insErr } = await supabase
      .from('perfiles_usuario')
      .insert([{
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : undefined,
        email: cleanEmail,
        rol: rol || 'tecnico',
        id_personal,
        activo: activo !== undefined ? activo : true,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (insErr) {
      // Si falla por RLS o falta de sesión, registrar advertencia
      console.warn('Aviso insertando en perfiles_usuario:', insErr.message)
      resultProfile = { email: cleanEmail, rol, id_personal, activo }
    } else {
      resultProfile = inserted
    }
  }

  // 2. Mantener el correo en la BD EXTERNA para que coincida siempre
  try {
    await supabaseExt
      .from('personal')
      .update({ email: cleanEmail })
      .eq('id_personal', id_personal)
  } catch (extErr) {
    console.warn('Aviso actualizando email en base externa:', extErr)
  }

  return resultProfile
}

// ────────────────────────────────────────────────────────────
// 6. Habilitar / Deshabilitar cuenta de acceso y estado
// ────────────────────────────────────────────────────────────
export async function toggleAccesoPersonal(id, activo, email, rol = 'supervisor') {
  const newEstado = activo ? 'Activo' : 'Inactivo'

  // 1. Actualizar estado en la BD EXTERNA
  const { data: updatedExt, error: extErr } = await supabaseExt
    .from('personal')
    .update({ estado: newEstado })
    .eq('id_personal', id)
    .select()
    .single()

  if (extErr) throw new Error(`Error actualizando estado en base externa: ${extErr.message}`)

  // 2. Si tiene correo o perfil en esta base de datos, actualizar activo en perfiles_usuario
  if (email) {
    try {
      await assignUserAccount({
        id_personal: id,
        email,
        rol: rol || 'supervisor',
        activo
      })
    } catch (accErr) {
      console.warn('Aviso al actualizar perfiles_usuario:', accErr)
    }
  }

  return mapExternalPerson(updatedExt)
}

// ────────────────────────────────────────────────────────────
// 7. Configurar o actualizar integrantes de una cuadrilla predefinida
// Almacenado en la base de datos local para la operación COVEPA
// ────────────────────────────────────────────────────────────
export async function updateCuadrillaAssignments(cuadrillaName, { idTecnico, idConductor }) {
  const cName = cuadrillaName.trim().toUpperCase()

  // Buscar integrantes actuales con esta cuadrilla en local
  const { data: currentMembers } = await supabase
    .from('personal')
    .select('id, cargo')
    .eq('cuadrilla', cName)

  const members = currentMembers || []
  const currentTecs = members.filter(m => {
    const c = (m.cargo || '').toUpperCase()
    return c.includes('TÉCNICO') || c.includes('TECNICO') || c.includes('SUPERVISOR')
  })
  const currentConds = members.filter(m => {
    const c = (m.cargo || '').toUpperCase()
    return c.includes('CONDUCTOR')
  })

  // Desasignar técnicos que ya no pertenecen a esta cuadrilla
  const tecsToClear = currentTecs.filter(m => m.id !== idTecnico).map(m => m.id)
  if (tecsToClear.length > 0) {
    await supabase
      .from('personal')
      .update({ cuadrilla: null, updated_at: new Date().toISOString() })
      .in('id', tecsToClear)
  }

  // Desasignar conductores que ya no pertenecen a esta cuadrilla
  const condsToClear = currentConds.filter(m => m.id !== idConductor).map(m => m.id)
  if (condsToClear.length > 0) {
    await supabase
      .from('personal')
      .update({ cuadrilla: null, updated_at: new Date().toISOString() })
      .in('id', condsToClear)
  }

  // Asignar el nuevo técnico a la cuadrilla
  if (idTecnico) {
    await supabase
      .from('personal')
      .update({ cuadrilla: cName, updated_at: new Date().toISOString() })
      .eq('id', idTecnico)
  }

  // Asignar el nuevo conductor a la cuadrilla
  if (idConductor) {
    await supabase
      .from('personal')
      .update({ cuadrilla: cName, updated_at: new Date().toISOString() })
      .eq('id', idConductor)
  }

  return true
}
