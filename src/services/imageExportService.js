/**
 * Servicio de Generación de Imagen (PNG) y Exportación al Portapapeles / Descarga
 * del Cuadro de Resumen por Cuadrillas para Amazonas-COVEPA.
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
 * Genera un Blob PNG de alta definición (2x Retina) con el Cuadro de Resumen por Cuadrillas.
 */
export async function generateAvanceDiaPNG({
  fecha,
  formattedDate,
  rows = [],
  stats = {},
  matrixData = null,
  statusColumns = null,
  presentationMode = false,
  filterEstado = 'TODOS'
}) {
  const scale = 2
  const width = 1000
  const marginX = 36
  const printableWidth = width - marginX * 2 // 928px

  // Resolver datos de la matriz de cuadrillas
  let mData = matrixData
  if (!mData || !mData.matrixRows || mData.matrixRows.length === 0) {
    const cuadrillasMap = {
      'CUADRILLA 1': { cuadrilla: 'CUADRILLA 1', tecnico: 'Jhonatan Flores', values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 }, total: 0 },
      'CUADRILLA 2': { cuadrilla: 'CUADRILLA 2', tecnico: 'Marco Chamba', values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 }, total: 0 },
      'CUADRILLA 3': { cuadrilla: 'CUADRILLA 3', tecnico: 'Daniel Javier', values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 }, total: 0 },
      'CUADRILLA 4': { cuadrilla: 'CUADRILLA 4', tecnico: 'Alfonso Curi', values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 }, total: 0 },
      'CUADRILLA 5': { cuadrilla: 'CUADRILLA 5', tecnico: 'William Avila', values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 }, total: 0 },
      'CUADRILLA 6': { cuadrilla: 'CUADRILLA 6', tecnico: 'Juan Castro', values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 }, total: 0 }
    }

    rows.forEach(r => {
      const cName = (r.cuadrilla || '').toUpperCase()
      const match = cName.match(/CUADRILLA\s*([1-6])/i)
      const targetCuadrilla = match ? `CUADRILLA ${match[1]}` : null
      const targetObj = targetCuadrilla ? cuadrillasMap[targetCuadrilla] : null
      if (targetObj) {
        if (r.tecnico && !r.tecnico.toLowerCase().includes('no asignado')) {
          targetObj.tecnico = r.tecnico
        }
        const st = (r.estado || '').toLowerCase()
        if (st.includes('solicitando')) targetObj.values.solicitando++
        else if (st.includes('en revision') || st.includes('en revisión')) targetObj.values.enRevision++
        else if (st.includes('rechazad')) targetObj.values.rechazados++
        else if (st.includes('validad') || st.includes('enviad')) targetObj.values.validados++
      }
    })

    const mRows = Object.values(cuadrillasMap).map(c => ({
      ...c,
      total: c.values.solicitando + c.values.enRevision + c.values.rechazados + c.values.validados
    }))

    const mTotals = {
      solicitando: mRows.reduce((a, b) => a + b.values.solicitando, 0),
      enRevision: mRows.reduce((a, b) => a + b.values.enRevision, 0),
      rechazados: mRows.reduce((a, b) => a + b.values.rechazados, 0),
      validados: mRows.reduce((a, b) => a + b.values.validados, 0)
    }

    mData = {
      matrixRows: mRows,
      matrixTotals: mTotals,
      matrixGrandTotal: mTotals.solicitando + mTotals.enRevision + mTotals.rechazados + mTotals.validados
    }
  }

  const matrixRows = mData.matrixRows || []
  const matrixTotals = mData.matrixTotals || { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 }
  const grandTotal = mData.matrixGrandTotal ?? (matrixTotals.solicitando + matrixTotals.enRevision + matrixTotals.rechazados + matrixTotals.validados)

  const headerHeight = 105
  const kpiHeight = 65
  const matrixHeaderHeight = 44
  const rowHeight = 42
  const tableRowsHeight = matrixRows.length * rowHeight
  const footerRowHeight = 46
  const footerHeight = 52
  const paddingBottom = 20

  const height = headerHeight + kpiHeight + matrixHeaderHeight + tableRowsHeight + footerRowHeight + footerHeight + paddingBottom

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
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('COVEPA · PROYECTO REGIONAL AMAZONAS', marginX, 35)

  // Título del cuadro
  const isEquipos = matrixRows.some(r => (r.cuadrilla || '').toUpperCase().startsWith('EQUIPO'))
  ctx.fillStyle = '#003060'
  ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText(isEquipos ? 'Resumen Operativo por Equipos' : 'Resumen Operativo por Cuadrilla', marginX, 64)

  // Subtítulo con fecha
  ctx.fillStyle = '#475569'
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const dateStr = formattedDate || fecha || ''
  const dateFormatted = dateStr ? (dateStr.charAt(0).toUpperCase() + dateStr.slice(1)) : ''
  ctx.fillText(`Distribución de estados para la jornada: ${dateFormatted}`, marginX, 86)

  // Badge derecho de conteo total
  const countLabel = `${grandTotal} Obs. Totales`
  ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const countWidth = ctx.measureText(countLabel).width + 24
  const countX = width - marginX - countWidth
  const countY = 40

  ctx.fillStyle = '#f0f9ff'
  ctx.strokeStyle = '#bae6fd'
  ctx.lineWidth = 1
  roundRect(ctx, countX, countY, countWidth, 32, 8, true, true)

  ctx.fillStyle = '#0369a1'
  ctx.fillText(countLabel, countX + 12, countY + 21)

  // Línea divisoria
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(marginX, headerHeight)
  ctx.lineTo(width - marginX, headerHeight)
  ctx.stroke()

  // 3. Tarjetas Resumen de KPIs (Métricas Superiores)
  const kpis = [
    { label: 'TOTAL DIARIO', val: grandTotal, color: '#003060', bg: '#f1f5f9', border: '#cbd5e1' },
    { label: 'SOLICITANDO REVISIÓN', val: matrixTotals.solicitando || 0, color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
    { label: 'EN REVISIÓN', val: matrixTotals.enRevision || 0, color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' },
    { label: 'RECHAZADOS', val: matrixTotals.rechazados || 0, color: '#b91c1c', bg: '#fee2e2', border: '#fecaca' },
    { label: 'VALIDADOS', val: matrixTotals.validados || 0, color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' }
  ]

  const kpiGap = 10
  const kpiCount = kpis.length
  const kpiWidth = (printableWidth - (kpiCount - 1) * kpiGap) / kpiCount
  const kpiY = headerHeight + 12
  const kpiBoxHeight = 44

  kpis.forEach((kpi, i) => {
    const kx = marginX + i * (kpiWidth + kpiGap)
    ctx.fillStyle = kpi.bg
    ctx.strokeStyle = kpi.border
    ctx.lineWidth = 1
    roundRect(ctx, kx, kpiY, kpiWidth, kpiBoxHeight, 8, true, true)

    // Número
    ctx.fillStyle = kpi.color
    ctx.font = '800 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    const numText = String(kpi.val)
    ctx.fillText(numText, kx + 10, kpiY + 25)

    // Etiqueta
    ctx.font = '700 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.fillText(kpi.label, kx + 10, kpiY + 38)
  })

  // 4. Definición de Columnas de la Matriz de Cuadrillas / Equipos
  const colDef = [
    { key: 'cuadrilla', label: isEquipos ? 'Equipo' : 'Cuadrilla', align: 'left', x: marginX, w: 155 },
    { key: 'tecnico', label: isEquipos ? 'Técnicos Responsables' : 'Técnico Asignado', align: 'left', x: marginX + 155, w: 195 },
    { key: 'solicitando', label: 'Solicitando Revisión', align: 'center', x: marginX + 350, w: 145 },
    { key: 'enRevision', label: 'En Revisión', align: 'center', x: marginX + 495, w: 125 },
    { key: 'rechazados', label: 'Rechazados', align: 'center', x: marginX + 620, w: 110 },
    { key: 'validados', label: 'Validados', align: 'center', x: marginX + 730, w: 110 },
    { key: 'total', label: 'Total', align: 'center', x: marginX + 840, w: 88 }
  ]

  const thY = headerHeight + kpiHeight + 10

  // Fondo del Encabezado de la Tabla
  ctx.fillStyle = '#003060'
  roundRect(ctx, marginX, thY, printableWidth, matrixHeaderHeight, 8, true, false)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

  colDef.forEach(col => {
    if (col.align === 'left') {
      ctx.textAlign = 'left'
      ctx.fillText(col.label, col.x + 14, thY + 27)
    } else {
      ctx.textAlign = 'center'
      ctx.fillText(col.label, col.x + col.w / 2, thY + 27)
    }
  })
  ctx.textAlign = 'left'

  // 5. Filas de la Tabla (Cuadrillas 1 a 6)
  const tbodyStartY = thY + matrixHeaderHeight

  matrixRows.forEach((r, idx) => {
    const ry = tbodyStartY + idx * rowHeight
    const isEven = idx % 2 === 0

    // Fondo alternado
    ctx.fillStyle = isEven ? '#ffffff' : '#f8fafc'
    ctx.fillRect(marginX, ry, printableWidth, rowHeight)

    // Borde inferior
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(marginX, ry + rowHeight)
    ctx.lineTo(marginX + printableWidth, ry + rowHeight)
    ctx.stroke()

    // Borde vertical sutil entre cuadrilla/técnico y métricas
    ctx.strokeStyle = '#f1f5f9'
    ctx.beginPath()
    ctx.moveTo(marginX + 350, ry)
    ctx.lineTo(marginX + 350, ry + rowHeight)
    ctx.stroke()

    // Col 0: Cuadrilla o Equipo
    ctx.fillStyle = '#003060'
    if (r.subtitulo) {
      ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(r.cuadrilla || `EQUIPO ${idx + 1}`, colDef[0].x + 14, ry + 19)
      ctx.fillStyle = '#64748b'
      ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(r.subtitulo, colDef[0].x + 14, ry + 32)
    } else {
      ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(r.cuadrilla || `CUADRILLA ${idx + 1}`, colDef[0].x + 14, ry + 26)
    }

    // Col 1: Técnico
    ctx.fillStyle = '#334155'
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    const techName = !presentationMode ? (r.tecnico || 'No asignado') : '—'
    ctx.fillText(fitText(ctx, techName, 180), colDef[1].x + 10, ry + 26)

    // Helper para dibujar celda numérica con píldora
    const renderCellPill = (val, col, pillConfig) => {
      const centerX = col.x + col.w / 2
      if (val <= 0) {
        ctx.fillStyle = '#94a3b8'
        ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('0', centerX, ry + 26)
        ctx.textAlign = 'left'
      } else {
        const pw = 48
        const ph = 24
        const px = centerX - pw / 2
        const py = ry + (rowHeight - ph) / 2
        ctx.fillStyle = pillConfig.bg
        ctx.strokeStyle = pillConfig.border
        ctx.lineWidth = 1
        roundRect(ctx, px, py, pw, ph, 12, true, true)

        ctx.fillStyle = pillConfig.color
        ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(String(val), centerX, py + 16.5)
        ctx.textAlign = 'left'
      }
    }

    // Col 2: Solicitando Revisión
    renderCellPill(r.values?.solicitando || 0, colDef[2], { bg: '#fef3c7', border: '#fde68a', color: '#b45309' })

    // Col 3: En Revisión
    renderCellPill(r.values?.enRevision || 0, colDef[3], { bg: '#e0f2fe', border: '#bae6fd', color: '#0369a1' })

    // Col 4: Rechazados
    renderCellPill(r.values?.rechazados || 0, colDef[4], { bg: '#fee2e2', border: '#fecaca', color: '#b91c1c' })

    // Col 5: Validados
    renderCellPill(r.values?.validados || 0, colDef[5], { bg: '#dcfce7', border: '#bbf7d0', color: '#15803d' })

    // Col 6: Total de Fila
    const rowTotal = r.total ?? ((r.values?.solicitando || 0) + (r.values?.enRevision || 0) + (r.values?.rechazados || 0) + (r.values?.validados || 0))
    ctx.textAlign = 'center'
    if (rowTotal > 0) {
      ctx.fillStyle = '#003060'
      ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(String(rowTotal), colDef[6].x + colDef[6].w / 2, ry + 26)
    } else {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText('0', colDef[6].x + colDef[6].w / 2, ry + 26)
    }
    ctx.textAlign = 'left'
  })

  // 6. Fila de TOTAL DIARIO (Pie de la Tabla)
  const tfootY = tbodyStartY + tableRowsHeight
  ctx.fillStyle = '#f1f5f9'
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1
  roundRect(ctx, marginX, tfootY, printableWidth, footerRowHeight, 8, true, true)

  // Label TOTAL DIARIO
  ctx.fillStyle = '#003060'
  ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('TOTAL DIARIO', marginX + 14, tfootY + 28)

  // Subtítulo en columna técnico
  ctx.fillStyle = '#64748b'
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('Consolidado 6 Cuadrillas', colDef[1].x + 10, tfootY + 28)

  // Función para totales en pie
  const renderFootTotal = (val, col, pillConfig) => {
    const centerX = col.x + col.w / 2
    if (val <= 0) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('0', centerX, tfootY + 28)
      ctx.textAlign = 'left'
    } else {
      const pw = 50
      const ph = 26
      const px = centerX - pw / 2
      const py = tfootY + (footerRowHeight - ph) / 2
      ctx.fillStyle = pillConfig.bg
      ctx.strokeStyle = pillConfig.border
      ctx.lineWidth = 1.2
      roundRect(ctx, px, py, pw, ph, 13, true, true)

      ctx.fillStyle = pillConfig.color
      ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(val), centerX, py + 18)
      ctx.textAlign = 'left'
    }
  }

  renderFootTotal(matrixTotals.solicitando || 0, colDef[2], { bg: '#fef3c7', border: '#fde68a', color: '#b45309' })
  renderFootTotal(matrixTotals.enRevision || 0, colDef[3], { bg: '#e0f2fe', border: '#bae6fd', color: '#0369a1' })
  renderFootTotal(matrixTotals.rechazados || 0, colDef[4], { bg: '#fee2e2', border: '#fecaca', color: '#b91c1c' })
  renderFootTotal(matrixTotals.validados || 0, colDef[5], { bg: '#dcfce7', border: '#bbf7d0', color: '#15803d' })

  // Gran Total en Foot
  const grandTotalCenterX = colDef[6].x + colDef[6].w / 2
  const gtw = 52
  const gth = 28
  const gtx = grandTotalCenterX - gtw / 2
  const gty = tfootY + (footerRowHeight - gth) / 2
  ctx.fillStyle = '#003060'
  roundRect(ctx, gtx, gty, gtw, gth, 14, true, false)

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(String(grandTotal), grandTotalCenterX, gty + 19)
  ctx.textAlign = 'left'

  // 7. Pie de Página Institucional
  const footY = tfootY + footerRowHeight + 24
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(marginX, footY)
  ctx.lineTo(width - marginX, footY)
  ctx.stroke()

  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const timeStr = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  ctx.fillText(`Sistema COVEPA · Generado el ${new Date().toLocaleDateString('es-PE')} a las ${timeStr}`, marginX, footY + 18)

  ctx.textAlign = 'right'
  ctx.fillText('Reporte Oficial de Subsanación · ZONA 2 y ZONA 7', width - marginX, footY + 18)
  ctx.textAlign = 'left'

  // Convertir canvas a Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve({
          blob,
          filename: `Resumen_Cuadrillas_${fecha || 'COVEPA'}.png`
        })
      } else {
        reject(new Error('No se pudo generar el archivo Blob PNG'))
      }
    }, 'image/png')
  })
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
