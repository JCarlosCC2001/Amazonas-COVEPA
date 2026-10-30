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

async function main() {
  const { fechaIso, horaMinuto, fechaFormateada } = getPeruDateInfo()
  const isManualRun = process.env.IS_MANUAL_RUN === 'true' ||
                      process.env.IS_MANUAL_RUN === true ||
                      process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'
  const forzarEnvio = process.env.FORZAR_ENVIO === 'true' || process.env.FORZAR_ENVIO === true

  console.log(`[CRON-REPORTE] 🚀 Iniciando verificación de reporte diario COVEPA.`)
  console.log(`[CRON-REPORTE] 🕒 Hora actual Perú: ${horaMinuto} · Fecha: ${fechaIso} | Modo: ${isManualRun ? 'MANUAL FORZADO' : 'PROGRAMADO'}`)

  // 3. Leer Configuración desde Supabase
  let config = {
    activo: true,
    hora_envio: '21:00:00',
    destinatarios: ['ccondor@covepa.pe'],
    destinatarios_cc: [],
    asunto: 'Reporte Diario de Levantamiento de Observaciones Amazonas - Zona 2 y Zona 7',
    notas_jornada: '',
    periodo_reporte: 'dia_actual'
  }

  try {
    const { data: dbConfig } = await supabase
      .from('configuracion_reportes_correo')
      .select('*')
      .eq('id', 'config_diario')
      .maybeSingle()

    if (dbConfig) {
      config = { ...config, ...dbConfig }
    }
  } catch (err) {
    console.warn('[CRON-REPORTE] ⚠️ No se pudo leer la tabla de configuración, usando valores por defecto:', err.message)
  }

  // 3.1 Limpieza automática diaria de notas_jornada si provienen de un día anterior
  let notasLimpias = (config.notas_jornada || '').trim()
  if (config.updated_at) {
    const fechaPeruUpdate = getPeruDateString(config.updated_at)
    if (fechaPeruUpdate && fechaPeruUpdate < fechaIso && notasLimpias) {
      console.log(`[CRON-REPORTE] 🧹 La nota operativa pertenece al día anterior (${fechaPeruUpdate}). Limpiando comentario para la nueva jornada.`)
      notasLimpias = ''
      try {
        await supabase
          .from('configuracion_reportes_correo')
          .update({ notas_jornada: '' })
          .eq('id', 'config_diario')
      } catch (_) {}
    }
  }

  // 3.2 Determinar jornada objetivo (Día actual vs Día anterior)
  const periodoReporte = config.periodo_reporte || 'dia_actual'
  const targetDateInfo = periodoReporte === 'dia_anterior' ? getPeruDateInfo(-1) : getPeruDateInfo(0)
  const targetFechaIso = targetDateInfo.fechaIso
  const targetFechaFormateada = targetDateInfo.fechaFormateada
  console.log(`[CRON-REPORTE] 📅 Configuración de jornada: ${periodoReporte === 'dia_anterior' ? 'DÍA ANTERIOR' : 'DÍA ACTUAL'} -> Reportando fecha: ${targetFechaIso} (${targetFechaFormateada})`)

  // 4. Si el envío automático está desactivado y no es corrida manual, salir
  if (!config.activo && !isManualRun) {
    console.log('[CRON-REPORTE] ⏸️ El envío automático está marcado como inactivo en la base de datos. Finalizando.')
    return
  }

  // 4.1 Comprobar coincidencia de hora si es ejecución programada
  const [cfgH, cfgM] = (config.hora_envio || '21:00:00').split(':').map(Number)
  const [curH, curM] = horaMinuto.split(':').map(Number)
  const cfgTotalMins = (cfgH || 0) * 60 + (cfgM || 0)
  const curTotalMins = (curH || 0) * 60 + (curM || 0)
  const diffMins = curTotalMins - cfgTotalMins

  // a) Si aún no llega la hora programada en hora Perú (diffMins < 0), esperar al siguiente ciclo
  if (!isManualRun && diffMins < 0) {
    console.log(`[CRON-REPORTE] ⏳ Hora programada: ${config.hora_envio} | Hora actual Perú: ${horaMinuto}. Faltan ${Math.abs(diffMins)} min para la hora programada. Omitiendo.`)
    return
  }

  // b) Si han pasado más de 6 horas desde la hora programada (ej. ya amaneció o es otra jornada), omitir
  if (!isManualRun && diffMins > 360) {
    console.log(`[CRON-REPORTE] ⏳ La hora programada (${config.hora_envio}) quedó fuera de la ventana nocturna respecto a la hora actual (${horaMinuto}). Omitiendo.`)
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
  const recipients = (config.destinatarios || []).filter(Boolean)
  if (recipients.length === 0) {
    recipients.push('ccondor@covepa.pe')
  }
  const recipientsCC = (config.destinatarios_cc || []).filter(Boolean)

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
  try {
    const [extRes, localRes] = await Promise.all([
      supabaseExt.from('sitios').select('id_site, localidad, nombre_nodo'),
      supabase.from('sitios_cuadrillas').select('id_site, cuadrilla, zona').eq('activo', true)
    ])

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

  // 7. Consultar observaciones de la jornada (Consistente con Programación y Avance del Día)
  const startIso = `${targetFechaIso}T00:00:00`
  const endIso = `${targetFechaIso}T23:59:59`

  const { data: rawObsFecha, error: obsErr } = await supabase
    .from('observaciones')
    .select('id_obs, id_sitio, protocolo, subsistema, detalle, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, justificacion_demora')
    .gte('fecha_subsanacion', startIso)
    .lte('fecha_subsanacion', endIso)
    .order('fecha_subsanacion', { ascending: false })

  if (obsErr) {
    console.error('[CRON-REPORTE] ❌ Error consultando observaciones por fecha:', obsErr)
    process.exit(1)
  }

  const { data: rawObsRevision, error: revErr } = await supabase
    .from('observaciones')
    .select('id_obs, id_sitio, protocolo, subsistema, detalle, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, justificacion_demora')
    .or('estado_covepa.eq.En Revision,estado_covepa.eq.En Revisión,estado_covepa.eq.Solicitando Revision,estado_covepa.eq.Solicitando Revisión')

  if (revErr) {
    console.warn('[CRON-REPORTE] ⚠️ Aviso consultando revisiones activas:', revErr.message)
  }

  // Consolidar observaciones de la fecha y de revisión activa sin duplicados
  const obsMap = new Map()
  ;(rawObsFecha || []).forEach(o => obsMap.set(o.id_obs, o))
  ;(rawObsRevision || []).forEach(o => {
    if (!obsMap.has(o.id_obs)) obsMap.set(o.id_obs, o)
  })

  const rows = Array.from(obsMap.values()).map(o => {
    const rawSt = (o.estado_covepa || '').trim()
    let estadoNormalizado = 'Validado'
    if (rawSt === 'Descartado') estadoNormalizado = 'Descartado'
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

  const validadas = rows.filter(r => r.estado === 'Validado')
  const rechazadas = rows.filter(r => r.estado === 'Rechazado')
  const descartadas = rows.filter(r => r.estado === 'Descartado')
  const enEspera = rows.filter(r => r.estado === 'Solicitando Revisión' || r.estado === 'En Revisión')
  const totalListados = validadas.length + rechazadas.length + enEspera.length + descartadas.length

  const stats = {
    validadas: validadas.length,
    rechazadas: rechazadas.length,
    descartadas: descartadas.length,
    enEspera: enEspera.length,
    total: rows.length
  }

  console.log(`[CRON-REPORTE] 📊 Resumen computado: Validadas: ${stats.validadas} | Rechazadas: ${stats.rechazadas} | En Espera: ${stats.enEspera} | Descartadas: ${stats.descartadas}`)

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

    // Anchos calibrados de las 6 columnas oficiales (Zona entre ID y Código de lugar)
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
      ...descartadas
    ]

    const tableRows = allRows.map(r => {
      let estadoDisplay = r.estado || 'Validado'
      if (estadoDisplay === 'Descartado') estadoDisplay = 'No Aplica'
      const revRaw = (r.revisor || '').trim()
      const isSinRevisor = !revRaw ||
        revRaw.toLowerCase() === 'sin revisor' ||
        revRaw.toLowerCase() === 'en proceso' ||
        revRaw.toLowerCase() === 'pendiente' ||
        revRaw === '-'
      const revisorFinal = isSinRevisor ? '-' : revRaw

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
    attachments.push({
      filename: `Reporte_Observaciones_${targetFechaIso}.xlsx`,
      content: excelBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    console.log(`[CRON-REPORTE] 📊 Archivo Excel con formato de tabla generado y adjuntado: Reporte_Observaciones_${targetFechaIso}.xlsx (${allRows.length} registros)`)
  } catch (errExcel) {
    console.error('[CRON-REPORTE] ⚠️ Error generando Excel adjunto:', errExcel)
  }

  // 9. Asunto oficial
  const subjectTemplate = config.asunto || 'Reporte Diario de Levantamiento de Observaciones Amazonas - Zona 2 y Zona 7'
  const subjectFinal = subjectTemplate.includes('{fecha}')
    ? subjectTemplate.replace(/\{fecha\}/gi, targetFechaIso)
    : subjectTemplate

  // Helper para renderizar insignias (chips) limpias y legibles de códigos
  const renderCodeList = (items, colorText, colorBorder, bgLight = '#f8fafc') => {
    return `
      <div style="background-color:${bgLight};border:1px solid ${colorBorder};border-radius:6px;padding:10px 14px;">
        ${items.map(o => `
          <span style="display:inline-block;padding:3px 9px;margin:2px 3px;background-color:#ffffff;border:1px solid ${colorBorder};border-radius:4px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:bold;color:${colorText};line-height:1.4;">
            ${escapeHtml(o.id_obs || '—')}
          </span>
        `).join('')}
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
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="middle">
                    <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#38bdf8;text-transform:uppercase;margin-bottom:4px;">
                      AMAZONAS · COVEPA
                    </div>
                    <h1 style="margin:0;font-family:'Segoe UI',Arial,sans-serif;font-size:19px;font-weight:bold;color:#ffffff;line-height:1.25;">
                      Reporte Diario de Levantamiento de Observaciones
                    </h1>
                    <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#bfdbfe;margin-top:3px;font-weight:500;">
                      Amazonas — Zona 2 y Zona 7
                    </div>
                  </td>
                  <td align="right" valign="middle" style="text-align:right;">
                    <div style="display:inline-block;background-color:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:16px;padding:6px 12px;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:600;white-space:nowrap;">
                      📅 ${escapeHtml(targetFechaFormateada)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Panel de Control de Métricas (Dashboard KPI Integrado) -->
          <tr>
            <td style="background-color:#f8fafc;border-bottom:1px solid #e2e8f0;padding:16px 24px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <!-- Total General Trabajado -->
                <tr>
                  <td colspan="4" style="padding-bottom:10px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #cbd5e1;border-left:4px solid #003060;border-radius:6px;">
                      <tr>
                        <td style="padding:10px 16px;text-align:left;">
                          <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">
                            Total de Observaciones Trabajadas en la Jornada
                          </span>
                        </td>
                        <td style="padding:10px 16px;text-align:right;">
                          <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:26px;font-weight:bold;color:#003060;line-height:1;">
                            ${stats.total}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Fila de los 4 Medidores -->
                <tr>
                  <!-- Validadas -->
                  <td width="25%" style="padding:0 3px 0 0;" valign="top">
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
                  <td width="25%" style="padding:0 3px;" valign="top">
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
                  <td width="25%" style="padding:0 3px;" valign="top">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #bfdbfe;border-top:3px solid #0284c7;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:10px 4px;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:bold;color:#0284c7;line-height:1;">${stats.enEspera}</div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10px;font-weight:bold;color:#0369a1;text-transform:uppercase;margin-top:4px;">⏳ En Espera</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- No Aplica -->
                  <td width="25%" style="padding:0 0 0 3px;" valign="top">
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

          <!-- 4. Agrupación: Observaciones No Aplica (Solo si tiene códigos) -->
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

  // 11. Despachar Correo
  console.log(`[CRON-REPORTE] 📤 Enviando correo a través de mail.covepa.pe (desde ${smtpUser})...`)
  const info = await transporter.sendMail({
    from: `"COVEPA - Gestión de Calidad" <${smtpUser}>`,
    to: recipients,
    cc: recipientsCC.length > 0 ? recipientsCC : undefined,
    bcc: [smtpUser], // Notificación inmediata en Outlook para ccondor@covepa.pe
    subject: subjectFinal,
    html: htmlBody,
    attachments: attachments.length > 0 ? attachments : undefined
  })

  console.log(`[CRON-REPORTE] ✅ Correo entregado con éxito! MessageId: ${info.messageId}`)

  // 12. Actualizar ultimo_envio_at en Supabase
  try {
    const { error: updErr } = await supabase
      .from('configuracion_reportes_correo')
      .update({ ultimo_envio_at: new Date().toISOString() })
      .eq('id', 'config_diario')

    if (updErr) {
      console.warn('[CRON-REPORTE] ⚠️ Aviso al actualizar ultimo_envio_at en Supabase:', updErr.message)
    } else {
      console.log('[CRON-REPORTE] 📝 Base de datos actualizada con la marca de tiempo de envío.')
    }
  } catch (_) {}

  console.log(`[CRON-REPORTE] 🏁 Proceso finalizado satisfactoriamente.`)
}

main().catch(err => {
  console.error('[CRON-REPORTE] ❌ Error fatal en el proceso:', err)
  process.exit(1)
})
