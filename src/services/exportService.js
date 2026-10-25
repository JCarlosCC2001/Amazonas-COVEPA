import ExcelJS from 'exceljs'
import { supabase } from '../lib/supabase'
import { fetchSitios } from './sitiosService'

/**
 * Exporta a Excel (.xlsx) las observaciones de un grupo específico
 * con formato de Tabla oficial de Excel (TableStyleMedium9)
 * e incluyendo la LOCALIDAD al lado del CÓDIGO DE SITIO.
 */
export async function exportObservacionesGrupoExcel(grupoCode, grupoTitle) {
  // 1. Obtener sitios asignados para el grupo
  const sitios = await fetchSitios({ soloAsignados: true })
  const sitiosGrupo = sitios.filter(
    s => (s.grupo || '').toUpperCase() === (grupoCode || '').toUpperCase()
  )

  if (sitiosGrupo.length === 0) {
    throw new Error(`No se encontraron sitios para ${grupoTitle || grupoCode}`)
  }

  const siteIds = sitiosGrupo.map(s => s.id_site)
  const siteMap = new Map(sitiosGrupo.map(s => [s.id_site, s]))

  // 2. Traer observaciones en lotes de 1000 de Supabase
  let allObs = []
  const PAGE_SIZE = 1000
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('observaciones')
      .select('id_obs, id_sitio, protocolo, subsistema, detalle, item, sub_item, comentario_inicial, comentario_complementario, comentario_final, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, comentario_covepa')
      .in('id_sitio', siteIds)
      .order('id_sitio', { ascending: true })
      .order('id_obs', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`Error al consultar observaciones: ${error.message}`)

    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allObs.push(...data)
      if (data.length < PAGE_SIZE) {
        hasMore = false
      } else {
        from += PAGE_SIZE
      }
    }
  }

  if (allObs.length === 0) {
    throw new Error(`No se encontraron observaciones registradas para ${grupoTitle || grupoCode}`)
  }

  return generateStyledExcel({
    observations: allObs,
    siteMap,
    sheetName: (grupoTitle || grupoCode).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 28),
    fileName: `Observaciones_COVEPA_${(grupoTitle || grupoCode).replace(/\s+/g, '_')}.xlsx`
  })
}

/**
 * Exporta a Excel (.xlsx) TODAS las observaciones del proyecto (156 sitios)
 */
export async function exportTodasObservacionesExcel() {
  const sitios = await fetchSitios({ soloAsignados: true })
  const siteMap = new Map(sitios.map(s => [s.id_site, s]))

  let allObs = []
  const PAGE_SIZE = 1000
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('observaciones')
      .select('id_obs, id_sitio, protocolo, subsistema, detalle, item, sub_item, comentario_inicial, comentario_complementario, comentario_final, acuerdo_subsanacion, estado_covepa, fecha_subsanacion, revisor, comentario_covepa')
      .order('id_sitio', { ascending: true })
      .order('id_obs', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`Error al consultar observaciones: ${error.message}`)

    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allObs.push(...data)
      if (data.length < PAGE_SIZE) {
        hasMore = false
      } else {
        from += PAGE_SIZE
      }
    }
  }

  return generateStyledExcel({
    observations: allObs,
    siteMap,
    sheetName: 'Todas_Observaciones',
    fileName: `Observaciones_COVEPA_GENERAL_Todas_${new Date().toISOString().slice(0, 10)}.xlsx`
  })
}

async function generateStyledExcel({ observations, siteMap, sheetName, fileName }) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'COVEPA ERP - Amazonas'
  workbook.created = new Date()

  const safeSheetName = sheetName || 'Observaciones'
  const worksheet = workbook.addWorksheet(safeSheetName, {
    views: [{ showGridLines: true }]
  })

  // Preparar filas
  const tableRows = observations.map((o, idx) => {
    const site = siteMap.get(o.id_sitio) || {}
    const rawSt = o.estado_covepa || (o.fecha_subsanacion ? 'Validado' : 'Pendiente')
    const fechaSub = o.fecha_subsanacion ? String(o.fecha_subsanacion).slice(0, 10) : ''

    return [
      idx + 1,
      site.grupo || 'Sin Grupo',
      o.id_sitio || '',
      site.localidad || 'Sin localidad',
      site.nombre_nodo || '',
      site.distrito || '',
      site.provincia || '',
      site.zona || '',
      o.id_obs || '',
      o.subsistema || '',
      o.protocolo || '',
      o.detalle || '',
      o.comentario_inicial || '',
      o.acuerdo_subsanacion || '',
      rawSt,
      fechaSub,
      o.revisor || '',
      o.comentario_covepa || ''
    ]
  })

  const safeTableName = `Tabla_${safeSheetName.replace(/[^a-zA-Z0-9_]/g, '_')}`

  // Añadir tabla nativa de Excel con estilo azul
  worksheet.addTable({
    name: safeTableName,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium9',
      showRowStripes: true,
      showColumnStripes: false
    },
    columns: [
      { name: '#', filterButton: true },
      { name: 'GRUPO', filterButton: true },
      { name: 'CÓDIGO DE SITIO', filterButton: true },
      { name: 'LOCALIDAD', filterButton: true },
      { name: 'NOMBRE NODO', filterButton: true },
      { name: 'DISTRITO', filterButton: true },
      { name: 'PROVINCIA', filterButton: true },
      { name: 'ZONA', filterButton: true },
      { name: 'CÓD. OBSERVACIÓN', filterButton: true },
      { name: 'SUBSISTEMA', filterButton: true },
      { name: 'PROTOCOLO', filterButton: true },
      { name: 'DETALLE', filterButton: true },
      { name: 'COMENTARIO INICIAL', filterButton: true },
      { name: 'ACUERDO DE SUBSANACIÓN', filterButton: true },
      { name: 'ESTADO COVEPA', filterButton: true },
      { name: 'FECHA SUBSANACIÓN', filterButton: true },
      { name: 'REVISOR', filterButton: true },
      { name: 'COMENTARIOS ADICIONALES', filterButton: true }
    ],
    rows: tableRows
  })

  // Anchos de columna óptimos
  const colWidths = [6, 13, 18, 24, 24, 18, 18, 12, 22, 20, 22, 45, 38, 38, 16, 18, 20, 30]
  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w
  })

  // Alturas y alineación
  worksheet.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 26 : 22
    row.eachCell((cell, colNumber) => {
      if (colNumber === 12 || colNumber === 13 || colNumber === 14 || colNumber === 18) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
      } else if (
        colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 8 ||
        colNumber === 9 || colNumber === 15 || colNumber === 16
      ) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      }
    })
  })

  // Descargar buffer
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
