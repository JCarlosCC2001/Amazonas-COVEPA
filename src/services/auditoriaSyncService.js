// =========================================================================================
// 🚀 PUENTE DE COMUNICACIÓN CON EL APLICATIVO DE FOTOS DE CAMPO
// =========================================================================================
// Archivo: src/services/auditoriaSyncService.js
//
// PROPÓSITO:
// Este módulo centraliza y aísla la sincronización de auditoría y estados de observaciones
// técnicas hacia la base de datos Supabase (`public.observaciones`).
//
// Permite que cuando un auditor/usuario revise, valide, rechace, descarte o actualice una
// observación en este ERP web, el aplicativo móvil de fotos de campo reciba y sincronice
// el dictamen y los cambios en tiempo real.
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
 * Función para actualizar el dictamen de una observación y sincronizar con Control Fotos
 * @param {string} idObs - Código PRONATEL de la observación (ej: 'H1-OC-25-316')
 * @param {string} estado - 'Validado' | 'Rechazado' | 'En Revisión' | 'Solicitando Revisión' | 'Descartado' | 'Pendiente'
 * @param {string} revisor - Nombre del auditor o usuario logueado
 * @param {string} [comentario] - Motivo de rechazo o nota técnica (opcional)
 */
export async function sincronizarEstadoConControlFotos(idObs, estado, revisor, comentario = null) {
  try {
    const { data, error } = await supabase
      .from('observaciones')
      .update({
        estado_covepa: estado,
        revisor: revisor,
        fecha_subsanacion: new Date().toISOString(),
        comentario_covepa: comentario
      })
      .eq('id_obs', idObs);
    if (error) {
      console.error('Error al actualizar observación:', error);
      return false;
    }
    console.log(`[Sincronización OK] Observación ${idObs} cambiada a ${estado}`);
    return true;
  } catch (err) {
    console.error('Error de red al actualizar observación:', err);
    return false;
  }
}

/**
 * SINCRONIZACIÓN PRINCIPAL:
 * Actualiza el dictamen de una observación técnica con los 4 campos oficiales requeridos.
 *
 * @param {string} idObs - Código único de la observación (ej: "H1-OC-100-242" o "H1-OC-25-340")
 * @param {Object} dictamen
 * @param {string} dictamen.nuevoEstado - Uno de los 6 estados oficiales
 * @param {string} [dictamen.revisor] - Nombre completo del auditor (si se omite, se usa fallback)
 * @param {string|null} [dictamen.comentarioTexto] - Notas técnicas, motivo de rechazo o sustento
 * @param {string} [dictamen.fechaSubsanacion] - Fecha ISO (por defecto new Date().toISOString())
 * @returns {Promise<{ data: Object|null, error: Object|null }>}
 */
export async function sincronizarAuditoriaObservacion(idObs, {
  nuevoEstado,
  revisor,
  comentarioTexto,
  fechaSubsanacion
} = {}) {
  if (!idObs) {
    throw new Error('[AUDITORIA-SYNC] Se requiere el código idObs para sincronizar.')
  }

  const estadoNormalizado = normalizarEstadoOficial(nuevoEstado)
  const revisorFinal = (revisor && String(revisor).trim()) ? String(revisor).trim() : 'Auditor COVEPA'
  const fechaFinal = fechaSubsanacion || new Date().toISOString()
  const comentarioLimpio = (comentarioTexto !== undefined && comentarioTexto !== null && String(comentarioTexto).trim() !== '')
    ? String(comentarioTexto).trim()
    : null

  const payload = {
    estado_covepa: estadoNormalizado,
    revisor: revisorFinal,
    fecha_subsanacion: fechaFinal,
    comentario_covepa: comentarioLimpio
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
    delete payload.revisor
    payload.validado_por = revisorFinal
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
  return { data: registroActualizado, error: null }
}

/**
 * SINCRONIZACIÓN DE COMENTARIO:
 * Permite guardar o autoguardar notas y motivos de dictamen sin alterar el estado existente.
 *
 * @param {string} idObs
 * @param {string|null} comentarioTexto
 * @param {string} [revisor]
 * @returns {Promise<{ data: Object|null, error: Object|null }>}
 */
export async function sincronizarComentarioObservacion(idObs, comentarioTexto, revisor = null) {
  if (!idObs) return { data: null, error: null }

  const comentarioLimpio = (comentarioTexto !== undefined && comentarioTexto !== null && String(comentarioTexto).trim() !== '')
    ? String(comentarioTexto).trim()
    : null

  const payload = {
    comentario_covepa: comentarioLimpio
  }
  if (revisor && String(revisor).trim()) {
    payload.revisor = String(revisor).trim()
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
