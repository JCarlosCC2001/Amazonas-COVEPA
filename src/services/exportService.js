// M3: ExcelJS se importa dinamicamente dentro de generateStyledExcel
import { supabase } from '../lib/supabase.js'
import { fetchSitios, getZonaBySiteId } from './sitiosService.js'
import { getPeruDateStr } from '../utils/helpers.js'
import { getProgramaciones } from './programacionService.js'

// Consulta completa de todas las columnas de la tabla 'observaciones'
const OBS_COLUMNS = '*'

async function fetchAllPages(queryFn, pageSize = 1000) {
  const results = []
  let from = 0
  let hasMore = true
  while (hasMore) {
    const { data, error } = await queryFn(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      results.push(...data)
      hasMore = data.length === pageSize
      from += pageSize
    }
  }
  return results
}

/**
 * Exporta a Excel (.xlsx) las observaciones de un grupo específico
 * con formato corporativo COVEPA (#003060)
 * e incluyendo la LOCALIDAD al lado del CÓDIGO DE SITIO.
 */
export async function exportObservacionesGrupoExcel(grupoCode, grupoTitle) {
  const sitios = await fetchSitios({ soloAsignados: true })
  const targetCode = (grupoCode || '').replace(/GRUPO/gi, 'CUADRILLA').toUpperCase()
  const sitiosGrupo = sitios.filter(s => {
    const c = (s.cuadrilla || s.grupo || '').replace(/GRUPO/gi, 'CUADRILLA').toUpperCase()
    return c === targetCode
  })

  if (sitiosGrupo.length === 0) {
    throw new Error(`No se encontraron sitios para ${grupoTitle || grupoCode}`)
  }

  const siteIds = sitiosGrupo.map(s => s.id_site)
  const siteMap = new Map(sitiosGrupo.map(s => [s.id_site, s]))

  // Paginación unificada mediante fetchAllPages
  const allObs = await fetchAllPages((from, to) =>
    supabase
      .from('observaciones')
      .select(OBS_COLUMNS)
      .in('id_sitio', siteIds)
      .order('id_sitio', { ascending: true })
      .order('id_obs', { ascending: true })
      .range(from, to)
  )

  if (allObs.length === 0) {
    throw new Error(`No se encontraron observaciones registradas para ${grupoTitle || grupoCode}`)
  }

  const labelCuadrilla = (grupoTitle || grupoCode).replace(/GRUPO/gi, 'Cuadrilla')
  return generateStyledExcel({
    observations: allObs,
    siteMap,
    sheetName: labelCuadrilla.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 28),
    fileName: `Observaciones_COVEPA_${labelCuadrilla.replace(/\s+/g, '_')}.xlsx`
  })
}

/**
 * Exporta a Excel (.xlsx) TODAS las observaciones del proyecto (156 sitios)
 * Incluye toda la información de la base de datos de la tabla 'observaciones'
 * y metadatos de sitios con formato corporativo:
 * - Cabecera #003060 con letra blanca en negrita
 * - Celdas de datos con cuadros semiresaltados sin color de fondo
 */
export async function exportTodasObservacionesExcel() {
  const sitios = await fetchSitios({ soloAsignados: true })
  const siteMap = new Map(sitios.map(s => [s.id_site, s]))

  // Paginación unificada para traer las 4,116 observaciones con todas sus columnas
  const allObs = await fetchAllPages((from, to) =>
    supabase
      .from('observaciones')
      .select(OBS_COLUMNS)
      .order('id_sitio', { ascending: true })
      .order('id_obs', { ascending: true })
      .range(from, to)
  )

  return generateStyledExcel({
    observations: allObs,
    siteMap,
    sheetName: 'Todas_Observaciones',
    fileName: `Observaciones_COVEPA_GENERAL_Todas_${new Date().toISOString().slice(0, 10)}.xlsx`
  })
}

async function generateStyledExcel({ observations, siteMap, sheetName, fileName }) {
  // Import dinámico: solo se descarga exceljs al exportar
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'COVEPA ERP - Amazonas'
  workbook.created = new Date()

  const safeSheetName = sheetName || 'Observaciones'
  const worksheet = workbook.addWorksheet(safeSheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2', showGridLines: true }]
  })

  // 1. Definición completa de columnas (incluyendo toda la metadata y campos de BD observaciones)
  // Regla 2.1: LOCALIDAD SIEMPRE al lado de CÓDIGO DE SITIO
  const columnsDef = [
    { name: '#', width: 7, align: 'center' },
    { name: 'CUADRILLA', width: 16, align: 'center' },
    { name: 'CÓDIGO DE SITIO', width: 18, align: 'center' },
    { name: 'LOCALIDAD', width: 26, align: 'left' },
    { name: 'NOMBRE NODO', width: 26, align: 'left' },
    { name: 'DISTRITO', width: 20, align: 'left' },
    { name: 'PROVINCIA', width: 18, align: 'left' },
    { name: 'ZONA', width: 12, align: 'center' },
    { name: 'CÓD. OBSERVACIÓN', width: 20, align: 'center' },
    { name: 'HITO', width: 12, align: 'center' },
    { name: 'PROTOCOLO', width: 22, align: 'left' },
    { name: 'SUBSISTEMA', width: 20, align: 'left' },
    { name: 'ITEM', width: 10, align: 'center' },
    { name: 'SUB ITEM', width: 12, align: 'center' },
    { name: 'DETALLE', width: 40, align: 'left', wrap: true },
    { name: 'COMENTARIO INICIAL', width: 40, align: 'left', wrap: true },
    { name: 'COMENTARIO COMPLEMENTARIO', width: 35, align: 'left', wrap: true },
    { name: 'COMENTARIO FINAL', width: 45, align: 'left', wrap: true },
    { name: 'ACUERDO DE SUBSANACIÓN', width: 40, align: 'left', wrap: true },
    { name: 'ESTADO GILAT', width: 18, align: 'center' },
    { name: 'ESTADO PRONATEL', width: 22, align: 'center' },
    { name: 'COMENTARIO PRONATEL', width: 45, align: 'left', wrap: true },
    { name: 'ESTADO COVEPA', width: 16, align: 'center' },
    { name: 'FECHA SUBSANACIÓN', width: 18, align: 'center' },
    { name: 'REVISOR / SUBSANADOR', width: 24, align: 'left' },
    { name: 'COMENTARIO COVEPA', width: 38, align: 'left', wrap: true },
    { name: 'JUSTIFICACIÓN DE DEMORA', width: 38, align: 'left', wrap: true },
    { name: 'FECHA REGISTRO DEMORA', width: 22, align: 'center' },
    { name: 'TIEMPO EJECUCIÓN REAL (HH:MM)', width: 22, align: 'center' },
    { name: 'TIEMPO CON DEMORAS (HH:MM)', width: 22, align: 'center' }
  ]

  // Configurar anchos de columna
  columnsDef.forEach((col, i) => {
    worksheet.getColumn(i + 1).width = col.width
  })

  // 2. Fila de Encabezados (Header)
  // Requisito de diseño: Fondo #003060 con letra blanca en negrita
  const headerRow = worksheet.addRow(columnsDef.map(col => col.name))
  headerRow.height = 28

  const headerBorder = {
    top: { style: 'thin', color: { argb: 'FF002040' } },
    left: { style: 'thin', color: { argb: 'FF002040' } },
    bottom: { style: 'medium', color: { argb: 'FF001C38' } },
    right: { style: 'thin', color: { argb: 'FF002040' } }
  }

  for (let c = 1; c <= columnsDef.length; c++) {
    const cell = headerRow.getCell(c)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF003060' }
    }
    cell.font = {
      name: 'Inter',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: false
    }
    cell.border = headerBorder
  }

  // 3. Estilos de Celdas de Datos
  // Requisito de diseño: Cuadros semiresaltados sin color de celda
  const dataCellBorder = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  }

  const dataCellFont = {
    name: 'Inter',
    size: 9.5,
    color: { argb: 'FF1E293B' }
  }

  // 4. Agregar filas con toda la información de observaciones y sitios
  observations.forEach((o, idx) => {
    const site = siteMap.get(o.id_sitio) || {}
    const rawSt = o.estado_covepa || (o.fecha_subsanacion ? 'Validado' : 'Pendiente')
    const fechaSub = o.fecha_subsanacion ? getPeruDateStr(o.fecha_subsanacion) : ''

    const rowValues = [
      idx + 1,
      (site.cuadrilla || site.grupo || 'Sin Cuadrilla').replace(/GRUPO/gi, 'CUADRILLA'),
      o.id_sitio || '',
      site.localidad || 'Sin localidad', // Regla 2.1: LOCALIDAD al lado de CÓDIGO DE SITIO
      site.nombre_nodo || '',
      site.distrito || '',
      site.provincia || '',
      site.zona || '',
      o.id_obs || '',
      o.hito || '',
      o.protocolo || '',
      o.subsistema || '',
      o.item != null ? String(o.item) : '',
      o.sub_item != null ? String(o.sub_item) : '',
      o.detalle || '',
      o.comentario_inicial || '',
      o.comentario_complementario || '',
      o.comentario_final || '',
      o.acuerdo_subsanacion || '',
      o.estado_gilat || '',
      o.estado_pronatel || '',
      o.comentario_pronatel || '',
      rawSt,
      fechaSub,
      o.revisor || '',
      o.comentario_covepa || '',
      o.justificacion_demora || '',
      o.fecha_registro_demora ? getPeruDateStr(o.fecha_registro_demora) : '',
      o.tiempo_ejecucion_real || '',
      o.tiempo_ejecucion_demora || ''
    ]

    const row = worksheet.addRow(rowValues)
    row.height = 22

    for (let c = 1; c <= columnsDef.length; c++) {
      const cell = row.getCell(c)
      const colDef = columnsDef[c - 1]
      cell.font = dataCellFont
      cell.border = dataCellBorder
      cell.alignment = {
        vertical: 'middle',
        horizontal: colDef ? colDef.align : 'left',
        wrapText: !!(colDef && colDef.wrap)
      }
      // Sin color de celda: no se asigna fill (permanece limpio/blanco)
    }
  })

  // 5. Filtros automáticos nativos de Excel en todo el rango
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: observations.length + 1, column: columnsDef.length }
  }

  // 6. Generar buffer y descargar archivo
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Construye las filas y columnas para el reporte de Programación Diaria y Rutas
 */
export async function buildProgramacionDiariaData({ fechaStr, conTecnico = true }) {
  const [sitios, progs] = await Promise.all([
    fetchSitios({ soloAsignados: true }),
    getProgramaciones(fechaStr, fechaStr)
  ])

  const sitiosMap = Object.fromEntries((sitios || []).map(s => [s.id_site, s]))
  const rows = []

  // Ordenar programaciones por cuadrilla
  const progsOrdenadas = [...(progs || [])].sort((a, b) => {
    const cA = a.personal?.cuadrilla || ''
    const cB = b.personal?.cuadrilla || ''
    return cA.localeCompare(cB, undefined, { numeric: true })
  })

  for (const prog of progsOrdenadas) {
    const team = prog.equipo && prog.equipo.length > 0 ? prog.equipo : [prog.personal || {}]
    const tec = team.find(m => {
      const c = (m.cargo || '').toUpperCase()
      return c.includes('TÉCN') || c.includes('TECN') || c.includes('SUPERVISOR')
    }) || prog.personal || team[0] || {}

    const nombreTecnico = tec.nombre_completo || 'Técnico sin asignar'
    const sitiosProg = prog.sitios && prog.sitios.length > 0 ? prog.sitios : []

    if (sitiosProg.length === 0) {
      const cuadrillaRaw = tec.cuadrilla || prog.personal?.cuadrilla || ''
      const matchCuad = cuadrillaRaw.match(/\d+/)
      const cuadrillaStr = matchCuad ? `Cuadrilla ${matchCuad[0]}` : (cuadrillaRaw || 'Sin Cuadrilla')
      const isZona2 = cuadrillaStr.includes('1') || cuadrillaStr.includes('2')
      const cm = isZona2 ? 'PEDRO RUIZ' : 'BAGUA GRANDE'
      const comentario = prog.notas || 'Sin sitios asignados'

      if (conTecnico) {
        rows.push([nombreTecnico, cuadrillaStr, cm, '-', '-', comentario])
      } else {
        rows.push([cuadrillaStr, cm, '-', '-', comentario])
      }
    } else {
      const sitiosOrdenados = [...sitiosProg].sort((a, b) => (a.orden || 0) - (b.orden || 0))

      for (const s of sitiosOrdenados) {
        const siteId = s.id_sitio
        const sData = sitiosMap[siteId] || {}

        const cuadrillaRaw = sData.cuadrilla || sData.grupo || tec.cuadrilla || prog.personal?.cuadrilla || ''
        const matchCuad = cuadrillaRaw.match(/\d+/)
        const cuadrillaStr = matchCuad ? `Cuadrilla ${matchCuad[0]}` : (cuadrillaRaw || 'Sin Cuadrilla')

        const zona = sData.zona || getZonaBySiteId(siteId)
        const isZona2 = String(zona).toUpperCase().includes('2') || cuadrillaStr.includes('1') || cuadrillaStr.includes('2')
        const cm = isZona2 ? 'PEDRO RUIZ' : 'BAGUA GRANDE'

        const lugar = sData.localidad || sData.nombre_nodo || ''

        let comentario = ''
        if (s.notas_visita && s.notas_visita.trim()) {
          comentario = s.notas_visita.trim()
        } else if (prog.notas && prog.notas.trim() && !prog.notas.startsWith('{')) {
          comentario = prog.notas.trim()
        } else {
          comentario = lugar
            ? `Levantamiento de Observaciones en ${siteId} - ${lugar}`
            : `Levantamiento de Observaciones en ${siteId}`
        }

        if (conTecnico) {
          rows.push([nombreTecnico, cuadrillaStr, cm, siteId, lugar, comentario])
        } else {
          rows.push([cuadrillaStr, cm, siteId, lugar, comentario])
        }
      }
    }
  }

  // Ordenar filas alfabética/numéricamente por Cuadrilla
  rows.sort((a, b) => {
    const cA = conTecnico ? a[1] : a[0]
    const cB = conTecnico ? b[1] : b[0]
    return cA.localeCompare(cB, undefined, { numeric: true })
  })

  const columns = conTecnico
    ? [
        { name: 'Tecnico', key: 'tecnico' },
        { name: 'Cuadrilla', key: 'cuadrilla' },
        { name: 'CM', key: 'cm' },
        { name: 'Sitio', key: 'sitio' },
        { name: 'Lugar', key: 'lugar' },
        { name: 'Comentario', key: 'comentario' }
      ]
    : [
        { name: 'Cuadrilla', key: 'cuadrilla' },
        { name: 'CM', key: 'cm' },
        { name: 'Sitio', key: 'sitio' },
        { name: 'Lugar', key: 'lugar' },
        { name: 'Comentario', key: 'comentario' }
      ]

  return {
    rows,
    columns,
    fecha: fechaStr,
    conTecnico,
    totalFilas: rows.length,
    progsCount: (progs || []).length
  }
}

/**
 * Exporta el reporte oficial de Programación Diaria y Rutas a Excel (.xlsx)
 */
export async function exportProgramacionDiariaExcel({ fechaStr, conTecnico = true }) {
  const data = await buildProgramacionDiariaData({ fechaStr, conTecnico })
  if (data.rows.length === 0) {
    throw new Error(`No hay programaciones registradas para la fecha ${fechaStr}.`)
  }

  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'COVEPA ERP - Amazonas'
  workbook.created = new Date()

  const cleanDate = fechaStr.replace(/[^a-zA-Z0-9]/g, '_')
  const sheetName = `Prog_${cleanDate}`.slice(0, 31)
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  })

  const cleanTableName = `RepProg_${cleanDate}_${conTecnico ? 'ConTec' : 'SinTec'}`.slice(0, 31)

  worksheet.addTable({
    name: cleanTableName,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium9',
      showRowStripes: true,
      showColumnStripes: false
    },
    columns: data.columns.map(c => ({ name: c.name, filterButton: true })),
    rows: data.rows
  })

  const colWidths = conTecnico
    ? [24, 16, 18, 18, 26, 68]
    : [16, 18, 18, 26, 68]

  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w
  })

  worksheet.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 26 : 22
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 }
      cell.alignment = {
        vertical: 'middle',
        horizontal: conTecnico
          ? (colNumber === 4 ? 'center' : (colNumber === 2 || colNumber === 3 ? 'center' : 'left'))
          : (colNumber === 3 ? 'center' : (colNumber === 1 || colNumber === 2 ? 'center' : 'left')),
        wrapText: colNumber === (conTecnico ? 6 : 5)
      }
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const suffix = conTecnico ? 'Con_Tecnicos' : 'Sin_Tecnicos'
  a.download = `Programacion_COVEPA_${fechaStr}_${suffix}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
