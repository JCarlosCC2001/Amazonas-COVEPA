// =========================================================================================
// 🚀 PUENTE DE COMUNICACIÓN CON EL APLICATIVO DE FOTOS DE CAMPO Y AUDITORÍA DE ESTADOS
// =========================================================================================
// Archivo: src/services/auditoriaSyncService.js
//
// PROPÓSITO:
// Este módulo centraliza y aísla la sincronización de auditoría y estados de observaciones
// técnicas hacia la base de datos Supabase (`public.observaciones`), y gestiona el
// historial de trazabilidad cronológica en `public.historial_estados_observaciones`.
//
// ESPECIFICACIÓN DEL PAYLOAD (4 campos oficiales requeridos):
// 1. `estado_covepa`     : Uno de los 6 estados oficiales (respetando mayúsculas y tildes):
//                          'Validado' | 'Rechazado' | 'En Revisión' | 'Solicitando Revisión' | 'Descartado' | 'Pendiente'
// 2. `revisor`           : Nombre completo del usuario auditor logueado en la sesión activa.
// 3. `fecha_subsanacion` : Timestamp en formato ISO (new Date().toISOString()).
// 4. `comentario_covepa` : Motivo de rechazo, notas técnicas, sustento o dictamen (texto o null).
//
// FILTRO DE BÚSQUEDA: .eq('id_obs', idObs)
// =========================================================================================

import { supabase } from '../lib/supabase'
import { asegurarProgramacionSitio } from './programacionService'

/**
 * Catálogo estricto de los 6 estados oficiales permitidos por la integración
 */
export const ESTADOS_OFICIALES_COVEPA = Object.freeze([
  'Validado',
  'Rechazado',
  'En Revisión',
  'Solicitando Revisión',
  'Descartado',
  'Pendiente'
])

/**
 * Normaliza cualquier variante de texto a uno de los 6 estados canónicos oficiales con tildes.
 *
 * @param {string} estado
 * @returns {string} Estado oficial normalizado
 */
export function normalizarEstadoOficial(estado) {
  if (!estado) return 'Pendiente'
  const trimmed = String(estado).trim()

  if (trimmed === 'Validado' || trimmed === 'Enviado') return 'Validado'
  if (trimmed === 'Rechazado') return 'Rechazado'
  if (trimmed === 'En Revision' || trimmed === 'En Revisión') return 'En Revisión'
  if (trimmed === 'Solicitando Revision' || trimmed === 'Solicitando Revisión') return 'Solicitando Revisión'
  if (trimmed === 'Descartado') return 'Descartado'
  if (trimmed === 'Pendiente') return 'Pendiente'

  return trimmed
}

/**
 * Extrae el nombre completo del auditor desde la sesión activa de autenticación (useAuth).
 *
 * @param {Object|null} user - Objeto de usuario de Supabase Auth
 * @param {Object|null} personalMember - Perfil de personal vinculado desde la BD
 * @param {string} [fallback='Auditor COVEPA']
 * @returns {string} Nombre completo del auditor
 */
export function resolverNombreAuditor(user, personalMember = null, fallback = 'Auditor COVEPA') {
  if (personalMember?.nombre_completo && String(personalMember.nombre_completo).trim()) {
    return String(personalMember.nombre_completo).trim()
  }
  if (user?.user_metadata?.nombre_completo && String(user.user_metadata.nombre_completo).trim()) {
    return String(user.user_metadata.nombre_completo).trim()
  }
  if (user?.user_metadata?.nombre && String(user.user_metadata.nombre).trim()) {
    return String(user.user_metadata.nombre).trim()
  }
  if (user?.user_metadata?.full_name && String(user.user_metadata.full_name).trim()) {
    return String(user.user_metadata.full_name).trim()
  }
  if (user?.email) {
    const rawPrefix = user.email.split('@')[0].replace(/[._-]/g, ' ')
    const capitalized = rawPrefix
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
    return capitalized || fallback
  }
  return fallback
}

/**
 * Registra un evento en la tabla de trazabilidad histórica `historial_estados_observaciones`.
 *
 * @param {Object} params
 * @param {string} params.idObs - Código de la observación
 * @param {string} [params.idSitio] - Código del sitio
 * @param {string} [params.estadoAnterior] - Estado previo antes del cambio
 * @param {string} params.estadoNuevo - Nuevo estado aplicado
 * @param {string} [params.usuarioNombre] - Nombre del auditor o usuario
 * @param {string} [params.usuarioEmail] - Correo electrónico de sesión
 * @param {string} [params.usuarioId] - UUID de autenticación de Supabase
 * @param {string} [params.comentario] - Motivo, sustento o nota técnica
 * @param {string} [params.origen] - 'programacion' | 'observaciones' | 'app_fotos' | 'web_erp'
 * @returns {Promise<Object|null>}
 */
export async function registrarHistorialEstado({
  idObs,
  idSitio = null,
  estadoAnterior = null,
  estadoNuevo,
  usuarioNombre = 'Auditor COVEPA',
  usuarioEmail = null,
  usuarioId = null,
  comentario = null,
  origen = 'web_erp'
}) {
  if (!idObs || !estadoNuevo) return null
  try {
    const { data, error } = await supabase
      .from('historial_estados_observaciones')
      .insert({
        id_obs: idObs,
        id_sitio: idSitio || null,
        estado_anterior: estadoAnterior || null,
        estado_nuevo: normalizarEstadoOficial(estadoNuevo),
        usuario_nombre: usuarioNombre || 'Auditor COVEPA',
        usuario_email: usuarioEmail || null,
        usuario_id: usuarioId || null,
        comentario: comentario || null,
        origen: origen,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.warn('[HISTORIAL-SYNC] Advertencia al registrar historial:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.warn('[HISTORIAL-SYNC] Error de red al registrar historial:', err)
    return null
  }
}

/**
 * Consulta la lista cronológica de cambios de estado de una observación.
 *
 * @param {string} idObs - Código de observación
 * @returns {Promise<Array>} Lista de registros ordenada descendentemente por fecha
 */
export async function fetchHistorialObservacion(idObs) {
  if (!idObs) return []
  try {
    const { data, error } = await supabase
      .from('historial_estados_observaciones')
      .select('*')
      .eq('id_obs', idObs)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[HISTORIAL-FETCH] Error al consultar historial:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.warn('[HISTORIAL-FETCH] Error de red al consultar historial:', err)
    return []
  }
}

/**
 * Función para actualizar el dictamen de una observación, sincronizar con Control Fotos
 * y registrar automáticamente el evento en el historial de trazabilidad.
 *
 * @param {string} idObs - Código PRONATEL de la observación (ej: 'H1-OC-25-316')
 * @param {string} estado - 'Validado' | 'Rechazado' | 'En Revisión' | 'Solicitando Revisión' | 'Descartado' | 'Pendiente'
 * @param {string} revisor - Nombre del auditor o usuario logueado
 * @param {string} [comentario] - Motivo de rechazo o nota técnica (opcional)
 * @param {Object} [extraContext] - Datos adicionales de contexto ({ idSitio, estadoAnterior, usuarioEmail, usuarioId, origen, fechaIso })
 */
export async function sincronizarEstadoConControlFotos(idObs, estado, revisor, comentario = null, extraContext = {}) {
  try {
    const estadoNorm = normalizarEstadoOficial(estado)
    const fechaIso = extraContext.fechaIso || new Date().toISOString()

    // Regla de Auto-Programación:
    // Verificar si existe programación para esa fecha; de no existir, primero genera la programación y luego continúa.
    try {
      await asegurarProgramacionSitio({
        idSitio: extraContext.idSitio,
        idObs,
        fecha: fechaIso
      })
    } catch (autoProgErr) {
      console.warn('[AUTO-PROG-WARN] Error verificando/generando programación:', autoProgErr)
    }

    // Payload de actualización en la tabla observaciones
    const updatePayload = {
      estado_covepa: estadoNorm,
      fecha_subsanacion: fechaIso,
      comentario_covepa: comentario
    }

    // Regla de Negocio: Conservar siempre el Revisor que ya estaba asignado (a menos que se especifique)
    if (revisor !== undefined) {
      updatePayload.revisor = revisor || null
    }

    const { data, error } = await supabase
      .from('observaciones')
      .update(updatePayload)
      .eq('id_obs', idObs)

    if (error) {
      console.error('Error al actualizar observación:', error)
      return false
    }

    console.log(`[Sincronización OK] Observación ${idObs} cambiada a ${estadoNorm}`)

    // El autor de la acción para el historial de trazabilidad es el usuario que ejecutó el cambio
    const usuarioAccion = extraContext.usuarioNombre || 'Usuario del Sistema'

    // Registro automático no bloqueante en el historial de estados
    registrarHistorialEstado({
      idObs,
      idSitio: extraContext.idSitio,
      estadoAnterior: extraContext.estadoAnterior,
      estadoNuevo: estadoNorm,
      usuarioNombre: usuarioAccion,
      usuarioEmail: extraContext.usuarioEmail,
      usuarioId: extraContext.usuarioId,
      comentario: comentario,
      origen: extraContext.origen || 'web_erp'
    }).catch(err => console.warn('[HISTORIAL-WARN] Error registrando historial:', err))

    return true
  } catch (err) {
    console.error('Error de red al actualizar observación:', err)
    return false
  }
}

/**
 * Valida si un nombre pertenece estrictamente al personal auditor de GILAT.
 * Solo personal de GILAT puede ser asignado como Revisor de observaciones.
 *
 * @param {string|null} nombre
 * @param {Array} [gilatOptions=[]]
 * @returns {boolean}
 */
export function esRevisorGilat(nombre, gilatOptions = []) {
  if (!nombre) return false
  const n = String(nombre).trim().toUpperCase()
  if (n.includes('GILAT')) return true
  if (n === 'AMILCAR HANDER' || n === 'THALIA URQUIZO') return true
  return (gilatOptions || []).some(g => (g.nombre_completo || '').toUpperCase().trim() === n)
}

/**
 * SINCRONIZACIÓN PRINCIPAL:
 * Actualiza el dictamen de una observación técnica con los campos oficiales requeridos
 * y registra el evento en el historial de trazabilidad.
 *
 * @param {string} idObs - Código único de la observación (ej: "H1-OC-100-242" o "H1-OC-25-340")
 * @param {Object} dictamen
 * @param {string} dictamen.nuevoEstado - Uno de los 6 estados oficiales
 * @param {string} [dictamen.revisor] - Solo personal de GILAT
 * @param {string} [dictamen.usuarioNombre] - Nombre del usuario activo de la sesión que realiza el cambio
 * @param {string|null} [dictamen.comentarioTexto] - Notas técnicas, motivo de rechazo o sustento
 * @param {string} [dictamen.fechaSubsanacion] - Fecha ISO (por defecto new Date().toISOString())
 * @param {string} [dictamen.estadoAnterior] - Estado anterior
 * @param {string} [dictamen.idSitio] - Sitio asociado
 * @param {string} [dictamen.usuarioEmail] - Correo del usuario autenticado
 * @param {string} [dictamen.usuarioId] - UUID del usuario autenticado
 * @param {string} [dictamen.origen] - 'programacion' | 'observaciones' | 'app_fotos' | 'web_erp'
 * @returns {Promise<{ data: Object|null, error: Object|null }>}
 */
export async function sincronizarAuditoriaObservacion(idObs, {
  nuevoEstado,
  revisor = undefined,
  usuarioNombre = null,
  comentarioTexto,
  fechaSubsanacion,
  estadoAnterior = null,
  idSitio = null,
  usuarioEmail = null,
  usuarioId = null,
  origen = 'web_erp'
} = {}) {
  if (!idObs) {
    throw new Error('[AUDITORIA-SYNC] Se requiere el código idObs para sincronizar.')
  }

  const estadoNormalizado = normalizarEstadoOficial(nuevoEstado)
  const fechaFinal = fechaSubsanacion || new Date().toISOString()

  // Regla de Auto-Programación:
  // Verificar si existe programación para esa fecha; de no existir, primero genera la programación y luego continúa.
  try {
    await asegurarProgramacionSitio({
      idSitio,
      idObs,
      fecha: fechaFinal
    })
  } catch (autoProgErr) {
    console.warn('[AUTO-PROG-WARN] Error verificando/generando programación:', autoProgErr)
  }

  const comentarioLimpio = (comentarioTexto !== undefined && comentarioTexto !== null && String(comentarioTexto).trim() !== '')
    ? String(comentarioTexto).trim()
    : null

  const payload = {
    estado_covepa: estadoNormalizado,
    fecha_subsanacion: fechaFinal,
    comentario_covepa: comentarioLimpio
  }

  // Regla: En revisores solo va personal de Gilat, NUNCA autocompletar con el usuario de sesión
  if (revisor !== undefined) {
    payload.revisor = (revisor && esRevisorGilat(revisor)) ? String(revisor).trim() : (revisor || null)
  }

  console.log(`[AUDITORIA-SYNC] Sincronizando observación ${idObs} con app de fotos:`, payload)

  // Actualización en la tabla public.observaciones
  let { data, error } = await supabase
    .from('observaciones')
    .update(payload)
    .eq('id_obs', idObs)
    .select()

  // Compatibilidad defensiva: si la columna revisor en la base de datos se llamase validado_por
  if (error && error.code === 'PGRST204' && payload.revisor !== undefined) {
    const revVal = payload.revisor
    delete payload.revisor
    payload.validado_por = revVal
    const retry = await supabase
      .from('observaciones')
      .update(payload)
      .eq('id_obs', idObs)
      .select()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error(`[AUDITORIA-SYNC] ❌ Error en sincronización de observación ${idObs}:`, error)
    throw new Error(`Error sincronizando observación ${idObs}: ${error.message}`)
  }

  const registroActualizado = data?.[0] || null
  console.log(`[AUDITORIA-SYNC] ✅ Observación ${idObs} sincronizada exitosamente.`)

  // El responsable del cambio en el historial SIEMPRE es el usuario activo de la sesión
  const responsableSesion = usuarioNombre || 'Usuario de sesión'

  // Registro en el historial
  registrarHistorialEstado({
    idObs,
    idSitio,
    estadoAnterior,
    estadoNuevo: estadoNormalizado,
    usuarioNombre: responsableSesion,
    usuarioEmail,
    usuarioId,
    comentario: comentarioLimpio,
    origen
  }).catch(err => console.warn('[HISTORIAL-WARN] Error registrando historial:', err))

  return { data: registroActualizado, error: null }
}

/**
 * SINCRONIZACIÓN DE COMENTARIO:
 * Permite guardar o autoguardar notas y motivos de dictamen sin alterar el estado existente.
 * NOTA DE SEGURIDAD: Nunca modifica ni autocompleta el campo revisor.
 *
 * @param {string} idObs
 * @param {string|null} comentarioTexto
 * @returns {Promise<{ data: Object|null, error: Object|null }>}
 */
export async function sincronizarComentarioObservacion(idObs, comentarioTexto) {
  if (!idObs) return { data: null, error: null }

  const comentarioLimpio = (comentarioTexto !== undefined && comentarioTexto !== null && String(comentarioTexto).trim() !== '')
    ? String(comentarioTexto).trim()
    : null

  const payload = {
    comentario_covepa: comentarioLimpio
  }

  const { data, error } = await supabase
    .from('observaciones')
    .update(payload)
    .eq('id_obs', idObs)
    .select()

  if (error) {
    console.error(`[AUDITORIA-SYNC] ❌ Error sincronizando comentario en observación ${idObs}:`, error)
    throw new Error(`Error sincronizando comentario: ${error.message}`)
  }

  return { data: data?.[0] || null, error: null }
}
