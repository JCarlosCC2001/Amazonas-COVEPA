/**
 * Script de Envío Automático del Reporte Diario por Correo
 * Proyecto: Amazonas - COVEPA
 * Remitente oficial: ccondor@covepa.pe (mail.covepa.pe)
 */

const nodemailer = require('nodemailer')
const { createClient } = require('@supabase/supabase-js')
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
function getPeruDateInfo() {
  const now = new Date()
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
  const peruTime = new Date(utc - (5 * 3600000))

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

  console.log(`[CRON-REPORTE] 🚀 Iniciando verificación de reporte diario COVEPA.`)
  console.log(`[CRON-REPORTE] 🕒 Hora actual Perú: ${horaMinuto} · Fecha: ${fechaIso} | Modo: ${isManualRun ? 'MANUAL FORZADO' : 'PROGRAMADO'}`)

  // 3. Leer Configuración desde Supabase
  let config = {
    activo: true,
    hora_envio: '21:00:00',
    destinatarios: ['ccondor@covepa.pe'],
    destinatarios_cc: [],
    asunto: 'Reporte Diario de Levantamiento de Observaciones Amazonas - Zona 2 y Zona 7',
    notas_jornada: ''
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
    const d = new Date(config.updated_at)
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000)
    const fechaPeruUpdate = new Date(utc - (5 * 3600000)).toISOString().slice(0, 10)
    if (fechaPeruUpdate < fechaIso && notasLimpias) {
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

  // 4. Si el envío automático está desactivado y no es corrida manual, salir
  if (!config.activo && !isManualRun) {
    console.log('[CRON-REPORTE] ⏸️ El envío automático está marcado como inactivo en la base de datos. Finalizando.')
    return
  }

  // 4.1 Comprobar coincidencia de hora y minuto si es ejecución programada
  const [cfgH, cfgM] = (config.hora_envio || '21:00:00').split(':').map(Number)
  const [curH, curM] = horaMinuto.split(':').map(Number)
  const cfgTotalMins = (cfgH || 0) * 60 + (cfgM || 0)
  const curTotalMins = (curH || 0) * 60 + (curM || 0)
  const diffMins = curTotalMins - cfgTotalMins

  // Si no es ejecución manual, verificar si estamos en la ventana de envío (desde la hora programada hasta 25 min después)
  if (!isManualRun && (diffMins < 0 || diffMins > 25)) {
    console.log(`[CRON-REPORTE] ⏳ Hora programada es ${config.hora_envio} y la hora actual Perú es ${horaMinuto}. Fuera de ventana (dif: ${diffMins} min). Omitiendo.`)
    return
  }

  // 4.2 Evitar envíos duplicados en la misma fecha (solo en modo programado)
  if (!isManualRun && config.ultimo_envio_at) {
    const ultimoEnvioStr = new Date(config.ultimo_envio_at).toISOString().slice(0, 10)
    if (ultimoEnvioStr === fechaIso) {
      console.log(`[CRON-REPORTE] ℹ️ El reporte de la fecha ${fechaIso} ya fue enviado hoy a las ${config.ultimo_envio_at}. Omitiendo envío duplicado.`)
      return
    }
  }

  // 5. Destinatarios
  const recipients = (config.destinatarios || []).filter(Boolean)
  if (recipients.length === 0) {
    recipients.push('ccondor@covepa.pe')
  }
  const recipientsCC = (config.destinatarios_cc || []).filter(Boolean)

  console.log(`[CRON-REPORTE] 📬 Destinatarios: ${recipients.join(', ')} | CC: ${recipientsCC.join(', ') || 'Ninguno'}`)

  // 6. Consultar mapa de localidades y cuadrillas (Regla 2.1)
  let sitiosMap = {}
  try {
    const [extRes, localRes] = await Promise.all([
      supabaseExt.from('sitios').select('id_site, localidad, nombre_nodo'),
      supabase.from('sitios_asignados').select('id_site, grupo, zona')
    ])

    const asignacionesMap = {}
    if (localRes.data) {
      localRes.data.forEach(a => { asignacionesMap[a.id_site] = a })
    }

    if (extRes.data) {
      extRes.data.forEach(s => {
        const asig = asignacionesMap[s.id_site] || {}
        sitiosMap[s.id_site] = {
          ...s,
          grupo: asig.grupo || 'Sin Cuadrilla',
          zona: asig.zona || ''
        }
      })
    }
  } catch (errSitios) {
    console.warn('[CRON-REPORTE] ⚠️ Aviso consultando catálogo de sitios:', errSitios.message)
  }

  // 7. Consultar observaciones de la base de datos
  const { data: rows, error: obsErr } = await supabase
    .from('observaciones')
    .select('id_obs, id_sitio, protocolo, subsistema, detalle, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, justificacion_demora')

  if (obsErr) {
    console.error('[CRON-REPORTE] ❌ Error consultando observaciones:', obsErr)
    process.exit(1)
  }

  const allObs = rows || []
  const validadas = []
  const rechazadas = []
  const descartadas = []
  const enEspera = []

  allObs.forEach(o => {
    const rawSt = (o.estado_covepa || '').trim()
    const fechaSub = o.fecha_subsanacion ? String(o.fecha_subsanacion).slice(0, 10) : ''
    const site = sitiosMap[o.id_sitio] || {}
    const loc = site.localidad || site.nombre_nodo || 'Amazonas'
    const cuad = (site.grupo || 'Sin Cuadrilla').replace(/GRUPO/gi, 'CUADRILLA')

    const item = { ...o, localidad: loc, cuadrilla: cuad }

    if (rawSt === 'Validado' || rawSt === 'Enviado' || (fechaSub === fechaIso && rawSt !== 'Descartado' && rawSt !== 'Rechazado' && rawSt !== 'Pendiente')) {
      if (fechaSub === fechaIso || rawSt === 'Validado') {
        validadas.push(item)
      }
    } else if (rawSt === 'Rechazado') {
      rechazadas.push(item)
    } else if (rawSt === 'Descartado') {
      descartadas.push(item)
    } else if (rawSt === 'Solicitando Revisión' || rawSt === 'Solicitando Revision' || rawSt === 'En Revisión' || rawSt === 'En Revision') {
      enEspera.push(item)
    }
  })

  console.log(`[CRON-REPORTE] 📊 Resumen computado: Validadas: ${validadas.length} | Rechazadas: ${rechazadas.length} | Descartadas: ${descartadas.length} | En Espera: ${enEspera.length}`)

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

  // 9. Asunto oficial
  const subjectTemplate = config.asunto || 'Reporte Diario de Levantamiento de Observaciones Amazonas - Zona 2 y Zona 7'
  const subjectFinal = subjectTemplate.includes('{fecha}')
    ? subjectTemplate.replace(/\{fecha\}/gi, fechaIso)
    : subjectTemplate

  // Helper para renderizar pastillas / badges compactos de códigos (Regla 2.1: Código de Sitio · Localidad)
  const renderItemPill = (o, colorBg, colorBorder, colorText) => {
    const loc = o.localidad || 'Amazonas'
    const siteInfo = o.id_sitio ? `(${escapeHtml(o.id_sitio)} · ${escapeHtml(loc)})` : ''
    return `
      <span style="display:inline-block;padding:5px 10px;margin:3px 4px;background:${colorBg};border:1px solid ${colorBorder};border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${colorText};line-height:1.4;">
        <strong style="color:${colorText};">${escapeHtml(o.id_obs || '—')}</strong>
        ${siteInfo ? `<span style="color:#64748b;font-size:11px;margin-left:5px;">${siteInfo}</span>` : ''}
      </span>
    `
  }

  const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Reporte Diario COVEPA</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:20px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:680px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          
          <!-- Cabecera Institucional COVEPA -->
          <tr>
            <td style="background-color:#003060;padding:22px 28px;text-align:left;">
              <div style="font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#38bdf8;text-transform:uppercase;margin-bottom:4px;">
                AMAZONAS · COVEPA
              </div>
              <h1 style="margin:0;font-size:19px;font-weight:bold;color:#ffffff;line-height:1.25;">
                Reporte Diario de Levantamiento de Observaciones
              </h1>
              <div style="font-size:13px;color:#93c5fd;margin-top:2px;font-weight:500;">
                Amazonas - Zona 2 y Zona 7
              </div>
              <div style="font-size:12px;color:#cbd5e1;margin-top:6px;">
                📅 <strong>Jornada:</strong> ${escapeHtml(fechaFormateada)}
              </div>
            </td>
          </tr>

          <!-- Medidores / Contadores del Reporte (4 Tarjetas) -->
          <tr>
            <td style="padding:20px 24px 12px 24px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Validadas -->
                  <td width="25%" style="padding:4px;">
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#16a34a;line-height:1;">${validadas.length}</div>
                      <div style="font-size:11px;font-weight:bold;color:#15803d;text-transform:uppercase;margin-top:4px;">✓ Validadas</div>
                    </div>
                  </td>
                  <!-- Rechazadas -->
                  <td width="25%" style="padding:4px;">
                    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#e11d48;line-height:1;">${rechazadas.length}</div>
                      <div style="font-size:11px;font-weight:bold;color:#be123c;text-transform:uppercase;margin-top:4px;">✕ Rechazadas</div>
                    </div>
                  </td>
                  <!-- En Espera (Solicitando Revisión + En Revisión) -->
                  <td width="25%" style="padding:4px;">
                    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#0284c7;line-height:1;">${enEspera.length}</div>
                      <div style="font-size:11px;font-weight:bold;color:#0369a1;text-transform:uppercase;margin-top:4px;">⏳ En Espera</div>
                    </div>
                  </td>
                  <!-- Descartadas -->
                  <td width="25%" style="padding:4px;">
                    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#7e22ce;line-height:1;">${descartadas.length}</div>
                      <div style="font-size:11px;font-weight:bold;color:#6b21a8;text-transform:uppercase;margin-top:4px;">🚫 Descartadas</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 1. Agrupación: Observaciones Validadas -->
          <tr>
            <td style="padding:10px 28px 12px 28px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#16a34a;margin-right:6px;">✓</span> Observaciones Validadas (${validadas.length})
              </div>
              ${validadas.length === 0 ? `
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;font-style:italic;padding:4px 0;">
                  No se registraron observaciones validadas en esta jornada.
                </div>
              ` : `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;line-height:2.0;">
                  ${validadas.map(o => renderItemPill(o, '#f0fdf4', '#bbf7d0', '#15803d')).join('')}
                </div>
              `}
            </td>
          </tr>

          <!-- 2. Agrupación: Observaciones Rechazadas -->
          <tr>
            <td style="padding:8px 28px 12px 28px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#e11d48;margin-right:6px;">✕</span> Observaciones Rechazadas (${rechazadas.length})
              </div>
              ${rechazadas.length === 0 ? `
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;font-style:italic;padding:4px 0;">
                  Ninguna observación rechazada en la jornada.
                </div>
              ` : `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;line-height:2.0;">
                  ${rechazadas.map(o => renderItemPill(o, '#fff1f2', '#fecdd3', '#be123c')).join('')}
                </div>
              `}
            </td>
          </tr>

          <!-- 3. Agrupación: En Espera de Revisión (Solicitando Revisión + En Revisión) -->
          <tr>
            <td style="padding:8px 28px 12px 28px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#0284c7;margin-right:6px;">⏳</span> En Espera de Revisión (${enEspera.length})
              </div>
              ${enEspera.length === 0 ? `
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;font-style:italic;padding:4px 0;">
                  No quedan observaciones a la espera de revisión para mañana.
                </div>
              ` : `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;line-height:2.0;">
                  ${enEspera.map(o => renderItemPill(o, '#f0f9ff', '#bae6fd', '#0369a1')).join('')}
                </div>
              `}
            </td>
          </tr>

          <!-- 4. Agrupación: Observaciones Descartadas (Solo si existen) -->
          ${descartadas.length > 0 ? `
          <tr>
            <td style="padding:8px 28px 12px 28px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#7e22ce;margin-right:6px;">🚫</span> Observaciones Descartadas (${descartadas.length})
              </div>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;line-height:2.0;">
                ${descartadas.map(o => renderItemPill(o, '#faf5ff', '#e9d5ff', '#6b21a8')).join('')}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Bloque de Comentarios u Observaciones de la Jornada (Solo si se ingresó texto) -->
          ${notasLimpias ? `
          <tr>
            <td style="padding:10px 28px 16px 28px;">
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #003060;border-radius:6px;padding:14px 16px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11.5px;font-weight:bold;color:#003060;text-transform:uppercase;margin-bottom:6px;letter-spacing:0.5px;">
                  💬 Comentarios u Observaciones de la Jornada:
                </div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#334155;line-height:1.55;white-space:pre-wrap;">${escapeHtml(notasLimpias)}</div>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Firma Institucional COVEPA con Logo Oficial -->
          <tr>
            <td style="background-color:#ffffff;border-top:1px solid #e2e8f0;padding:24px 28px 18px 28px;text-align:left;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#334155;margin-bottom:12px;">
                Saludos cordiales
              </div>
              <div style="margin-bottom:14px;">
                <img src="${logoSrc}" alt="COVEPA" style="display:block;width:150px;max-width:160px;height:auto;border:0;" />
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#003060;line-height:1.3;">
                Condor Callupe Carlos
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#475569;font-weight:600;margin-top:2px;">
                Gestor de calidad
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;margin-top:5px;">
                Cel: <a href="tel:+51958086874" style="color:#0284c7;text-decoration:none;font-weight:500;">+51 958 086 874</a>
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;margin-top:3px;">
                Correo: <a href="mailto:ccondor@covepa.pe" style="color:#0284c7;text-decoration:none;font-weight:500;">ccondor@covepa.pe</a>
              </div>
            </td>
          </tr>

          <!-- Pie del Correo Institucional -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 28px;text-align:center;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#94a3b8;">
                Sistema de Control y Operaciones Amazonas · COVEPA
              </div>
            </td>
          </tr>

        </table>
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
