/**
 * Script de Envío Automático del Reporte Diario por Correo
 * Proyecto: Amazonas - COVEPA
 * Remitente oficial: ccondor@covepa.pe (mail.covepa.pe)
 */

const nodemailer = require('nodemailer')
const { createClient } = require('@supabase/supabase-js')

// 1. Conexión a Supabase (con respaldo directo al proyecto oficial)
const DEFAULT_SUPABASE_URL = 'https://byywikicdvmmmndhkooe.supabase.co'
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5eXdpa2ljZHZtbW1uZGhrb29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTIxODgsImV4cCI6MjEwODA4ODE4OH0.KnBrlx7KmH6OelDv9k7EstHhuFCTGcgtgarLvHh4epk'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// 2. Helper de fecha en hora Perú (UTC-5)
function getPeruDateInfo() {
  const now = new Date()
  // Ajuste a UTC-5
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
  const isManualRun = process.env.IS_MANUAL_RUN === 'true'

  console.log(`[CRON-REPORTE] 🚀 Iniciando verificación de reporte diario COVEPA.`)
  console.log(`[CRON-REPORTE] 🕒 Hora actual Perú: ${horaMinuto} · Fecha: ${fechaIso}`)

  // 3. Leer Configuración desde Supabase
  let config = {
    activo: true,
    hora_envio: '21:00:00',
    destinatarios: ['ccondor@covepa.pe'],
    destinatarios_cc: [],
    asunto: '[COVEPA] Reporte Diario de Observaciones - {fecha}',
    notas_jornada: 'Cierre operativo de observaciones de la jornada.'
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

  // 4. Si el envío automático está desactivado y no es corrida manual, salir
  if (!config.activo && !isManualRun) {
    console.log('[CRON-REPORTE] ⏸️ El envío automático está marcado como inactivo. Finalizando.')
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

  // 4.2 Evitar envíos duplicados en la misma fecha
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

  // 6. Consultar mapa de localidades (Regla 2.1)
  let sitiosMap = {}
  try {
    const { data: sitiosData } = await supabase.from('sitios_asignados').select('id_site, localidad, nombre_nodo, grupo').eq('activo', true)
    if (sitiosData) {
      sitiosData.forEach(s => { sitiosMap[s.id_site] = s })
    }
  } catch (_) {}

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

    if (rawSt === 'Validado' || rawSt === 'Enviado' || (fechaSub === fechaIso && rawSt !== 'Descartado' && rawSt !== 'Rechazado')) {
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

  // 8. Armar asunto y cuerpo HTML
  const subjectTemplate = config.asunto || '[COVEPA] Reporte Diario de Observaciones - {fecha}'
  const subjectFinal = subjectTemplate.replace(/\{fecha\}/gi, fechaIso)

  const renderFila = (o, colorBorde = '#0284c7') => {
    const demoraBadge = o.justificacion_demora
      ? `<span style="display:inline-block;padding:2px 7px;background:#fffbeb;color:#b45309;border:1px solid #fde68a;border-radius:4px;font-size:11px;font-weight:600;margin-left:6px;">⚠️ Demora: ${escapeHtml(o.justificacion_demora)}</span>`
      : ''
    return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:12.5px;color:#003060;font-weight:bold;white-space:nowrap;border-left:3px solid ${colorBorde};">
          ${escapeHtml(o.id_obs || '—')}
        </td>
        <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;color:#334155;white-space:nowrap;">
          <strong>${escapeHtml(o.id_sitio || '—')}</strong> · ${escapeHtml(o.localidad || '—')}
        </td>
        <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:11.5px;color:#475569;">
          ${escapeHtml(o.cuadrilla || '—')}
        </td>
        <td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:11.5px;color:#1e293b;">
          ${escapeHtml(o.detalle || o.acuerdo_subsanacion || 'Sin detalle adicional')}
          ${demoraBadge}
        </td>
      </tr>
    `
  }

  const notas = config.notas_jornada || ''

  const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
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
              <h1 style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;line-height:1.2;">
                Reporte Diario de Operaciones y Observaciones
              </h1>
              <div style="font-size:12.5px;color:#cbd5e1;margin-top:6px;">
                📅 <strong>Jornada:</strong> ${escapeHtml(fechaFormateada)}
              </div>
            </td>
          </tr>

          <!-- Resumen de Contadores (4 Tarjetas) -->
          <tr>
            <td style="padding:20px 24px 10px 24px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="25%" style="padding:4px;">
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#16a34a;line-height:1;">${validadas.length}</div>
                      <div style="font-size:11px;font-weight:bold;color:#15803d;text-transform:uppercase;margin-top:4px;">✓ Validadas</div>
                    </div>
                  </td>
                  <td width="25%" style="padding:4px;">
                    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#e11d48;line-height:1;">${rechazadas.length}</div>
                      <div style="font-size:11px;font-weight:bold;color:#be123c;text-transform:uppercase;margin-top:4px;">✕ Rechazadas</div>
                    </div>
                  </td>
                  <td width="25%" style="padding:4px;">
                    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#7e22ce;line-height:1;">${descartadas.length}</div>
                      <div style="font-size:11px;font-weight:bold;color:#6b21a8;text-transform:uppercase;margin-top:4px;">🚫 Descartadas</div>
                    </div>
                  </td>
                  <td width="25%" style="padding:4px;">
                    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#0284c7;line-height:1;">${enEspera.length}</div>
                      <div style="font-size:11px;font-weight:bold;color:#0369a1;text-transform:uppercase;margin-top:4px;">⏳ En Espera</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${notas.trim() ? `
          <!-- Notas de la Jornada -->
          <tr>
            <td style="padding:10px 28px;">
              <div style="background:#fffbeb;border-left:4px solid #f59e0b;border:1px solid #fde68a;border-left-width:4px;border-radius:6px;padding:12px 14px;">
                <div style="font-size:12px;font-weight:bold;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
                  📌 Notas y Consideraciones de la Jornada:
                </div>
                <div style="font-size:13px;color:#451a03;line-height:1.45;white-space:pre-wrap;">${escapeHtml(notas)}</div>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Desglose Validadas -->
          <tr>
            <td style="padding:14px 28px 6px 28px;">
              <h2 style="margin:0 0 8px 0;font-size:14px;color:#003060;font-weight:bold;">
                <span style="color:#16a34a;margin-right:6px;">✓</span> Observaciones Validadas Hoy (${validadas.length})
              </h2>
              ${validadas.length === 0 ? `<div style="font-size:12px;color:#64748b;font-style:italic;padding:6px 0;">No se registraron validaciones formales en la jornada.</div>` : `
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px;">
                  <thead style="background:#f8fafc;font-size:11px;color:#475569;text-transform:uppercase;">
                    <tr>
                      <th style="padding:7px 12px;text-align:left;">Código</th>
                      <th style="padding:7px 12px;text-align:left;">Sitio · Localidad</th>
                      <th style="padding:7px 12px;text-align:left;">Cuadrilla</th>
                      <th style="padding:7px 12px;text-align:left;">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>${validadas.map(o => renderFila(o, '#16a34a')).join('')}</tbody>
                </table>
              `}
            </td>
          </tr>

          <!-- Desglose Rechazadas -->
          <tr>
            <td style="padding:6px 28px;">
              <h2 style="margin:0 0 8px 0;font-size:14px;color:#003060;font-weight:bold;">
                <span style="color:#e11d48;margin-right:6px;">✕</span> Observaciones Rechazadas (${rechazadas.length})
              </h2>
              ${rechazadas.length === 0 ? `<div style="font-size:12px;color:#64748b;font-style:italic;padding:6px 0;">Ninguna observación rechazada en la fecha.</div>` : `
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px;">
                  <thead style="background:#f8fafc;font-size:11px;color:#475569;text-transform:uppercase;">
                    <tr>
                      <th style="padding:7px 12px;text-align:left;">Código</th>
                      <th style="padding:7px 12px;text-align:left;">Sitio · Localidad</th>
                      <th style="padding:7px 12px;text-align:left;">Cuadrilla</th>
                      <th style="padding:7px 12px;text-align:left;">Motivo de Rechazo</th>
                    </tr>
                  </thead>
                  <tbody>${rechazadas.map(o => renderFila(o, '#e11d48')).join('')}</tbody>
                </table>
              `}
            </td>
          </tr>

          <!-- Desglose Descartadas -->
          ${descartadas.length > 0 ? `
          <tr>
            <td style="padding:6px 28px;">
              <h2 style="margin:0 0 8px 0;font-size:14px;color:#003060;font-weight:bold;">
                <span style="color:#7e22ce;margin-right:6px;">🚫</span> Observaciones Descartadas (${descartadas.length})
              </h2>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px;">
                <thead style="background:#f8fafc;font-size:11px;color:#475569;text-transform:uppercase;">
                  <tr>
                    <th style="padding:7px 12px;text-align:left;">Código</th>
                    <th style="padding:7px 12px;text-align:left;">Sitio · Localidad</th>
                    <th style="padding:7px 12px;text-align:left;">Cuadrilla</th>
                    <th style="padding:7px 12px;text-align:left;">Motivo</th>
                  </tr>
                </thead>
                <tbody>${descartadas.map(o => renderFila(o, '#7e22ce')).join('')}</tbody>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Desglose En Espera -->
          <tr>
            <td style="padding:6px 28px 18px 28px;">
              <h2 style="margin:0 0 8px 0;font-size:14px;color:#003060;font-weight:bold;">
                <span style="color:#0284c7;margin-right:6px;">⏳</span> Observaciones a la Espera de Revisión (${enEspera.length})
              </h2>
              ${enEspera.length === 0 ? `<div style="font-size:12px;color:#64748b;font-style:italic;padding:6px 0;">No quedan observaciones pendientes de revisión para mañana.</div>` : `
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px;">
                  <thead style="background:#f8fafc;font-size:11px;color:#475569;text-transform:uppercase;">
                    <tr>
                      <th style="padding:7px 12px;text-align:left;">Código</th>
                      <th style="padding:7px 12px;text-align:left;">Sitio · Localidad</th>
                      <th style="padding:7px 12px;text-align:left;">Cuadrilla</th>
                      <th style="padding:7px 12px;text-align:left;">Estado Actual</th>
                    </tr>
                  </thead>
                  <tbody>${enEspera.map(o => renderFila(o, '#0284c7')).join('')}</tbody>
                </table>
              `}
            </td>
          </tr>

          <!-- Pie del Correo -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 28px;text-align:center;">
              <div style="font-size:11px;color:#64748b;margin-bottom:4px;">
                Este correo fue generado y enviado automáticamente por el sistema <strong>Amazonas - COVEPA</strong>.
              </div>
              <div style="font-size:10.5px;color:#94a3b8;">
                Remitente: <strong>ccondor@covepa.pe</strong> · Servidor SMTP: mail.covepa.pe
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

  // 9. Configuración del Transportador SMTP
  const smtpUser = process.env.SMTP_USER || 'ccondor@covepa.pe'
  const smtpPass = process.env.SMTP_PASS

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

  // 10. Despachar Correo (con copia oculta de notificación al remitente para confirmación inmediata en Outlook)
  console.log(`[CRON-REPORTE] 📤 Enviando correo a través de mail.covepa.pe...`)
  const info = await transporter.sendMail({
    from: `"COVEPA - Gestión de Calidad" <${smtpUser}>`,
    to: recipients,
    cc: recipientsCC.length > 0 ? recipientsCC : undefined,
    bcc: [smtpUser], // Asegura notificación inmediata en Outlook para ccondor@covepa.pe
    subject: subjectFinal,
    html: htmlBody
  })

  console.log(`[CRON-REPORTE] ✅ Correo entregado con éxito! MessageId: ${info.messageId}`)

  // 11. Actualizar ultimo_envio_at en Supabase
  try {
    await supabase
      .from('configuracion_reportes_correo')
      .update({ ultimo_envio_at: new Date().toISOString() })
      .eq('id', 'config_diario')
  } catch (_) {}

  console.log(`[CRON-REPORTE] 🏁 Proceso finalizado satisfactoriamente.`)
}

main().catch(err => {
  console.error('[CRON-REPORTE] ❌ Error fatal en el proceso:', err)
  process.exit(1)
})
