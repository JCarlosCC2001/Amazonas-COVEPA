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
import { supabase } from '../../lib/supabase'
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
  const [cuadrillaStaffMap, setCuadrillaStaffMap] = useState({})

  // Cargar asignaciones oficiales actualizadas de personal_cuadrillas desde la base de datos
  useEffect(() => {
    let isMounted = true
    const loadCuadrillaStaff = async () => {
      try {
        const { data, error } = await supabase
          .from('personal_cuadrillas')
          .select('cuadrilla, nombre_completo, cargo')
          .eq('activo', true)

        if (error) {
          console.warn('Error cargando personal_cuadrillas en ModalAvanceDia:', error.message)
          return
        }

        if (isMounted && data && data.length > 0) {
          const map = {}
          data.forEach(row => {
            const cClean = String(row.cuadrilla || '').toUpperCase().trim()
            const cargo = (row.cargo || '').toUpperCase()
            const isTec = cargo.includes('TECN') || cargo.includes('SUPERV') || !cargo.includes('CONDUCT')
            if (isTec && row.nombre_completo) {
              map[cClean] = formatNombrePersona(row.nombre_completo)
            }
          })
          setCuadrillaStaffMap(map)
        }
      } catch (err) {
        console.warn('Error en loadCuadrillaStaff:', err)
      }
    }
    loadCuadrillaStaff()
    return () => { isMounted = false }
  }, [])

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
    // 1. Prioridad por sitio oficial en el catálogo maestro
    const siteId = obs.id_sitio
    const asig = ASIGNACIONES_BASE.find(s => s.id_site === siteId) || sitiosMap[siteId]
    if (asig?.grupo) {
      const gClean = String(asig.grupo).toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
      const match = gClean.match(/CUADRILLA\s*([1-6])/)
      if (match) return `CUADRILLA ${match[1]}`
    }

    // 2. Prioridad por cuadrilla explícita en la observación
    if (obs.cuadrilla) {
      const cClean = String(obs.cuadrilla).toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
      const match = cClean.match(/CUADRILLA\s*([1-6])/)
      if (match) return `CUADRILLA ${match[1]}`
    }

    // 3. Prioridad por nombre del técnico
    if (obs.tecnico) {
      const tClean = String(obs.tecnico).toUpperCase().trim()
      for (const [cName, tecNom] of Object.entries(cuadrillaStaffMap)) {
        if (tecNom && tClean.includes(tecNom.toUpperCase())) {
          return cName
        }
      }
      for (const [cName, cfg] of Object.entries(DEFAULT_CUADRILLAS_CONFIG)) {
        if (cfg.tecnicoNombre && tClean.includes(cfg.tecnicoNombre.toUpperCase())) {
          return cName
        }
      }
    }

    return 'CUADRILLA 1'
  }, [sitiosMap, cuadrillaStaffMap])

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
    },
    {
      key: 'documentacion',
      label: 'Documentación',
      badgeVariant: 'purple',
      title: 'Observaciones en recopilación técnica de documentación'
    }
  ], [])

  // Consolidación de datos matriciales agrupados por Equipos (3 Equipos x Estados)
  // Regla de Negocio: Equipo 1 = Cuadrilla 1 y 2, Equipo 2 = Cuadrilla 3 y 6, Equipo 3 = Cuadrilla 4 y 5
  const matrixData = useMemo(() => {
    const rows = avanceData.rows || []

    const getCuadrillaTecnico = (cName) => {
      return cuadrillaStaffMap[cName] ||
        DEFAULT_CUADRILLAS_CONFIG[cName]?.tecnicoNombre ||
        ''
    }

    const tecC1 = getCuadrillaTecnico('CUADRILLA 1')
    const tecC2 = getCuadrillaTecnico('CUADRILLA 2')
    const tecC3 = getCuadrillaTecnico('CUADRILLA 3')
    const tecC4 = getCuadrillaTecnico('CUADRILLA 4')
    const tecC5 = getCuadrillaTecnico('CUADRILLA 5')
    const tecC6 = getCuadrillaTecnico('CUADRILLA 6')

    const equiposMap = {
      'EQUIPO 1': {
        id: 'EQUIPO 1',
        cuadrilla: 'EQUIPO 1',
        subtitulo: 'Cuadrilla 1 y 2',
        tecnico: [tecC1, tecC2].filter(Boolean).join(' · ') || 'Técnicos Equipo 1',
        values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0, documentacion: 0 },
        total: 0
      },
      'EQUIPO 2': {
        id: 'EQUIPO 2',
        cuadrilla: 'EQUIPO 2',
        subtitulo: 'Cuadrilla 3 y 6',
        tecnico: [tecC3, tecC6].filter(Boolean).join(' · ') || 'Técnicos Equipo 2',
        values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0, documentacion: 0 },
        total: 0
      },
      'EQUIPO 3': {
        id: 'EQUIPO 3',
        cuadrilla: 'EQUIPO 3',
        subtitulo: 'Cuadrilla 4 y 5',
        tecnico: [tecC4, tecC5].filter(Boolean).join(' · ') || 'Técnicos Equipo 3',
        values: { solicitando: 0, enRevision: 0, rechazados: 0, validados: 0, documentacion: 0 },
        total: 0
      }
    }

    rows.forEach(r => {
      const targetCuadrilla = resolveCuadrillaForObs(r)
      let targetEquipoKey = 'EQUIPO 1'
      if (targetCuadrilla === 'CUADRILLA 1' || targetCuadrilla === 'CUADRILLA 2') {
        targetEquipoKey = 'EQUIPO 1'
      } else if (targetCuadrilla === 'CUADRILLA 3' || targetCuadrilla === 'CUADRILLA 6') {
        targetEquipoKey = 'EQUIPO 2'
      } else if (targetCuadrilla === 'CUADRILLA 4' || targetCuadrilla === 'CUADRILLA 5') {
        targetEquipoKey = 'EQUIPO 3'
      }

      const targetObj = equiposMap[targetEquipoKey]
      if (targetObj) {
        const rawSt = (r.estado || '').trim().toLowerCase()
        if (rawSt === 'solicitando revisión' || rawSt === 'solicitando revision') {
          targetObj.values.solicitando++
        } else if (rawSt === 'en revisión' || rawSt === 'en revision') {
          targetObj.values.enRevision++
        } else if (rawSt === 'rechazado' || rawSt === 'rechazada' || rawSt === 'rechazados') {
          targetObj.values.rechazados++
        } else if (rawSt === 'validado' || rawSt === 'validada' || rawSt === 'enviado' || rawSt === 'enviada') {
          targetObj.values.validados++
        } else if (rawSt === 'documentación' || rawSt === 'documentacion') {
          targetObj.values.documentacion++
        }
      }
    })

    const matrixRowsList = Object.values(equiposMap).map(row => ({
      ...row,
      total: row.values.solicitando + row.values.enRevision + row.values.rechazados + row.values.validados + row.values.documentacion
    }))

    const totalsObj = {
      solicitando: matrixRowsList.reduce((acc, r) => acc + r.values.solicitando, 0),
      enRevision: matrixRowsList.reduce((acc, r) => acc + r.values.enRevision, 0),
      rechazados: matrixRowsList.reduce((acc, r) => acc + r.values.rechazados, 0),
      validados: matrixRowsList.reduce((acc, r) => acc + r.values.validados, 0),
      documentacion: matrixRowsList.reduce((acc, r) => acc + r.values.documentacion, 0)
    }

    const grandTotalNum = totalsObj.solicitando + totalsObj.enRevision + totalsObj.rechazados + totalsObj.validados + totalsObj.documentacion

    return {
      matrixRows: matrixRowsList,
      matrixTotals: totalsObj,
      matrixGrandTotal: grandTotalNum
    }
  }, [avanceData.rows, resolveCuadrillaForObs, cuadrillaStaffMap])

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

      // Hoja 1: Matriz Ejecutiva por Equipos (Cuadrillas 1+2, 3+6, 4+5)
      const wsMatriz = workbook.addWorksheet('Matriz_Equipos', {
        views: [{ showGridLines: true }]
      })

      const matrixTableRows = matrixData.matrixRows.map(r => [
        r.cuadrilla,
        r.subtitulo || '',
        r.tecnico,
        r.values.solicitando || 0,
        r.values.enRevision || 0,
        r.values.rechazados || 0,
        r.values.validados || 0,
        r.values.documentacion || 0,
        r.total || 0
      ])

      // Fila de Total Diario
      matrixTableRows.push([
        'TOTAL DIARIO',
        '',
        '',
        matrixData.matrixTotals.solicitando || 0,
        matrixData.matrixTotals.enRevision || 0,
        matrixData.matrixTotals.rechazados || 0,
        matrixData.matrixTotals.validados || 0,
        matrixData.matrixTotals.documentacion || 0,
        matrixData.matrixGrandTotal || 0
      ])

      wsMatriz.addTable({
        name: `Matriz_Equipos_${fecha.replace(/-/g, '_')}`,
        ref: 'A1',
        headerRow: true,
        totalsRow: false,
        style: {
          theme: 'TableStyleMedium9',
          showRowStripes: true,
          showColumnStripes: false
        },
        columns: [
          { name: 'EQUIPO', filterButton: true },
          { name: 'INTEGRANTES', filterButton: true },
          { name: 'TÉCNICOS RESPONSABLES', filterButton: true },
          { name: 'SOLICITANDO REVISIÓN', filterButton: true },
          { name: 'EN REVISIÓN', filterButton: true },
          { name: 'RECHAZADOS', filterButton: true },
          { name: 'VALIDADOS', filterButton: true },
          { name: 'DOCUMENTACIÓN', filterButton: true },
          { name: 'TOTAL DIARIO', filterButton: true }
        ],
        rows: matrixTableRows
      })

      const matrixColWidths = [16, 20, 32, 24, 18, 16, 16, 18, 18]
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
            horizontal: colNumber <= 3 ? 'left' : 'center'
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

  // Copiar imagen PNG del cuadro de resumen por cuadrillas al portapapeles
  const handleCopyPNG = async () => {
    if (exportingPng) return
    setExportingPng(true)
    try {
      const { copyAvanceDiaPNG } = await import('../../services/imageExportService')
      const res = await copyAvanceDiaPNG({
        fecha,
        formattedDate,
        rows: avanceData.rows || [],
        stats,
        matrixData,
        statusColumns,
        presentationMode,
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

  // Descargar imagen PNG del cuadro de resumen por cuadrillas
  const handleDownloadPNG = async () => {
    if (exportingPng) return
    setExportingPng(true)
    try {
      const { downloadAvanceDiaPNG } = await import('../../services/imageExportService')
      await downloadAvanceDiaPNG({
        fecha,
        formattedDate,
        rows: avanceData.rows || [],
        stats,
        matrixData,
        statusColumns,
        presentationMode,
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

          {(stats.documentacion || 0) > 0 && (
            <button
              type="button"
              className={`prog-modal-stat-btn stat-documentacion ${filterEstado === 'Documentación' ? 'active' : ''}`}
              onClick={() => setFilterEstado(prev => prev === 'Documentación' ? 'TODOS' : 'Documentación')}
              title="Observaciones en recopilación técnica de documentación"
            >
              <span className="stat-btn-label text-documentacion">📑 Documentación</span>
              <span className="stat-btn-val text-documentacion">{stats.documentacion || 0}</span>
            </button>
          )}
        </div>

        {/* Barra de Acciones y Exportación */}
        <div className="prog-modal-search-bar" style={{ justifyContent: 'flex-end', borderBottom: 'none', padding: '0.5rem 0' }}>
          <div className="prog-modal-export-cluster">
            <button
              type="button"
              className={`prog-export-btn prog-export-copy-btn ${copiedPng ? 'copied' : ''}`}
              onClick={handleCopyPNG}
              disabled={exportingPng || (matrixData.matrixGrandTotal === 0 && (!avanceData.rows || avanceData.rows.length === 0))}
              title="Copiar imagen del cuadro de resumen por equipos al portapapeles para WhatsApp o correo (Ctrl+V)"
            >
              {copiedPng ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedPng ? '¡Copiado!' : (exportingPng ? 'Generando...' : 'Copiar PNG')}</span>
            </button>

            <button
              type="button"
              className="prog-export-btn prog-export-png-btn"
              onClick={handleDownloadPNG}
              disabled={exportingPng || (matrixData.matrixGrandTotal === 0 && (!avanceData.rows || avanceData.rows.length === 0))}
              title="Descargar imagen PNG del cuadro de resumen por equipos de alta definición"
            >
              <Image size={14} />
              <span>{exportingPng ? 'Generando...' : 'Descargar PNG'}</span>
            </button>

            <button
              type="button"
              className="prog-export-btn prog-export-xlsx-btn"
              onClick={handleExportXLSX}
              disabled={exportingXlsx || (matrixData.matrixGrandTotal === 0 && (!avanceData.rows || avanceData.rows.length === 0))}
              title="Descargar reporte oficial en Excel (.xlsx)"
            >
              <Download size={14} />
              <span>{exportingXlsx ? 'Excel...' : 'Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {/* Cuerpo de la Ventana: Cuadro de Avance Operativo por Equipos */}
        <div className="prog-details-modal-body prog-avance-modal-body">
          {loading ? (
            <div className="modal-state-msg">
              <RefreshCw size={24} className="spin" color="#0284c7" />
              <span>Cargando avance y observaciones del {fecha}...</span>
            </div>
          ) : errorMsg ? (
            <div className="modal-state-msg error">{errorMsg}</div>
          ) : matrixData.matrixGrandTotal === 0 && (!avanceData.rows || avanceData.rows.length === 0) ? (
            <div className="modal-empty-filter-state">
              <p>No hay observaciones registradas para el <strong>{fecha}</strong>.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Matriz Principal Ejecutiva por Equipos (Equipo 1: C1+C2, Equipo 2: C3+C6, Equipo 3: C4+C5) */}
              <CuadrillasMatrixTable
                icon={<TrendingUp size={18} color="#003060" />}
                title="Resumen Operativo por Equipos"
                subtitle={`Distribución consolidada por equipos para la jornada ${formattedDate || fecha}`}
                badgeText={`${matrixData.matrixGrandTotal} Obs. Totales`}
                groupColumnLabel="Equipo"
                techColumnLabel="Técnicos"
                columns={statusColumns}
                rows={matrixData.matrixRows}
                totals={matrixData.matrixTotals}
                grandTotal={matrixData.matrixGrandTotal}
                footLabel="TOTAL DIARIO"
                presentationMode={presentationMode}
              />
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
