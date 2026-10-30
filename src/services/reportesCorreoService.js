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
  asunto: 'Reporte Diario de Levantamiento de Observaciones Amazonas - Zona 2 y Zona 7',
  notas_jornada: ''
}

/**
 * Obtiene la configuración guardada del reporte automático.
 * Intenta leer desde Supabase y cuenta con fallback transparente en localStorage.
 * Borra automáticamente notas_jornada si provienen de un día anterior (cierre diario 00:00).
 */
export async function fetchConfiguracionReporte() {
  const hoyPeru = toLocalDateString(new Date())

  try {
    const { data, error } = await supabase
      .from('configuracion_reportes_correo')
      .select('*')
      .eq('id', 'config_diario')
      .maybeSingle()

    if (!error && data) {
      // Comprobar si la nota es de un día anterior para limpiarla a las 00:00
      let notasLimpias = data.notas_jornada || ''
      if (data.updated_at) {
        const d = new Date(data.updated_at)
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000)
        const fechaPeruUpdate = new Date(utc - (5 * 3600000)).toISOString().slice(0, 10)
        if (fechaPeruUpdate < hoyPeru && notasLimpias) {
          notasLimpias = ''
          // Limpiar en background en la base de datos
          supabase
            .from('configuracion_reportes_correo')
            .update({ notas_jornada: '' })
            .eq('id', 'config_diario')
            .then(() => {})
        }
      }

      const merged = {
        ...DEFAULT_CONFIG,
        ...data,
        notas_jornada: notasLimpias,
        asunto: data.asunto || DEFAULT_CONFIG.asunto,
        hora_envio: (data.hora_envio || '21:00:00').slice(0, 5) // normalizar a HH:MM
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged))
      return merged
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
        asunto: parsed.asunto || DEFAULT_CONFIG.asunto,
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
    updated_by: userEmail
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
  } catch (_) {}

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

    if (rawSt === 'Validado' || rawSt === 'Enviado' || (fechaSub === hoyStr && rawSt !== 'Descartado' && rawSt !== 'Rechazado' && rawSt !== 'Pendiente')) {
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
export function generarHTMLReporte({ config, datos, isWebPreview = true }) {
  const { fechaFormateada, stats, validadas, rechazadas, descartadas, enEspera } = datos
  const notas = (config.notas_jornada || '').trim()
  const logoSrc = isWebPreview ? '/covepa.png' : 'cid:covepa-logo'

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
              </table>
            </td>
          </tr>

          <!-- Resumen de Medidores / Contadores (4 Tarjetas) -->
          <tr>
            <td style="padding:20px 24px 12px 24px;">
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
                  <!-- En Espera (Solicitando Revisión + En Revisión) -->
                  <td width="25%" style="padding:4px;">
                    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#0284c7;line-height:1;">${stats.enEspera}</div>
                      <div style="font-size:11px;font-weight:bold;color:#0369a1;text-transform:uppercase;margin-top:4px;">⏳ En Espera</div>
                    </div>
                  </td>
                  <!-- Descartadas -->
                  <td width="25%" style="padding:4px;">
                    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:12px 8px;text-align:center;">
                      <div style="font-size:22px;font-weight:bold;color:#7e22ce;line-height:1;">${stats.descartadas}</div>
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
          ${notas ? `
          <tr>
            <td style="padding:10px 28px 16px 28px;">
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #003060;border-radius:6px;padding:14px 16px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11.5px;font-weight:bold;color:#003060;text-transform:uppercase;margin-bottom:6px;letter-spacing:0.5px;">
                  💬 Comentarios u Observaciones de la Jornada:
                </div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#334155;line-height:1.55;white-space:pre-wrap;">${escapeHtml(notas)}</div>
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
