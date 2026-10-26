/**
 * Servicio de Generación de Imagen (PNG) y Exportación al Portapapeles / Descarga
 * para el Reporte de Avance del Día de Amazonas-COVEPA.
 */

/**
 * Trunca el texto con elipsis (...) si supera el ancho máximo en pixeles del contexto Canvas.
 */
function fitText(ctx, text, maxWidth) {
  if (!text) return ''
  if (ctx.measureText(text).width <= maxWidth) return text
  let truncated = String(text)
  while (truncated.length > 2 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '...'
}

/**
 * Dibuja un rectángulo con esquinas redondeadas en el Canvas.
 */
function roundRect(ctx, x, y, width, height, radius, fill = true, stroke = false) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
  if (fill) ctx.fill()
  if (stroke) ctx.stroke()
}

/**
 * Genera un Blob PNG de alta definición (2x Retina) con el reporte de avance diario.
 */
export async function generateAvanceDiaPNG({
  fecha,
  formattedDate,
  rows = [],
  stats = {},
  getLocalidad = () => '',
  filterEstado = 'TODOS'
}) {
  const scale = 2
  const width = 1100
  const marginX = 40
  const printableWidth = width - marginX * 2 // 1020px

  const headerHeight = 110
  const kpiHeight = 74
  const tableHeaderHeight = 40
  const rowHeight = 44
  const tableBodyHeight = Math.max(rows.length * rowHeight, 90)
  const footerHeight = 45
  const paddingBottom = 25

  const height = headerHeight + kpiHeight + tableHeaderHeight + tableBodyHeight + footerHeight + paddingBottom

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')

  // Escala para renderizado Retina ultra nítido
  ctx.scale(scale, scale)

  // 1. Fondo principal y marco
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Borde sutil exterior
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

  // 2. Cabecera Institucional
  // Barra decorativa superior en Azul COVEPA
  ctx.fillStyle = '#003060'
  ctx.fillRect(0, 0, width, 5)

  // Identificador de proyecto
  ctx.fillStyle = '#0284c7'
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('COVEPA · PROYECTO REGIONAL AMAZONAS', marginX, 36)

  // Título del reporte
  ctx.fillStyle = '#003060'
  ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('Reporte de Avance Diario de Subsanación', marginX, 64)

  // Subtítulo con fecha
  ctx.fillStyle = '#475569'
  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const dateStr = formattedDate || fecha
  ctx.fillText(`Jornada técnica: ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}`, marginX, 88)

  // Badge derecho de conteo
  const countLabel = `${rows.length} ${rows.length === 1 ? 'OBSERVACIÓN' : 'OBSERVACIONES'}`
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const countWidth = ctx.measureText(countLabel).width + 24
  const countX = width - marginX - countWidth
  const countY = 38

  ctx.fillStyle = '#f0f9ff'
  ctx.strokeStyle = '#bae6fd'
  ctx.lineWidth = 1
  roundRect(ctx, countX, countY, countWidth, 30, 8, true, true)

  ctx.fillStyle = '#0369a1'
  ctx.fillText(countLabel, countX + 12, countY + 19)

  if (filterEstado !== 'TODOS') {
    ctx.fillStyle = '#64748b'
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    const filterText = `(Filtro: ${filterEstado})`
    const fw = ctx.measureText(filterText).width
    ctx.fillText(filterText, width - marginX - fw, countY + 48)
  }

  // Línea divisoria
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(marginX, headerHeight)
  ctx.lineTo(width - marginX, headerHeight)
  ctx.stroke()

  // 3. Tarjetas Resumen de KPIs (Métricas Superiores)
  const kpis = [
    { label: 'TOTAL', val: stats.total || rows.length, color: '#003060', bg: '#f1f5f9', border: '#cbd5e1' },
    { label: '✓ POR SUBIR', val: stats.validadas || 0, color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' },
    { label: '🔍 EN REVISIÓN', val: stats.enRevision || 0, color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
    { label: '✉ ENVIADAS', val: stats.enviadas || 0, color: '#4338ca', bg: '#e0e7ff', border: '#c7d2fe' },
    { label: '🚫 DESCARTADAS', val: stats.descartadas || 0, color: '#475569', bg: '#f8fafc', border: '#e2e8f0' }
  ]

  if ((stats.rechazadas || 0) > 0) {
    kpis.push({ label: '✕ RECHAZADAS', val: stats.rechazadas, color: '#b91c1c', bg: '#fee2e2', border: '#fecaca' })
  }

  const kpiGap = 10
  const kpiCount = kpis.length
  const kpiWidth = (printableWidth - (kpiCount - 1) * kpiGap) / kpiCount
  const kpiY = headerHeight + 14
  const kpiBoxHeight = 46

  kpis.forEach((kpi, i) => {
    const kx = marginX + i * (kpiWidth + kpiGap)
    ctx.fillStyle = kpi.bg
    ctx.strokeStyle = kpi.border
    ctx.lineWidth = 1
    roundRect(ctx, kx, kpiY, kpiWidth, kpiBoxHeight, 8, true, true)

    // Número
    ctx.fillStyle = kpi.color
    ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    const numText = String(kpi.val)
    ctx.fillText(numText, kx + 10, kpiY + 28)

    // Etiqueta
    ctx.font = '700 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.fillText(kpi.label, kx + 10, kpiY + 41)
  })

  // 4. Encabezados de la Tabla
  // Columnas: CÓD. OBS, TÉCNICO / CUADRILLA, CÓDIGO DE SITIO · LOCALIDAD, ESTADO, REVISADO POR
  const colDef = [
    { label: 'CÓD. OBS', x: marginX + 12, w: 140 },
    { label: 'TÉCNICO / CUADRILLA', x: marginX + 155, w: 245 },
    { label: 'CÓDIGO DE SITIO · LOCALIDAD', x: marginX + 405, w: 320 },
    { label: 'ESTADO', x: marginX + 730, w: 135 },
    { label: 'REVISADO POR', x: marginX + 870, w: 145 }
  ]

  const thY = headerHeight + kpiHeight + 10
  ctx.fillStyle = '#003060'
  roundRect(ctx, marginX, thY, printableWidth, tableHeaderHeight, 6, true, false)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  colDef.forEach(col => {
    ctx.fillText(col.label, col.x, thY + 25)
  })

  // 5. Filas de la Tabla
  const tbodyStartY = thY + tableHeaderHeight

  if (rows.length === 0) {
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(marginX, tbodyStartY, printableWidth, 80)
    ctx.fillStyle = '#64748b'
    ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No hay observaciones registradas en este estado para la fecha seleccionada.', width / 2, tbodyStartY + 45)
    ctx.textAlign = 'left'
  } else {
    rows.forEach((r, idx) => {
      const ry = tbodyStartY + idx * rowHeight
      const isEven = idx % 2 === 0

      // Fondo de fila alternado
      ctx.fillStyle = isEven ? '#ffffff' : '#f8fafc'
      ctx.fillRect(marginX, ry, printableWidth, rowHeight)

      // Borde inferior
      ctx.strokeStyle = '#f1f5f9'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(marginX, ry + rowHeight)
      ctx.lineTo(marginX + printableWidth, ry + rowHeight)
      ctx.stroke()

      // Col 1: Cód. Obs
      ctx.fillStyle = '#003060'
      ctx.font = '700 11.5px "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
      ctx.fillText(fitText(ctx, r.id_obs || '—', 130), colDef[0].x, ry + 27)

      // Col 2: Técnico y Cuadrilla
      ctx.fillStyle = '#1e293b'
      ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(fitText(ctx, r.tecnico || 'No asignado', 230), colDef[1].x, ry + 20)

      if (r.cuadrilla) {
        ctx.fillStyle = '#64748b'
        ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText(fitText(ctx, r.cuadrilla, 230), colDef[1].x, ry + 34)
      }

      // Col 3: Código de Sitio · Localidad (Regla inmutable)
      const loc = getLocalidad(r.id_sitio)
      const siteDisplay = `${r.id_sitio || '—'}${loc ? ` · ${loc}` : ''}`
      ctx.fillStyle = '#003060'
      ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(fitText(ctx, siteDisplay, 305), colDef[2].x, ry + 27)

      // Col 4: Estado (Insignia Semántica)
      const estadoConfig = getEstadoBadgeConfig(r.estado)
      const badgeW = 108
      const badgeH = 24
      const badgeX = colDef[3].x
      const badgeY = ry + (rowHeight - badgeH) / 2

      ctx.fillStyle = estadoConfig.bg
      ctx.strokeStyle = estadoConfig.border
      ctx.lineWidth = 1
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 12, true, true)

      ctx.fillStyle = estadoConfig.color
      ctx.font = '700 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(estadoConfig.label, badgeX + badgeW / 2, badgeY + 16)
      ctx.textAlign = 'left'

      // Col 5: Revisado Por
      ctx.fillStyle = '#334155'
      ctx.font = '500 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      const revisorDisplay = r.revisor || (r.estado?.toLowerCase().includes('revision') ? 'En proceso' : '—')
      ctx.fillText(fitText(ctx, revisorDisplay, 140), colDef[4].x, ry + 27)
    })
  }

  // 6. Pie de Página Institucional
  const footY = tbodyStartY + tableBodyHeight + 22
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(marginX, footY)
  ctx.lineTo(width - marginX, footY)
  ctx.stroke()

  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const timeStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  ctx.fillText(`Sistema ERP Amazonas-COVEPA · Generado el ${new Date().toLocaleDateString('es-ES')} a las ${timeStr}`, marginX, footY + 18)

  ctx.textAlign = 'right'
  ctx.fillText('Reporte Oficial de Subsanación ZONA 2 y 7', width - marginX, footY + 18)
  ctx.textAlign = 'left'

  // Convertir canvas a Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve({
          blob,
          filename: `Avance_COVEPA_${fecha}.png`
        })
      } else {
        reject(new Error('No se pudo generar el archivo Blob PNG'))
      }
    }, 'image/png')
  })
}

/**
 * Retorna colores y texto para la insignia de estado según los valores de COVEPA.
 */
function getEstadoBadgeConfig(st) {
  switch (st) {
    case 'Validado':
      return { label: '✓ Por Subir', color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' }
    case 'Enviado':
      return { label: '✉ Enviada', color: '#4338ca', bg: '#e0e7ff', border: '#c7d2fe' }
    case 'En Revision':
    case 'En Revisión':
      return { label: '🔍 En Revisión', color: '#b45309', bg: '#fef3c7', border: '#fde68a' }
    case 'Descartado':
      return { label: '🚫 Descartada', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' }
    case 'Rechazado':
      return { label: '✕ Rechazada', color: '#b91c1c', bg: '#fee2e2', border: '#fecaca' }
    default:
      return { label: `● ${st || 'Pendiente'}`, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' }
  }
}

/**
 * Descarga directamente la imagen generada en el navegador del usuario.
 */
export async function downloadAvanceDiaPNG(options) {
  const { blob, filename } = await generateAvanceDiaPNG(options)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return { success: true, method: 'download', filename }
}

/**
 * Intenta copiar la imagen PNG al portapapeles del sistema (WhatsApp Web, Correo, etc.).
 * Si el navegador o la política de seguridad no lo permite, descarga la imagen como alternativa segura.
 */
export async function copyAvanceDiaPNG(options) {
  const { blob, filename } = await generateAvanceDiaPNG(options)

  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      return { success: true, method: 'clipboard', filename }
    } catch (err) {
      console.warn('Escritura de imagen al portapapeles no soportada o rechazada, ejecutando descarga:', err)
    }
  }

  // Fallback transparente a descarga directa
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return { success: true, method: 'download', filename }
}
