import { supabase, handleSupabaseAuthError } from '../lib/supabase'

// Fallback del personal inicial del proyecto por si falla la red o DB
export const PERSONAL_FALLBACK = [
  { id: '1', cuadrilla: 'CUADRILLA 1', origen: 'PEDRO RUIZ', cargo: 'TÉCNICO', nombre_completo: 'JHONATAN FLORES', telefono: '929985566', operador: 'BITEL', activo: true },
  { id: '2', cuadrilla: null, origen: 'CHICLAYO', cargo: 'CONDUCTOR', nombre_completo: 'ANDER PERALTA', telefono: '945551928', operador: null, activo: true },
  { id: '3', cuadrilla: 'CUADRILLA 2', origen: 'HUANCAYO', cargo: 'TÉCNICO', nombre_completo: 'DANIEL JAVIER', telefono: '956188967', operador: 'BITEL', activo: true },
  { id: '4', cuadrilla: null, origen: null, cargo: 'CONDUCTOR', nombre_completo: 'LINO TICLLA', telefono: '910493156', operador: null, activo: true },
  { id: '5', cuadrilla: 'CUADRILLA 3', origen: 'HUANCAYO', cargo: 'TÉCNICO', nombre_completo: 'ALFONSO CURI', telefono: '952010919 / 939507297', operador: 'BITEL / MOVISTAR', activo: true },
  { id: '6', cuadrilla: null, origen: 'BAGUA GRANDE', cargo: 'CONDUCTOR', nombre_completo: 'JHORDITH ZULUETA (TOÑO)', telefono: '999389272', operador: null, activo: true },
  { id: '7', cuadrilla: 'CUADRILLA 4', origen: 'LIMA', cargo: 'SUPERVISOR / CAMPO', nombre_completo: 'WILLIAM AVILA', telefono: '951231901', operador: 'CLARO', activo: true },
  { id: '8', cuadrilla: null, origen: 'BAGUA GRANDE', cargo: 'CONDUCTOR', nombre_completo: 'JHORDIN PEREZ', telefono: '921004913', operador: null, activo: true },
  { id: '9', cuadrilla: 'CUADRILLA 5', origen: 'BAGUA GRANDE', cargo: 'TÉCNICO', nombre_completo: 'GABRIEL FARRO', telefono: '931704961', operador: 'BITEL', activo: true },
  { id: '10', cuadrilla: null, origen: 'BAGUA GRANDE', cargo: 'CONDUCTOR', nombre_completo: 'NILSON VERA', telefono: '969936764', operador: null, activo: true },
  { id: '11', cuadrilla: 'CUADRILLA 6', origen: 'CHACHAPOYAS', cargo: 'TÉCNICO', nombre_completo: 'CRISTIAN ISLA', telefono: '923932783 / 930996665', operador: 'CLARO / BITEL', activo: true },
  { id: '12', cuadrilla: null, origen: 'CHACHAPOYAS', cargo: 'SUPERVISOR', nombre_completo: 'CARLOS CONDOR', documento_identidad: '73144613', telefono: '958086874', operador: null, email: 'jcarloscc1101@gmail.com', empresa: 'COVEPA', activo: true }
]

// ────────────────────────────────────────────────────────────
// 1. Obtener todo el personal ordenado por cuadrilla y cargo
// ────────────────────────────────────────────────────────────
export async function fetchPersonal() {
  const { data, error } = await supabase
    .from('personal')
    .select('*')
    .order('cuadrilla', { ascending: true })
    .order('cargo', { ascending: false })

  if (error) {
    handleSupabaseAuthError(error)
    console.warn('Error fetching personal, using fallback:', error.message)
    return PERSONAL_FALLBACK
  }

  if (!data || data.length === 0) {
    return PERSONAL_FALLBACK
  }

  return data
}

// ────────────────────────────────────────────────────────────
// 2. Registrar nuevo integrante en la base de datos
// ────────────────────────────────────────────────────────────
export async function createPersonal(payload) {
  const { data, error } = await supabase
    .from('personal')
    .insert([{
      cuadrilla: payload.cuadrilla ? payload.cuadrilla.trim().toUpperCase() : null,
      cargo: payload.cargo ? payload.cargo.trim().toUpperCase() : 'TÉCNICO',
      nombre_completo: payload.nombre_completo ? payload.nombre_completo.trim().toUpperCase() : '',
      telefono: payload.telefono ? payload.telefono.trim() : null,
      operador: payload.operador ? payload.operador.trim().toUpperCase() : null,
      origen: payload.origen ? payload.origen.trim().toUpperCase() : null,
      documento_identidad: payload.documento_identidad ? payload.documento_identidad.trim() : null,
      email: payload.email ? payload.email.trim().toLowerCase() : null,
      empresa: payload.empresa ? payload.empresa.trim().toUpperCase() : 'COVEPA',
      activo: payload.activo !== undefined ? payload.activo : true
    }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// ────────────────────────────────────────────────────────────
// 3. Actualizar datos de un integrante
// ────────────────────────────────────────────────────────────
export async function updatePersonal(id, payload) {
  const updateData = {
    updated_at: new Date().toISOString()
  }
  if (payload.cuadrilla !== undefined) updateData.cuadrilla = payload.cuadrilla ? payload.cuadrilla.trim().toUpperCase() : null
  if (payload.cargo !== undefined) updateData.cargo = payload.cargo ? payload.cargo.trim().toUpperCase() : null
  if (payload.nombre_completo !== undefined) updateData.nombre_completo = payload.nombre_completo.trim().toUpperCase()
  if (payload.telefono !== undefined) updateData.telefono = payload.telefono ? payload.telefono.trim() : null
  if (payload.operador !== undefined) updateData.operador = payload.operador ? payload.operador.trim().toUpperCase() : null
  if (payload.origen !== undefined) updateData.origen = payload.origen ? payload.origen.trim().toUpperCase() : null
  if (payload.documento_identidad !== undefined) updateData.documento_identidad = payload.documento_identidad ? payload.documento_identidad.trim() : null
  if (payload.email !== undefined) updateData.email = payload.email ? payload.email.trim().toLowerCase() : null
  if (payload.empresa !== undefined) updateData.empresa = payload.empresa ? payload.empresa.trim().toUpperCase() : 'COVEPA'
  if (payload.activo !== undefined) updateData.activo = payload.activo

  const { data, error } = await supabase
    .from('personal')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// ────────────────────────────────────────────────────────────
// 4. Eliminar integrante del directorio
// ────────────────────────────────────────────────────────────
export async function deletePersonal(id) {
  const { error } = await supabase
    .from('personal')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  return true
}

// ────────────────────────────────────────────────────────────
// 5. Configurar o actualizar integrantes de una cuadrilla predefinida
// ────────────────────────────────────────────────────────────
export async function updateCuadrillaAssignments(cuadrillaName, { idTecnico, idConductor }) {
  const cName = cuadrillaName.trim().toUpperCase()

  // Buscar integrantes actuales con esta cuadrilla
  const { data: currentMembers, error: fetchErr } = await supabase
    .from('personal')
    .select('id, cargo')
    .eq('cuadrilla', cName)

  if (fetchErr) throw fetchErr

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

// ────────────────────────────────────────────────────────────
// 6. Habilitar / Deshabilitar cuenta de acceso al sistema
// ────────────────────────────────────────────────────────────
export async function toggleAccesoPersonal(id, activo, email, rol = 'supervisor') {
  const { data: updatedPerson, error: pErr } = await supabase
    .from('personal')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (pErr) throw new Error(pErr.message)

  if (email) {
    try {
      const { data: profile } = await supabase
        .from('perfiles_usuario')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle()

      if (profile) {
        await supabase
          .from('perfiles_usuario')
          .update({
            activo,
            rol: rol || profile.rol,
            id_personal: id,
            updated_at: new Date().toISOString()
          })
          .eq('email', email.toLowerCase().trim())
      }
    } catch (err) {
      console.warn('Sincronización con perfiles_usuario omitida o no requerida:', err)
    }
  }

  return updatedPerson
}

