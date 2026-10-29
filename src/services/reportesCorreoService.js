import { supabase } from '../lib/supabase'
import { getCachedSitiosAsignados } from './sitiosService'
import { toLocalDateString } from '../utils/helpers'

const LOCAL_STORAGE_KEY = 'covepa_config_reporte_correo'

const DEFAULT_CONFIG = {
  id: 'config_diario',
  activo: true,
  hora_envio: '21:00:00',
  destinatarios: ['ccondor@covepa.pe'],
  destinatarios_cc: [],
  asunto: '[COVEPA] Reporte Diario de Observaciones - {fecha}',
  notas_jornada: 'Cierre operativo de observaciones de la jornada.'
}

/**
 * Obtiene la configuración guardada del reporte automático.
 * Intenta leer desde Supabase y cuenta con fallback transparente en localStorage.
 */
export async function fetchConfiguracionReporte() {
  try {
    const { data, error } = await supabase
      .from('configuracion_reportes_correo')
      .select('*')
      .eq('id', 'config_diario')
      .maybeSingle()

    if (!error && data) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
      return {
        ...DEFAULT_CONFIG,
        ...data,
        hora_envio: (data.hora_envio || '21:00:00').slice(0, 5) // normalizar a HH:MM
      }
    }
  } catch (err) {
    console.warn('[REPORTES-CORREO] Error al consultar Supabase, usando respaldo local:', err)
  }

  // Fallback seguro a localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        hora_envio: (parsed.hora_envio || '21:00:00').slice(0, 5)
      }
    }
  } catch (_) {}

  return { ...DEFAULT_CONFIG, hora_envio: '21:00' }
}

/**
 * Guarda la configuración del reporte automático.
 */
export async function saveConfiguracionReporte(config, userEmail = null) {
  const horaNormalizada = config.hora_envio ? `${config.hora_envio.slice(0, 5)}:00` : '21:00:00'
  const payload = {
    id: 'config_diario',
    activo: config.activo !== false,
    hora_envio: horaNormalizada,
    destinatarios: Array.isArray(config.destinatarios) ? config.destinatarios : [config.destinatarios].filter(Boolean),
    destinatarios_cc: Array.isArray(config.destinatarios_cc) ? config.destinatarios_cc : [],
    asunto: config.asunto || DEFAULT_CONFIG.asunto,
    notas_jornada: config.notas_jornada || '',
    updated_at: new Date().toISOString(),
    updated_by: userEmail || 'coordinador'
  }

  // 1. Guardar en localStorage de inmediato
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))

  // 2. Persistir en Supabase
  try {
    const { data, error } = await supabase
      .from('configuracion_reportes_correo')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .maybeSingle()

    if (error) {
      console.warn('[REPORTES-CORREO] Aviso al guardar en Supabase (usando respaldo local):', error.message)
    }
    return data || payload
  } catch (err) {
    console.warn('[REPORTES-CORREO] Error de red al guardar en Supabase, guardado localmente:', err)
    return payload
  }
}

/**
 * Obtiene las observaciones de la fecha indicada clasificadas para el reporte diario.
 */
export async function fetchDatosReporteDiario(fechaFiltro = null) {
  const hoyStr = fechaFiltro || toLocalDateString(new Date())

  // Mapear catálogo de localidades para cumplir la Regla 2.1 (Código + Localidad)
  let sitiosMap = {}
  try {
    const sitiosList = await getCachedSitiosAsignados()
    for (const s of (sitiosList || [])) {
      sitiosMap[s.id_site] = s
    }
  } catch (e) {
    console.warn('Error cargando sitios para reporte:', e)
  }

  // Consultar observaciones relevantes
  const { data: rows, error } = await supabase
    .from('observaciones')
    .select('id_obs, id_sitio, protocolo, subsistema, detalle, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, justificacion_demora')

  if (error) {
    throw new Error(`Error cargando observaciones para el reporte: ${error.message}`)
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
    const cuad = (site.cuadrilla || site.grupo || '').replace(/GRUPO/gi, 'CUADRILLA')

    const item = {
      ...o,
      localidad: loc,
      cuadrilla: cuad
    }

    if (rawSt === 'Validado' || rawSt === 'Enviado' || (fechaSub === hoyStr && rawSt !== 'Descartado' && rawSt !== 'Rechazado')) {
      if (fechaSub === hoyStr || rawSt === 'Validado') {
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

  // Formato formal en español: ej. "Jueves, 29 de Octubre de 2026"
  let fechaFormateada = hoyStr
  try {
    const [y, m, d] = hoyStr.split('-').map(Number)
    const fechaObj = new Date(y, m - 1, d, 12, 0, 0)
    fechaFormateada = fechaObj.toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    fechaFormateada = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1)
  } catch (_) {}

  return {
    fechaStr: hoyStr,
    fechaFormateada,
    stats: {
      validadas: validadas.length,
      rechazadas: rechazadas.length,
      descartadas: descartadas.length,
      enEspera: enEspera.length,
      total: validadas.length + rechazadas.length + descartadas.length + enEspera.length
    },
    validadas,
    rechazadas,
    descartadas,
    enEspera
  }
}

/**
 * Genera el cuerpo de correo en formato HTML estricto con estilos en línea
 * compatible con Microsoft Outlook, Gmail y clientes móviles.
 */
export function generarHTMLReporte({ config, datos }) {
  const { fechaFormateada, stats, validadas, rechazadas, descartadas, enEspera } = datos
  const notas = config.notas_jornada || ''

  const renderFilaObs = (o, colorBorde = '#0284c7') => {
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

  return `
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
        <!-- Contenedor Principal (Max 680px) -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:680px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          
          <!-- Cabecera Institucional COVEPA -->
          <tr>
            <td style="background-color:#003060;padding:22px 28px;text-align:left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
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
              </table>
            </td>
          </tr>

          <!-- Resumen de Contadores (4 Tarjetas) -->
          <tr>
            <td style="padding:20px 24px 10px 24px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Validadas -->
                  <td width="25%" style="padding:4px;">
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#16a34a;line-height:1;">${stats.validadas}</div>
                      <div style="font-size:11px;font-weight:bold;color:#15803d;text-transform:uppercase;margin-top:4px;">✓ Validadas</div>
                    </div>
                  </td>
                  <!-- Rechazadas -->
                  <td width="25%" style="padding:4px;">
                    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#e11d48;line-height:1;">${stats.rechazadas}</div>
                      <div style="font-size:11px;font-weight:bold;color:#be123c;text-transform:uppercase;margin-top:4px;">✕ Rechazadas</div>
                    </div>
                  </td>
                  <!-- Descartadas -->
                  <td width="25%" style="padding:4px;">
                    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#7e22ce;line-height:1;">${stats.descartadas}</div>
                      <div style="font-size:11px;font-weight:bold;color:#6b21a8;text-transform:uppercase;margin-top:4px;">🚫 Descartadas</div>
                    </div>
                  </td>
                  <!-- En Espera -->
                  <td width="25%" style="padding:4px;">
                    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#0284c7;line-height:1;">${stats.enEspera}</div>
                      <div style="font-size:11px;font-weight:bold;color:#0369a1;text-transform:uppercase;margin-top:4px;">⏳ En Espera</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bloque de Notas y Consideraciones de la Jornada (Si existen) -->
          ${notas.trim() ? `
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

          <!-- Desglose 1: Observaciones Validadas Hoy -->
          <tr>
            <td style="padding:14px 28px 6px 28px;">
              <h2 style="margin:0 0 8px 0;font-size:14px;color:#003060;font-weight:bold;display:flex;align-items:center;">
                <span style="color:#16a34a;margin-right:6px;">✓</span> Observaciones Validadas Hoy (${validadas.length})
              </h2>
              ${validadas.length === 0 ? `
                <div style="font-size:12px;color:#64748b;font-style:italic;padding:6px 0;">No se registraron validaciones formales en la jornada.</div>
              ` : `
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px;">
                  <thead style="background:#f8fafc;font-size:11px;color:#475569;text-transform:uppercase;">
                    <tr>
                      <th style="padding:7px 12px;text-align:left;">Código</th>
                      <th style="padding:7px 12px;text-align:left;">Sitio · Localidad</th>
                      <th style="padding:7px 12px;text-align:left;">Cuadrilla</th>
                      <th style="padding:7px 12px;text-align:left;">Detalle / Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${validadas.map(o => renderFilaObs(o, '#16a34a')).join('')}
                  </tbody>
                </table>
              `}
            </td>
          </tr>

          <!-- Desglose 2: Observaciones Rechazadas Hoy -->
          <tr>
            <td style="padding:6px 28px;">
              <h2 style="margin:0 0 8px 0;font-size:14px;color:#003060;font-weight:bold;">
                <span style="color:#e11d48;margin-right:6px;">✕</span> Observaciones Rechazadas (${rechazadas.length})
              </h2>
              ${rechazadas.length === 0 ? `
                <div style="font-size:12px;color:#64748b;font-style:italic;padding:6px 0;">Ninguna observación rechazada en la fecha.</div>
              ` : `
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px;">
                  <thead style="background:#f8fafc;font-size:11px;color:#475569;text-transform:uppercase;">
                    <tr>
                      <th style="padding:7px 12px;text-align:left;">Código</th>
                      <th style="padding:7px 12px;text-align:left;">Sitio · Localidad</th>
                      <th style="padding:7px 12px;text-align:left;">Cuadrilla</th>
                      <th style="padding:7px 12px;text-align:left;">Motivo de Rechazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rechazadas.map(o => renderFilaObs(o, '#e11d48')).join('')}
                  </tbody>
                </table>
              `}
            </td>
          </tr>

          <!-- Desglose 3: Observaciones Descartadas (Si las hay) -->
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
                    <th style="padding:7px 12px;text-align:left;">Motivo de Cierre</th>
                  </tr>
                </thead>
                <tbody>
                  ${descartadas.map(o => renderFilaObs(o, '#7e22ce')).join('')}
                </tbody>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Desglose 4: A la Espera de Revisión -->
          <tr>
            <td style="padding:6px 28px 18px 28px;">
              <h2 style="margin:0 0 8px 0;font-size:14px;color:#003060;font-weight:bold;">
                <span style="color:#0284c7;margin-right:6px;">⏳</span> Observaciones a la Espera de Revisión (${enEspera.length})
              </h2>
              ${enEspera.length === 0 ? `
                <div style="font-size:12px;color:#64748b;font-style:italic;padding:6px 0;">No quedan observaciones pendientes de revisión para mañana.</div>
              ` : `
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px;">
                  <thead style="background:#f8fafc;font-size:11px;color:#475569;text-transform:uppercase;">
                    <tr>
                      <th style="padding:7px 12px;text-align:left;">Código</th>
                      <th style="padding:7px 12px;text-align:left;">Sitio · Localidad</th>
                      <th style="padding:7px 12px;text-align:left;">Cuadrilla</th>
                      <th style="padding:7px 12px;text-align:left;">Estado Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${enEspera.map(o => renderFilaObs(o, '#0284c7')).join('')}
                  </tbody>
                </table>
              `}
            </td>
          </tr>

          <!-- Pie del Correo Institucional -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 28px;text-align:center;">
              <div style="font-size:11px;color:#64748b;margin-bottom:4px;">
                Este correo fue generado y enviado automáticamente por el sistema <strong>Amazonas - COVEPA</strong>.
              </div>
              <div style="font-size:10.5px;color:#94a3b8;">
                Remitente oficial: <strong>ccondor@covepa.pe</strong> · Servidor: mail.covepa.pe
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

