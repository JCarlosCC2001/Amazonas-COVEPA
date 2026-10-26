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
  const ciudadOrigen = p.ciudad_origen || localMeta.origen || p.origen || null

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
    // Ciudad de origen / base operativa directa de la BD externa
    ciudad_origen: ciudadOrigen,
    origen: ciudadOrigen,
    // Metadato de cuadrilla operativa
    cuadrilla: localMeta.cuadrilla || p.cuadrilla || null,
    // Cuenta y rol en esta base de datos (COVEPA)
    cuenta_usuario: profile ? {
      id: profile.id,
      email: profile.email,
      rol: profile.rol,
      activo: profile.activo !== false
    } : null
  }
}

// Helper: Configuración local de cuadrillas sin depender de la tabla personal eliminada
const CUADRILLAS_STORAGE_KEY = 'covepa_cuadrillas_config'

export function getLocalCuadrillasMap() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CUADRILLAS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveLocalCuadrillasMap(map) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CUADRILLAS_STORAGE_KEY, JSON.stringify(map))
  } catch {}
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
      console.warn('Error consultando base externa:', extErr.message)
      return PERSONAL_FALLBACK.map(p => mapExternalPerson(p))
    }

    if (!extPersonal || extPersonal.length === 0) {
      return PERSONAL_FALLBACK.map(p => mapExternalPerson(p))
    }

    // 2. Consultar cuentas de usuario (roles) en esta base de datos
    let profileMap = {}
    let profileByEmailMap = {}

    try {
      const { data: profData } = await supabase.from('perfiles_usuario').select('*')
      if (profData) {
        profData.forEach(pr => {
          if (pr.id_personal) profileMap[pr.id_personal] = pr
          if (pr.email) profileByEmailMap[pr.email.toLowerCase().trim()] = pr
        })
      }
    } catch (localErr) {
      console.warn('Aviso leyendo perfiles_usuario locales:', localErr)
    }

    // 3. Mapear cuadrillas desde almacenamiento local
    const cuadrillasMap = getLocalCuadrillasMap()
    const memberCuadrillaMap = {}
    Object.entries(cuadrillasMap).forEach(([cuadrillaName, members]) => {
      if (members.idTecnico) memberCuadrillaMap[members.idTecnico] = { cuadrilla: cuadrillaName }
      if (members.idConductor) memberCuadrillaMap[members.idConductor] = { cuadrilla: cuadrillaName }
    })

    // 4. Mapear todo el personal
    return extPersonal.map(p =>
      mapExternalPerson(p, memberCuadrillaMap, profileMap, profileByEmailMap)
    )
  } catch (err) {
    console.error('Error general en fetchPersonal:', err)
    return PERSONAL_FALLBACK.map(p => mapExternalPerson(p))
  }
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
    estado: payload.estado || (payload.activo !== false ? 'Activo' : 'Inactivo'),
    ciudad_origen: payload.ciudad_origen ? payload.ciudad_origen.trim() : (payload.origen ? payload.origen.trim() : null)
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

  // Si enviaron ciudad_origen u origen
  if (payload.ciudad_origen !== undefined) {
    extUpdate.ciudad_origen = payload.ciudad_origen ? payload.ciudad_origen.trim() : null
  } else if (payload.origen !== undefined) {
    extUpdate.ciudad_origen = payload.origen ? payload.origen.trim() : null
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

  // Desvincular de perfiles_usuario en segundo plano si existía
  try {
    await supabase.from('perfiles_usuario').update({ id_personal: null }).eq('id_personal', id)
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
// ────────────────────────────────────────────────────────────
export async function updateCuadrillaAssignments(cuadrillaName, { idTecnico, idConductor }) {
  const cName = cuadrillaName.trim().toUpperCase()
  const map = getLocalCuadrillasMap()
  map[cName] = { idTecnico, idConductor }
  saveLocalCuadrillasMap(map)
  return true
}
