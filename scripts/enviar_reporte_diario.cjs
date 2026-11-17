/**
 * Script de Envío Automático del Reporte Diario por Correo
 * Proyecto: Amazonas - COVEPA
 * Remitente oficial: ccondor@covepa.pe (mail.covepa.pe)
 */

const nodemailer = require('nodemailer')
const { createClient } = require('@supabase/supabase-js')
const ExcelJS = require('exceljs')
const path = require('path')
const fs = require('fs')

// 1. Conexión a Supabase Local y Externa (con respaldo directo al proyecto oficial)
const DEFAULT_SUPABASE_URL = 'https://byywikicdvmmmndhkooe.supabase.co'
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5eXdpa2ljZHZtbW1uZGhrb29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTIxODgsImV4cCI6MjEwODA4ODE4OH0.KnBrlx7KmH6OelDv9k7EstHhuFCTGcgtgarLvHh4epk'

const DEFAULT_EXT_URL = 'https://iiwmqvnjjhaapyolaity.supabase.co'
const DEFAULT_EXT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpd21xdm5qamhhYXB5b2xhaXR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5OTM3MCwiZXhwIjoyMDk4NTc1MzcwfQ.Q6YLBY_HWLQP3pGNyDtq1SYqTTBtjYQQqvGiVkcIVSw'

const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
const supabaseUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) ? rawUrl : DEFAULT_SUPABASE_URL

const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
const supabaseKey = (rawKey.length > 20) ? rawKey : DEFAULT_SUPABASE_KEY

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
}

const supabase = createClient(supabaseUrl, supabaseKey, clientOptions)
const supabaseExt = createClient(DEFAULT_EXT_URL, DEFAULT_EXT_KEY, clientOptions)

// 2. Helper de fecha en hora Perú (UTC-5)
function getPeruDateInfo(offsetDays = 0) {
  const now = new Date()
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
  const peruTime = new Date(utc - (5 * 3600000) + (offsetDays * 86400000))

  const y = peruTime.getFullYear()
  const m = String(peruTime.getMonth() + 1).padStart(2, '0')
  const d = String(peruTime.getDate()).padStart(2, '0')
  const fechaIso = `${y}-${m}-${d}`

  const hora = String(peruTime.getHours()).padStart(2, '0')
  const minuto = String(peruTime.getMinutes()).padStart(2, '0')
  const horaMinuto = `${hora}:${minuto}`

  const fechaFormateada = peruTime.toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return {
    fechaIso,
    horaMinuto,
    fechaFormateada: fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1)
  }
}

function getPeruDateString(dateInput, offsetDays = 0) {
  if (!dateInput) return null
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return null
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000)
  const peruTime = new Date(utc - (5 * 3600000) + (offsetDays * 86400000))
  const y = peruTime.getFullYear()
  const m = String(peruTime.getMonth() + 1).padStart(2, '0')
  const day = String(peruTime.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatNombrePersona(str) {
  if (!str) return ''
  const trimmed = String(str).trim()
  if (!trimmed) return ''
  return trimmed
    .split(/\s+/)
    .map(w => {
      if (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      }
      return w
    })
    .join(' ')
}

const AUDITORES_GILAT_OFICIALES = [
  'AMILCAR HANDER',
  'HELIO CAMAC',
  'KARIN CEPEDA',
  'THALIA URQUIZO',
  'GILAT NETWORKS'
]

function esRevisorGilat(nombre) {
  if (!nombre) return false
  const n = String(nombre).trim().toUpperCase()
  if (n.includes('GILAT')) return true
  return AUDITORES_GILAT_OFICIALES.includes(n)
}

/**
 * Formatea una fecha ISO a hora local de Perú (UTC-5) en formato DD/MM/YYYY HH:mm
 */
function formatPeruDateTime(isoStr) {
  if (!isoStr) return '-'
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(',', '')
}

function normalizarEstadoOficial(estado) {
  if (!estado) return 'Pendiente'
  const trimmed = String(estado).trim()
  if (trimmed === 'Validado' || trimmed === 'Enviado') return 'Validado'
  if (trimmed === 'Rechazado') return 'Rechazado'
  if (trimmed === 'En Revision' || trimmed === 'En Revisión') return 'En Revisión'
  if (trimmed === 'Solicitando Revision' || trimmed === 'Solicitando Revisión') return 'Solicitando Revisión'
  if (trimmed === 'Documentacion' || trimmed === 'Documentación') return 'Documentación'
  if (trimmed === 'Descartado') return 'Descartado'
  if (trimmed === 'Pendiente') return 'Pendiente'
  return trimmed
}

function esRegistroSoloComentario(h) {
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
 * Calcula los tiempos de solicitud, dictamen y demora de revisión a partir del historial.
 * Excluye rigurosamente eventos de solo comentario o sin cambio real de estado.
 */
function calcularTiemposRevision(events = [], obs = {}) {
  // Filtrar cambios de solo comentario o donde estado_anterior === estado_nuevo
  const validEvents = (events || []).filter(e => !esRegistroSoloComentario(e))

  // 1. Solicitó Revisión: evento donde pasó a En Revisión (transición real)
  const revEvent = validEvents.slice().reverse().find(e =>
    (e.estado_nuevo === 'En Revisión' || e.estado_nuevo === 'En Revision') &&
    e.estado_anterior !== e.estado_nuevo
  ) || validEvents.slice().reverse().find(e =>
    e.estado_nuevo === 'En Revisión' || e.estado_nuevo === 'En Revision'
  )

  // 2. Revisado: evento donde se validó, rechazó o descartó
  const finalEvent = revEvent
    ? validEvents.find(e =>
      (e.estado_nuevo === 'Validado' || e.estado_nuevo === 'Rechazado' || e.estado_nuevo === 'Descartado') &&
      new Date(e.created_at) >= new Date(revEvent.created_at)
    )
    : validEvents.slice().reverse().find(e =>
      e.estado_nuevo === 'Validado' || e.estado_nuevo === 'Rechazado' || e.estado_nuevo === 'Descartado'
    )

  const estadoActual = (obs.estado || obs.estado_covepa || '').trim()
  const isEnEspera = estadoActual === 'En Revisión' || estadoActual === 'En Revision' ||
    estadoActual === 'Solicitando Revisión' || estadoActual === 'Solicitando Revision' ||
    estadoActual === 'Pendiente'

  // Regla de Negocio: No agregar la hora ni fechas a las observaciones que están en revisión o solicitando revisión
  if (isEnEspera) {
    return {
      fechaSolicitoIso: null,
      fechaRevisadoIso: null,
      solicitoDisplay: '-',
      revisadoDisplay: '-',
      tiempoRevisionTexto: '-',
      tiempoDiffMins: null
    }
  }

  let fechaSolicitoIso = revEvent ? revEvent.created_at : null
  let fechaRevisadoIso = finalEvent ? finalEvent.created_at : null

  // Fallback si no está en historial pero fecha_subsanacion existe y ya no está en espera
  if (!fechaRevisadoIso && obs.fecha_subsanacion && obs.fecha_subsanacion !== 'Pendiente') {
    fechaRevisadoIso = obs.fecha_subsanacion
  }

  let tiempoDiffMins = null
  let tiempoRevisionTexto = '-'

  if (fechaSolicitoIso && fechaRevisadoIso) {
    const tSol = new Date(fechaSolicitoIso).getTime()
    const tRev = new Date(fechaRevisadoIso).getTime()
    if (!isNaN(tSol) && !isNaN(tRev) && tRev >= tSol) {
      tiempoDiffMins = Math.round((tRev - tSol) / 60000)
      const hrs = Math.floor(tiempoDiffMins / 60)
      const mins = tiempoDiffMins % 60
      tiempoRevisionTexto = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
    }
  }

  return {
    fechaSolicitoIso,
    fechaRevisadoIso,
    solicitoDisplay: fechaSolicitoIso ? formatPeruDateTime(fechaSolicitoIso) : '-',
    revisadoDisplay: fechaRevisadoIso ? formatPeruDateTime(fechaRevisadoIso) : '-',
    tiempoRevisionTexto,
    tiempoDiffMins
  }
}

async function enviarReporteDiarioGilat(tramo = 'original') {
  const isAmpliacion = tramo === 'ampliacion'
  const configId = isAmpliacion ? 'config_diario_ampliacion' : 'config_diario'
  const tagLog = isAmpliacion ? '[CRON-REPORTE-AMPLIACION]' : '[CRON-REPORTE-ORIGINAL]'
  const tituloTramo = isAmpliacion ? 'Amazonas Ampliación' : 'Amazonas Original'

  const { fechaIso, horaMinuto, fechaFormateada } = getPeruDateInfo()
  const isManualRun = process.env.IS_MANUAL_RUN === 'true' ||
    process.env.IS_MANUAL_RUN === true ||
    process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'
  const forzarEnvio = process.env.FORZAR_ENVIO === 'true' || process.env.FORZAR_ENVIO === true

  console.log(`${tagLog} 🚀 Iniciando verificación de reporte diario COVEPA (${tituloTramo}).`)
  console.log(`${tagLog} 🕒 Hora actual Perú: ${horaMinuto} · Fecha: ${fechaIso} | Modo: ${isManualRun ? 'MANUAL FORZADO' : 'PROGRAMADO'}`)

  // 3. Leer Configuración desde Supabase
  let config = {
    activo: true,
    hora_envio: '21:00:00',
    destinatarios: ['ccondor@covepa.pe'],
    destinatarios_cc: [],
    asunto: isAmpliacion
      ? '[COVEPA] Reporte Diario de Observaciones — Amazonas Ampliación - Zona 2 y Zona 7'
      : 'Reporte Diario de Levantamiento de Observaciones Amazonas Original - Zona 2 y Zona 7',
    notas_jornada: '',
    periodo_reporte: 'dia_actual'
  }

  try {
    const { data: dbConfig } = await supabase
      .from('configuracion_reportes_correo')
      .select('*')
      .eq('id', configId)
      .maybeSingle()

    if (dbConfig) {
      config = { ...config, ...dbConfig }
    }
  } catch (err) {
    console.warn(`${tagLog} ⚠️ No se pudo leer la tabla de configuración, usando valores por defecto:`, err.message)
  }

  // 3.1 Limpieza automática diaria de notas_jornada si provienen de un día anterior
  let notasLimpias = (config.notas_jornada || '').trim()
  if (config.updated_at) {
    const fechaPeruUpdate = getPeruDateString(config.updated_at)
    if (fechaPeruUpdate && fechaPeruUpdate < fechaIso && notasLimpias) {
      console.log(`${tagLog} 🧹 La nota operativa pertenece al día anterior (${fechaPeruUpdate}). Limpiando comentario para la nueva jornada.`)
      notasLimpias = ''
      try {
        await supabase
          .from('configuracion_reportes_correo')
          .update({ notas_jornada: '' })
          .eq('id', configId)
      } catch (_) { }
    }
  }

  // 3.2 Determinar jornada objetivo (Día actual vs Día anterior)
  const periodoReporte = config.periodo_reporte || 'dia_actual'
  const targetDateInfo = periodoReporte === 'dia_anterior' ? getPeruDateInfo(-1) : getPeruDateInfo(0)
  const targetFechaIso = targetDateInfo.fechaIso
  const targetFechaFormateada = targetDateInfo.fechaFormateada
  console.log(`[CRON-REPORTE] 📅 Configuración de jornada: ${periodoReporte === 'dia_anterior' ? 'DÍA ANTERIOR' : 'DÍA ACTUAL'} -> Reportando fecha: ${targetFechaIso} (${targetFechaFormateada})`)

  // 4. Si el envío automático está desactivado y no es corrida forzada de prueba, salir
  if (!config.activo && !forzarEnvio) {
    console.log('[CRON-REPORTE] ⏸️ El envío automático está marcado como inactivo en la base de datos. Finalizando.')
    return
  }

  // 4.1 Comprobar coincidencia de hora si es ejecución programada (cron)
  const [cfgH, cfgM] = (config.hora_envio || '21:00:00').split(':').map(Number)
  const [curH, curM] = horaMinuto.split(':').map(Number)
  const cfgTotalMins = (cfgH || 0) * 60 + (cfgM || 0)
  const curTotalMins = (curH || 0) * 60 + (curM || 0)
  const diffMins = Math.abs(curTotalMins - cfgTotalMins)

  // Tolerancia de ±30 minutos para absorber diferencias de inicio o ejecución horaria
  if (!forzarEnvio && diffMins > 30) {
    console.log(`[CRON-REPORTE] ⏳ Hora programada: ${config.hora_envio} | Hora actual Perú: ${horaMinuto} (Diferencia: ${diffMins} min). Fuera de horario. Omitiendo.`)
    return
  }

  // 4.2 Regla Estricta: MÁXIMO 1 CORREO AL DÍA
  // Solo se autoriza reenvío si:
  // a) Es prueba manual forzada (forzarEnvio === true)
  // b) O la configuración se actualizó después del último envío (updated_at > ultimo_envio_at)
  if (!forzarEnvio && config.ultimo_envio_at) {
    const ultimoEnvioPeruDate = getPeruDateString(config.ultimo_envio_at)
    const configUpdateTime = config.updated_at ? new Date(config.updated_at).getTime() : 0
    const ultimoEnvioTime = new Date(config.ultimo_envio_at).getTime()
    const fueReprogramado = configUpdateTime > (ultimoEnvioTime + 10000) // margen de 10 segundos

    if (ultimoEnvioPeruDate === fechaIso && !fueReprogramado) {
      console.log(`[CRON-REPORTE] ℹ️ El reporte de hoy (${fechaIso}) ya fue enviado a las ${config.ultimo_envio_at} y no hay cambios posteriores de configuración. Omitiendo envío duplicado.`)
      return
    }

    if (fueReprogramado) {
      console.log(`[CRON-REPORTE] 🔄 Se detectó una reprogramación de horario/configuración posterior al último envío (${config.updated_at} > ${config.ultimo_envio_at}). Procediendo con el nuevo despacho.`)
    }
  }

  // 5. Destinatarios
  const rawDestinatarioPrueba = (process.env.DESTINATARIO_PRUEBA || '').trim()
  let recipients = (config.destinatarios || []).filter(Boolean)
  let recipientsCC = (config.destinatarios_cc || []).filter(Boolean)

  if (forzarEnvio && rawDestinatarioPrueba) {
    console.log(`[CRON-REPORTE] 🧪 MODO PRUEBA ACTIVO: Enviando exclusivamente al destinatario de prueba: ${rawDestinatarioPrueba}`)
    recipients = [rawDestinatarioPrueba]
    recipientsCC = []
  } else {
    if (recipients.length === 0) {
      recipients.push('ccondor@covepa.pe')
    }
  }

  console.log(`[CRON-REPORTE] 📬 Destinatarios: ${recipients.join(', ')} | CC: ${recipientsCC.join(', ') || 'Ninguno'}`)

  // 6. Consultar mapa de localidades y asignaciones territoriales (Regla 2.1)
  const ASIGNACIONES_BASE = [
    { id_site: 'AM-0038-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0038-CS01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0038-CO01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0038-CO02', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0041-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0041-CS01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0041-IE01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0041-HS01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0034-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0034-CS01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0123-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0042-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0042-CS01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0042-CO01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0124-CS01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0125-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0235-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0240-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0237-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0238-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0234-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0234-HS01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0232-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0232-HS01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0220-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0219-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0231-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0231-HS01', grupo: 'CUADRILLA 1', zona: 'ZONA 7' },
    { id_site: 'AM-0233-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0233-IE01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0239-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0078-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0078-CS01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0078-CO01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0078-HS01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0286-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0230-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0275-IE01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0217-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0271-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0271-IE01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0271-CS01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0215-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0214-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0214-CS01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0214-HS01', grupo: 'CUADRILLA 2', zona: 'ZONA 7' },
    { id_site: 'AM-0186-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0186-IE01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0189-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0189-CS01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0190-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0192-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0192-CS01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0192-HS01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0192-IE01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0193-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0241-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0241-HS01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0241-IE01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0242-IE02', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0243-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0245-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0246-IE01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0248-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0249-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0253-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0270-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0315-A01', grupo: 'CUADRILLA 3', zona: 'ZONA 7' },
    { id_site: 'AM-0076-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0076-HS01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0079-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0079-CO01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0079-HS01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0080-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0080-HS01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0221-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0222-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0222-HS01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0223-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0224-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0228-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0250-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0250-HS01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0251-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0252-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0252-HS01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0254-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0268-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0284-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0304-A01', grupo: 'CUADRILLA 4', zona: 'ZONA 7' },
    { id_site: 'AM-0180-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0183-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0183-CS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0185-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0185-IE02', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0191-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0177-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0177-HS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0178-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0178-HS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0179-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0229-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0229-HS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0227-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0227-HS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0225-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0226-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0226-CS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0225-HS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0077-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0077-HS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0075-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0075-HS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0201-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0200-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0256-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0256-HS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0256-IE01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0195-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0181-A01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0194-A01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0194-IE01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0272-A01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0272-HS01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0213-A01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0207-A01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0205-A01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0197-A01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0196-A01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0204-A01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0199-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0203-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0209-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0208-A01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0212-IE01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0216-A01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0216-HS01', grupo: 'CUADRILLA 6', zona: 'ZONA 7' },
    { id_site: 'AM-0188-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0274-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0274-CS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0274-IE01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0273-A01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0273-IE01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0273-CS01', grupo: 'CUADRILLA 5', zona: 'ZONA 7' },
    { id_site: 'AM-0040-A01', grupo: 'CUADRILLA 1', zona: 'ZONA 2' },
    { id_site: 'AM-0036-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 2' },
    { id_site: 'AM-0121-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 2' },
    { id_site: 'AM-0121-IE01', grupo: 'CUADRILLA 2', zona: 'ZONA 2' },
    { id_site: 'AM-0122-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 2' },
    { id_site: 'AM-0037-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 2' },
    { id_site: 'AM-0037-CS01', grupo: 'CUADRILLA 2', zona: 'ZONA 2' },
    { id_site: 'AM-0037-CO01', grupo: 'CUADRILLA 2', zona: 'ZONA 2' },
    { id_site: 'AM-0037-CO02', grupo: 'CUADRILLA 2', zona: 'ZONA 2' },
    { id_site: 'AM-0043-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 2' },
    { id_site: 'AM-0126-A01', grupo: 'CUADRILLA 2', zona: 'ZONA 2' }
  ]

  const asignacionesMap = {}
  ASIGNACIONES_BASE.forEach(a => { asignacionesMap[a.id_site.toUpperCase()] = a })

  const getZonaForSite = (siteId) => {
    if (!siteId) return 'ZONA 7'
    const clean = String(siteId).trim().toUpperCase()
    if (asignacionesMap[clean]?.zona) return asignacionesMap[clean].zona
    const parts = clean.split('-')
    if (parts.length >= 2) {
      const prefix = `${parts[0]}-${parts[1]}`
      const found = ASIGNACIONES_BASE.find(s => s.id_site.toUpperCase().startsWith(prefix))
      if (found?.zona) return found.zona
    }
    return 'ZONA 7'
  }

  let sitiosMap = {}
  const emailToNameMap = {
    'ccondor@covepa.pe': 'Carlos Condor',
    'ksedano@covepa.pe': 'Katherine Sedano',
    'hventocilla@covepa.pe': 'Higinio Ventocilla',
    'mventocilla@covepa.pe': 'Manuel Ventocilla',
    'projas@covepa.pe': 'Percy Rojas',
    'wavila@covepa.pe': 'William Avila',
    'crivera@covepa.pe': 'Cristhian Rivera',
    'jhospina@covepa.pe': 'Jhon Hospina',
    'mchavez@covepa.pe': 'Milton Chavez',
    'jcarloscc1101@gmail.com': 'Carlos Condor',
    'hcamac.ext@gilatla.com': 'Helio Camac',
    'mtagle@gilatla.com': 'Monica Tagle',
    'turquizo@gilatla.com': 'Thalia Urquizo',
    'mnoriega@gilatla.com': 'Miguel Noriega',
    'rhuapaya@gilatla.com': 'Renzo Huapaya',
    'kcepeda@gilatla.com': 'Karin Cepeda',
    'yalvarez@gilatla.com': 'Yevit Alvarez',
    'kdextre@gilatla.com': 'Kori Dextre',
    'alayme.ext@gilatla.com': 'Amilcar Hander',
    'mnavarro@gilatla.com': 'Marco Navarro'
  }

  try {
    const [extRes, localRes, personalRes] = await Promise.all([
      supabaseExt.from('sitios').select('id_site, localidad, nombre_nodo'),
      supabase.from('sitios_cuadrillas').select('id_site, cuadrilla, zona').eq('activo', true),
      supabaseExt.from('personal').select('nombre, apellido, nombre_completo, email, email_2')
    ])

    if (personalRes && personalRes.data) {
      personalRes.data.forEach(p => {
        const fullName = formatNombrePersona((p.nombre_completo || [p.nombre, p.apellido].filter(Boolean).join(' ') || '').trim())
        if (fullName) {
          if (p.email) emailToNameMap[p.email.toLowerCase().trim()] = fullName
          if (p.email_2) emailToNameMap[p.email_2.toLowerCase().trim()] = fullName
        }
      })
    }

    if (localRes.data && localRes.data.length > 0) {
      localRes.data.forEach(a => {
        if (a.id_site) {
          asignacionesMap[a.id_site.toUpperCase()] = {
            id_site: a.id_site,
            grupo: a.cuadrilla,
            zona: a.zona
          }
        }
      })
    }

    if (extRes.data) {
      extRes.data.forEach(s => {
        const asig = asignacionesMap[s.id_site?.toUpperCase()] || {}
        sitiosMap[s.id_site] = {
          ...s,
          grupo: asig.grupo || 'Sin Cuadrilla',
          zona: asig.zona || getZonaForSite(s.id_site)
        }
      })
    }
  } catch (errSitios) {
    console.warn('[CRON-REPORTE] ⚠️ Aviso consultando catálogo de sitios:', errSitios.message)
  }

  // 7. Consultar observaciones de la jornada (Consistente 100% con Programación y Avance del Día)
  // Delimitar jornada exacta en zona horaria de Perú (UTC-5) convertida a ISO UTC
  const startIsoUtc = new Date(`${targetFechaIso}T00:00:00-05:00`).toISOString()
  const endIsoUtc = new Date(`${targetFechaIso}T23:59:59.999-05:00`).toISOString()
  const isToday = targetFechaIso === fechaIso

  const { data: rawObsFecha, error: obsErr } = await supabase
    .from('observaciones')
    .select('id_obs, id_sitio, protocolo, subsistema, detalle, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, justificacion_demora')
    .gte('fecha_subsanacion', startIsoUtc)
    .lte('fecha_subsanacion', endIsoUtc)
    .order('fecha_subsanacion', { ascending: false })

  if (obsErr) {
    console.error('[CRON-REPORTE] ❌ Error consultando observaciones por fecha:', obsErr)
    process.exit(1)
  }

  // 7.1 Obtener TODAS las observaciones que tuvieron cambios de estado/auditoría en ese día (historial_estados_observaciones)
  const histMap = new Map()
  try {
    const { data: rawHist } = await supabase
      .from('historial_estados_observaciones')
      .select('id_obs, id_sitio, estado_anterior, estado_nuevo, created_at, usuario_nombre')
      .gte('created_at', startIsoUtc)
      .lte('created_at', endIsoUtc)
      .order('created_at', { ascending: true })

      ; (rawHist || []).forEach(h => {
        histMap.set(h.id_obs, h)
      })
  } catch (histErr) {
    console.warn('[CRON-REPORTE] ⚠️ Aviso consultando historial de cambios en fecha:', histErr.message)
  }

  // Traer observaciones complementarias que registraron actividad en historial pero cuya fecha_subsanacion no cayó en la ventana
  const obsFechaSet = new Set((rawObsFecha || []).map(o => o.id_obs))
  const missingObsIds = Array.from(histMap.keys()).filter(id => !obsFechaSet.has(id))

  let additionalObs = []
  if (missingObsIds.length > 0) {
    try {
      const { data: addData } = await supabase
        .from('observaciones')
        .select('id_obs, id_sitio, protocolo, subsistema, detalle, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, justificacion_demora')
        .in('id_obs', missingObsIds)
      additionalObs = addData || []
    } catch (addErr) {
      console.warn('[CRON-REPORTE] ⚠️ Aviso consultando observaciones complementarias de historial:', addErr.message)
    }
  }

  // 7.2 Observaciones activas en revisión técnica para la jornada de hoy
  let rawObsRevision = []
  if (isToday) {
    const { data: revData, error: revErr } = await supabase
      .from('observaciones')
      .select('id_obs, id_sitio, protocolo, subsistema, detalle, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, justificacion_demora')
      .or('estado_covepa.eq.En Revision,estado_covepa.eq.En Revisión,estado_covepa.eq.Solicitando Revision,estado_covepa.eq.Solicitando Revisión')

    if (revErr) {
      console.warn('[CRON-REPORTE] ⚠️ Aviso consultando revisiones activas:', revErr.message)
    } else {
      rawObsRevision = revData || []
    }
  }

  // Consolidar observaciones de la fecha y de revisión activa sin duplicados
  const obsMap = new Map()
    ; (rawObsFecha || []).forEach(o => obsMap.set(o.id_obs, { ...o }))
  additionalObs.forEach(o => {
    if (!obsMap.has(o.id_obs)) obsMap.set(o.id_obs, { ...o })
  })
    ; (rawObsRevision || []).forEach(o => {
      if (!obsMap.has(o.id_obs)) obsMap.set(o.id_obs, { ...o })
    })

  const rows = Array.from(obsMap.values())
    .filter(o => {
      const sId = String(o.id_sitio || '').toUpperCase().trim()
      const oId = String(o.id_obs || '').toUpperCase().trim()
      const esDeAmpliacion = sId.startsWith('AMEX') || oId.startsWith('AMEX')
      return isAmpliacion ? esDeAmpliacion : !esDeAmpliacion
    })
    .map(o => {
      // Para la jornada de hoy (isToday), el estado prioritario es el estado vivo actual en la BD (o.estado_covepa).
      // Para jornadas anteriores, si tuvo transición en esa fecha, se toma el estado que alcanzó en dicha fecha (hTransition.estado_nuevo).
      const hTransition = histMap.get(o.id_obs)
      const rawSt = (isToday ? (o.estado_covepa || hTransition?.estado_nuevo || '') : (hTransition ? hTransition.estado_nuevo : (o.estado_covepa || ''))).trim()

      let estadoNormalizado = 'Validado'
      if (rawSt === 'Documentación' || rawSt === 'Documentacion') estadoNormalizado = 'Documentación'
      else if (rawSt === 'Descartado') estadoNormalizado = 'Descartado'
      else if (rawSt === 'Solicitando Revision' || rawSt === 'Solicitando Revisión') estadoNormalizado = 'Solicitando Revisión'
      else if (rawSt === 'En Revision' || rawSt === 'En Revisión') estadoNormalizado = 'En Revisión'
      else if (rawSt === 'Rechazado') estadoNormalizado = 'Rechazado'
      else if (rawSt === 'Pendiente') estadoNormalizado = 'Pendiente'
      else if (rawSt === 'Validado' || rawSt === 'Enviado') estadoNormalizado = 'Validado'
      else if (o.fecha_subsanacion) estadoNormalizado = 'Validado'

      const zonaCalculada = (sitiosMap[o.id_sitio]?.zona || getZonaForSite(o.id_sitio))
      return {
        ...o,
        localidad: (sitiosMap[o.id_sitio]?.localidad || sitiosMap[o.id_sitio]?.nombre_nodo || ''),
        zona: zonaCalculada,
        estado: estadoNormalizado
      }
    })
    // Regla de Negocio: El estado "Documentación" se excluye de los reportes por correo
    .filter(o => o.estado !== 'Documentación')

  // 7.3 Obtener historial cronológico para calcular tiempos de revisión exactos
  const obsIds = rows.map(r => r.id_obs).filter(Boolean)
  const historyByObs = new Map()
  if (obsIds.length > 0) {
    try {
      const lote = 200
      for (let i = 0; i < obsIds.length; i += lote) {
        const sliceIds = obsIds.slice(i, i + lote)
        const { data: hData, error: hErr } = await supabase
          .from('historial_estados_observaciones')
          .select('id_obs, id_sitio, estado_anterior, estado_nuevo, created_at, usuario_nombre, comentario')
          .in('id_obs', sliceIds)
          .order('created_at', { ascending: true })
        if (!hErr && Array.isArray(hData)) {
          hData.forEach(h => {
            if (esRegistroSoloComentario(h)) return

            if (!historyByObs.has(h.id_obs)) historyByObs.set(h.id_obs, [])
            historyByObs.get(h.id_obs).push(h)
          })
        }
      }
    } catch (eHist) {
      console.warn('[CRON-REPORTE] ⚠️ Aviso consultando historial para cálculo de tiempos:', eHist.message)
    }
  }

  // Enriquecer cada observación con los datos de tiempo de revisión
  let sumDiffMins = 0
  let countConTiempo = 0

  const rowsEnriquecidas = rows.map(r => {
    const evs = historyByObs.get(r.id_obs) || []
    const calc = calcularTiemposRevision(evs, r)
    if (calc.tiempoDiffMins !== null) {
      sumDiffMins += calc.tiempoDiffMins
      countConTiempo++
    }
    return {
      ...r,
      fecha_solicito_revision: calc.solicitoDisplay,
      fecha_revisado: calc.revisadoDisplay,
      tiempo_revision: calc.tiempoRevisionTexto,
      tiempo_revision_mins: calc.tiempoDiffMins,
      fecha_solicito_iso: calc.fechaSolicitoIso,
      fecha_revisado_iso: calc.fechaRevisadoIso
    }
  })

  // Calcular tiempo promedio de revisión de la jornada
  let tiempoPromedioTexto = '—'
  let tiempoPromedioHoras = 0
  if (countConTiempo > 0) {
    const avgMins = Math.round(sumDiffMins / countConTiempo)
    const avgHrs = Math.floor(avgMins / 60)
    const avgRestMins = avgMins % 60
    tiempoPromedioTexto = avgHrs > 0 ? `${avgHrs}h ${avgRestMins}m` : `${avgRestMins} min`
    tiempoPromedioHoras = Number((avgMins / 60).toFixed(1))
  }

  const validadas = rowsEnriquecidas.filter(r => r.estado === 'Validado')
  const rechazadas = rowsEnriquecidas.filter(r => r.estado === 'Rechazado')
  const descartadas = rowsEnriquecidas.filter(r => r.estado === 'Descartado')
  const enEspera = rowsEnriquecidas.filter(r => r.estado === 'Solicitando Revisión' || r.estado === 'En Revisión')
  const documentacion = rowsEnriquecidas.filter(r => r.estado === 'Documentación')
  const totalListados = validadas.length + rechazadas.length + enEspera.length + descartadas.length + documentacion.length

  const stats = {
    validadas: validadas.length,
    rechazadas: rechazadas.length,
    descartadas: descartadas.length,
    enEspera: enEspera.length,
    documentacion: documentacion.length,
    total: totalListados,
    tiempoPromedioRevision: tiempoPromedioHoras,
    tiempoPromedioRevisionTexto: tiempoPromedioTexto,
    totalConTiempo: countConTiempo
  }

  console.log(`[CRON-REPORTE] 📊 Resumen computado: Validadas: ${stats.validadas} | Rechazadas: ${stats.rechazadas} | En Espera: ${stats.enEspera} | Descartadas: ${stats.descartadas} | Tiempo Promedio: ${stats.tiempoPromedioRevisionTexto}`)

  // 8. Preparar Logo Adjunto (covepa.png con Content-ID)
  const logoPath = path.resolve(__dirname, '../covepa.png')
  const hasLogo = fs.existsSync(logoPath)
  const attachments = []

  if (hasLogo) {
    attachments.push({
      filename: 'covepa.png',
      path: logoPath,
      cid: 'covepa-logo'
    })
    console.log(`[CRON-REPORTE] 🖼️ Logo oficial cargado como adjunto CID desde: ${logoPath}`)
  } else {
    console.warn(`[CRON-REPORTE] ⚠️ No se encontró covepa.png en la raíz.`)
  }

  const logoSrc = hasLogo ? 'cid:covepa-logo' : 'https://byywikicdvmmmndhkooe.supabase.co/storage/v1/object/public/covepa.png'

  // 8.1 Generar archivo Excel (.xlsx) adjunto con formato oficial de tabla y fondo #003060
  try {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Amazonas-COVEPA'
    const ws = wb.addWorksheet('Reporte_Observaciones', {
      views: [{ showGridLines: true }]
    })

    // Anchos calibrados de las 6 columnas oficiales
    ws.columns = [
      { width: 22 }, // ID
      { width: 14 }, // Zona
      { width: 20 }, // Código de lugar
      { width: 28 }, // Nombre de localidad
      { width: 24 }, // Persona que validó
      { width: 22 }  // Estado observación
    ]

    // Consolidado de todas las observaciones trabajadas en la jornada
    const allRows = [
      ...validadas,
      ...rechazadas,
      ...enEspera,
      ...descartadas,
      ...documentacion
    ]

    const tableRows = allRows.map(r => {
      let estadoDisplay = r.estado || 'Validado'
      if (estadoDisplay === 'Descartado') estadoDisplay = 'No Aplica'
      const revRaw = (r.revisor || '').trim()
      const isEnRev = estadoDisplay === 'En Revisión' || estadoDisplay === 'En Revision' || estadoDisplay === 'Solicitando Revisión' || estadoDisplay === 'Solicitando Revision' || estadoDisplay === 'Pendiente'
      const isGilat = !isEnRev && esRevisorGilat(revRaw)
      const revisorFinal = isGilat ? revRaw : '-'

      return [
        r.id_obs || '',
        r.zona || getZonaForSite(r.id_sitio) || 'ZONA 7',
        r.id_sitio || '',
        r.localidad || '',
        revisorFinal,
        estadoDisplay
      ]
    })

    // Añadir tabla oficial con formato de tabla (addTable)
    const cleanTableName = `Reporte_${targetFechaIso.replace(/-/g, '_')}`
    ws.addTable({
      name: cleanTableName,
      ref: 'A1',
      headerRow: true,
      totalsRow: false,
      style: {
        theme: 'TableStyleMedium9', // Azul marino corporativo COVEPA
        showRowStripes: true,
        showColumnStripes: false
      },
      columns: [
        { name: 'ID', filterButton: true },
        { name: 'Zona', filterButton: true },
        { name: 'Código de lugar', filterButton: true },
        { name: 'Nombre de localidad', filterButton: true },
        { name: 'Persona que validó', filterButton: true },
        { name: 'Estado observación', filterButton: true }
      ],
      rows: tableRows.length > 0 ? tableRows : [['-', '-', '-', '-', '-', '-']]
    })

    // Conservar encabezado institucional en color oficial #003060 y texto blanco
    const headerRow = ws.getRow(1)
    headerRow.height = 26
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF003060' }
      }
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    // Formato y alineación de celdas de datos
    const totalFilas = tableRows.length > 0 ? tableRows.length : 1
    for (let i = 0; i < totalFilas; i++) {
      const rowNum = i + 2
      const row = ws.getRow(rowNum)
      row.height = 20
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 10 }
        cell.alignment = {
          vertical: 'middle',
          horizontal: (colNum === 1 || colNum === 2 || colNum === 3 || colNum === 6 || cell.value === '-') ? 'center' : 'left'
        }
      })
    }

    const excelBuffer = await wb.xlsx.writeBuffer()
    const outFilename = isAmpliacion ? `Reporte_Observaciones_Ampliacion_${targetFechaIso}.xlsx` : `Reporte_Observaciones_Amazonas_${targetFechaIso}.xlsx`
    attachments.push({
      filename: outFilename,
      content: excelBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    console.log(`${tagLog} 📊 Archivo Excel generado y adjuntado: ${outFilename} (${allRows.length} registros)`)
  } catch (errExcel) {
    console.error(`${tagLog} ⚠️ Error generando Excel adjunto:`, errExcel)
  }

  // 9. Asunto oficial
  const subjectTemplate = config.asunto || 'Reporte Diario de Levantamiento de Observaciones Amazonas - Zona 2 y Zona 7'
  const subjectFinal = subjectTemplate.includes('{fecha}')
    ? subjectTemplate.replace(/\{fecha\}/gi, targetFechaIso)
    : subjectTemplate

  // Helper para renderizar observaciones agrupadas en lista vertical (de arriba a abajo)
  const renderCodeList = (items, colorText, colorBorder, bgLight = '#f8fafc') => {
    return `
      <div style="background-color:${bgLight};border:1px solid ${colorBorder};border-radius:6px;padding:10px 16px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          ${items.map(o => `
            <tr>
              <td style="padding:3px 0;font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;font-weight:bold;color:${colorText};line-height:1.5;white-space:nowrap;">
                <span style="color:${colorText};margin-right:8px;font-size:13px;line-height:1;">•</span>${escapeHtml(o.id_obs || '—')}
              </td>
            </tr>
          `).join('')}
        </table>
      </div>
    `
  }

  const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Diario COVEPA</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <!--[if mso]>
        <table role="presentation" width="700" align="center" border="0" cellspacing="0" cellpadding="0">
        <tr><td>
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:700px;width:100%;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          
          <!-- Cabecera Institucional COVEPA -->
          <tr>
            <td style="background-color:#003060;padding:24px 30px;text-align:left;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#38bdf8;text-transform:uppercase;margin-bottom:4px;">
                AMAZONAS · COVEPA
              </div>
              <h1 style="margin:0;font-family:'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;line-height:1.25;">
                ${isAmpliacion ? 'Reporte Diario de Levantamiento de Observaciones Amazonas Ampliación - Zona 2 y Zona 7' : 'Reporte Diario de Levantamiento de Observaciones Amazonas Original'}
              </h1>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#bfdbfe;margin-top:3px;font-weight:500;">
                ${isAmpliacion ? 'Zona 2 y Zona 7 (Sitios AMEX)' : 'Zona 2 y Zona 7 (Sitios Originales)'}
              </div>
              <div style="margin-top:10px;">
                <span style="display:inline-block;background-color:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:16px;padding:5px 14px;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:600;white-space:nowrap;">
                  📅 ${escapeHtml(targetFechaFormateada)}
                </span>
              </div>
            </td>
          </tr>

          <!-- Panel de Control de Métricas (Dashboard KPI Integrado) -->
          <tr>
            <td style="background-color:#f8fafc;border-bottom:1px solid #e2e8f0;padding:16px 24px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <!-- Total General Trabajado (Centrado como los medidores de abajo, conservando su posición) -->
                <tr>
                  <td colspan="5" style="padding-bottom:10px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #cbd5e1;border-top:3px solid #003060;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:12px 16px;text-align:center;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:26px;font-weight:bold;color:#003060;line-height:1;">
                            ${stats.total}
                          </div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;">
                            ${isAmpliacion ? 'Total de Observaciones de Ampliación Trabajadas en la Jornada' : 'Total de Observaciones Trabajadas en la Jornada'}
                          </div>
                            Total de Observaciones Trabajadas en la Jornada
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Fila de los 5 Medidores -->
                <tr>
                  <!-- Validadas -->
                  <td width="20%" style="padding:0 2px 0 0;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #bbf7d0;border-top:3px solid #16a34a;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:10px 4px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:bold;color:#16a34a;line-height:1;">${stats.validadas}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10px;font-weight:bold;color:#15803d;text-transform:uppercase;margin-top:4px;">✓ Validadas</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Rechazadas -->
                  <td width="20%" style="padding:0 2px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #fecdd3;border-top:3px solid #e11d48;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:10px 4px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:bold;color:#e11d48;line-height:1;">${stats.rechazadas}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10px;font-weight:bold;color:#be123c;text-transform:uppercase;margin-top:4px;">✕ Rechazadas</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- En Espera -->
                  <td width="20%" style="padding:0 2px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #bfdbfe;border-top:3px solid #0284c7;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:10px 4px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:bold;color:#0284c7;line-height:1;">${stats.enEspera}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10px;font-weight:bold;color:#0369a1;text-transform:uppercase;margin-top:4px;">⏳ En Espera</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- En Documentación -->
                  <td width="20%" style="padding:0 2px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #c7d2fe;border-top:3px solid #6366f1;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:10px 4px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:bold;color:#4f46e5;line-height:1;">${stats.documentacion ?? 0}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10px;font-weight:bold;color:#4338ca;text-transform:uppercase;margin-top:4px;">📁 Documentación</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- No Aplica -->
                  <td width="20%" style="padding:0 0 0 2px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #e9d5ff;border-top:3px solid #9333ea;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:10px 4px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:bold;color:#9333ea;line-height:1;">${stats.descartadas}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10px;font-weight:bold;color:#7e22ce;text-transform:uppercase;margin-top:4px;">🚫 No Aplica</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 1. Agrupación: Observaciones Validadas (Solo si tiene códigos) -->
          ${validadas.length > 0 ? `
          <tr>
            <td style="padding:14px 28px 10px 28px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#16a34a;margin-right:6px;">✓</span> Observaciones Validadas (${validadas.length})
              </div>
              ${renderCodeList(validadas, '#15803d', '#86efac', '#f0fdf4')}
            </td>
          </tr>
          ` : ''}

          <!-- 2. Agrupación: Observaciones Rechazadas (Solo si tiene códigos) -->
          ${rechazadas.length > 0 ? `
          <tr>
            <td style="padding:10px 28px 10px 28px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#e11d48;margin-right:6px;">✕</span> Observaciones Rechazadas (${rechazadas.length})
              </div>
              ${renderCodeList(rechazadas, '#b91c1c', '#fca5a5', '#fff1f2')}
            </td>
          </tr>
          ` : ''}

          <!-- 3. Agrupación: En Espera de Revisión (Solo si tiene códigos) -->
          ${enEspera.length > 0 ? `
          <tr>
            <td style="padding:10px 28px 10px 28px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#0284c7;margin-right:6px;">⏳</span> En Espera de Revisión (${enEspera.length})
              </div>
              ${renderCodeList(enEspera, '#0369a1', '#93c5fd', '#f0f9ff')}
            </td>
          </tr>
          ` : ''}

          <!-- 4. Agrupación: Observaciones en Documentación (Solo si tiene códigos) -->
          ${documentacion && documentacion.length > 0 ? `
          <tr>
            <td style="padding:10px 28px 10px 28px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#6366f1;margin-right:6px;">📁</span> Observaciones en Documentación (${documentacion.length})
              </div>
              ${renderCodeList(documentacion, '#4338ca', '#c7d2fe', '#eef2ff')}
            </td>
          </tr>
          ` : ''}

          <!-- 5. Agrupación: Observaciones No Aplica (Solo si tiene códigos) -->
          ${descartadas.length > 0 ? `
          <tr>
            <td style="padding:10px 28px 10px 28px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#7e22ce;margin-right:6px;">🚫</span> Observaciones No Aplica (${descartadas.length})
              </div>
              ${renderCodeList(descartadas, '#6b21a8', '#d8b4fe', '#faf5ff')}
            </td>
          </tr>
          ` : ''}

          <!-- Mensaje si no hubo ninguna observación en toda la jornada -->
          ${totalListados === 0 ? `
          <tr>
            <td style="padding:20px 28px;text-align:center;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#64748b;font-style:italic;">
                No se registraron observaciones levantadas o en espera para la jornada seleccionada.
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Bloque de Comentarios u Observaciones de la Jornada (Solo si se ingresó texto) -->
          ${notasLimpias ? `
          <tr>
            <td style="padding:10px 28px 16px 28px;">
              <div style="background-color:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #003060;border-radius:6px;padding:14px 18px;">
                <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#003060;text-transform:uppercase;margin-bottom:6px;letter-spacing:0.8px;">
                  💬 Comentarios u Observaciones de la Jornada
                </div>
                <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#334155;line-height:1.55;white-space:pre-wrap;">${escapeHtml(notasLimpias)}</div>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Firma Institucional COVEPA con Logo Oficial -->
          <tr>
            <td style="background-color:#ffffff;border-top:1px solid #e2e8f0;padding:24px 30px;text-align:left;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#475569;margin-bottom:12px;">
                Saludos cordiales,
              </div>
              <div style="margin-bottom:12px;">
                <img src="${logoSrc}" alt="COVEPA" width="145" height="38" border="0" style="display:block;width:145px;max-width:145px;height:auto;border:0;outline:none;" />
              </div>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:bold;color:#003060;line-height:1.3;">
                Condor Callupe Carlos
              </div>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;color:#64748b;font-weight:600;margin-top:2px;">
                Gestor de Calidad
              </div>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#64748b;margin-top:6px;">
                Cel: <a href="tel:+51958086874" style="color:#0284c7;text-decoration:none;font-weight:600;">+51 958 086 874</a>
              </div>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#64748b;margin-top:3px;">
                Correo: <a href="mailto:ccondor@covepa.pe" style="color:#0284c7;text-decoration:none;font-weight:600;">ccondor@covepa.pe</a>
              </div>
            </td>
          </tr>

        </table>
        <!--[if mso]>
        </td></tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
  `

  // 10. Configuración del Transportador SMTP
  const rawSmtpUser = (process.env.SMTP_USER || '').trim()
  const smtpUser = rawSmtpUser.includes('@') ? rawSmtpUser : 'ccondor@covepa.pe'
  const smtpPass = (process.env.SMTP_PASS || '').trim()

  if (!smtpPass) {
    console.error('[CRON-REPORTE] ❌ Error: Falta la variable de entorno SMTP_PASS con la contraseña de ccondor@covepa.pe.')
    process.exit(1)
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.covepa.pe',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: true, // puerto 465 SSL
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      rejectUnauthorized: false
    }
  })

  // 11. Despachar Correo con Formato de Nombre Oficial RFC 5322 ("Nombre" <correo>)
  const formatRecipientWithName = (addr) => {
    if (!addr) return ''
    let str = String(addr).trim()
    if (!str) return ''
    if (str.includes('<') && str.includes('>')) return str
    if (!str.includes('@')) str = `${str}@covepa.pe`
    const cleanEmail = str.toLowerCase().trim()
    const name = emailToNameMap[cleanEmail]
    if (name) {
      return `"${name}" <${cleanEmail}>`
    }
    return cleanEmail
  }

  const formattedTo = recipients.map(formatRecipientWithName).filter(Boolean)
  const formattedCC = recipientsCC.map(formatRecipientWithName).filter(Boolean)

  console.log(`[CRON-REPORTE] 📤 Enviando correo a través de mail.covepa.pe (desde ${smtpUser})...`)
  console.log(`[CRON-REPORTE] 📋 Destinatarios formateados con nombre oficial:`)
  console.log(`[CRON-REPORTE]   Para: ${formattedTo.join(', ')}`)
  console.log(`[CRON-REPORTE]   CC:   ${formattedCC.join(', ') || 'Ninguno'}`)

  const info = await transporter.sendMail({
    from: `"COVEPA - Gestión de Calidad" <${smtpUser}>`,
    to: formattedTo,
    cc: formattedCC.length > 0 ? formattedCC : undefined,
    bcc: (forzarEnvio && rawDestinatarioPrueba) ? undefined : [smtpUser], // Notificación inmediata para ccondor
    subject: subjectFinal,
    html: htmlBody,
    attachments: attachments.length > 0 ? attachments : undefined
  })

  console.log(`[CRON-REPORTE] ✅ Correo entregado con éxito! MessageId: ${info.messageId}`)

  // 12. Actualizar ultimo_envio_at en Supabase (Solo en envíos automáticos programados)
  // Las pruebas manuales forzadas no bloquean el despacho nocturno oficial de la jornada.
  if (!forzarEnvio) {
    try {
      const { error: updErr } = await supabase
        .from('configuracion_reportes_correo')
        .update({ ultimo_envio_at: new Date().toISOString() })
        .eq('id', configId)

      if (updErr) {
        console.warn(`${tagLog} ⚠️ Aviso al actualizar ultimo_envio_at en Supabase:`, updErr.message)
      } else {
        console.log(`${tagLog} 📝 Base de datos actualizada con la marca de tiempo de envío programado.`)
      }
    } catch (_) { }
  } else {
    console.log(`${tagLog} 🧪 Envío de prueba manual completado con éxito. El despacho automático nocturno queda intacto y listo para ejecutarse.`)
  }

  // 13. Registrar en historial_reportes_correo si la tabla existe en Supabase
  try {
    const esPrueba = Boolean(forzarEnvio && rawDestinatarioPrueba)
    const logItem = {
      tipo_reporte: isAmpliacion ? 'diario_ampliacion' : 'diario',
      tipo: esPrueba ? 'prueba' : (forzarEnvio ? 'manual' : 'oficial'),
      origen: process.env.GITHUB_RUN_ID ? (isManual ? 'github_actions' : 'cron') : 'manual',
      destinatarios: recipients,
      destinatarios_cc: recipientsCC,
      asunto: subjectFinal,
      total_obs: stats.total || 0,
      validadas: stats.validadas || 0,
      rechazadas: stats.rechazadas || 0,
      en_espera: stats.enEspera || 0,
      descartadas: stats.descartadas || 0,
      estado: 'exitoso',
      message_id: info.messageId || null,
      github_run_id: process.env.GITHUB_RUN_ID || null,
      created_at: new Date().toISOString()
    }
    const { error: insErr } = await supabase.from('historial_reportes_correo').insert(logItem)
    if (!insErr) {
      console.log(`${tagLog} 📜 Registro guardado exitosamente en historial_reportes_correo.`)
    }
  } catch (_) { }

  console.log(`${tagLog} 🏁 Proceso de reporte diario ${tituloTramo} finalizado satisfactoriamente.`)
}

async function enviarReporteDiarioAmpliacion() {
  return enviarReporteDiarioGilat('ampliacion')
}

/**
 * Procesa y despacha el REPORTE DIARIO INTERNO COVEPA con:
 * - Cifras del día actual (incluyendo Documentación)
 * - Cuadro Matricial Ejecutivo por Equipos (Equipo 1: C1+C2, Equipo 2: C3+C6, Equipo 3: C4+C5)
 * - Archivo Excel adjunto con Hoja 1 (Matriz_Equipos) y Hoja 2 (Detalle_Codigos con localidad contigua al sitio)
 */
async function enviarReporteDiarioInterno() {
  const { fechaIso, horaMinuto, fechaFormateada } = getPeruDateInfo()
  const isManualRun = process.env.IS_MANUAL_RUN === 'true' ||
    process.env.IS_MANUAL_RUN === true ||
    process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'
  const forzarEnvio = process.env.FORZAR_ENVIO === 'true' || process.env.FORZAR_ENVIO === true
  const rawDestinatarioPrueba = (process.env.DESTINATARIO_PRUEBA || '').trim()

  console.log(`[REPORTE-INTERNO] 🚀 Iniciando verificación de Reporte Diario Interno COVEPA.`)
  console.log(`[REPORTE-INTERNO] 🕒 Hora actual Perú: ${horaMinuto} · Fecha: ${fechaIso} | Modo: ${isManualRun ? 'MANUAL FORZADO' : 'PROGRAMADO'}`)

  // 1. Leer configuración desde Supabase (config_diario_interno)
  let config = {
    activo: true,
    hora_envio: '21:30:00',
    destinatarios: ['ccondor@covepa.pe'],
    destinatarios_cc: [],
    asunto: 'Reporte Interno Diario - {fecha}',
    notas_jornada: '',
    periodo_reporte: 'dia_actual'
  }

  try {
    const { data: dbConfig } = await supabase
      .from('configuracion_reportes_correo')
      .select('*')
      .eq('id', 'config_diario_interno')
      .maybeSingle()

    if (dbConfig) {
      config = { ...config, ...dbConfig }
    }
  } catch (err) {
    console.warn('[REPORTE-INTERNO] ⚠️ No se pudo leer la tabla de configuración, usando valores por defecto:', err.message)
  }

  // 1.1 Limpieza de notas de días anteriores
  let notasLimpias = (config.notas_jornada || '').trim()
  if (config.updated_at) {
    const fechaPeruUpdate = getPeruDateString(config.updated_at)
    if (fechaPeruUpdate && fechaPeruUpdate < fechaIso && notasLimpias) {
      console.log(`[REPORTE-INTERNO] 🧹 La nota operativa pertenece al día anterior (${fechaPeruUpdate}). Limpiando comentario.`)
      notasLimpias = ''
      try {
        await supabase
          .from('configuracion_reportes_correo')
          .update({ notas_jornada: '' })
          .eq('id', 'config_diario_interno')
      } catch (_) { }
    }
  }

  // 1.2 Determinar jornada objetivo
  const periodoReporte = config.periodo_reporte || 'dia_actual'
  const targetDateInfo = periodoReporte === 'dia_anterior' ? getPeruDateInfo(-1) : getPeruDateInfo(0)
  const targetFechaIso = targetDateInfo.fechaIso
  const targetFechaFormateada = targetDateInfo.fechaFormateada
  console.log(`[REPORTE-INTERNO] 📅 Reportando fecha: ${targetFechaIso} (${targetFechaFormateada})`)

  // 1.3 Si está desactivado y no es envío forzado de prueba, salir
  if (!config.activo && !forzarEnvio) {
    console.log('[REPORTE-INTERNO] ⏸️ El envío automático interno está pausado en la base de datos. Finalizando.')
    return
  }

  // 1.4 Si es programado (no forzado), comprobar hora y frecuencia de 1 al día
  if (!forzarEnvio) {
    const [cfgH, cfgM] = (config.hora_envio || '21:30:00').split(':').map(Number)
    const [curH, curM] = horaMinuto.split(':').map(Number)
    const cfgTotalMins = (cfgH || 0) * 60 + (cfgM || 0)
    const curTotalMins = (curH || 0) * 60 + (curM || 0)
    const diffMins = Math.abs(curTotalMins - cfgTotalMins)

    // Tolerancia de ±30 minutos para absorber diferencias de inicio o ejecución horaria
    if (diffMins > 30) {
      console.log(`[REPORTE-INTERNO] ⏳ Hora programada: ${config.hora_envio} | Hora actual: ${horaMinuto} (Diferencia: ${diffMins} min). Fuera de horario. Omitiendo.`)
      return
    }

    if (config.ultimo_envio_at) {
      const ultimoEnvioPeruDate = getPeruDateString(config.ultimo_envio_at)
      const configUpdateTime = config.updated_at ? new Date(config.updated_at).getTime() : 0
      const ultimoEnvioTime = new Date(config.ultimo_envio_at).getTime()
      const fueReprogramado = configUpdateTime > (ultimoEnvioTime + 10000)

      if (ultimoEnvioPeruDate === fechaIso && !fueReprogramado) {
        console.log(`[REPORTE-INTERNO] ✋ Ya se envió hoy el reporte interno (${ultimoEnvioPeruDate}) y no hay cambios posteriores. Omitiendo duplicado.`)
        return
      }

      if (fueReprogramado) {
        console.log(`[REPORTE-INTERNO] 🔄 Se detectó reprogramación posterior al último envío (${config.updated_at} > ${config.ultimo_envio_at}). Procediendo con el nuevo despacho.`)
      }
    }
  }

  // 2. Destinatarios
  let recipients = (config.destinatarios || []).filter(Boolean)
  let recipientsCC = (config.destinatarios_cc || []).filter(Boolean)

  if (forzarEnvio && rawDestinatarioPrueba) {
    console.log(`[REPORTE-INTERNO] 🧪 MODO PRUEBA: Enviando exclusivamente al destinatario de prueba: ${rawDestinatarioPrueba}`)
    recipients = [rawDestinatarioPrueba]
    recipientsCC = []
  } else if (recipients.length === 0) {
    recipients.push('ccondor@covepa.pe')
  }

  console.log(`[REPORTE-INTERNO] 📬 Destinatarios: ${recipients.join(', ')} | CC: ${recipientsCC.join(', ') || 'Ninguno'}`)

  // 3. Catálogo de Sitios y Personal
  const [extSitios, localCuadrillas, personalRes] = await Promise.all([
    supabaseExt.from('sitios').select('id_site, localidad, nombre_nodo').then(r => r, () => ({ data: [] })),
    supabase.from('sitios_cuadrillas').select('id_site, cuadrilla, zona').eq('activo', true).then(r => r, () => ({ data: [] })),
    supabase.from('personal_cuadrillas').select('nombre_completo, cargo, cuadrilla, activo').eq('activo', true).then(r => r, () => ({ data: [] }))
  ])

  let baseSitiosAsignados = {}
  try {
    baseSitiosAsignados = require('./base_sitios_asignados.json')
  } catch (_) { }

  const sitiosMap = {}
  const asignacionesMap = {}
  Object.entries(baseSitiosAsignados).forEach(([sId, info]) => {
    asignacionesMap[sId.toUpperCase()] = info
  })
    ; (localCuadrillas?.data || []).forEach(a => {
      if (a.id_site) asignacionesMap[a.id_site.toUpperCase()] = a
    })
    ; (extSitios?.data || []).forEach(s => {
      const asig = asignacionesMap[s.id_site?.toUpperCase()] || {}
      sitiosMap[s.id_site] = {
        ...s,
        grupo: asig.cuadrilla || asig.grupo || 'Sin Cuadrilla',
        zona: asig.zona || 'ZONA 7'
      }
    })

  // Técnicos titulares oficiales por cuadrilla
  const cuadrillaTecnicos = {
    'CUADRILLA 1': 'Jhonatan Flores',
    'CUADRILLA 2': 'Marco Chamba',
    'CUADRILLA 3': 'Daniel Javier',
    'CUADRILLA 4': 'Alfonso Curi',
    'CUADRILLA 5': 'William Avila',
    'CUADRILLA 6': 'Juan Castro',
    'CUADRILLA 7': 'Por Asignar'
  }
    ; (personalRes?.data || []).forEach(p => {
      const c = (p.cuadrilla || p.cuadrilla_asignada || '').trim().toUpperCase()
      const cargo = (p.cargo || '').trim().toUpperCase()
      if (c && c.startsWith('CUADRILLA') && (cargo.includes('TÉCNICO') || cargo.includes('TECNICO') || cargo.includes('SUPERVISOR'))) {
        const nom = (p.nombre_completo || [p.nombre, p.apellido].filter(Boolean).join(' ') || '').trim()
        if (nom) cuadrillaTecnicos[c] = formatNombrePersona(nom)
      }
    })

  // 4. Observaciones de la jornada (incluyendo Documentación)
  const startIsoUtc = new Date(`${targetFechaIso}T00:00:00-05:00`).toISOString()
  const endIsoUtc = new Date(`${targetFechaIso}T23:59:59.999-05:00`).toISOString()
  const isToday = targetFechaIso === fechaIso

  const { data: rawObsFecha } = await supabase
    .from('observaciones')
    .select('id_obs, id_sitio, protocolo, subsistema, detalle, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, justificacion_demora')
    .gte('fecha_subsanacion', startIsoUtc)
    .lte('fecha_subsanacion', endIsoUtc)

  const histMap = new Map()
  try {
    const { data: rawHist } = await supabase
      .from('historial_estados_observaciones')
      .select('id_obs, id_sitio, estado_anterior, estado_nuevo, created_at, usuario_nombre')
      .gte('created_at', startIsoUtc)
      .lte('created_at', endIsoUtc)
      .order('created_at', { ascending: true })
      ; (rawHist || []).forEach(h => histMap.set(h.id_obs, h))
  } catch (_) { }

  const obsFechaSet = new Set((rawObsFecha || []).map(o => o.id_obs))
  const missingObsIds = Array.from(histMap.keys()).filter(id => !obsFechaSet.has(id))
  let additionalObs = []
  if (missingObsIds.length > 0) {
    try {
      const { data: addData } = await supabase
        .from('observaciones')
        .select('id_obs, id_sitio, protocolo, subsistema, detalle, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, justificacion_demora')
        .in('id_obs', missingObsIds)
      additionalObs = addData || []
    } catch (_) { }
  }

  let rawObsRevision = []
  if (isToday) {
    try {
      const { data: revData } = await supabase
        .from('observaciones')
        .select('id_obs, id_sitio, protocolo, subsistema, detalle, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, justificacion_demora')
        .or('estado_covepa.eq.En Revision,estado_covepa.eq.En Revisión,estado_covepa.eq.Solicitando Revision,estado_covepa.eq.Solicitando Revisión')
      rawObsRevision = revData || []
    } catch (_) { }
  }

  const obsMap = new Map()
    ; (rawObsFecha || []).forEach(o => obsMap.set(o.id_obs, { ...o }))
  additionalObs.forEach(o => { if (!obsMap.has(o.id_obs)) obsMap.set(o.id_obs, { ...o }) })
    ; (rawObsRevision || []).forEach(o => { if (!obsMap.has(o.id_obs)) obsMap.set(o.id_obs, { ...o }) })

  // 5. Agrupación por Equipos: Amazonas Original (Equipos 1, 2, 3) y Amazonas Ampliación (Equipo 4)
  const equiposOriginalMap = {
    'EQUIPO 1': {
      id: 'EQUIPO 1',
      cuadrilla: 'EQUIPO 1',
      subtitulo: 'Cuadrilla 1 y 2',
      tecnico: `${cuadrillaTecnicos['CUADRILLA 1']} · ${cuadrillaTecnicos['CUADRILLA 2']}`,
      values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
      total: 0
    },
    'EQUIPO 2': {
      id: 'EQUIPO 2',
      cuadrilla: 'EQUIPO 2',
      subtitulo: 'Cuadrilla 3 y 6',
      tecnico: `${cuadrillaTecnicos['CUADRILLA 3']} · ${cuadrillaTecnicos['CUADRILLA 6']}`,
      values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
      total: 0
    },
    'EQUIPO 3': {
      id: 'EQUIPO 3',
      cuadrilla: 'EQUIPO 3',
      subtitulo: 'Cuadrilla 4 y 5',
      tecnico: `${cuadrillaTecnicos['CUADRILLA 4']} · ${cuadrillaTecnicos['CUADRILLA 5']}`,
      values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
      total: 0
    }
  }

  const equiposAmpliacionMap = {
    'EQUIPO 4': {
      id: 'EQUIPO 4',
      cuadrilla: 'EQUIPO 4',
      subtitulo: 'Cuadrilla 7',
      tecnico: `${cuadrillaTecnicos['CUADRILLA 7'] || 'Por Asignar'}`,
      values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
      total: 0
    }
  }

  const resolveCuadrilla = (o) => {
    const sId = (o.id_sitio || '').toUpperCase()
    if (sId.startsWith('AMEX-')) return 'CUADRILLA 7'

    const s = sitiosMap[o.id_sitio] || {}
    let g = (s.grupo || '').toUpperCase()
    if (g.startsWith('CUADRILLA')) return g

    const asig = asignacionesMap[sId]
    if (asig && (asig.cuadrilla || asig.grupo)) {
      const cNom = (asig.cuadrilla || asig.grupo).replace(/GRUPO/gi, 'CUADRILLA').toUpperCase()
      if (cNom.startsWith('CUADRILLA')) return cNom
    }

    const tecUpper = (o.tecnico || '').toUpperCase()
    if (tecUpper.includes('FLORES') || tecUpper.includes('JHONATAN')) return 'CUADRILLA 1'
    if (tecUpper.includes('CHAMBA') || tecUpper.includes('MARCO')) return 'CUADRILLA 2'
    if (tecUpper.includes('DANIEL') || tecUpper.includes('JAVIER') || tecUpper.includes('PERCY') || tecUpper.includes('ROJAS')) return 'CUADRILLA 3'
    if (tecUpper.includes('ALFONSO') || tecUpper.includes('CURI')) return 'CUADRILLA 4'
    if (tecUpper.includes('WILL') || tecUpper.includes('AVILA')) return 'CUADRILLA 5'
    if (tecUpper.includes('CASTRO') || tecUpper.includes('JUAN')) return 'CUADRILLA 6'
    return 'CUADRILLA 1'
  }

  const allDetailRows = []

  Array.from(obsMap.values()).forEach(o => {
    const hTransition = histMap.get(o.id_obs)
    const rawSt = (isToday ? (o.estado_covepa || hTransition?.estado_nuevo || '') : (hTransition ? hTransition.estado_nuevo : (o.estado_covepa || ''))).trim()

    let estadoFinal = 'Validado'
    if (rawSt.toLowerCase().includes('documentaci')) estadoFinal = 'Documentación'
    else if (rawSt.toLowerCase().includes('crític') || rawSt.toLowerCase().includes('critic')) estadoFinal = 'Crítico'
    else if (rawSt.toLowerCase().includes('solicitando')) estadoFinal = 'En Revisión'
    else if (rawSt.toLowerCase().includes('en revisi')) estadoFinal = 'En Revisión'
    else if (rawSt.toLowerCase().includes('rechaz')) estadoFinal = 'Rechazado'
    else if (rawSt.toLowerCase().includes('descart')) estadoFinal = 'Descartado'

    const targetCuadrilla = resolveCuadrilla(o)
    let equipoKey = 'EQUIPO 1'
    if (targetCuadrilla === 'CUADRILLA 1' || targetCuadrilla === 'CUADRILLA 2') equipoKey = 'EQUIPO 1'
    else if (targetCuadrilla === 'CUADRILLA 3' || targetCuadrilla === 'CUADRILLA 6') equipoKey = 'EQUIPO 2'
    else if (targetCuadrilla === 'CUADRILLA 4' || targetCuadrilla === 'CUADRILLA 5') equipoKey = 'EQUIPO 3'
    else if (targetCuadrilla === 'CUADRILLA 7') equipoKey = 'EQUIPO 4'

    const targetEq = equiposOriginalMap[equipoKey] || equiposAmpliacionMap[equipoKey]
    if (targetEq) {
      if (estadoFinal === 'En Revisión') targetEq.values.enRevision++
      else if (estadoFinal === 'Descartado') targetEq.values.descartados++
      else if (estadoFinal === 'Crítico') targetEq.values.criticos++
      else if (estadoFinal === 'Documentación') targetEq.values.documentacion++
      else if (estadoFinal === 'Rechazado') targetEq.values.rechazados++
      else if (estadoFinal === 'Validado') targetEq.values.validados++
    }

    const sInfo = sitiosMap[o.id_sitio] || {}
    allDetailRows.push({
      id_obs: o.id_obs,
      equipo: equipoKey,
      cuadrilla: targetCuadrilla,
      tecnico: cuadrillaTecnicos[targetCuadrilla] || '-',
      id_sitio: o.id_sitio,
      localidad: sInfo.localidad || sInfo.nombre_nodo || '',
      zona: sInfo.zona || 'ZONA 7',
      estado: estadoFinal,
      revisor: o.revisor || '-',
      fecha_subsanacion: o.fecha_subsanacion || '-',
      detalle: o.detalle || '',
      comentario: o.justificacion_demora || o.acuerdo_subsanacion || '-'
    })
  })

  // Totales de la matriz
  const buildMatrix = (map) => {
    const rowsList = Object.values(map).map(row => ({
      ...row,
      total: row.values.enRevision + (row.values.descartados || 0) + (row.values.criticos || 0) + row.values.documentacion + row.values.rechazados + row.values.validados
    }))

    const totalsObj = {
      enRevision: rowsList.reduce((acc, r) => acc + r.values.enRevision, 0),
      descartados: rowsList.reduce((acc, r) => acc + (r.values.descartados || 0), 0),
      criticos: rowsList.reduce((acc, r) => acc + (r.values.criticos || 0), 0),
      documentacion: rowsList.reduce((acc, r) => acc + r.values.documentacion, 0),
      rechazados: rowsList.reduce((acc, r) => acc + r.values.rechazados, 0),
      validados: rowsList.reduce((acc, r) => acc + r.values.validados, 0)
    }

    const totalCalculado = totalsObj.enRevision + totalsObj.descartados + totalsObj.criticos + totalsObj.documentacion + totalsObj.rechazados + totalsObj.validados

    return {
      matrixRows: rowsList,
      matrixTotals: totalsObj,
      matrixGrandTotal: totalCalculado
    }
  }

  const origMatrix = buildMatrix(equiposOriginalMap)
  const amplMatrix = buildMatrix(equiposAmpliacionMap)

  const matrixRows = [...origMatrix.matrixRows, ...amplMatrix.matrixRows]
  const matrixTotals = {
    enRevision: origMatrix.matrixTotals.enRevision + amplMatrix.matrixTotals.enRevision,
    descartados: origMatrix.matrixTotals.descartados + amplMatrix.matrixTotals.descartados,
    criticos: origMatrix.matrixTotals.criticos + amplMatrix.matrixTotals.criticos,
    documentacion: origMatrix.matrixTotals.documentacion + amplMatrix.matrixTotals.documentacion,
    rechazados: origMatrix.matrixTotals.rechazados + amplMatrix.matrixTotals.rechazados,
    validados: origMatrix.matrixTotals.validados + amplMatrix.matrixTotals.validados
  }
  const grandTotal = origMatrix.matrixGrandTotal + amplMatrix.matrixGrandTotal

  console.log(`[REPORTE-INTERNO] 📊 Estadísticas calculadas: Total=${grandTotal} | Validadas=${matrixTotals.validados} | Rechazadas=${matrixTotals.rechazados} | EnRevision=${matrixTotals.enRevision} | Doc=${matrixTotals.documentacion}`)
  matrixRows.forEach(r => {
    console.log(`[REPORTE-INTERNO]   • ${r.id} (${r.subtitulo}) [${r.tecnico}]: ${r.total} obs (Val:${r.values.validados}, Rech:${r.values.rechazados}, Rev:${r.values.enRevision}, Doc:${r.values.documentacion})`)
  })

  // 6. Generar Excel Oficial de 3 Hojas:
  // - Hoja 1: Matriz_Equipos (Separado en 2 tablas: Amazonas Original y Amazonas Ampliación)
  // - Hoja 2: Detalle_Original (Observaciones de Amazonas Original)
  // - Hoja 3: Detalle_Ampliacion (Observaciones de Amazonas Ampliación)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Amazonas-COVEPA'

  // Hoja 1: Matriz_Equipos
  const wsMatriz = wb.addWorksheet('Matriz_Equipos', { views: [{ showGridLines: true }] })
  wsMatriz.columns = [
    { width: 16 }, // Equipo
    { width: 22 }, // Cuadrillas
    { width: 34 }, // Técnicos Asignados
    { width: 16 }, // En Revisión
    { width: 16 }, // Descartados
    { width: 14 }, // Críticos
    { width: 16 }, // Documentación
    { width: 14 }, // Rechazados
    { width: 14 }, // Validados
    { width: 14 }  // Total Diario
  ]
  wsMatriz.mergeCells('A1:J1')
  const c1 = wsMatriz.getCell('A1')
  c1.value = 'COVEPA — REPORTE DIARIO INTERNO (MATRIZ DE EQUIPOS)'
  c1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF003060' } }
  c1.alignment = { vertical: 'middle', horizontal: 'center' }
  wsMatriz.getRow(1).height = 30

  wsMatriz.mergeCells('A2:J2')
  const c2 = wsMatriz.getCell('A2')
  c2.value = `Jornada Operativa: ${targetFechaFormateada} | Total Observaciones Tocadas: ${grandTotal}`
  c2.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } }
  c2.alignment = { vertical: 'middle', horizontal: 'center' }
  wsMatriz.getRow(2).height = 20

  const headersMatriz = [
    'Equipo',
    'Cuadrillas',
    'Técnicos Asignados',
    'En Revisión',
    'Descartados',
    'Críticos',
    'Documentación',
    'Rechazados',
    'Validados',
    'Total Diario'
  ]

  let currentRowIdx = 4

  const renderMatrizSection = (tituloSeccion, rows, totals, grand) => {
    // Título de la sección
    wsMatriz.mergeCells(`A${currentRowIdx}:J${currentRowIdx}`)
    const secCell = wsMatriz.getCell(`A${currentRowIdx}`)
    secCell.value = `📈 ${tituloSeccion.toUpperCase()}`
    secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003060' } }
    secCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    secCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    wsMatriz.getRow(currentRowIdx).height = 24
    currentRowIdx++

    // Encabezados
    const hr = wsMatriz.getRow(currentRowIdx)
    hr.height = 24
    headersMatriz.forEach((h, idx) => {
      const c = hr.getCell(idx + 1)
      c.value = h
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      c.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    currentRowIdx++

    // Filas de datos
    rows.forEach(row => {
      const r = wsMatriz.getRow(currentRowIdx)
      r.height = 22
      const vals = [
        row.id,
        row.subtitulo,
        row.tecnico,
        row.values.enRevision,
        row.values.descartados || 0,
        row.values.criticos || 0,
        row.values.documentacion,
        row.values.rechazados,
        row.values.validados,
        row.total
      ]
      vals.forEach((v, idx) => {
        const c = r.getCell(idx + 1)
        c.value = v
        c.font = { name: 'Arial', size: 10, bold: idx === 0 || idx === 9 }
        c.alignment = { vertical: 'middle', horizontal: idx <= 2 ? (idx === 2 ? 'left' : 'center') : 'center' }
        if (idx === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } }
        if (idx === 9) {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }
          c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0284C7' } }
        }
      })
      currentRowIdx++
    })

    // Fila Total de la Sección
    const totRow = wsMatriz.getRow(currentRowIdx)
    totRow.height = 24
    const totVals = [
      `TOTAL ${tituloSeccion.toUpperCase()}`,
      '-',
      '-',
      totals.enRevision,
      totals.descartados || 0,
      totals.criticos || 0,
      totals.documentacion,
      totals.rechazados,
      totals.validados,
      grand
    ]
    totVals.forEach((v, idx) => {
      const c = totRow.getCell(idx + 1)
      c.value = v
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
      c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      c.alignment = { vertical: 'middle', horizontal: idx <= 2 ? (idx === 2 ? 'left' : 'center') : 'center' }
    })
    currentRowIdx += 2 // Deja una fila en blanco
  }

  // Renderizar Tabla 1: Amazonas Original
  renderMatrizSection('Amazonas Original', origMatrix.matrixRows, origMatrix.matrixTotals, origMatrix.matrixGrandTotal)

  // Renderizar Tabla 2: Amazonas Ampliación
  renderMatrizSection('Amazonas Ampliación', amplMatrix.matrixRows, amplMatrix.matrixTotals, amplMatrix.matrixGrandTotal)

  // Fila Total Consolidado General de la Jornada
  const grandTotRow = wsMatriz.getRow(currentRowIdx)
  grandTotRow.height = 26
  const grandTotVals = [
    'TOTAL GENERAL DE JORNADA',
    'Todas las cuadrillas',
    '-',
    matrixTotals.enRevision,
    matrixTotals.descartados,
    matrixTotals.criticos,
    matrixTotals.documentacion,
    matrixTotals.rechazados,
    matrixTotals.validados,
    grandTotal
  ]
  grandTotVals.forEach((v, idx) => {
    const c = grandTotRow.getCell(idx + 1)
    c.value = v
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002244' } }
    c.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } }
    c.alignment = { vertical: 'middle', horizontal: idx <= 2 ? (idx === 2 ? 'left' : 'center') : 'center' }
  })

  // Separar los registros de detalle en Amazonas Original y Amazonas Ampliación
  const detailRowsOriginal = allDetailRows.filter(r => r.equipo !== 'EQUIPO 4')
  const detailRowsAmpliacion = allDetailRows.filter(r => r.equipo === 'EQUIPO 4')

  const detailColsConfig = [
    { width: 22 }, { width: 14 }, { width: 16 }, { width: 24 },
    { width: 18 }, { width: 28 }, { width: 12 }, { width: 20 },
    { width: 22 }, { width: 20 }, { width: 36 }, { width: 36 }
  ]
  const detailTableColsDef = [
    { name: 'ID Obs', filterButton: true },
    { name: 'Equipo', filterButton: true },
    { name: 'Cuadrilla', filterButton: true },
    { name: 'Técnico', filterButton: true },
    { name: 'Código de Sitio', filterButton: true },
    { name: 'Localidad', filterButton: true },
    { name: 'Zona', filterButton: true },
    { name: 'Estado COVEPA', filterButton: true },
    { name: 'Revisor', filterButton: true },
    { name: 'Fecha/Hora Subsanación', filterButton: true },
    { name: 'Detalle', filterButton: true },
    { name: 'Comentario', filterButton: true }
  ]

  const buildDetailWorksheet = (sheetName, tableName, rows) => {
    const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: true }] })
    ws.columns = detailColsConfig
    const mappedRows = rows.map(r => [
      r.id_obs, r.equipo, r.cuadrilla, r.tecnico, r.id_sitio, r.localidad,
      r.zona, r.estado, r.revisor, r.fecha_subsanacion, r.detalle, r.comentario
    ])
    ws.addTable({
      name: tableName,
      ref: 'A1',
      headerRow: true,
      totalsRow: false,
      style: { theme: 'TableStyleMedium9', showRowStripes: true, showColumnStripes: false },
      columns: detailTableColsDef,
      rows: mappedRows.length > 0 ? mappedRows : [['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']]
    })
    const hr = ws.getRow(1)
    hr.height = 26
    hr.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003060' } }
      c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      c.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    return ws
  }

  // Hoja 2: Detalle_Original (Regla 2.1: Localidad contigua a Sitio)
  buildDetailWorksheet(
    'Detalle_Original',
    `Interno_Orig_${targetFechaIso.replace(/-/g, '_')}`,
    detailRowsOriginal
  )

  // Hoja 3: Detalle_Ampliacion (Regla 2.1: Localidad contigua a Sitio)
  buildDetailWorksheet(
    'Detalle_Ampliacion',
    `Interno_Ampl_${targetFechaIso.replace(/-/g, '_')}`,
    detailRowsAmpliacion
  )

  const excelBuffer = await wb.xlsx.writeBuffer()
  const excelFileName = `Reporte_Interno_Observaciones_${targetFechaIso}.xlsx`

  const logoPath = path.resolve(__dirname, '../covepa.png')
  const hasLogo = fs.existsSync(logoPath)
  const logoSrc = hasLogo ? 'cid:covepa-logo' : 'https://byywikicdvmmmndhkooe.supabase.co/storage/v1/object/public/covepa.png'

  const renderTablaMatricialHTML = (titulo, matrix) => {
    const rows = matrix?.matrixRows || []
    const totals = matrix?.matrixTotals || { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 }
    const tGrand = matrix?.matrixGrandTotal || 0

    return `
      <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;font-weight:bold;color:#003060;margin:14px 0 6px 0;letter-spacing:0.3px;">
        📈 ${escapeHtml(titulo)}
      </div>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;border-collapse:collapse;width:100%;table-layout:fixed;margin-bottom:8px;">
        <thead>
          <tr style="background-color:#003060;color:#ffffff;">
            <th style="padding:10px 8px;font-family:'Segoe UI',Arial,sans-serif;font-size:10px;font-weight:bold;text-align:left;letter-spacing:0.4px;width:14%;overflow:hidden;white-space:nowrap;">EQUIPO</th>
            <th style="padding:10px 8px;font-family:'Segoe UI',Arial,sans-serif;font-size:10px;font-weight:bold;text-align:left;letter-spacing:0.4px;width:20%;overflow:hidden;white-space:nowrap;">TÉCNICOS</th>
            <th style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#bae6fd;text-align:center;width:11%;">EN REVISIÓN</th>
            <th style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#cbd5e1;text-align:center;width:11%;">DESCARTADOS</th>
            <th style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#fecdd3;text-align:center;width:9%;">CRÍTICOS</th>
            <th style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#e9d5ff;text-align:center;width:12%;">DOCUMENTACIÓN</th>
            <th style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#fecdd3;text-align:center;width:9%;">RECHAZADOS</th>
            <th style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#bbf7d0;text-align:center;width:9%;">VALIDADOS</th>
            <th style="padding:10px 6px;font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;font-weight:bold;color:#ffffff;text-align:center;width:5%;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
          <tr style="background-color:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};border-bottom:1px solid #e2e8f0;">
            <td style="padding:9px 8px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#003060;border-right:1px solid #e2e8f0;overflow:hidden;white-space:nowrap;">
              ${escapeHtml(r.id)}
              <div style="font-size:9.5px;font-weight:normal;color:#64748b;margin-top:1px;">${escapeHtml(r.subtitulo)}</div>
            </td>
            <td style="padding:9px 8px;font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;color:#334155;border-right:1px solid #e2e8f0;overflow:hidden;white-space:nowrap;">
              ${escapeHtml(r.tecnico)}
            </td>
            <td style="padding:9px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:${r.values.enRevision > 0 ? '#0284c7' : '#94a3b8'};text-align:center;border-right:1px solid #e2e8f0;background-color:${r.values.enRevision > 0 ? '#f0f9ff' : 'transparent'};">
              ${r.values.enRevision}
            </td>
            <td style="padding:9px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:${(r.values.descartados || 0) > 0 ? '#475569' : '#94a3b8'};text-align:center;border-right:1px solid #e2e8f0;background-color:${(r.values.descartados || 0) > 0 ? '#f1f5f9' : 'transparent'};">
              ${r.values.descartados || 0}
            </td>
            <td style="padding:9px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:${(r.values.criticos || 0) > 0 ? '#b91c1c' : '#94a3b8'};text-align:center;border-right:1px solid #e2e8f0;background-color:${(r.values.criticos || 0) > 0 ? '#fef2f2' : 'transparent'};">
              ${r.values.criticos || 0}
            </td>
            <td style="padding:9px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:${r.values.documentacion > 0 ? '#7e22ce' : '#94a3b8'};text-align:center;border-right:1px solid #e2e8f0;background-color:${r.values.documentacion > 0 ? '#faf5ff' : 'transparent'};">
              ${r.values.documentacion}
            </td>
            <td style="padding:9px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:${r.values.rechazados > 0 ? '#e11d48' : '#94a3b8'};text-align:center;border-right:1px solid #e2e8f0;background-color:${r.values.rechazados > 0 ? '#fff1f2' : 'transparent'};">
              ${r.values.rechazados}
            </td>
            <td style="padding:9px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:${r.values.validados > 0 ? '#16a34a' : '#94a3b8'};text-align:center;border-right:1px solid #e2e8f0;background-color:${r.values.validados > 0 ? '#f0fdf4' : 'transparent'};">
              ${r.values.validados}
            </td>
            <td style="padding:9px 6px;font-family:'Segoe UI',Arial,sans-serif;font-size:11.5px;font-weight:bold;color:${r.total > 0 ? '#003060' : '#94a3b8'};text-align:center;background-color:${r.total > 0 ? '#eff6ff' : 'transparent'};">
              ${r.total}
            </td>
          </tr>
          `).join('')}
          <!-- Fila de Total Tabla -->
          <tr style="background-color:#0f172a;color:#ffffff;border-top:2px solid #003060;">
            <td colspan="2" style="padding:10px 8px;font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.6px;">
              TOTAL DIARIO
            </td>
            <td style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#bae6fd;text-align:center;">${totals.enRevision}</td>
            <td style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#cbd5e1;text-align:center;">${totals.descartados || 0}</td>
            <td style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#fecdd3;text-align:center;">${totals.criticos || 0}</td>
            <td style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#e9d5ff;text-align:center;">${totals.documentacion}</td>
            <td style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#fecdd3;text-align:center;">${totals.rechazados}</td>
            <td style="padding:10px 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#bbf7d0;text-align:center;">${totals.validados}</td>
            <td style="padding:10px 6px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:bold;color:#38bdf8;text-align:center;background-color:#1e293b;">${tGrand}</td>
          </tr>
        </tbody>
      </table>
    `
  }

  // 7. Generar HTML del correo interno con diseño corporativo impecable y blindado contra bloqueos de imagen
  const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>COVEPA - Reporte Diario Interno</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <!--[if mso]>
        <table role="presentation" width="760" align="center" border="0" cellspacing="0" cellpadding="0">
        <tr><td>
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:760px;width:100%;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          
          <!-- Cabecera Institucional COVEPA (Homologada con los demás reportes) -->
          <tr>
            <td style="background-color:#003060;padding:24px 30px;text-align:left;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#38bdf8;text-transform:uppercase;margin-bottom:4px;">
                AMAZONAS · COVEPA
              </div>
              <h1 style="margin:0;font-family:'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;line-height:1.25;">
                Reporte Diario Interno — Productividad por Equipos
              </h1>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#93c5fd;margin-top:3px;font-weight:500;">
                Matriz ejecutiva de cuadrillas integradas y observaciones de la jornada
              </div>
              <div style="margin-top:10px;">
                <span style="display:inline-block;background-color:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:16px;padding:5px 14px;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:600;white-space:nowrap;">
                  📅 ${escapeHtml(targetFechaFormateada)}
                </span>
              </div>
            </td>
          </tr>

          <!-- Panel de Control de Métricas (Dashboard KPI: 7 Medidores en Fila Homologada) -->
          <tr>
            <td style="background-color:#f8fafc;border-bottom:1px solid #e2e8f0;padding:14px 16px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="table-layout:fixed;width:100%;">
                <tr>
                  <!-- 1. Total -->
                  <td style="padding:0 3px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #cbd5e1;border-top:3px solid #003060;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:8px 2px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:18px;font-weight:bold;color:#003060;line-height:1;">${grandTotal}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#003060;text-transform:uppercase;margin-top:4px;">TOTAL</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- 2. En Revisión -->
                  <td style="padding:0 3px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #bfdbfe;border-top:3px solid #0284c7;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:8px 2px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:18px;font-weight:bold;color:#0284c7;line-height:1;">${matrixTotals.enRevision}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#0369a1;text-transform:uppercase;margin-top:4px;">🔍 EN REV.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- 3. Descartadas -->
                  <td style="padding:0 3px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #cbd5e1;border-top:3px solid #64748b;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:8px 2px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:18px;font-weight:bold;color:#475569;line-height:1;">${matrixTotals.descartados}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#334155;text-transform:uppercase;margin-top:4px;">🚫 DESCART.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- 4. Críticos -->
                  <td style="padding:0 3px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #fecdd3;border-top:3px solid #e11d48;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:8px 2px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:18px;font-weight:bold;color:#e11d48;line-height:1;">${matrixTotals.criticos}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#be123c;text-transform:uppercase;margin-top:4px;">⚠️ CRÍTICOS</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- 5. Documentación -->
                  <td style="padding:0 3px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #e9d5ff;border-top:3px solid #9333ea;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:8px 2px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:18px;font-weight:bold;color:#9333ea;line-height:1;">${matrixTotals.documentacion}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#7e22ce;text-transform:uppercase;margin-top:4px;">📁 DOCUM.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- 6. Rechazadas -->
                  <td style="padding:0 3px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #fecdd3;border-top:3px solid #e11d48;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:8px 2px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:18px;font-weight:bold;color:#e11d48;line-height:1;">${matrixTotals.rechazados}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#be123c;text-transform:uppercase;margin-top:4px;">✕ RECHAZ.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- 7. Validadas -->
                  <td style="padding:0 3px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #bbf7d0;border-top:3px solid #16a34a;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:8px 2px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:18px;font-weight:bold;color:#16a34a;line-height:1;">${matrixTotals.validados}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:9.5px;font-weight:bold;color:#15803d;text-transform:uppercase;margin-top:4px;">✓ VALID.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TABLAS MATRICIALES EJECUTIVAS: AMAZONAS ORIGINAL Y AMAZONAS AMPLIACIÓN -->
          <tr>
            <td style="padding:16px 24px 12px 24px;">
              ${renderTablaMatricialHTML('Amazonas Original', origMatrix)}
              <div style="height:10px;"></div>
              ${renderTablaMatricialHTML('Amazonas Ampliación', amplMatrix)}
            </td>
          </tr>

          <!-- Notas Operativas de la Jornada (Solo si se ingresó texto) -->
          ${notasLimpias ? `
          <tr>
            <td style="padding:8px 24px 14px 24px;">
              <div style="background-color:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #003060;border-radius:6px;padding:12px 16px;">
                <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#003060;text-transform:uppercase;margin-bottom:5px;letter-spacing:0.8px;">
                  💬 Notas Operativas de la Jornada
                </div>
                <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;color:#334155;line-height:1.5;white-space:pre-wrap;">${escapeHtml(notasLimpias)}</div>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Firma Institucional COVEPA (Idéntica a los demás reportes) -->
          <tr>
            <td style="background-color:#ffffff;border-top:1px solid #e2e8f0;padding:24px 28px;text-align:left;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#475569;margin-bottom:12px;">
                Saludos cordiales,
              </div>
              <div style="margin-bottom:12px;">
                <img src="${logoSrc}" alt="COVEPA" width="145" height="38" border="0" style="display:block;width:145px;max-width:145px;height:auto;border:0;outline:none;" />
              </div>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:bold;color:#003060;line-height:1.3;">
                Condor Callupe Carlos
              </div>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;color:#64748b;font-weight:600;margin-top:2px;">
                Gestor de Calidad
              </div>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#64748b;margin-top:6px;">
                Cel: <a href="tel:+51958086874" style="color:#0284c7;text-decoration:none;font-weight:600;">+51 958 086 874</a>
              </div>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#64748b;margin-top:3px;">
                Correo: <a href="mailto:ccondor@covepa.pe" style="color:#0284c7;text-decoration:none;font-weight:600;">ccondor@covepa.pe</a>
              </div>
              <div style="margin-top:14px;border-top:1px solid #f1f5f9;padding-top:10px;font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#94a3b8;line-height:1.4;">
                Este mensaje y los archivos adjuntos son para uso exclusivo del personal de COVEPA y contienen información operativa confidencial.
              </div>
            </td>
          </tr>

        </table>
        <!--[if mso]>
        </td></tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
  `

  // 8. Enviar correo vía Nodemailer
  const smtpUser = (process.env.SMTP_USER || 'ccondor@covepa.pe').trim()
  const smtpPass = (process.env.SMTP_PASS || '').trim()
  if (!smtpPass) {
    console.error('[REPORTE-INTERNO] ❌ Falta variable de entorno SMTP_PASS.')
    return
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.covepa.pe',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false }
  })

  const subjectFinal = (config.asunto || 'Reporte Interno Diario - {fecha}')
    .replace('{fecha}', targetFechaFormateada)

  console.log(`[REPORTE-INTERNO] 📤 Enviando correo a ${recipients.join(', ')}...`)

  const info = await transporter.sendMail({
    from: `"COVEPA - Gestión de Calidad" <${smtpUser}>`,
    to: recipients,
    cc: recipientsCC.length > 0 ? recipientsCC : undefined,
    bcc: (forzarEnvio && rawDestinatarioPrueba) ? undefined : [smtpUser],
    subject: subjectFinal,
    html: htmlBody,
    attachments: [
      ...(hasLogo ? [{
        filename: 'covepa.png',
        path: logoPath,
        cid: 'covepa-logo'
      }] : []),
      {
        filename: excelFileName,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    ]
  })

  console.log(`[REPORTE-INTERNO] ✅ Correo entregado con éxito! MessageId: ${info.messageId}`)

  // 9. Actualizar ultimo_envio_at y registrar en historial
  if (!forzarEnvio) {
    try {
      await supabase
        .from('configuracion_reportes_correo')
        .update({ ultimo_envio_at: new Date().toISOString() })
        .eq('id', 'config_diario_interno')
    } catch (_) { }
  }

  try {
    const esPrueba = Boolean(forzarEnvio && rawDestinatarioPrueba)
    await supabase.from('historial_reportes_correo').insert({
      tipo_reporte: 'diario_interno',
      tipo: esPrueba ? 'prueba' : (forzarEnvio ? 'manual' : 'oficial'),
      origen: process.env.GITHUB_RUN_ID ? (isManualRun ? 'github_actions' : 'cron') : 'manual',
      destinatarios: recipients,
      destinatarios_cc: recipientsCC,
      asunto: subjectFinal,
      total_obs: grandTotal,
      validadas: matrixTotals.validados,
      rechazadas: matrixTotals.rechazados,
      en_espera: matrixTotals.solicitando + matrixTotals.enRevision,
      descartadas: matrixTotals.documentacion,
      estado: 'exitoso',
      message_id: info.messageId || null,
      github_run_id: process.env.GITHUB_RUN_ID || null,
      created_at: new Date().toISOString()
    })
  } catch (_) { }

  console.log(`[REPORTE-INTERNO] 🏁 Proceso de reporte interno completado con éxito.`)
}

// ============================================================
// MAIN: DISPATCHER COORDINADOR DE REPORTES DIARIOS
// ============================================================
async function main() {
  const tipoReporte = (process.env.TIPO_REPORTE || '').trim().toLowerCase()

  // Disparo dirigido a un reporte específico (sea prueba forzada o programado)
  if (tipoReporte === 'diario_interno' || tipoReporte === 'interno') {
    await enviarReporteDiarioInterno()
    return
  }

  if (tipoReporte === 'diario_ampliacion' || tipoReporte === 'ampliacion') {
    await enviarReporteDiarioAmpliacion()
    return
  }

  if (tipoReporte === 'diario' || tipoReporte === 'gilat' || tipoReporte === 'externo' || tipoReporte === 'original') {
    await enviarReporteDiarioGilat('original')
    return
  }

  // Si tipoReporte es 'todos' o no especificado (ej: señal periódica de cron-job.org):
  // Evalúa inteligentemente cada reporte contra su estado (activo) y su hora programada en Supabase
  console.log('[MAIN] 🧭 Evaluación programada de reportes activos según su hora configurada...')
  await enviarReporteDiarioGilat('original')
  await enviarReporteDiarioAmpliacion()
  await enviarReporteDiarioInterno()
}

module.exports = { main, enviarReporteDiarioInterno, enviarReporteDiarioGilat, enviarReporteDiarioAmpliacion }

if (require.main === module) {
  main().catch(err => {
    console.error('[CRON-REPORTE] ❌ Error fatal en el proceso:', err)
    process.exit(1)
  })
}
