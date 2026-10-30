import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  TrendingUp, X, Search, Download, MapPin, User,
  Clock, ShieldCheck, RefreshCw, AlertCircle, Eye, FileText,
  Copy, Image, Check, ChevronDown, ChevronUp
} from 'lucide-react'
// M3: ExcelJS importado dinamicamente en handleExportXLSX
import { getAvancePorFecha } from '../../services/dashboardService'
import { ASIGNACIONES_BASE } from '../../services/sitiosService'
import { DEFAULT_CUADRILLAS_CONFIG } from '../../services/personalService'
import CuadrillasMatrixTable from '../shared/CuadrillasMatrixTable'
import { formatNombrePersona, getPeruDateStr } from '../../utils/helpers'
// M3: imageExportService importado dinamicamente en handleCopyPNG / handleDownloadPNG
import { usePresentationMode } from '../../context/PresentationContext'

export default function ModalAvanceDia({ fecha, sitiosMap = {}, onClose }) {
  const { presentationMode } = usePresentationMode()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [avanceData, setAvanceData] = useState({ rows: [], stats: {}, programacionesDelDia: 0 })
  const [searchTable, setSearchTable] = useState('')
  const [filterEstado, setFilterEstado] = useState('TODOS')
  const [selectedRowDetail, setSelectedRowDetail] = useState(null)
  const [exportingXlsx, setExportingXlsx] = useState(false)
  const [exportingPng, setExportingPng] = useState(false)
  const [copiedPng, setCopiedPng] = useState(false)
  const [showDetailedList, setShowDetailedList] = useState(false)
  const [selectedCellFilter, setSelectedCellFilter] = useState(null)

  // Cargar datos de avance para la fecha seleccionada
  useEffect(() => {
    let isMounted = true
    const loadAvance = async () => {
      setLoading(true)
      setErrorMsg('')
      try {
        const res = await getAvancePorFecha(fecha)
        if (isMounted) {
          setAvanceData(res || { rows: [], stats: {}, programacionesDelDia: 0 })
        }
      } catch (err) {
        if (isMounted) setErrorMsg(err.message || 'Error cargando avance del día')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadAvance()
    return () => { isMounted = false }
  }, [fecha])

  // Cerrar únicamente con tecla Escape (o botón X)
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        if (selectedRowDetail) {
          setSelectedRowDetail(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, selectedRowDetail])

  // Helper para resolver localidad de un sitio
  const getLocalidad = (idSitio) => {
    return sitiosMap[idSitio]?.localidad ||
      sitiosMap[idSitio]?.nombre_nodo ||
      ASIGNACIONES_BASE.find(s => s.id_site === idSitio)?.localidad ||
      ''
  }

  // Helper para resolver la zona de un sitio
  const getZona = (idSitio) => {
    return sitiosMap[idSitio]?.zona ||
      ASIGNACIONES_BASE.find(s => s.id_site === idSitio)?.zona ||
      ''
  }

  // Helper para resolver la cuadrilla oficial asignada a una observación
  const resolveCuadrillaForObs = useCallback((obs) => {
    if (obs.cuadrilla) {
      const cClean = String(obs.cuadrilla).toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
      const match = cClean.match(/CUADRILLA\s*([1-6])/)
      if (match) return `CUADRILLA ${match[1]}`
    }

    const siteId = obs.id_sitio
    const asig = ASIGNACIONES_BASE.find(s => s.id_site === siteId) || sitiosMap[siteId]
    if (asig?.grupo) {
      const gClean = String(asig.grupo).toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
      const match = gClean.match(/CUADRILLA\s*([1-6])/)
      if (match) return `CUADRILLA ${match[1]}`
    }

    if (obs.tecnico) {
      const tClean = String(obs.tecnico).toUpperCase().trim()
      for (const [cName, cfg] of Object.entries(DEFAULT_CUADRILLAS_CONFIG)) {
        if (cfg.tecnicoNombre && tClean.includes(cfg.tecnicoNombre.toUpperCase())) {
          return cName
        }
      }
    }

    return 'CUADRILLA 1'
  }, [sitiosMap])

  const stats = avanceData.stats || {}

  // Columnas semánticas para la Matriz de Cuadrillas
  const statusColumns = useMemo(() => [
    {
      key: 'solicitando',
      label: 'Solicitando Revisión',
      badgeVariant: 'amber',
      title: 'Observaciones solicitando revisión técnica'
    },
    {
      key: 'enRevision',
      label: 'En Revisión',
      badgeVariant: 'sky',
      title: 'Observaciones en proceso de revisión'
    },
    {
      key: 'rechazados',
      label: 'Rechazados',
      badgeVariant: 'rose',
      title: 'Observaciones rechazadas por calidad'
    },
    {
      key: 'validados',
      label: 'Validados',
      badgeVariant: 'emerald',
      title: 'Observaciones validadas conformes'
    }
  ], [])

  // Consolidación de datos matriciales (6 Cuadrillas x Estados)
  const matrixData = useMemo(() => {
    const rows = avanceData.rows || []

    const cuadrillasMap = {
      'CUADRILLA 1': {
        id: 'CUADRILLA 1',
        cuadrilla: 'CUADRILLA 1',
        tecnico: DEFAULT_CUADRILLAS_CONFIG['CUADRILLA 1']?.tecnicoNombre || 'Jhonatan Flores',
        values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 },
        total: 0
      },
      'CUADRILLA 2': {
        id: 'CUADRILLA 2',
        cuadrilla: 'CUADRILLA 2',
        tecnico: DEFAULT_CUADRILLAS_CONFIG['CUADRILLA 2']?.tecnicoNombre || 'Cristian Isla',
        values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 },
        total: 0
      },
      'CUADRILLA 3': {
        id: 'CUADRILLA 3',
        cuadrilla: 'CUADRILLA 3',
        tecnico: DEFAULT_CUADRILLAS_CONFIG['CUADRILLA 3']?.tecnicoNombre || 'Daniel Javier',
        values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 },
        total: 0
      },
      'CUADRILLA 4': {
        id: 'CUADRILLA 4',
        cuadrilla: 'CUADRILLA 4',
        tecnico: DEFAULT_CUADRILLAS_CONFIG['CUADRILLA 4']?.tecnicoNombre || 'Alfonso Curi',
        values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 },
        total: 0
      },
      'CUADRILLA 5': {
        id: 'CUADRILLA 5',
        cuadrilla: 'CUADRILLA 5',
        tecnico: DEFAULT_CUADRILLAS_CONFIG['CUADRILLA 5']?.tecnicoNombre || 'William Avila',
        values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 },
        total: 0
      },
      'CUADRILLA 6': {
        id: 'CUADRILLA 6',
        cuadrilla: 'CUADRILLA 6',
        tecnico: DEFAULT_CUADRILLAS_CONFIG['CUADRILLA 6']?.tecnicoNombre || 'Gabriel Farro',
        values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0 },
        total: 0
      }
    }

    rows.forEach(r => {
      const targetCuadrilla = resolveCuadrillaForObs(r)
      const targetObj = cuadrillasMap[targetCuadrilla]
      if (targetObj) {
        if (r.tecnico && r.tecnico !== 'No asignado' && r.tecnico !== 'Técnico de Cuadrilla' && r.tecnico !== 'Técnico en ruta') {
          targetObj.tecnico = formatNombrePersona(r.tecnico)
        }

        const rawSt = (r.estado || '').trim().toLowerCase()
        if (rawSt === 'solicitando revisión' || rawSt === 'solicitando revision') {
          targetObj.values.solicitando++
        } else if (rawSt === 'en revisión' || rawSt === 'en revision') {
          targetObj.values.enRevision++
        } else if (rawSt === 'rechazado' || rawSt === 'rechazada' || rawSt === 'rechazados') {
          targetObj.values.rechazados++
        } else if (rawSt === 'validado' || rawSt === 'validada' || rawSt === 'enviado' || rawSt === 'enviada') {
          targetObj.values.validados++
        }
      }
    })

    const matrixRowsList = Object.values(cuadrillasMap).map(row => ({
      ...row,
      total: row.values.solicitando + row.values.enRevision + row.values.rechazados + row.values.validados
    }))

    const totalsObj = {
      solicitando: matrixRowsList.reduce((acc, r) => acc + r.values.solicitando, 0),
      enRevision: matrixRowsList.reduce((acc, r) => acc + r.values.enRevision, 0),
      rechazados: matrixRowsList.reduce((acc, r) => acc + r.values.rechazados, 0),
      validados: matrixRowsList.reduce((acc, r) => acc + r.values.validados, 0)
    }

    const grandTotalNum = totalsObj.solicitando + totalsObj.enRevision + totalsObj.rechazados + totalsObj.validados

    return {
      matrixRows: matrixRowsList,
      matrixTotals: totalsObj,
      matrixGrandTotal: grandTotalNum
    }
  }, [avanceData.rows, resolveCuadrillaForObs])

  // Filtrado de filas detalladas
  const filteredRows = useMemo(() => {
    return (avanceData.rows || []).filter(r => {
      const loc = getLocalidad(r.id_sitio)
      const q = searchTable.toLowerCase().trim()
      const matchSearch = !q ||
        (r.id_obs && r.id_obs.toLowerCase().includes(q)) ||
        (r.tecnico && r.tecnico.toLowerCase().includes(q)) ||
        (r.cuadrilla && r.cuadrilla.toLowerCase().includes(q)) ||
        (r.id_sitio && r.id_sitio.toLowerCase().includes(q)) ||
        (loc && loc.toLowerCase().includes(q)) ||
        (r.revisor && r.revisor.toLowerCase().includes(q))

      if (!matchSearch) return false

      if (filterEstado === 'TODOS') return true
      if (filterEstado === 'Validado') {
        return r.estado === 'Validado' || r.estado === 'Enviado'
      }
      if (filterEstado === 'Solicitando Revisión') {
        return r.estado === 'Solicitando Revisión' || r.estado === 'Solicitando Revision'
      }
      if (filterEstado === 'En Revisión') {
        return r.estado === 'En Revision' || r.estado === 'En Revisión'
      }
      return r.estado === filterEstado
    })
  }, [avanceData.rows, filterEstado, searchTable, sitiosMap])

  // Filas finales para el desglose (aplicando filtro de celda si está activo)
  const displayRows = useMemo(() => {
    if (!selectedCellFilter) return filteredRows

    return filteredRows.filter(r => {
      const c = resolveCuadrillaForObs(r)
      if (c !== selectedCellFilter.cuadrilla) return false

      const rawSt = (r.estado || '').trim().toLowerCase()
      if (selectedCellFilter.colKey === 'solicitando') {
        return rawSt === 'solicitando revisión' || rawSt === 'solicitando revision'
      }
      if (selectedCellFilter.colKey === 'enRevision') {
        return rawSt === 'en revisión' || rawSt === 'en revision'
      }
      if (selectedCellFilter.colKey === 'rechazados') {
        return rawSt === 'rechazado' || rawSt === 'rechazada' || rawSt === 'rechazados'
      }
      if (selectedCellFilter.colKey === 'validados') {
        return rawSt === 'validado' || rawSt === 'validada' || rawSt === 'enviado' || rawSt === 'enviada'
      }
      return true
    })
  }, [filteredRows, selectedCellFilter, resolveCuadrillaForObs])

  // Formato legible de fecha
  const formattedDate = useMemo(() => {
    if (!fecha) return ''
    const parts = fecha.split('-')
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      return d.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }
    return fecha
  }, [fecha])

  // Exportar reporte a Excel (.xlsx) con Hoja 1: Matriz de Cuadrillas y Hoja 2: Detalle (con LOCALIDAD al lado de CÓDIGO DE SITIO)
  const handleExportXLSX = async () => {
    if (matrixData.matrixRows.length === 0 && filteredRows.length === 0) return
    setExportingXlsx(true)
    try {
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'COVEPA ERP'
      workbook.created = new Date()

      // Hoja 1: Matriz Ejecutiva por Cuadrilla
      const wsMatriz = workbook.addWorksheet('Matriz_Cuadrillas', {
        views: [{ showGridLines: true }]
      })

      const matrixTableRows = matrixData.matrixRows.map(r => [
        r.cuadrilla,
        r.tecnico,
        r.values.solicitando || 0,
        r.values.enRevision || 0,
        r.values.rechazados || 0,
        r.values.validados || 0,
        r.total || 0
      ])

      // Fila de Total Diario
      matrixTableRows.push([
        'TOTAL DIARIO',
        '',
        matrixData.matrixTotals.solicitando || 0,
        matrixData.matrixTotals.enRevision || 0,
        matrixData.matrixTotals.rechazados || 0,
        matrixData.matrixTotals.validados || 0,
        matrixData.matrixGrandTotal || 0
      ])

      wsMatriz.addTable({
        name: `Matriz_${fecha.replace(/-/g, '_')}`,
        ref: 'A1',
        headerRow: true,
        totalsRow: false,
        style: {
          theme: 'TableStyleMedium9',
          showRowStripes: true,
          showColumnStripes: false
        },
        columns: [
          { name: 'CUADRILLA', filterButton: true },
          { name: 'TÉCNICO RESPONSABLE', filterButton: true },
          { name: 'SOLICITANDO REVISIÓN', filterButton: true },
          { name: 'EN REVISIÓN', filterButton: true },
          { name: 'RECHAZADOS', filterButton: true },
          { name: 'VALIDADOS', filterButton: true },
          { name: 'TOTAL DIARIO', filterButton: true }
        ],
        rows: matrixTableRows
      })

      const matrixColWidths = [18, 28, 24, 18, 16, 16, 18]
      matrixColWidths.forEach((w, i) => {
        wsMatriz.getColumn(i + 1).width = w
      })

      wsMatriz.eachRow((row, rowNumber) => {
        row.height = rowNumber === 1 ? 26 : 22
        const isFoot = rowNumber === matrixTableRows.length + 1
        row.eachCell((cell, colNumber) => {
          if (isFoot) {
            cell.font = { bold: true }
          }
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 || colNumber === 2 ? 'left' : 'center'
          }
        })
      })

      // Hoja 2: Detalle Unitario de Observaciones
      const wsDetalle = workbook.addWorksheet('Detalle_Observaciones', {
        views: [{ showGridLines: true }]
      })

      const tableRows = filteredRows.map(r => [
        r.id_obs || '',
        r.tecnico || 'No asignado',
        resolveCuadrillaForObs(r) || r.cuadrilla || 'Sin cuadrilla',
        r.id_sitio || '',
        getLocalidad(r.id_sitio) || '',
        getZona(r.id_sitio) || '',
        r.estado || '',
        r.revisor || 'Sin revisor',
        r.fecha_subsanacion ? getPeruDateStr(r.fecha_subsanacion) : '',
        r.detalle || ''
      ])

      wsDetalle.addTable({
        name: `Detalle_${fecha.replace(/-/g, '_')}`,
        ref: 'A1',
        headerRow: true,
        totalsRow: false,
        style: {
          theme: 'TableStyleMedium9',
          showRowStripes: true,
          showColumnStripes: false
        },
        columns: [
          { name: 'CÓD. OBSERVACIÓN', filterButton: true },
          { name: 'NOMBRE DE TÉCNICO', filterButton: true },
          { name: 'CUADRILLA', filterButton: true },
          { name: 'CÓDIGO DE SITIO', filterButton: true },
          { name: 'LOCALIDAD', filterButton: true },
          { name: 'ZONA', filterButton: true },
          { name: 'ESTADO COVEPA', filterButton: true },
          { name: 'REVISADO POR', filterButton: true },
          { name: 'FECHA DE REVISIÓN', filterButton: true },
          { name: 'DETALLE DE OBSERVACIÓN', filterButton: true }
        ],
        rows: tableRows
      })

      const colWidths = [20, 26, 16, 18, 24, 18, 22, 16, 40]
      colWidths.forEach((w, i) => {
        wsDetalle.getColumn(i + 1).width = w
      })

      wsDetalle.eachRow((row, rowNumber) => {
        row.height = rowNumber === 1 ? 24 : 20
        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 || colNumber === 4 || colNumber === 6 || colNumber === 8 ? 'center' : 'left'
          }
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Avance_COVEPA_${fecha}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al exportar Excel de avance:', err)
      alert('Error generando Excel: ' + err.message)
    } finally {
      setExportingXlsx(false)
    }
  }

  // Copiar imagen PNG del reporte al portapapeles
  const handleCopyPNG = async () => {
    if (filteredRows.length === 0 || exportingPng) return
    setExportingPng(true)
    try {
      const { copyAvanceDiaPNG } = await import('../../services/imageExportService')
      const res = await copyAvanceDiaPNG({
        fecha,
        formattedDate,
        rows: filteredRows,
        stats,
        getLocalidad,
        filterEstado
      })
      if (res.method === 'clipboard') {
        setCopiedPng(true)
        setTimeout(() => setCopiedPng(false), 3000)
      } else {
        alert('Imagen descargada en tu dispositivo (el portapapeles del navegador requiere HTTPS o permiso para copiar directamente).')
      }
    } catch (err) {
      console.error('Error al copiar imagen PNG:', err)
      alert('Error al generar la imagen: ' + err.message)
    } finally {
      setExportingPng(false)
    }
  }

  // Descargar imagen PNG del reporte
  const handleDownloadPNG = async () => {
    if (filteredRows.length === 0 || exportingPng) return
    setExportingPng(true)
    try {
      const { downloadAvanceDiaPNG } = await import('../../services/imageExportService')
      await downloadAvanceDiaPNG({
        fecha,
        formattedDate,
        rows: filteredRows,
        stats,
        getLocalidad,
        filterEstado
      })
    } catch (err) {
      console.error('Error al descargar imagen PNG:', err)
      alert('Error al descargar la imagen: ' + err.message)
    } finally {
      setExportingPng(false)
    }
  }

  // Renderizador de badge semántico de estado
  const renderEstadoBadge = (st) => {
    switch (st) {
      case 'Validado':
        return <span className="prog-avance-badge validado">✓ Por Subir</span>
      case 'Enviado':
        return <span className="prog-avance-badge enviado">✉ Enviada</span>
      case 'En Revision':
      case 'En Revisión':
        return <span className="prog-avance-badge revision">🔍 En Revisión</span>
      case 'Descartado':
        return <span className="prog-avance-badge descartado">🚫 Descartada</span>
      case 'Rechazado':
        return <span className="prog-avance-badge rechazado">✕ Rechazada</span>
      default:
        return <span className="prog-avance-badge pendiente">● {st || 'Pendiente'}</span>
    }
  }

  return (
    <div className="prog-details-modal-overlay">
      <div className="prog-details-modal prog-avance-modal">
        {/* Cabecera del Modal */}
        <div className="prog-details-modal-header">
          <div className="prog-details-header-main">
            <div className="prog-details-site-title-row">
              <div className="prog-details-site-badge-icon" style={{ background: '#f0f9ff', color: '#0284c7', borderColor: '#bae6fd' }}>
                <TrendingUp size={22} />
              </div>
              <div className="prog-details-site-texts">
                <div className="prog-details-title-line">
                  <h2 className="prog-details-site-title" style={{ fontFamily: 'var(--font-sans)', letterSpacing: 'normal' }}>
                    Avance del Día
                  </h2>
                  <span className="prog-details-site-loc" style={{ textTransform: 'capitalize', color: '#475569', fontSize: 'var(--text-base)' }}>
                    · {formattedDate}
                  </span>
                </div>
                <div className="prog-details-site-meta-pills">
                  <span className="meta-pill" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd', fontWeight: 'var(--fw-bold)' }}>
                    {avanceData.rows?.length || 0} observaciones registradas
                  </span>
                  {avanceData.programacionesDelDia > 0 && (
                    <span className="meta-pill">
                      {avanceData.programacionesDelDia} {avanceData.programacionesDelDia === 1 ? 'jornada programada' : 'jornadas programadas'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="prog-details-modal-actions">
            <button
              type="button"
              className="prog-modal-close-btn"
              onClick={onClose}
              title="Cerrar ventana (Esc)"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Filtros por Estado */}
        <div className="prog-modal-stats-bar">
          <button
            type="button"
            className={`prog-modal-stat-btn ${filterEstado === 'TODOS' ? 'active' : ''}`}
            onClick={() => setFilterEstado('TODOS')}
            title="Ver todas las observaciones del día"
          >
            <span className="stat-btn-label">Total</span>
            <span className="stat-btn-val">{avanceData.rows?.length || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-solicitando ${filterEstado === 'Solicitando Revisión' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'Solicitando Revisión' ? 'TODOS' : 'Solicitando Revisión')}
            title="Observaciones solicitando revisión técnica"
          >
            <span className="stat-btn-label text-solicitando">⏳ Solicitando</span>
            <span className="stat-btn-val text-solicitando">{stats.solicitando || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-revision ${filterEstado === 'En Revisión' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'En Revisión' ? 'TODOS' : 'En Revisión')}
            title="Observaciones en proceso de revisión"
          >
            <span className="stat-btn-label text-revision">🔍 En Revisión</span>
            <span className="stat-btn-val text-revision">{stats.enRevision || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-validado ${filterEstado === 'Validado' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'Validado' ? 'TODOS' : 'Validado')}
            title="Observaciones validadas conformes"
          >
            <span className="stat-btn-label text-validado">✓ Validadas</span>
            <span className="stat-btn-val text-validado">{stats.validadas || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-descartado ${filterEstado === 'Descartado' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'Descartado' ? 'TODOS' : 'Descartado')}
            title="Observaciones descartadas en campo"
          >
            <span className="stat-btn-label text-descartado">🚫 Descartadas</span>
            <span className="stat-btn-val text-descartado">{stats.descartadas || 0}</span>
          </button>

          {(stats.rechazadas || 0) > 0 && (
            <button
              type="button"
              className={`prog-modal-stat-btn stat-rechazado ${filterEstado === 'Rechazado' ? 'active' : ''}`}
              onClick={() => setFilterEstado(prev => prev === 'Rechazado' ? 'TODOS' : 'Rechazado')}
              title="Observaciones rechazadas por calidad"
            >
              <span className="stat-btn-label text-rechazado">✕ Rechazadas</span>
              <span className="stat-btn-val text-rechazado">{stats.rechazadas || 0}</span>
            </button>
          )}
        </div>

        {/* Barra de Búsqueda y Exportación */}
        <div className="prog-modal-search-bar">
          <div className="prog-modal-search-box-wrap">
            <div className="search-input-container">
              <Search size={15} className="search-input-icon" />
              <input
                type="text"
                className="prog-modal-search-input"
                placeholder="Buscar por código, técnico, sitio o revisor..."
                value={searchTable}
                onChange={e => setSearchTable(e.target.value)}
              />
              {searchTable && (
                <button
                  type="button"
                  onClick={() => setSearchTable('')}
                  title="Limpiar búsqueda"
                  className="search-clear-btn"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {searchTable && (
              <span className="search-results-counter">
                {filteredRows.length} resultado(s)
              </span>
            )}
          </div>

          <div className="prog-modal-export-cluster">
            <button
              type="button"
              className={`prog-export-btn prog-export-copy-btn ${copiedPng ? 'copied' : ''}`}
              onClick={handleCopyPNG}
              disabled={exportingPng || filteredRows.length === 0}
              title="Copiar imagen PNG al portapapeles para pegar directamente en WhatsApp o correo (Ctrl+V)"
            >
              {copiedPng ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedPng ? '¡Copiado!' : (exportingPng ? 'Generando...' : 'Copiar PNG')}</span>
            </button>

            <button
              type="button"
              className="prog-export-btn prog-export-png-btn"
              onClick={handleDownloadPNG}
              disabled={exportingPng || filteredRows.length === 0}
              title="Descargar imagen PNG de alta definición"
            >
              <Image size={14} />
              <span>{exportingPng ? 'Generando...' : 'Descargar PNG'}</span>
            </button>

            <button
              type="button"
              className="prog-export-btn prog-export-xlsx-btn"
              onClick={handleExportXLSX}
              disabled={exportingXlsx || filteredRows.length === 0}
              title="Descargar reporte oficial en Excel (.xlsx)"
            >
              <Download size={14} />
              <span>{exportingXlsx ? 'Excel...' : 'Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {/* Cuerpo de la Ventana: Tabla de Avance */}
        <div className="prog-details-modal-body prog-avance-modal-body">
          {loading ? (
            <div className="modal-state-msg">
              <RefreshCw size={24} className="spin" color="#0284c7" />
              <span>Cargando avance y observaciones del {fecha}...</span>
            </div>
          ) : errorMsg ? (
            <div className="modal-state-msg error">{errorMsg}</div>
          ) : filteredRows.length === 0 ? (
            <div className="modal-empty-filter-state">
              <p>
                {searchTable ? (
                  <>No se encontraron registros para <strong>"{searchTable}"</strong>.</>
                ) : (
                  <>No hay observaciones registradas en este estado para el <strong>{fecha}</strong>.</>
                )}
              </p>
              {(searchTable || filterEstado !== 'TODOS') && (
                <div className="empty-filter-actions">
                  {searchTable && (
                    <button type="button" onClick={() => setSearchTable('')} className="btn-reset-filter">
                      Borrar búsqueda
                    </button>
                  )}
                  {filterEstado !== 'TODOS' && (
                    <button type="button" onClick={() => setFilterEstado('TODOS')} className="btn-reset-filter primary">
                      Ver todos ({avanceData.rows?.length || 0})
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Matriz Principal de Cuadrillas y Estados (Diseño idéntico al Dashboard) */}
              <CuadrillasMatrixTable
                icon={<TrendingUp size={18} color="#003060" />}
                title="Resumen Operativo por Cuadrilla"
                subtitle={`Distribución de estados para la jornada ${fecha}`}
                badgeText={`${matrixData.matrixGrandTotal} Obs. Totales`}
                columns={statusColumns}
                rows={matrixData.matrixRows}
                totals={matrixData.matrixTotals}
                grandTotal={matrixData.matrixGrandTotal}
                footLabel="TOTAL DIARIO"
                presentationMode={presentationMode}
                onCellClick={(row, col, count) => {
                  if (count > 0) {
                    if (selectedCellFilter?.cuadrilla === row.cuadrilla && selectedCellFilter?.colKey === col.key) {
                      setSelectedCellFilter(null)
                    } else {
                      setSelectedCellFilter({
                        cuadrilla: row.cuadrilla,
                        colKey: col.key,
                        label: col.label
                      })
                      setShowDetailedList(true)
                    }
                  }
                }}
              />

              {/* Barra de Acceso y Filtro al Desglose Individual */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {selectedCellFilter ? (
                      <>
                        Filtrando detalle por: <strong style={{ color: '#003060' }}>{selectedCellFilter.cuadrilla}</strong> · <strong style={{ color: '#0284c7' }}>{selectedCellFilter.label}</strong> ({displayRows.length} obs.)
                      </>
                    ) : (
                      <span>Desglose unitario de observaciones ({displayRows.length} disponibles)</span>
                    )}
                  </span>
                  {selectedCellFilter && (
                    <button
                      type="button"
                      onClick={() => setSelectedCellFilter(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#e11d48',
                        fontSize: 'var(--text-2xs)',
                        fontWeight: 'var(--fw-bold)',
                        cursor: 'pointer',
                        padding: '0.2rem 0.4rem',
                        textDecoration: 'underline'
                      }}
                    >
                      Quitar filtro
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowDetailedList(prev => !prev)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--fw-semibold)',
                    color: '#003060',
                    cursor: 'pointer'
                  }}
                  title={showDetailedList ? 'Ocultar listado de observaciones' : 'Ver listado de observaciones'}
                >
                  <Eye size={13} />
                  <span>{showDetailedList ? 'Ocultar listado individual' : 'Ver listado individual'}</span>
                  {showDetailedList ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Listado Individual de Observaciones (Desplegable) */}
              {showDetailedList && (
                displayRows.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    No hay observaciones para este filtro específico.
                  </div>
                ) : (
                  <div className="prog-avance-table-wrap">
                    <table className="prog-avance-table">
                      <thead>
                        <tr>
                          <th style={{ width: '120px' }}>CÓD. OBS</th>
                          <th>TÉCNICO / CUADRILLA</th>
                          <th>CÓDIGO DE SITIO · LOCALIDAD</th>
                          <th style={{ width: '130px' }}>ESTADO</th>
                          <th>REVISADO POR</th>
                          <th style={{ width: '48px', textAlign: 'center' }}>VER</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows.map((row, idx) => {
                          const localidad = getLocalidad(row.id_sitio)
                          const resolvedC = resolveCuadrillaForObs(row)
                          return (
                            <tr key={row.id_obs || idx} className="prog-avance-tr">
                              <td>
                                <span className="prog-avance-obs-code">{row.id_obs}</span>
                              </td>
                              <td>
                                <div className="prog-avance-tech-cell">
                                  <User size={13} color="#0284c7" style={{ flexShrink: 0 }} />
                                  <div className="prog-avance-tech-texts">
                                    {!presentationMode && (
                                      <span className="prog-avance-tech-name">{row.tecnico || 'No asignado'}</span>
                                    )}
                                    <span className="prog-avance-tech-cuadrilla">{resolvedC || row.cuadrilla || 'Sin Cuadrilla'}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="prog-avance-site-cell">
                                  <MapPin size={12} color="#0284c7" style={{ flexShrink: 0 }} />
                                  <span className="prog-avance-site-code">{row.id_sitio}</span>
                                  {localidad && (
                                    <span className="prog-avance-site-loc">· {localidad}</span>
                                  )}
                                  {getZona(row.id_sitio) && (
                                    <span className="prog-avance-site-loc" style={{ fontWeight: 'var(--fw-bold)', color: '#0369a1' }}>· {getZona(row.id_sitio)}</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {renderEstadoBadge(row.estado)}
                              </td>
                              <td>
                                <div className="prog-avance-revisor-cell">
                                  {row.estado === 'En Revision' || row.estado === 'En Revisión' ? (
                                    <>
                                      <Clock size={12} color="#0284c7" />
                                      <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: 'var(--text-sm)' }}>
                                        {row.revisor || 'En proceso'}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck size={13} color="#059669" />
                                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                                        {row.revisor || 'Sin revisor'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="prog-avance-row-btn"
                                  title="Ver detalle completo de esta observación"
                                  onClick={() => setSelectedRowDetail(row)}
                                >
                                  <Eye size={13} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Modal Emergente Interno de Detalle Rápido de Observación */}
        {selectedRowDetail && (
          <div className="prog-modal-overlay">
            <div className="prog-modal" style={{ maxWidth: '580px', borderRadius: '12px' }}>
              <div className="prog-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} color="#0284c7" />
                  <h3 style={{ margin: 0, fontSize: 'var(--text-md)', color: '#003060' }}>
                    Detalle de Observación · {selectedRowDetail.id_obs}
                  </h3>
                </div>
                <button
                  type="button"
                  className="prog-modal-close-btn"
                  onClick={() => setSelectedRowDetail(null)}
                  title="Cerrar detalle (Esc)"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="prog-modal-body" style={{ padding: '1rem 1.25rem', gap: '0.75rem' }}>
                <div className="prog-avance-detail-grid">
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">Código de Sitio y Localidad:</span>
                    <strong style={{ color: '#003060', fontSize: 'var(--text-sm)' }}>
                      {selectedRowDetail.id_sitio} {getLocalidad(selectedRowDetail.id_sitio) ? `· ${getLocalidad(selectedRowDetail.id_sitio)}` : ''}{getZona(selectedRowDetail.id_sitio) ? ` · ${getZona(selectedRowDetail.id_sitio)}` : ''}
                    </strong>
                  </div>
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">{presentationMode ? 'Cuadrilla Asignada:' : 'Técnico Asignado:'}</span>
                    <span style={{ color: '#1e293b', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}>
                      {presentationMode
                        ? (selectedRowDetail.cuadrilla || 'Sin Cuadrilla')
                        : `${selectedRowDetail.tecnico} ${selectedRowDetail.cuadrilla ? `(${selectedRowDetail.cuadrilla})` : ''}`}
                    </span>
                  </div>
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">Estado:</span>
                    <div>{renderEstadoBadge(selectedRowDetail.estado)}</div>
                  </div>
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">Revisado Por:</span>
                    <span style={{ color: '#003060', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}>
                      {selectedRowDetail.revisor || 'Sin revisor'}
                    </span>
                  </div>
                </div>

                {selectedRowDetail.detalle && (
                  <div className="obs-content-box box-detalle" style={{ marginTop: '0.4rem' }}>
                    <span className="box-label">Detalle de la Observación:</span>
                    <div className="box-body-text">{selectedRowDetail.detalle}</div>
                  </div>
                )}

                {(selectedRowDetail.subsistema || selectedRowDetail.protocolo) && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: 'var(--text-xs)', color: '#64748b', marginTop: '0.2rem' }}>
                    {selectedRowDetail.protocolo && (
                      <span className="meta-pill">Protocolo: <strong>{selectedRowDetail.protocolo}</strong></span>
                    )}
                    {selectedRowDetail.subsistema && (
                      <span className="meta-pill">Subsistema: <strong>{selectedRowDetail.subsistema}</strong></span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
