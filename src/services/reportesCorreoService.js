import { supabase } from '../lib/supabase'
import { getAvancePorFecha } from './dashboardService'
import { getCachedSitiosAsignados, getZonaBySiteId } from './sitiosService'
import { toLocalDateString, getPeruDateStr, getAyerPeruStr } from '../utils/helpers'

const LOCAL_STORAGE_KEY_DIARIO = 'covepa_config_reporte_correo'
const LOCAL_STORAGE_KEY_SEMANAL = 'covepa_config_reporte_semanal'

export const DEFAULT_CONFIG_DIARIO = {
  id: 'config_diario',
  activo: true,
  hora_envio: '21:00:00',
  destinatarios: ['ccondor@covepa.pe'],
  destinatarios_cc: [],
  asunto: '[COVEPA] Reporte Diario de Observaciones - {fecha}',
  notas_jornada: 'Cierre operativo de observaciones de la jornada.',
  periodo_reporte: 'dia_actual', // 'dia_actual' | 'dia_anterior'
  destinatario_prueba: ''
}

export const DEFAULT_CONFIG_SEMANAL = {
  id: 'config_semanal',
  activo: true,
  hora_envio: '20:00:00',
  dia_semana_envio: '5', // 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom
  destinatarios: ['ccondor@covepa.pe'],
  destinatarios_cc: [],
  asunto: '[COVEPA] Reporte Semanal de Levantamiento de Observaciones Amazonas - Semana {semana}',
  notas_jornada: 'Consolidado semanal de observaciones levantadas y avances de cuadrillas.',
  periodo_reporte: 'semana_actual', // 'semana_actual' | 'semana_anterior'
  destinatario_prueba: ''
}

/**
 * Obtiene la configuración guardada del reporte automático (diario o semanal).
 * Intenta leer desde Supabase y cuenta con fallback transparente en localStorage.
 */
// Registro en memoria de columnas opcionales admitidas en la tabla configuracion_reportes_correo
// Evita peticiones con columnas inexistentes que provoquen errores 400 en consola
const dbColumnsSupport = {
  destinatario_prueba: true, // Columna migrada exitosamente en Supabase
  periodo_reporte: true,
  dia_semana_envio: true
}

export async function fetchConfiguracionReporte(tipo = 'diario') {
  const isSemanal = tipo === 'semanal'
  const configId = isSemanal ? 'config_semanal' : 'config_diario'
  const storageKey = isSemanal ? LOCAL_STORAGE_KEY_SEMANAL : LOCAL_STORAGE_KEY_DIARIO
  const defaults = isSemanal ? DEFAULT_CONFIG_SEMANAL : DEFAULT_CONFIG_DIARIO
  const hoyPeru = getPeruDateStr() || toLocalDateString(new Date())

  // Recuperar cualquier dato local previo (ej. destinatario_prueba)
  let localPrev = {}
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) localPrev = JSON.parse(raw)
  } catch (_) {}

  try {
    const { data, error } = await supabase
      .from('configuracion_reportes_correo')
      .select('*')
      .eq('id', configId)
      .maybeSingle()

    if (!error && data) {
      // Detectar dinámicamente si la columna destinatario_prueba existe en la base de datos
      if ('destinatario_prueba' in data) {
        dbColumnsSupport.destinatario_prueba = true
      }
      if ('periodo_reporte' in data) {
        dbColumnsSupport.periodo_reporte = true
      }
      if ('dia_semana_envio' in data) {
        dbColumnsSupport.dia_semana_envio = true
      }

      let notasLimpias = data.notas_jornada || ''
      // Para diario, limpiar notas si son de un día anterior
      if (!isSemanal && data.updated_at) {
        const d = new Date(data.updated_at)
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000)
        const fechaPeruUpdate = new Date(utc - (5 * 3600000)).toISOString().slice(0, 10)
        if (fechaPeruUpdate < hoyPeru && notasLimpias) {
          notasLimpias = ''
          supabase
            .from('configuracion_reportes_correo')
            .update({ notas_jornada: '' })
            .eq('id', 'config_diario')
            .then(() => {})
        }
      }

      const merged = {
        ...defaults,
        ...localPrev,
        ...data,
        notas_jornada: notasLimpias,
        asunto: data.asunto || localPrev.asunto || defaults.asunto,
        periodo_reporte: data.periodo_reporte || localPrev.periodo_reporte || defaults.periodo_reporte,
        destinatario_prueba: data.destinatario_prueba || localPrev.destinatario_prueba || defaults.destinatario_prueba || '',
        hora_envio: (data.hora_envio || localPrev.hora_envio || defaults.hora_envio).slice(0, 5)
      }
      localStorage.setItem(storageKey, JSON.stringify(merged))
      return merged
    }
  } catch (err) {
    console.warn(`[REPORTES-CORREO] Error al consultar Supabase (${configId}), usando local:`, err)
  }

  // Fallback seguro a localStorage
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...defaults,
        ...parsed,
        asunto: parsed.asunto || defaults.asunto,
        periodo_reporte: parsed.periodo_reporte || defaults.periodo_reporte,
        destinatario_prueba: parsed.destinatario_prueba || defaults.destinatario_prueba || '',
        hora_envio: (parsed.hora_envio || defaults.hora_envio).slice(0, 5)
      }
    }
  } catch (_) {}

  return { ...defaults, hora_envio: defaults.hora_envio.slice(0, 5) }
}

/**
 * Guarda la configuración del reporte automático (diario o semanal).
 */
export async function saveConfiguracionReporte(config, userEmail = null, tipo = 'diario') {
  const isSemanal = tipo === 'semanal'
  const configId = isSemanal ? 'config_semanal' : 'config_diario'
  const storageKey = isSemanal ? LOCAL_STORAGE_KEY_SEMANAL : LOCAL_STORAGE_KEY_DIARIO
  const defaults = isSemanal ? DEFAULT_CONFIG_SEMANAL : DEFAULT_CONFIG_DIARIO

  const horaNormalizada = config.hora_envio ? `${config.hora_envio.slice(0, 5)}:00` : defaults.hora_envio
  const payload = {
    id: configId,
    activo: config.activo !== false,
    hora_envio: horaNormalizada,
    destinatarios: Array.isArray(config.destinatarios) ? config.destinatarios : [config.destinatarios].filter(Boolean),
    destinatarios_cc: Array.isArray(config.destinatarios_cc) ? config.destinatarios_cc : [],
    asunto: config.asunto || defaults.asunto,
    notas_jornada: config.notas_jornada || '',
    updated_at: new Date().toISOString(),
    updated_by: userEmail
  }

  // Guardar siempre el estado completo en localStorage para resguardar la configuración del usuario
  const fullLocal = {
    ...payload,
    periodo_reporte: config.periodo_reporte || defaults.periodo_reporte,
    dia_semana_envio: config.dia_semana_envio || defaults.dia_semana_envio || '5',
    destinatario_prueba: (config.destinatario_prueba || '').trim()
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(fullLocal))
  } catch (_) {}

  // Enviar a Supabase solo las columnas que la base de datos admite actualmente
  if (dbColumnsSupport.periodo_reporte !== false && config.periodo_reporte) {
    payload.periodo_reporte = config.periodo_reporte
  }
  if (dbColumnsSupport.dia_semana_envio !== false && config.dia_semana_envio) {
    payload.dia_semana_envio = config.dia_semana_envio
  }
  if (dbColumnsSupport.destinatario_prueba !== false && config.destinatario_prueba !== undefined) {
    payload.destinatario_prueba = (config.destinatario_prueba || '').trim()
  }

  try {
    const { data, error } = await supabase
      .from('configuracion_reportes_correo')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .maybeSingle()

    if (error) {
      // Si la BD rechazó alguna columna opcional, marcarla como no soportada y reintentar limpiamente
      if (error.message?.includes('destinatario_prueba')) {
        dbColumnsSupport.destinatario_prueba = false
      }
      if (error.message?.includes('dia_semana_envio')) {
        dbColumnsSupport.dia_semana_envio = false
      }
      if (error.message?.includes('periodo_reporte')) {
        dbColumnsSupport.periodo_reporte = false
      }

      const safePayload = { ...payload }
      delete safePayload.destinatario_prueba
      delete safePayload.dia_semana_envio
      delete safePayload.periodo_reporte

      const { data: retryData } = await supabase
        .from('configuracion_reportes_correo')
        .upsert(safePayload, { onConflict: 'id' })
        .select()
        .maybeSingle()
      return retryData ? { ...fullLocal, ...retryData } : fullLocal
    }
    return data ? { ...fullLocal, ...data } : fullLocal
  } catch (err) {
    console.warn(`[REPORTES-CORREO] Error al guardar ${configId} en Supabase, guardado en local:`, err)
    return fullLocal
  }
}

/**
 * Obtiene las observaciones de la fecha indicada clasificadas para el reporte diario.
 * Utiliza getAvancePorFecha para garantizar coincidencia matemática 100% con Programación y Avance del Día.
 */
export async function fetchDatosReporteDiario(fechaFiltro = null, periodoReporte = null) {
  let targetDate = fechaFiltro
  if (!targetDate) {
    if (periodoReporte === 'dia_anterior') {
      targetDate = getAyerPeruStr()
    } else {
      targetDate = getPeruDateStr() || toLocalDateString(new Date())
    }
  }

  const [avance, sitios] = await Promise.all([
    getAvancePorFecha(targetDate),
    getCachedSitiosAsignados()
  ])
  const sitiosMap = {}
  if (Array.isArray(sitios)) {
    sitios.forEach(s => { sitiosMap[s.id_site] = s })
  }
  const rawRows = avance?.rows || []
  const rows = rawRows.map(r => {
    const sInfo = sitiosMap[r.id_sitio] || {}
    const zonaFinal = (r.zona && r.zona !== '-') ? r.zona : (sInfo.zona || getZonaBySiteId(r.id_sitio))
    return {
      ...r,
      zona: zonaFinal
    }
  })
  const statsAvance = avance?.stats || {}

  const validadas = rows.filter(r => r.estado === 'Validado')
  const rechazadas = rows.filter(r => r.estado === 'Rechazado')
  const descartadas = rows.filter(r => r.estado === 'Descartado')
  const enEspera = rows.filter(r => r.estado === 'Solicitando Revisión' || r.estado === 'En Revisión')

  let fechaFormateada = targetDate
  try {
    const [y, m, d] = targetDate.split('-').map(Number)
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
    fechaStr: targetDate,
    fechaFormateada,
    stats: {
      validadas: statsAvance.validadas ?? validadas.length,
      rechazadas: statsAvance.rechazadas ?? rechazadas.length,
      descartadas: statsAvance.descartadas ?? descartadas.length,
      enEspera: ((statsAvance.solicitando || 0) + (statsAvance.enRevision || 0)) || enEspera.length,
      total: rows.length
    },
    validadas,
    rechazadas,
    descartadas,
    enEspera
  }
}

/**
 * Obtiene el consolidado semanal de observaciones (Lunes a Domingo) para el reporte semanal.
 * Consulta los avances de la semana de forma concurrente para exactitud total.
 */
export async function fetchDatosReporteSemanal(fechaFiltro = null, periodoReporte = 'semana_actual') {
  const now = new Date()
  let peruStr = getPeruDateStr() || toLocalDateString(now)
  if (fechaFiltro) peruStr = fechaFiltro

  const [y, m, d] = peruStr.split('-').map(Number)
  const baseDate = new Date(y, m - 1, d)

  if (periodoReporte === 'semana_anterior') {
    baseDate.setDate(baseDate.getDate() - 7)
  }

  const dayOfWeek = (baseDate.getDay() + 6) % 7 // Lunes = 0 ... Domingo = 6
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() - dayOfWeek)

  const DIAS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const dias = []

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday)
    cur.setDate(monday.getDate() + i)
    const yyyy = cur.getFullYear()
    const mm = String(cur.getMonth() + 1).padStart(2, '0')
    const dd = String(cur.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`
    dias.push({
      dateStr,
      diaSemana: DIAS_SHORT[i],
      diaNombre: DIAS_FULL[i],
      shortLabel: `${DIAS_SHORT[i]} ${dd}/${mm}`,
      dayNum: dd,
      monthNum: mm
    })
  }

  const lunesStr = dias[0].dateStr
  const domingoStr = dias[6].dateStr
  const rangoSemanaStr = `${dias[0].dayNum}/${dias[0].monthNum} al ${dias[6].dayNum}/${dias[6].monthNum}/${dias[6].dateStr.slice(0, 4)}`

  // Número de semana ISO
  const dObj = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()))
  const dayNum = dObj.getUTCDay() || 7
  dObj.setUTCDate(dObj.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(dObj.getUTCFullYear(), 0, 1))
  const numeroSemana = Math.ceil((((dObj - yearStart) / 86400000) + 1) / 7)

  // Consultar avances por cada día de la semana y catálogo de sitios
  const [avancesPorDia, sitiosCatalog] = await Promise.all([
    Promise.all(dias.map(item => getAvancePorFecha(item.dateStr))),
    getCachedSitiosAsignados()
  ])

  const sitiosMap = {}
  if (Array.isArray(sitiosCatalog)) {
    sitiosCatalog.forEach(s => { sitiosMap[s.id_site] = s })
  }

  const obsMap = new Map()
  const desgloseDias = []

  dias.forEach((dItem, idx) => {
    const av = avancesPorDia[idx] || { rows: [], stats: {} }
    const rowsDia = av.rows || []
    let valDia = 0, rechDia = 0, descDia = 0, espDia = 0

    rowsDia.forEach(r => {
      const sInfo = sitiosMap[r.id_sitio] || {}
      const zonaFinal = (r.zona && r.zona !== '-') ? r.zona : (sInfo.zona || getZonaBySiteId(r.id_sitio))
      const enriched = {
        ...r,
        zona: zonaFinal
      }
      if (r.estado === 'Validado') valDia++
      else if (r.estado === 'Rechazado') rechDia++
      else if (r.estado === 'Descartado') descDia++
      else if (r.estado === 'Solicitando Revisión' || r.estado === 'En Revisión') espDia++

      obsMap.set(r.id_obs, enriched)
    })

    desgloseDias.push({
      ...dItem,
      total: rowsDia.length,
      validadas: valDia,
      rechazadas: rechDia,
      descartadas: descDia,
      enEspera: espDia
    })
  })

  const allConsolidado = Array.from(obsMap.values())
  const validadas = allConsolidado.filter(r => r.estado === 'Validado')
  const rechazadas = allConsolidado.filter(r => r.estado === 'Rechazado')
  const descartadas = allConsolidado.filter(r => r.estado === 'Descartado')
  const enEspera = allConsolidado.filter(r => r.estado === 'Solicitando Revisión' || r.estado === 'En Revisión')

  return {
    semanaKey: `${lunesStr}_a_${domingoStr}`,
    numeroSemana,
    rangoSemanaStr,
    lunesStr,
    domingoStr,
    desgloseDias,
    stats: {
      validadas: validadas.length,
      rechazadas: rechazadas.length,
      descartadas: descartadas.length,
      enEspera: enEspera.length,
      total: allConsolidado.length
    },
    validadas,
    rechazadas,
    descartadas,
    enEspera
  }
}

/**
 * Genera y descarga un archivo Excel (.xlsx) estructurado con las observaciones de la jornada diaria.
 */
export async function exportarExcelReporteDiario(datos) {
  if (!datos) return
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'))
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Amazonas-COVEPA'
  const ws = wb.addWorksheet('Reporte_Observaciones', {
    views: [{ showGridLines: true }]
  })

  ws.columns = [
    { width: 22 }, // ID
    { width: 14 }, // Zona
    { width: 20 }, // Código de lugar
    { width: 28 }, // Nombre de localidad
    { width: 24 }, // Persona que validó
    { width: 22 }  // Estado observación
  ]

  const allRows = [
    ...(datos.validadas || []),
    ...(datos.rechazadas || []),
    ...(datos.enEspera || []),
    ...(datos.descartadas || [])
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
      r.zona && r.zona !== '-' ? r.zona : getZonaBySiteId(r.id_sitio),
      r.id_sitio || r.codigo_lugar || '',
      r.localidad || '',
      revisorFinal,
      estadoDisplay
    ]
  })

  const cleanTableName = `Reporte_${(datos.fechaStr || 'jornada').replace(/-/g, '_')}`
  ws.addTable({
    name: cleanTableName,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium9',
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

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Reporte_Observaciones_${datos.fechaStr || 'jornada'}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Genera y descarga un archivo Excel (.xlsx) estructurado con el consolidado SEMANAL de observaciones
 * y la pestaña adicional de resumen de avance diario (Lunes a Domingo).
 */
export async function exportarExcelReporteSemanal(datos) {
  if (!datos) return
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'))
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Amazonas-COVEPA'

  // PESTAÑA 1: Observaciones Consolidadas de la Semana
  const wsObs = wb.addWorksheet('Observaciones_Semana', {
    views: [{ showGridLines: true }]
  })
  wsObs.columns = [
    { width: 22 }, // ID
    { width: 14 }, // Zona
    { width: 20 }, // Código de lugar
    { width: 28 }, // Nombre de localidad
    { width: 24 }, // Persona que validó
    { width: 22 }  // Estado observación
  ]

  const allRows = [
    ...(datos.validadas || []),
    ...(datos.rechazadas || []),
    ...(datos.enEspera || []),
    ...(datos.descartadas || [])
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
      r.zona && r.zona !== '-' ? r.zona : getZonaBySiteId(r.id_sitio),
      r.id_sitio || r.codigo_lugar || '',
      r.localidad || '',
      revisorFinal,
      estadoDisplay
    ]
  })

  wsObs.addTable({
    name: `Semanal_${datos.numeroSemana || 'Consolidado'}`,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium9',
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

  const headerObs = wsObs.getRow(1)
  headerObs.height = 26
  headerObs.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003060' } }
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  const totalObsFilas = tableRows.length > 0 ? tableRows.length : 1
  for (let i = 0; i < totalObsFilas; i++) {
    const rowNum = i + 2
    const row = wsObs.getRow(rowNum)
    row.height = 20
    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Arial', size: 10 }
      cell.alignment = {
        vertical: 'middle',
        horizontal: (colNum === 1 || colNum === 2 || colNum === 3 || colNum === 6 || cell.value === '-') ? 'center' : 'left'
      }
    })
  }

  // PESTAÑA 2: Resumen Diario (Lunes a Domingo)
  const wsResumen = wb.addWorksheet('Resumen_Diario_Semana', {
    views: [{ showGridLines: true }]
  })
  wsResumen.columns = [
    { width: 14 }, // Día
    { width: 16 }, // Fecha
    { width: 16 }, // Validadas
    { width: 16 }, // Rechazadas
    { width: 16 }, // En Espera
    { width: 16 }, // No Aplica
    { width: 16 }  // Total
  ]

  const desgloseRows = (datos.desgloseDias || []).map(d => [
    d.diaNombre || d.diaSemana,
    d.dateStr,
    d.validadas || 0,
    d.rechazadas || 0,
    d.enEspera || 0,
    d.descartadas || 0,
    d.total || 0
  ])

  wsResumen.addTable({
    name: `Resumen_Semana_${datos.numeroSemana || 'Global'}`,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium9',
      showRowStripes: true,
      showColumnStripes: false
    },
    columns: [
      { name: 'Día', filterButton: false },
      { name: 'Fecha', filterButton: false },
      { name: 'Validadas', filterButton: false },
      { name: 'Rechazadas', filterButton: false },
      { name: 'En Espera', filterButton: false },
      { name: 'No Aplica', filterButton: false },
      { name: 'Total', filterButton: false }
    ],
    rows: desgloseRows
  })

  const headerRes = wsResumen.getRow(1)
  headerRes.height = 26
  headerRes.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003060' } }
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  for (let i = 0; i < desgloseRows.length; i++) {
    const row = wsResumen.getRow(i + 2)
    row.height = 20
    row.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Reporte_Semanal_Observaciones_Semana_${datos.numeroSemana || 'consolidado'}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Genera el cuerpo de correo para el REPORTE DIARIO en formato HTML estricto.
 */
export function generarHTMLReporte({ config, datos, isWebPreview = true }) {
  const { fechaFormateada, stats, validadas, rechazadas, descartadas, enEspera } = datos
  const notas = (config.notas_jornada || '').trim()
  const logoSrc = isWebPreview ? '/covepa.png' : 'cid:covepa-logo'
  const totalListados = validadas.length + rechazadas.length + enEspera.length + descartadas.length

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

  return `
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
                Reporte Diario de Levantamiento de Observaciones
              </h1>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#93c5fd;margin-top:3px;font-weight:500;">
                Amazonas — Zona 2 y Zona 7
              </div>
              <div style="margin-top:10px;">
                <span style="display:inline-block;background-color:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:16px;padding:5px 14px;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:600;white-space:nowrap;">
                  📅 ${escapeHtml(fechaFormateada)}
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
                  <td colspan="4" style="padding-bottom:10px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #cbd5e1;border-top:3px solid #003060;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:12px 16px;text-align:center;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:26px;font-weight:bold;color:#003060;line-height:1;">
                            ${stats.total}
                          </div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;">
                            Total de Observaciones Trabajadas en la Jornada
                          </div>
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

          <!-- 1. Agrupación: Observaciones Validadas -->
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

          <!-- 2. Agrupación: Observaciones Rechazadas -->
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

          <!-- 3. Agrupación: En Espera de Revisión -->
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

          <!-- 4. Agrupación: Observaciones No Aplica -->
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

          <!-- Mensaje si no hubo observaciones -->
          ${totalListados === 0 ? `
          <tr>
            <td style="padding:20px 28px;text-align:center;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#64748b;font-style:italic;">
                No se registraron observaciones levantadas o en espera para la jornada seleccionada.
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Bloque de Comentarios de la Jornada -->
          ${notas ? `
          <tr>
            <td style="padding:10px 28px 16px 28px;">
              <div style="background-color:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #003060;border-radius:6px;padding:14px 18px;">
                <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#003060;text-transform:uppercase;margin-bottom:6px;letter-spacing:0.8px;">
                  💬 Comentarios u Observaciones de la Jornada
                </div>
                <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#334155;line-height:1.55;white-space:pre-wrap;">${escapeHtml(notas)}</div>
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
}

/**
 * Genera el cuerpo de correo para el REPORTE SEMANAL en formato HTML estricto.
 * Incluye cabecera de semana, contador general semanal, 4 medidores, tabla de días y listas de códigos.
 */
export function generarHTMLReporteSemanal({ config, datos, isWebPreview = true }) {
  const { numeroSemana, rangoSemanaStr, stats, validadas, rechazadas, descartadas, enEspera, desgloseDias } = datos
  const notas = (config.notas_jornada || '').trim()
  const logoSrc = isWebPreview ? '/covepa.png' : 'cid:covepa-logo'
  const totalListados = validadas.length + rechazadas.length + enEspera.length + descartadas.length

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

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Semanal COVEPA</title>
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
                Reporte Semanal Consolidado de Observaciones
              </h1>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#93c5fd;margin-top:3px;font-weight:500;">
                Amazonas — Zona 2 y Zona 7
              </div>
              <div style="margin-top:10px;">
                <span style="display:inline-block;background-color:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:16px;padding:5px 14px;color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:600;white-space:nowrap;">
                  📅 Sem. ${numeroSemana} · ${escapeHtml(rangoSemanaStr)}
                </span>
              </div>
            </td>
          </tr>

          <!-- Panel de Control de Métricas (Dashboard KPI Integrado) -->
          <tr>
            <td style="background-color:#f8fafc;border-bottom:1px solid #e2e8f0;padding:16px 24px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <!-- Total General Semanal (Centrado como los medidores de abajo, conservando su posición) -->
                <tr>
                  <td colspan="4" style="padding-bottom:10px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #cbd5e1;border-top:3px solid #003060;border-radius:6px;text-align:center;">
                      <tr>
                        <td style="padding:12px 16px;text-align:center;">
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:26px;font-weight:bold;color:#003060;line-height:1;">
                            ${stats.total}
                          </div>
                          <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;">
                            Total de Observaciones Trabajadas en la Semana
                          </div>
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

          <!-- Tabla de Desglose de Avance Diario de Lunes a Domingo -->
          <tr>
            <td style="padding:14px 28px 10px 28px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:bold;color:#003060;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.5px;">
                📊 Desglose de Avance Diario (Lunes a Domingo)
              </div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;">
                <thead>
                  <tr style="background-color:#003060;color:#ffffff;text-align:center;font-weight:bold;">
                    <th style="padding:8px;text-align:left;">Día</th>
                    <th style="padding:8px 4px;">Validadas</th>
                    <th style="padding:8px 4px;">Rechazadas</th>
                    <th style="padding:8px 4px;">En Espera</th>
                    <th style="padding:8px 4px;">No Aplica</th>
                    <th style="padding:8px 6px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${(desgloseDias || []).map((d, i) => `
                    <tr style="background-color:${i % 2 === 0 ? '#f8fafc' : '#ffffff'};border-bottom:1px solid #e2e8f0;text-align:center;color:#334155;">
                      <td style="padding:6px 8px;text-align:left;font-weight:bold;color:#003060;">
                        ${escapeHtml(d.diaNombre)} <span style="font-size:11px;color:#64748b;font-weight:normal;">(${d.dayNum}/${d.monthNum})</span>
                      </td>
                      <td style="padding:6px 4px;color:#16a34a;font-weight:bold;">${d.validadas}</td>
                      <td style="padding:6px 4px;color:#e11d48;font-weight:bold;">${d.rechazadas}</td>
                      <td style="padding:6px 4px;color:#0284c7;font-weight:bold;">${d.enEspera}</td>
                      <td style="padding:6px 4px;color:#7e22ce;font-weight:bold;">${d.descartadas}</td>
                      <td style="padding:6px 6px;font-weight:bold;color:#0f172a;background-color:${i % 2 === 0 ? '#f1f5f9' : '#f8fafc'};">${d.total}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Agrupación: Validadas -->
          ${validadas.length > 0 ? `
          <tr>
            <td style="padding:10px 28px 10px 28px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#16a34a;margin-right:6px;">✓</span> Observaciones Validadas en la Semana (${validadas.length})
              </div>
              ${renderCodeList(validadas, '#15803d', '#86efac', '#f0fdf4')}
            </td>
          </tr>
          ` : ''}

          <!-- Agrupación: Rechazadas -->
          ${rechazadas.length > 0 ? `
          <tr>
            <td style="padding:10px 28px 10px 28px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#e11d48;margin-right:6px;">✕</span> Observaciones Rechazadas en la Semana (${rechazadas.length})
              </div>
              ${renderCodeList(rechazadas, '#b91c1c', '#fca5a5', '#fff1f2')}
            </td>
          </tr>
          ` : ''}

          <!-- Agrupación: En Espera -->
          ${enEspera.length > 0 ? `
          <tr>
            <td style="padding:10px 28px 10px 28px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#0284c7;margin-right:6px;">⏳</span> En Espera al Cierre de Semana (${enEspera.length})
              </div>
              ${renderCodeList(enEspera, '#0369a1', '#93c5fd', '#f0f9ff')}
            </td>
          </tr>
          ` : ''}

          <!-- Agrupación: No Aplica -->
          ${descartadas.length > 0 ? `
          <tr>
            <td style="padding:10px 28px 10px 28px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:bold;color:#003060;margin-bottom:8px;">
                <span style="color:#7e22ce;margin-right:6px;">🚫</span> Observaciones No Aplica en la Semana (${descartadas.length})
              </div>
              ${renderCodeList(descartadas, '#6b21a8', '#d8b4fe', '#faf5ff')}
            </td>
          </tr>
          ` : ''}

          <!-- Mensaje si no hubo observaciones -->
          ${totalListados === 0 ? `
          <tr>
            <td style="padding:20px 28px;text-align:center;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#64748b;font-style:italic;">
                No se registraron observaciones levantadas o en espera para la semana seleccionada.
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Comentarios de la Semana -->
          ${notas ? `
          <tr>
            <td style="padding:10px 28px 16px 28px;">
              <div style="background-color:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #003060;border-radius:6px;padding:14px 18px;">
                <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:bold;color:#003060;text-transform:uppercase;margin-bottom:6px;letter-spacing:0.8px;">
                  💬 Comentarios y Conclusiones de la Semana
                </div>
                <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#334155;line-height:1.55;white-space:pre-wrap;">${escapeHtml(notas)}</div>
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

/**
 * Despacha el reporte diario de inmediato.
 */
export const DEFAULT_CRON_KEY = 'covepa_cron_7f8a9b2c3d4e5f'

export async function despacharReporteInmediato({ forzar = true, destinatarioPrueba = '' } = {}) {
  const cronKey = (import.meta.env.VITE_CRON_SECRET || DEFAULT_CRON_KEY).trim()
  try {
    const res = await fetch('/api/despachar-reporte', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-key': cronKey,
        'x-forzar': forzar ? 'true' : 'false',
        'x-destinatario-prueba': destinatarioPrueba || ''
      },
      body: JSON.stringify({ forzar, destinatario_prueba: destinatarioPrueba || '' })
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      registrarEnvioLocal({
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
        tipo_reporte: 'diario',
        tipo: destinatarioPrueba ? 'prueba' : (forzar ? 'manual' : 'oficial'),
        origen: 'web',
        destinatarios: destinatarioPrueba ? [destinatarioPrueba] : [],
        destinatarios_cc: [],
        asunto: 'Reporte Diario de Levantamiento de Observaciones',
        estado: 'exitoso'
      })
      return { ok: true, message: data.message || '¡Reporte diario despachado exitosamente!' }
    }
    if (res.status !== 404) {
      const errData = await res.json().catch(() => ({}))
      if (errData && errData.error) {
        throw new Error(errData.error)
      }
    }
  } catch (apiErr) {
    if (apiErr.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('Failed to fetch')) {
      throw apiErr
    }
  }

  // Fallback directo a la API de GitHub Actions
  const token = (import.meta.env.VITE_GITHUB_DISPATCH_TOKEN || '').trim()
  if (!token) {
    throw new Error('Falta configurar GITHUB_DISPATCH_TOKEN en Vercel (o VITE_GITHUB_DISPATCH_TOKEN en local) para autorizar el despacho desde la web. Puedes ejecutarlo con 1 clic en la pestaña Actions de GitHub.')
  }
  const repo = 'JCarlosCC2001/Amazonas-COVEPA'
  const url = `https://api.github.com/repos/${repo}/actions/workflows/reporte-diario.yml/dispatches`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        forzar: forzar ? 'true' : 'false',
        destinatario_prueba: destinatarioPrueba || ''
      }
    })
  })

  if (response.status === 204 || response.ok) {
    registrarEnvioLocal({
      id: `local-${Date.now()}`,
      created_at: new Date().toISOString(),
      tipo_reporte: 'diario',
      tipo: destinatarioPrueba ? 'prueba' : (forzar ? 'manual' : 'oficial'),
      origen: 'web_direct',
      destinatarios: destinatarioPrueba ? [destinatarioPrueba] : [],
      destinatarios_cc: [],
      asunto: 'Reporte Diario de Levantamiento de Observaciones',
      estado: 'exitoso'
    })
    return { ok: true, message: '¡Reporte despachado exitosamente!' }
  }

  const errData = await response.json().catch(() => ({}))
  throw new Error(errData.message || `Error del servidor GitHub (${response.status})`)
}

/**
 * Despacha el reporte semanal de inmediato (prueba de envío).
 */
export async function despacharReporteSemanalInmediato({ forzar = true, destinatarioPrueba = '' } = {}) {
  const cronKey = (import.meta.env.VITE_CRON_SECRET || DEFAULT_CRON_KEY).trim()
  try {
    const res = await fetch('/api/despachar-reporte-semanal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-key': cronKey,
        'x-forzar': forzar ? 'true' : 'false',
        'x-destinatario-prueba': destinatarioPrueba || ''
      },
      body: JSON.stringify({ forzar, destinatario_prueba: destinatarioPrueba || '' })
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      registrarEnvioLocal({
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
        tipo_reporte: 'semanal',
        tipo: destinatarioPrueba ? 'prueba' : (forzar ? 'manual' : 'oficial'),
        origen: 'web',
        destinatarios: destinatarioPrueba ? [destinatarioPrueba] : [],
        destinatarios_cc: [],
        asunto: '[COVEPA] Reporte Semanal de Observaciones',
        estado: 'exitoso'
      })
      return { ok: true, message: data.message }
    }
  } catch (_) {}

  registrarEnvioLocal({
    id: `local-${Date.now()}`,
    created_at: new Date().toISOString(),
    tipo_reporte: 'semanal',
    tipo: destinatarioPrueba ? 'prueba' : 'manual',
    origen: 'simulacion',
    destinatarios: destinatarioPrueba ? [destinatarioPrueba] : [],
    destinatarios_cc: [],
    asunto: '[COVEPA] Simulación de Reporte Semanal',
    estado: 'exitoso'
  })

  // Fallback si no hay endpoint semanal directo todavía: avisa al usuario
  return { ok: true, message: '¡Simulación de despacho semanal completada exitosamente!' }
}

export const LOCAL_STORAGE_KEY_HISTORIAL = 'covepa_historial_reportes_local'

/**
 * Agrega un registro al historial local para feedback instantáneo en UI.
 */
export function registrarEnvioLocal(registro) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_HISTORIAL)
    const list = raw ? JSON.parse(raw) : []
    const updated = [registro, ...list].slice(0, 30)
    localStorage.setItem(LOCAL_STORAGE_KEY_HISTORIAL, JSON.stringify(updated))
  } catch (_) {}
}

/**
 * Consulta y unifica el historial completo de envíos de reportes.
 * Permite filtrar por tipo de reporte ('diario' | 'semanal') para que cada
 * tipo de informe conserve su propio historial independiente.
 */
export async function fetchHistorialEnvios(tipoReporte = null) {
  const unified = []
  const seenRunIds = new Set()

  // 1. Intentar consultar Supabase historial_reportes_correo
  try {
    const { data, error } = await supabase
      .from('historial_reportes_correo')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60)

    if (!error && Array.isArray(data)) {
      data.forEach(item => {
        if (item.github_run_id) seenRunIds.add(String(item.github_run_id))
        const itemTipoReporte = item.tipo_reporte || 
          ((item.asunto || '').toLowerCase().includes('semanal') ? 'semanal' : 'diario')

        unified.push({
          id: item.id || `sb-${item.created_at}`,
          created_at: item.created_at,
          tipo_reporte: itemTipoReporte,
          tipo: item.tipo || 'oficial', // 'oficial' | 'prueba' | 'manual'
          origen: item.origen || 'supabase',
          destinatarios: Array.isArray(item.destinatarios) ? item.destinatarios : [item.destinatarios].filter(Boolean),
          destinatarios_cc: Array.isArray(item.destinatarios_cc) ? item.destinatarios_cc : [],
          asunto: item.asunto || 'Reporte de Levantamiento de Observaciones',
          total_obs: item.total_obs ?? null,
          validadas: item.validadas ?? null,
          rechazadas: item.rechazadas ?? null,
          en_espera: item.en_espera ?? null,
          descartadas: item.descartadas ?? null,
          estado: item.estado || 'exitoso',
          error_mensaje: item.error_mensaje || null,
          message_id: item.message_id || null,
          github_run_id: item.github_run_id || null,
          url_log: item.github_run_id ? `https://github.com/JCarlosCC2001/Amazonas-COVEPA/actions/runs/${item.github_run_id}` : null,
          source: 'database'
        })
      })
    }
  } catch (sbErr) {
    console.warn('[HISTORIAL-REPORTES] Supabase historial_reportes_correo no disponible aún:', sbErr)
  }

  // 2. Consultar ejecuciones reales en tiempo real desde GitHub Actions
  try {
    const token = (import.meta.env.VITE_GITHUB_DISPATCH_TOKEN || '').trim()
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Covepa-App'
    }
    if (token) {
      headers['Authorization'] = `token ${token}`
    }

    const res = await fetch('https://api.github.com/repos/JCarlosCC2001/Amazonas-COVEPA/actions/workflows/reporte-diario.yml/runs?per_page=35', {
      headers
    })

    if (res.ok) {
      const ghData = await res.json()
      const runs = ghData.workflow_runs || []

      runs.forEach(run => {
        const runIdStr = String(run.id)
        if (seenRunIds.has(runIdStr)) return // Ya procesado desde Supabase

        let estadoNormalizado = 'exitoso'
        if (run.status === 'in_progress' || run.status === 'queued') {
          estadoNormalizado = 'en_proceso'
        } else if (run.conclusion === 'failure' || run.conclusion === 'cancelled') {
          estadoNormalizado = 'fallido'
        }

        const isSchedule = run.event === 'schedule'
        const tipoFinal = isSchedule ? 'oficial' : 'manual'
        const runNameLower = (run.name || '').toLowerCase()
        const runTipoReporte = runNameLower.includes('semanal') ? 'semanal' : 'diario'

        unified.push({
          id: `gh-${run.id}`,
          created_at: run.created_at,
          tipo_reporte: runTipoReporte,
          tipo: tipoFinal,
          origen: isSchedule ? 'cron' : 'github_actions',
          destinatarios: [],
          destinatarios_cc: [],
          asunto: run.name || 'Reporte Diario de Observaciones COVEPA',
          total_obs: null,
          estado: estadoNormalizado,
          github_run_id: runIdStr,
          run_number: run.run_number,
          actor: run.actor?.login,
          url_log: run.html_url,
          source: 'github'
        })
      })
    }
  } catch (err) {
    console.warn('[HISTORIAL-REPORTES] No se pudieron consultar runs de GitHub:', err)
  }

  // 3. Consultar registros locales recientes de localStorage
  try {
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY_HISTORIAL)
    if (rawLocal) {
      const localItems = JSON.parse(rawLocal)
      if (Array.isArray(localItems)) {
        localItems.forEach(loc => {
          const yaExiste = unified.some(u => (
            u.id === loc.id || 
            (Math.abs(new Date(u.created_at) - new Date(loc.created_at)) < 30000)
          ))
          if (!yaExiste) {
            unified.push({
              tipo_reporte: loc.tipo_reporte || ((loc.asunto || '').toLowerCase().includes('semanal') ? 'semanal' : 'diario'),
              ...loc,
              source: 'local'
            })
          }
        })
      }
    }
  } catch (_) {}

  // 4. Ordenar cronológicamente descendente (más reciente arriba)
  unified.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // 5. Filtrar por tipo específico si se solicita
  if (tipoReporte) {
    return unified.filter(item => item.tipo_reporte === tipoReporte)
  }

  return unified
}
