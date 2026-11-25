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
import { ASIGNACIONES_BASE } from './sitiosService'
import { getPeruISOString } from '../utils/helpers'
import { resolveTecnicoAndCuadrilla } from '../shared/reportesCore.js'

/**
 * Catálogo estricto de los estados oficiales permitidos por la integración
 */
export const ESTADOS_OFICIALES_COVEPA = Object.freeze([
  'Validado',
  'Pre-validado',
  'Rechazado',
  'En Revisión',
  'Solicitando Revisión',
  'Documentación',
  'Crítico',
  'Descartado',
  'Pendiente'
])

/**
 * Normaliza cualquier variante de texto a uno de los estados canónicos oficiales con tildes.
 *
 * @param {string} estado
 * @returns {string} Estado oficial normalizado
 */
export function normalizarEstadoOficial(estado) {
  if (!estado) return 'Pendiente'
  const trimmed = String(estado).trim()

  if (trimmed === 'Validado' || trimmed === 'Enviado') return 'Validado'
  if (trimmed === 'Pre-validado' || trimmed === 'Pre-Validado' || trimmed === 'Prevalidado') return 'Pre-validado'
  if (trimmed === 'Rechazado') return 'Rechazado'
  if (trimmed === 'En Revision' || trimmed === 'En Revisión') return 'En Revisión'
  if (trimmed === 'Solicitando Revision' || trimmed === 'Solicitando Revisión') return 'Solicitando Revisión'
  if (trimmed === 'Documentacion' || trimmed === 'Documentación') return 'Documentación'
  if (trimmed === 'Critico' || trimmed === 'Crítico') return 'Crítico'
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
  if (personalMember?.nombre && String(personalMember.nombre).trim()) {
    const ap = personalMember.apellido ? ` ${personalMember.apellido}` : ''
    return `${personalMember.nombre}${ap}`.trim()
  }
  if (user?.user_metadata?.nombre_completo && String(user.user_metadata.nombre_completo).trim()) {
    return String(user.user_metadata.nombre_completo).trim()
  }
  if (user?.user_metadata?.nombre && String(user.user_metadata.nombre).trim()) {
    const ap = user.user_metadata.apellido ? ` ${user.user_metadata.apellido}` : ''
    return `${user.user_metadata.nombre}${ap}`.trim()
  }
  if (user?.user_metadata?.full_name && String(user.user_metadata.full_name).trim()) {
    return String(user.user_metadata.full_name).trim()
  }

  // Diccionario de nombres oficiales para cuentas de usuario COVEPA conocidas
  const emailNorm = (user?.email || '').toLowerCase().trim()
  const KNOWN_USERS_MAP = {
    'jcarloscc1101@gmail.com': 'Jhoan Carlos Condor Callupe',
    'fduran@covepa.pe': 'Flor Duran',
    'ksedano@covepa.pe': 'Kevin Sedano',
    'ccondor@covepa.pe': 'Carlos Condor',
    'hventocilla@covepa.pe': 'Hans Ventocilla'
  }
  if (KNOWN_USERS_MAP[emailNorm]) {
    return KNOWN_USERS_MAP[emailNorm]
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
  origen = 'web_erp',
  fechaExacta = null
}) {
  if (!idObs || !estadoNuevo) return null

  // Regla de Negocio: No registrar cambios que sean solo de comentario o donde no haya cambio real de estado
  const estAntNorm = estadoAnterior ? normalizarEstadoOficial(estadoAnterior) : null
  const estNuevoNorm = normalizarEstadoOficial(estadoNuevo)
  if (estAntNorm && estNuevoNorm && estAntNorm === estNuevoNorm) {
    return null
  }
  if (comentario && (comentario.includes('Edición de Comentario COVEPA') || comentario === 'Comentario COVEPA eliminado')) {
    return null
  }

  // Prevención de duplicados para 'Solicitando Revisión':
  // Si en los últimos 15 minutos ya existe un registro de Solicitando Revisión para esta observación, no duplicar.
  if (estNuevoNorm === 'Solicitando Revisión') {
    try {
      const quinceMinAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data: exist } = await supabase
        .from('historial_estados_observaciones')
        .select('id, usuario_nombre, comentario')
        .eq('id_obs', idObs)
        .in('estado_nuevo', ['Solicitando Revisión', 'Solicitando Revision'])
        .gte('created_at', quinceMinAtras)
        .order('created_at', { ascending: false })
        .limit(1)

      if (exist && exist.length > 0) {
        // Si el registro previo tenía nombre genérico y ahora se conoce el técnico real, enriquecerlo
        if (esNombreGenerico(exist[0].usuario_nombre) && !esNombreGenerico(usuarioNombre)) {
          await supabase
            .from('historial_estados_observaciones')
            .update({ usuario_nombre: usuarioNombre })
            .eq('id', exist[0].id)
        }
        // Atribuir técnico ejecutor a la observación si no estaba
        if (!esNombreGenerico(usuarioNombre)) {
          atribuirTecnicoYCuadrillaAObservacion(idObs, usuarioNombre, idSitio).catch(() => {})
        }
        return null // Omitir inserción redundante
      }
    } catch (checkErr) {
      console.warn('[HISTORIAL-DEDUPE] Advertencia comprobando duplicado:', checkErr)
    }
  }

  try {
    const { data, error } = await supabase
      .from('historial_estados_observaciones')
      .insert({
        id_obs: idObs,
        id_sitio: idSitio || null,
        estado_anterior: estadoAnterior || null,
        estado_nuevo: estNuevoNorm,
        usuario_nombre: usuarioNombre || 'Auditor COVEPA',
        usuario_email: usuarioEmail || null,
        usuario_id: usuarioId || null,
        comentario: comentario || null,
        origen: origen,
        created_at: fechaExacta || new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) {
      console.warn('[HISTORIAL-SYNC] Advertencia al registrar historial:', error.message)
      return null
    }

    // Si es Solicitando Revisión, auto-asignar el técnico ejecutor y cuadrilla a la observación
    if (estNuevoNorm === 'Solicitando Revisión' && !esNombreGenerico(usuarioNombre)) {
      atribuirTecnicoYCuadrillaAObservacion(idObs, usuarioNombre, idSitio).catch(() => {})
    }

    return data
  } catch (err) {
    console.warn('[HISTORIAL-SYNC] Error de red al registrar historial:', err)
    return null
  }
}

/**
 * Determina si un nombre es genérico del sistema en lugar de una persona real.
 */
export function esNombreGenerico(nombre) {
  if (!nombre) return true
  const s = String(nombre).trim().toLowerCase()
  return (
    s === 'técnico de campo (app fotos)' ||
    s === 'tecnico de campo (app fotos)' ||
    s === 'técnico de campo' ||
    s === 'tecnico de campo' ||
    s === 'app fotos' ||
    s === 'auditor covepa' ||
    s === 'usuario de sesión' ||
    s === 'usuario de sesion' ||
    s === 'sistema' ||
    s === 'sistema (trigger)' ||
    s === 'administrador'
  )
}

/**
 * Deduplica eventos de historial consecutivos con el mismo estado nuevo
 * ocurridos en una misma ráfaga de tiempo (<= 30 minutos).
 * Si uno de los eventos tiene el nombre real del técnico (ej. Juan Castro Torres)
 * y el otro es genérico (ej. Técnico de Campo (App Fotos)), conserva el nombre real.
 */
export function deduplicarHistorialEventos(eventos) {
  if (!Array.isArray(eventos) || eventos.length <= 1) return eventos || []

  const resultado = []

  for (let i = 0; i < eventos.length; i++) {
    const cur = eventos[i]
    if (resultado.length === 0) {
      resultado.push(cur)
      continue
    }

    const prev = resultado[resultado.length - 1]
    const mismoEstadoNuevo = normalizarEstadoOficial(cur.estado_nuevo) === normalizarEstadoOficial(prev.estado_nuevo)

    if (mismoEstadoNuevo) {
      const diffMs = Math.abs(new Date(cur.created_at) - new Date(prev.created_at))
      // Si ocurrieron con menos de 30 minutos de diferencia (ráfaga o sincronización duplicada)
      if (isNaN(diffMs) || diffMs <= 30 * 60 * 1000) {
        const esSolRev = normalizarEstadoOficial(cur.estado_nuevo) === 'Solicitando Revisión'
        const prevEsGilat = esSolRev && esRevisorGilat(prev.usuario_nombre)
        const curEsGilat = esSolRev && esRevisorGilat(cur.usuario_nombre)

        const prevEsGen = esNombreGenerico(prev.usuario_nombre) || prevEsGilat
        const curEsGen = esNombreGenerico(cur.usuario_nombre) || curEsGilat

        if (prevEsGen && !curEsGen) {
          // Reemplazar prev por cur porque cur tiene el nombre real del técnico
          resultado[resultado.length - 1] = {
            ...cur,
            comentario: cur.comentario || prev.comentario || null,
            created_at: cur.created_at || prev.created_at
          }
        } else if (!prevEsGen && curEsGen) {
          // Conservar prev que ya tiene el nombre real, pero transferir comentario si prev no tenía
          if (!prev.comentario && cur.comentario) {
            resultado[resultado.length - 1] = {
              ...prev,
              comentario: cur.comentario
            }
          }
        } else {
          // Ambos genéricos o ambos con nombre: si prev es auditor Gilat en Solicitando Revisión, priorizar cur
          if (prevEsGilat && !curEsGilat) {
            resultado[resultado.length - 1] = {
              ...cur,
              comentario: cur.comentario || prev.comentario || null
            }
          } else if (!prev.comentario && cur.comentario) {
            resultado[resultado.length - 1] = {
              ...prev,
              comentario: cur.comentario
            }
          }
        }
        continue // Omitir duplicado
      }
    }

    resultado.push(cur)
  }

  // Sanitizar cualquier evento de 'Solicitando Revisión' que haya quedado con nombre de auditor Gilat
  // (Un auditor de Gilat nunca solicita revisión técnica desde campo)
  return resultado.map(ev => {
    if (normalizarEstadoOficial(ev.estado_nuevo) === 'Solicitando Revisión' && esRevisorGilat(ev.usuario_nombre)) {
      return {
        ...ev,
        usuario_nombre: 'Técnico de Campo (App Fotos)'
      }
    }
    return ev
  })
}

/**
 * Atribuye automáticamente el técnico ejecutor y cuadrilla a una observación en Supabase
 * buscando el nombre recibido contra la lista oficial de personal del proyecto.
 *
 * @param {string} idObs - Código de la observación (ej: 'C-4068')
 * @param {string} nombreTecnico - Nombre del solicitante (ej: 'Juan Castro Torres')
 * @param {string} [idSitio] - Código del sitio (opcional)
 * @returns {Promise<Object|null>} { tecnico, cuadrilla } si se resolvió y actualizó
 */
export async function atribuirTecnicoYCuadrillaAObservacion(idObs, nombreTecnico, idSitio = null) {
  if (!idObs || !nombreTecnico) return null
  const resolved = resolveTecnicoAndCuadrilla(nombreTecnico)
  if (!resolved?.tecnico || !resolved?.cuadrilla) return null

  try {
    const updatePayload = {
      tecnico_ejecutor: resolved.id_personal || resolved.tecnico,
      cuadrilla_ejecutora: resolved.cuadrilla,
      revisor: null
    }

    let query = supabase
      .from('observaciones')
      .update(updatePayload)
      .eq('id_obs', idObs)

    if (idSitio) {
      query = query.eq('id_sitio', idSitio)
    }

    const { error } = await query
    if (error) {
      console.warn('[ATRIBUIR-TEC] Error asignando técnico ejecutor:', error.message)
      return null
    }

    return resolved
  } catch (err) {
    console.warn('[ATRIBUIR-TEC] Excepción asignando técnico ejecutor:', err)
    return null
  }
}

/**
 * Evalúa si un registro de historial corresponde únicamente a una edición o eliminación de comentario,
 * o a un registro redundante sin cambio real de estado (estado anterior igual a estado nuevo).
 * Estos registros NO deben distorsionar la trazabilidad de estados ni los promedios de tiempo de revisión.
 *
 * @param {Object} h - Objeto de historial
 * @returns {boolean} True si es un cambio de solo comentario o sin transición real
 */
export function esRegistroSoloComentario(h) {
  if (!h) return false
  const com = (h.comentario || '').trim().toLowerCase()
  if (
    com.includes('edición de comentario') ||
    com.includes('edicion de comentario') ||
    com === 'comentario covepa eliminado'
  ) {
    return true
  }
  const ant = normalizarEstadoOficial(h.estado_anterior)
  const nue = normalizarEstadoOficial(h.estado_nuevo)
  if (ant && nue && ant === nue) {
    return true
  }
  return false
}

/**
 * Consulta la lista cronológica de cambios de estado de una observación.
 * Excluye registros que sean solo de comentario y deduplica ráfagas del mismo estado.
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

    // Filtrar cambios de solo comentario o sin transición real de estado
    const limpios = (data || []).filter(h => !esRegistroSoloComentario(h))

    // Deduplicar ráfagas o repeticiones de estado
    return deduplicarHistorialEventos(limpios)
  } catch (err) {
    console.warn('[HISTORIAL-FETCH] Error de red al consultar historial:', err)
    return []
  }
}

/**
 * Consulta únicamente el registro más reciente del historial y el conteo total para una observación.
 * Optimizado para renderizado ultra rápido en tarjetas y modales, excluyendo ediciones de solo comentario.
 *
 * @param {string} idObs - Código de la observación
 * @returns {Promise<{ latest: Object|null, count: number }>}
 */
export async function fetchUltimoCambioObservacion(idObs) {
  if (!idObs) return { latest: null, count: 0 }
  try {
    const { data, error } = await supabase
      .from('historial_estados_observaciones')
      .select('id, id_obs, id_sitio, estado_anterior, estado_nuevo, usuario_nombre, usuario_email, usuario_id, comentario, origen, created_at')
      .eq('id_obs', idObs)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.warn('[ULTIMO-CAMBIO-FETCH] Error:', error.message)
      return { latest: null, count: 0 }
    }

    // Filtrar cambios que sean solo de comentario y deduplicar ráfagas
    const limpios = deduplicarHistorialEventos((data || []).filter(h => !esRegistroSoloComentario(h)))

    return { latest: limpios[0] || null, count: limpios.length }
  } catch (err) {
    console.warn('[ULTIMO-CAMBIO-FETCH] Error de red:', err)
    return { latest: null, count: 0 }
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
    const fechaIso = extraContext.fechaIso || getPeruISOString()

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
      comentario_covepa: comentario
    }

    // Conservar fecha_subsanacion original del técnico si pasa a En Revisión
    if (estadoNorm === 'En Revisión' && extraContext.fechaSubsanacionPrevia) {
      updatePayload.fecha_subsanacion = extraContext.fechaSubsanacionPrevia
    } else {
      updatePayload.fecha_subsanacion = fechaIso
    }

    // Regla de Negocio: En estado 'En Revisión', 'Solicitando Revisión', 'Documentación' o 'Crítico' NUNCA debe haber revisor asignado.
    // Para otros estados (Validado, Pre-validado, Rechazado, Descartado), solo personal de GILAT puede ser Revisor.
    if (estadoNorm === 'En Revisión' || estadoNorm === 'Solicitando Revisión' || estadoNorm === 'Documentación' || estadoNorm === 'Crítico') {
      updatePayload.revisor = null
    } else if (revisor !== undefined) {
      updatePayload.revisor = (revisor && esRevisorGilat(revisor, extraContext.gilatOptions)) ? String(revisor).trim() : null
    }

    // Regla de Negocio — Cuadrilla Ejecutora y Técnico Ejecutor:
    // Al pedir validación o asignación, se asigna esa cuadrilla y técnico ejecutor.
    // Se mantiene intacto hasta que otro técnico solicite validación y lo reemplace.
    let tecEjecutor = extraContext.tecnicoDesignado || null
    let cuadEjecutora = extraContext.cuadrillaDesignada || null

    if (estadoNorm === 'Descartado') {
      // Regla de Negocio: En estado 'Descartado', SIEMPRE asignar la cuadrilla oficial del sitio y NUNCA técnico.
      tecEjecutor = null
      updatePayload.tecnico_ejecutor = null

      const siteId = extraContext.idSitio || ''
      if (siteId.startsWith('AMEX') || idObs.startsWith('AMEX')) {
        cuadEjecutora = 'CUADRILLA 4'
      } else {
        const asig = ASIGNACIONES_BASE.find(s => s.id_site === siteId)
        cuadEjecutora = asig?.cuadrilla || asig?.grupo || extraContext.cuadrillaDesignada || 'CUADRILLA 1'
      }
      updatePayload.cuadrilla_ejecutora = cuadEjecutora
    } else if (estadoNorm === 'Solicitando Revisión' || estadoNorm === 'Solicitando Revision') {
      const resolved = resolveTecnicoAndCuadrilla(extraContext.usuarioNombre || extraContext.tecnicoDesignado)
      if (resolved) {
        tecEjecutor = resolved.tecnico
        cuadEjecutora = resolved.cuadrilla
      }
    } else if (tecEjecutor && !cuadEjecutora) {
      const resolved = resolveTecnicoAndCuadrilla(tecEjecutor)
      if (resolved) cuadEjecutora = resolved.cuadrilla
    }

    if (estadoNorm !== 'Descartado') {
      if ('tecnicoDesignado' in extraContext) {
        updatePayload.tecnico_ejecutor = tecEjecutor ? (resolverIdPersonalTecnico(tecEjecutor) || tecEjecutor) : null
      } else if (tecEjecutor) {
        updatePayload.tecnico_ejecutor = resolverIdPersonalTecnico(tecEjecutor) || tecEjecutor
      }

      if ('cuadrillaDesignada' in extraContext) {
        updatePayload.cuadrilla_ejecutora = cuadEjecutora || null
      } else if (cuadEjecutora) {
        updatePayload.cuadrilla_ejecutora = cuadEjecutora
      }
    }

    let qEstado = supabase
      .from('observaciones')
      .update(updatePayload)
      .eq('id_obs', idObs)

    if (extraContext?.idSitio) {
      qEstado = qEstado.eq('id_sitio', extraContext.idSitio)
    }

    let { data, error } = await qEstado

    // Resiliencia: Si las columnas nuevas aún no existen en la base de datos, reintentar sin ellas
    if (error && (error.code === '42703' || String(error.message).includes('cuadrilla_ejecutora') || String(error.message).includes('tecnico_ejecutor'))) {
      console.warn('[AVISO-SCHEMA] Columnas ejecutoras no creadas aún. Ejecuta sql/migraciones/20261123_agregar_columnas_cuadrilla_tecnico_ejecutor.sql. Reintentando...')
      delete updatePayload.tecnico_ejecutor
      delete updatePayload.cuadrilla_ejecutora

      let retryQ = supabase
        .from('observaciones')
        .update(updatePayload)
        .eq('id_obs', idObs)
      if (extraContext?.idSitio) retryQ = retryQ.eq('id_sitio', extraContext.idSitio)
      const retryRes = await retryQ
      error = retryRes.error
    }

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
      comentario,
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
export const AUDITORES_GILAT_OFICIALES = Object.freeze([
  'AMILCAR HANDER',
  'HELIO CAMAC',
  'KARIN CEPEDA',
  'THALIA URQUIZO',
  'GILAT NETWORKS'
])

/**
 * Normaliza el nombre de un auditor de Gilat a su formato canónico oficial
 * (ej. "Amilcar" -> "Amilcar Hander"). Si no corresponde a Gilat, retorna null.
 *
 * @param {string|null} nombre
 * @returns {string|null}
 */
export function normalizarNombreAuditorGilat(nombre) {
  if (!nombre) return null
  const n = String(nombre).trim().toUpperCase()
  if (n === 'AMILCAR' || n.includes('AMILCAR HANDER')) return 'Amilcar Hander'
  if (n === 'HELIO' || n.includes('HELIO CAMAC')) return 'Helio Camac'
  if (n === 'KARIN' || n.includes('KARIN CEPEDA')) return 'Karin Cepeda'
  if (n === 'THALIA' || n.includes('THALIA URQUIZO')) return 'Thalia Urquizo'
  if (n.includes('SUPERVISOR GILAT')) return 'Supervisor Gilat'
  if (n.includes('GILAT')) return 'Gilat Networks'
  return null
}

export function esRevisorGilat(nombre, gilatOptions = []) {
  if (!nombre) return false
  if (normalizarNombreAuditorGilat(nombre) !== null) return true
  const n = String(nombre).trim().toUpperCase()
  if (AUDITORES_GILAT_OFICIALES.includes(n)) return true
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
  const fechaFinal = fechaSubsanacion ? (fechaSubsanacion.includes('T') ? fechaSubsanacion : getPeruISOString(fechaSubsanacion)) : getPeruISOString()

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

  // Regla de Negocio: Si el estado pasa a 'En Revisión', 'Solicitando Revisión', 'Documentación' o 'Crítico', revisor DEBE ser null.
  // Para los demás estados (Validado, Pre-validado, Rechazado, Descartado), solo personal de Gilat puede ser revisor.
  if (
    estadoNormalizado === 'En Revisión' ||
    estadoNormalizado === 'Solicitando Revisión' ||
    estadoNormalizado === 'Documentación' ||
    estadoNormalizado === 'Crítico'
  ) {
    payload.revisor = null
  } else if (revisor !== undefined) {
    payload.revisor = (revisor && esRevisorGilat(revisor)) ? String(revisor).trim() : null
  }

  console.log(`[AUDITORIA-SYNC] Sincronizando observación ${idObs} con app de fotos:`, payload)

  // Actualización en la tabla public.observaciones
  let queryAudit = supabase
    .from('observaciones')
    .update(payload)
    .eq('id_obs', idObs)

  if (idSitio) {
    queryAudit = queryAudit.eq('id_sitio', idSitio)
  }

  let { data, error } = await queryAudit.select('id_obs, id_sitio')

  // Compatibilidad defensiva: si la columna revisor en la base de datos se llamase validado_por
  if (error && error.code === 'PGRST204' && payload.revisor !== undefined) {
    const revVal = payload.revisor
    delete payload.revisor
    payload.validado_por = revVal
    let retryQuery = supabase
      .from('observaciones')
      .update(payload)
      .eq('id_obs', idObs)

    if (idSitio) {
      retryQuery = retryQuery.eq('id_sitio', idSitio)
    }

    const retry = await retryQuery.select('id_obs, id_sitio')
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
export async function sincronizarComentarioObservacion(idObs, comentarioTexto, idSitio = null, extraContext = {}) {
  if (!idObs) return { data: null, error: null }

  const comentarioLimpio = (comentarioTexto !== undefined && comentarioTexto !== null && String(comentarioTexto).trim() !== '')
    ? String(comentarioTexto).trim()
    : null

  const payload = {
    comentario_covepa: comentarioLimpio
  }

  let query = supabase
    .from('observaciones')
    .update(payload)
    .eq('id_obs', idObs)

  if (idSitio && typeof idSitio === 'string' && (idSitio.startsWith('AM-') || idSitio.includes('-'))) {
    query = query.eq('id_sitio', idSitio)
  }

  const { data, error } = await query.select('id_obs, id_sitio')

  if (error) {
    console.error(`[AUDITORIA-SYNC] ❌ Error sincronizando comentario en observación ${idObs}:`, error)
    throw new Error(`Error sincronizando comentario: ${error.message}`)
  }

  // Nota de diseño: La edición de comentarios NO se registra en historial_estados_observaciones
  // para no distorsionar las métricas y promedios de tiempo de respuesta de revisión.

  return { data: data?.[0] || null, error: null }
}

/**
 * Función oficial de conexión y envío hacia Control COVEPA / App Fotos.
 * Actualiza demoras, tiempos de ejecución y/o dictámenes en public.observaciones
 * aplicando siempre el filtro conjunto id_obs + id_sitio según la guía oficial.
 *
 * @param {Object} params
 * @param {string} params.idObs - Código Pronatel de la observación (ej. "H1-OC-100-242", "A-340")
 * @param {string} [params.idSitio] - Código del nodo o sitio (ej. "AM-0034-A01")
 * @param {string|null} [params.demora] - Motivo o justificación de demora
 * @param {string|null} [params.tiempoReal] - Tiempo neto de trabajo físico en sitio
 * @param {string|null} [params.tiempoDemora] - Tiempo total transcurrido con demoras
 * @param {string} [params.estadoCovepa] - Estado oficial (ej: 'Validado', 'En Revisión')
 * @param {string} [params.revisor] - Nombre del auditor / revisor
 * @param {string} [params.fechaSubsanacion] - Fecha y hora en formato ISO
 * @param {string} [params.comentarioCovepa] - Comentario técnico o acuerdo
 * @returns {Promise<{ ok: boolean, data: Object|null, error: Object|null, pendingMigration?: boolean }>}
 */
export async function enviarTiemposYDemoras({
  idObs,
  idSitio,
  demora,
  tiempoReal,
  tiempoDemora,
  fechaRegistroDemora,
  estadoCovepa,
  revisor,
  fechaSubsanacion,
  comentarioCovepa,
  usuarioNombre = null,
  usuarioEmail = null,
  usuarioId = null,
  origen = 'web_erp',
  estadoActual = null,
  registrarEnHistorial = true
} = {}) {
  if (!idObs) {
    return { ok: false, data: null, error: new Error('idObs es obligatorio') }
  }

  const payload = {}
  if (demora !== undefined) {
    payload.justificacion_demora = (demora && String(demora).trim() !== '') ? String(demora).trim() : null
    payload.fecha_registro_demora = payload.justificacion_demora ? (fechaRegistroDemora || new Date().toISOString()) : null
  }
  if (tiempoReal !== undefined) {
    payload.tiempo_ejecucion_real = (tiempoReal && String(tiempoReal).trim() !== '') ? String(tiempoReal).trim() : null
  }
  if (tiempoDemora !== undefined) {
    payload.tiempo_ejecucion_demora = (tiempoDemora && String(tiempoDemora).trim() !== '') ? String(tiempoDemora).trim() : null
  }
  if (estadoCovepa !== undefined) {
    payload.estado_covepa = estadoCovepa
    if (estadoCovepa === 'En Revisión' || estadoCovepa === 'Solicitando Revisión') {
      payload.revisor = null
    }
  }
  if (revisor !== undefined && payload.revisor === undefined) {
    if (payload.estado_covepa === 'En Revisión' || payload.estado_covepa === 'Solicitando Revisión') {
      payload.revisor = null
    } else {
      payload.revisor = (revisor && esRevisorGilat(revisor)) ? String(revisor).trim() : null
    }
  }
  if (fechaSubsanacion !== undefined) {
    payload.fecha_subsanacion = fechaSubsanacion
  }
  if (comentarioCovepa !== undefined) {
    payload.comentario_covepa = comentarioCovepa
  }

  if (Object.keys(payload).length === 0) {
    return { ok: true, data: null, error: null }
  }

  try {
    let query = supabase.from('observaciones').update(payload).eq('id_obs', idObs)
    if (idSitio) {
      query = query.eq('id_sitio', idSitio)
    }

    let { data, error } = await query.select('id_obs, id_sitio')

    // Fallback defensivo si la columna fecha_registro_demora aún no existe en Supabase
    if (error && (error.code === 'PGRST204' || error.message?.includes('fecha_registro_demora')) && payload.fecha_registro_demora) {
      delete payload.fecha_registro_demora
      let retryQuery = supabase.from('observaciones').update(payload).eq('id_obs', idObs)
      if (idSitio) retryQuery = retryQuery.eq('id_sitio', idSitio)
      const retryRes = await retryQuery.select('id_obs, id_sitio')
      data = retryRes.data
      error = retryRes.error
    }

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        console.warn(`[CONTROL-COVEPA] ⚠️ Advertencia de columnas en Supabase para ${idObs} (${idSitio || ''}):`, error.message)
        return { ok: true, data: null, error: null, pendingMigration: true }
      }
      console.error(`[CONTROL-COVEPA] ❌ Error enviando datos hacia Control COVEPA (${idObs}):`, error)
      return { ok: false, data: null, error }
    }

    console.log(`[CONTROL-COVEPA] ✅ Datos sincronizados con éxito hacia Control COVEPA (${idObs}${idSitio ? ` · ${idSitio}` : ''})`)

    // Registrar trazabilidad cronológica automática en historial_estados_observaciones
    if (registrarEnHistorial && (demora !== undefined || tiempoReal !== undefined || tiempoDemora !== undefined)) {
      const partes = []
      if (demora && String(demora).trim() !== '') {
        partes.push(`⚠️ Demora: "${String(demora).trim()}"`)
      }
      if (tiempoReal && String(tiempoReal).trim() !== '') {
        partes.push(`⏱️ T. Real: ${String(tiempoReal).trim()}`)
      }
      if (tiempoDemora && String(tiempoDemora).trim() !== '') {
        partes.push(`⏳ T. Con Demora: ${String(tiempoDemora).trim()}`)
      }

      if (partes.length > 0) {
        registrarHistorialEstado({
          idObs,
          idSitio,
          estadoAnterior: estadoActual || null,
          estadoNuevo: estadoCovepa || estadoActual || 'Pendiente',
          usuarioNombre: usuarioNombre || 'Control COVEPA / App Fotos',
          usuarioEmail: usuarioEmail || null,
          usuarioId: usuarioId || null,
          comentario: partes.join(' · '),
          origen: origen || 'web_erp'
        }).catch(err => console.warn('[HISTORIAL-WARN] Error registrando demora en historial:', err))
      }
    }

    return { ok: true, data: data?.[0] || null, error: null }
  } catch (err) {
    console.error(`[CONTROL-COVEPA] ❌ Excepción al sincronizar datos hacia Control COVEPA:`, err)
    return { ok: false, data: null, error: err }
  }
}

/**
 * Actualiza la justificación de demora o control de incidentes de una observación técnica.
 * Si es null o vacío, indica que la observación se resolvió dentro del tiempo normal sin incidentes.
 *
 * @param {string} idObs
 * @param {string|null} justificacionTexto
 * @param {string|null} [idSitio]
 * @param {Object} [extraContext]
 * @returns {Promise<{ data: Object|null, error: Object|null }>}
 */
export async function sincronizarJustificacionDemora(idObs, justificacionTexto, idSitio = null, extraContext = {}) {
  const res = await enviarTiemposYDemoras({
    idObs,
    idSitio,
    demora: justificacionTexto,
    usuarioNombre: extraContext.usuarioNombre,
    usuarioEmail: extraContext.usuarioEmail,
    usuarioId: extraContext.usuarioId,
    origen: extraContext.origen || 'web_erp',
    estadoActual: extraContext.estadoActual
  })

  if (!res.ok && res.error && !res.pendingMigration) {
    throw new Error(`Error sincronizando justificación de demora: ${res.error.message}`)
  }

  return { data: res.data, error: res.error, pendingMigration: res.pendingMigration }
}

/**
 * Actualiza los tiempos de ejecución de una observación técnica (tiempo real y tiempo con demoras).
 * Formato esperado: 'HH:MM' (ej: '01:30', '00:45') o null.
 *
 * @param {string} idObs
 * @param {Object} tiempos
 * @param {string|null} [tiempos.tiempoReal]
 * @param {string|null} [tiempos.tiempoDemora]
 * @param {string|null} [idSitio]
 * @param {Object} [extraContext]
 * @returns {Promise<{ data: Object|null, error: Object|null, pendingMigration?: boolean }>}
 */
export async function sincronizarTiemposEjecucion(idObs, { tiempoReal, tiempoDemora } = {}, idSitio = null, extraContext = {}) {
  const res = await enviarTiemposYDemoras({
    idObs,
    idSitio,
    tiempoReal,
    tiempoDemora,
    usuarioNombre: extraContext.usuarioNombre,
    usuarioEmail: extraContext.usuarioEmail,
    usuarioId: extraContext.usuarioId,
    origen: extraContext.origen || 'web_erp',
    estadoActual: extraContext.estadoActual
  })

  if (!res.ok && res.error && !res.pendingMigration) {
    throw new Error(`Error sincronizando tiempos de ejecución: ${res.error.message}`)
  }

  return { data: res.data, error: res.error, pendingMigration: res.pendingMigration }
}
