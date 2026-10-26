import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar, RefreshCw, CheckCircle2, Clock, AlertTriangle,
  XCircle, Send, Check, Search, Download,
  MapPin, User, Users, ShieldCheck, ChevronLeft, ChevronRight,
  TrendingUp, Award, Layers, Eye
} from 'lucide-react'
import { getAvancePorFecha, getGlobalMetrics } from '../services/dashboardService'
import ExcelJS from 'exceljs'

// Helper para formato de fecha local YYYY-MM-DD
function getTodayLocalDate() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getYesterdayLocalDate() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return d.toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Subcomponente: Medidor Circular / Radial Segmentado SVG
function MultiSegmentRadialGauge({ segments = [], total = 0, size = 120, strokeWidth = 10, centerValue, centerLabel, centerSublabel }) {
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const effectiveTotal = total > 0 ? total : 0
  
  let accumulated = 0
  const renderedSegments = segments.map((seg) => {
    const val = Math.max(0, seg.value || 0)
    const segLength = effectiveTotal > 0 ? (val / effectiveTotal) * circumference : 0
    const offset = effectiveTotal > 0 ? (accumulated / effectiveTotal) * circumference : 0
    accumulated += val
    return { ...seg, val, segLength, offset }
  })

  return (
    <div className="dash-radial-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="dash-gauge-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(0, 48, 96, 0.08)"
          strokeWidth={strokeWidth}
        />
        {effectiveTotal > 0 && renderedSegments.map((seg, i) => {
          if (seg.val <= 0) return null
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.segLength} ${circumference}`}
              strokeDashoffset={-seg.offset}
              style={{
                transition: 'stroke-dashoffset 0.8s ease-in-out',
                transform: 'rotate(-90deg)',
                transformOrigin: '50% 50%'
              }}
            />
          )
        })}
      </svg>
      <div className="dash-gauge-content">
        <span className="dash-gauge-value" style={{ color: '#003060' }}>{centerValue}</span>
        {centerLabel && <span className="dash-gauge-label">{centerLabel}</span>}
        {centerSublabel && <span className="dash-gauge-sublabel">{centerSublabel}</span>}
      </div>
    </div>
  )
}

// Subcomponente: Medidor Semicircular de Tacómetro
function SemicircleGauge({ percentage = 0, color = '#10b981', size = 160 }) {
  const radius = 60
  const strokeWidth = 12
  const circumference = Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference

  return (
    <div className="dash-semi-gauge" style={{ width: size, height: size / 2 + 35 }}>
      <svg width={size} height={size / 2 + 15} viewBox="0 0 160 90">
        <path
          d="M 20 80 A 60 60 0 0 1 140 80"
          fill="none"
          stroke="rgba(0, 48, 96, 0.08)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d="M 20 80 A 60 60 0 0 1 140 80"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="dash-semi-text">
        <span className="dash-semi-pct" style={{ color }}>{percentage}%</span>
        <span className="dash-semi-label">Avance Global</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  // Siempre se inicia en la fecha actual por defecto
  const [selectedFecha, setSelectedFecha] = useState(() => getTodayLocalDate())
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // Datos
  const [avanceData, setAvanceData] = useState({ rows: [], stats: {}, programacionesDelDia: 0 })
  const [globalMetrics, setGlobalMetrics] = useState({
    total: 0,
    validadas: 0,
    enRevision: 0,
    descartadas: 0,
    enviadas: 0,
    rechazadas: 0,
    resueltas: 0,
    pendientes: 0,
    porcentajeGlobal: 0
  })

  // Filtros de tabla
  const [searchTable, setSearchTable] = useState('')
  const [filterEstado, setFilterEstado] = useState('TODOS')
  const [selectedRowDetail, setSelectedRowDetail] = useState(null)

  // Cerrar modal de detalle rápido con tecla Escape
  useEffect(() => {
    if (!selectedRowDetail) return
    const handleKeyDown = e => {
      if (e.key === 'Escape') setSelectedRowDetail(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedRowDetail])

  // Carga reactiva de datos por fecha
  const loadData = useCallback(async (fecha) => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [avanceRes, globalRes] = await Promise.all([
        getAvancePorFecha(fecha),
        getGlobalMetrics()
      ])
      setAvanceData(avanceRes)
      setGlobalMetrics(globalRes)
    } catch (err) {
      console.error('Error cargando datos del dashboard:', err)
      setErrorMsg(err.message || 'Error al conectar con la base de datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(selectedFecha)
  }, [selectedFecha, loadData])

  const stats = avanceData.stats || {}
  const totalEnFecha = stats.total || 0
  const todayStr = getTodayLocalDate()
  const isToday = selectedFecha === todayStr
  const isYesterday = selectedFecha === getYesterdayLocalDate()

  // Navegación de fecha con flechas
  const changeDateBy = (offsetDays) => {
    const parts = selectedFecha.split('-')
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    d.setDate(d.getDate() + offsetDays)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setSelectedFecha(`${year}-${month}-${day}`)
  }

  // Filtrado de la tabla de avance de la fecha seleccionada
  const filteredRows = useMemo(() => {
    const q = searchTable.toLowerCase().trim()
    return (avanceData.rows || []).filter(r => {
      let matchEstado = true
      if (filterEstado === 'TODOS') {
        matchEstado = true
      } else if (filterEstado === 'ENVIADAS_VALIDADAS') {
        matchEstado = r.estado === 'Validado' || r.estado === 'Enviado'
      } else {
        matchEstado = r.estado === filterEstado
      }

      const matchSearch =
        !q ||
        r.id_obs.toLowerCase().includes(q) ||
        r.id_sitio.toLowerCase().includes(q) ||
        (r.tecnico && r.tecnico.toLowerCase().includes(q)) ||
        (r.revisor && r.revisor.toLowerCase().includes(q)) ||
        (r.cuadrilla && r.cuadrilla.toLowerCase().includes(q))

      return matchEstado && matchSearch
    })
  }, [avanceData.rows, filterEstado, searchTable])

  // Exportar tabla nativa a Excel (.xlsx) con Formato de Tabla (Table Design)
  const handleExportXLSX = async () => {
    if (filteredRows.length === 0) return

    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'COVEPA ERP'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet('Avance_COVEPA', {
        views: [{ showGridLines: true }]
      })

      // Construir filas de datos
      const tableRows = filteredRows.map((r, idx) => [
        idx + 1,
        r.id_obs || '',
        r.tecnico || 'No asignado',
        r.cuadrilla || 'Apoyo rotativo',
        r.id_sitio || '',
        r.estado || '',
        r.revisor || 'Sin revisor',
        r.fecha_subsanacion ? String(r.fecha_subsanacion).slice(0, 10) : ''
      ])

      // Añadir Tabla Oficial de Excel con estilo nativo (filtros y filas alternadas)
      worksheet.addTable({
        name: 'TablaAvanceCOVEPA',
        ref: 'A1',
        headerRow: true,
        totalsRow: false,
        style: {
          theme: 'TableStyleMedium9', // Estilo azul formal clásico de tabla de Excel con zebra striping
          showRowStripes: true,
          showColumnStripes: false
        },
        columns: [
          { name: '#', filterButton: true },
          { name: 'CÓD. OBSERVACIÓN', filterButton: true },
          { name: 'NOMBRE DE TÉCNICO', filterButton: true },
          { name: 'CUADRILLA', filterButton: true },
          { name: 'CÓDIGO DE SITIO', filterButton: true },
          { name: 'ESTADO', filterButton: true },
          { name: 'REVISADO POR', filterButton: true },
          { name: 'FECHA DE REVISIÓN', filterButton: true }
        ],
        rows: tableRows
      })

      // Anchos de columna óptimos
      const colWidths = [6, 22, 28, 18, 18, 16, 24, 18]
      colWidths.forEach((w, i) => {
        worksheet.getColumn(i + 1).width = w
      })

      // Altura de filas y alineación
      worksheet.eachRow((row, rowNumber) => {
        row.height = rowNumber === 1 ? 24 : 20
        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 || colNumber === 5 || colNumber === 6 || colNumber === 8 ? 'center' : 'left'
          }
        })
      })

      // Generar buffer y descargar
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Avance_COVEPA_${selectedFecha}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error generando archivo Excel:', err)
      alert('Error al generar el archivo Excel: ' + err.message)
    }
  }

  // Helper para badges de estado
  const renderEstadoBadge = (estado) => {
    switch (estado) {
      case 'Validado':
        return <span className="dash-badge badge-validado"><CheckCircle2 size={12} /> Validado</span>
      case 'En Revisión':
      case 'En Revision':
        return <span className="dash-badge badge-revision"><Clock size={12} /> En Revisión</span>
      case 'Enviado':
        return <span className="dash-badge badge-enviado"><Send size={12} /> Enviado</span>
      case 'Descartado':
        return <span className="dash-badge badge-descartado"><Check size={12} /> Descartado</span>
      case 'Rechazado':
        return <span className="dash-badge badge-rechazado"><XCircle size={12} /> Rechazado</span>
      default:
        return <span className="dash-badge badge-pendiente"><AlertTriangle size={12} /> {estado}</span>
    }
  }

  return (
    <div className="dash-page-container">
      {/* ── HEADER DEL DASHBOARD CON REVISIÓN POR FECHA ── */}
      <div className="dash-header-card">
        <div className="dash-header-title-box">
          <div className="dash-header-badge">
            <span className="dash-live-dot" />
            <span>OPERACIONES COVEPA EN VIVO</span>
          </div>
          <h1 className="dash-main-title">Dashboard de Levantamiento de Observaciones</h1>
          <p className="dash-main-sub">
            Monitoreo en tiempo real del avance en campo, control de revisiones y métricas de desempeño por cuadrilla.
          </p>
        </div>

        {/* Controles de Navegación por Fecha (Siempre hoy por defecto) */}
        <div className="dash-header-controls">
          <div className="dash-date-picker-box">
            <button
              type="button"
              className="dash-date-nav-btn"
              onClick={() => changeDateBy(-1)}
              title="Día anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <Calendar size={15} color="#818cf8" style={{ marginLeft: '2px' }} />
            <input
              type="date"
              className="dash-date-input"
              value={selectedFecha}
              onChange={e => setSelectedFecha(e.target.value)}
              title="Seleccionar fecha a revisar"
            />

            <button
              type="button"
              className="dash-date-nav-btn"
              onClick={() => changeDateBy(1)}
              title="Día siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Botones de Acceso Rápido: Hoy y Ayer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              className={`dash-btn-today ${isToday ? 'active' : ''}`}
              onClick={() => setSelectedFecha(todayStr)}
            >
              Hoy
            </button>
            <button
              type="button"
              className={`dash-btn-today ${isYesterday ? 'active' : ''}`}
              onClick={() => setSelectedFecha(getYesterdayLocalDate())}
            >
              Ayer
            </button>
          </div>

          <button
            type="button"
            className={`dash-refresh-btn ${loading ? 'is-spinning' : ''}`}
            onClick={() => loadData(selectedFecha)}
            disabled={loading}
            title="Actualizar datos de la fecha seleccionada"
          >
            <RefreshCw size={15} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="dash-error-banner">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── SECCIÓN DE MEDIDORES Y GAUGES ── */}
      <div className="dash-metrics-section">
        {/* Medidor 1: Total Avanzado en la Fecha */}
        <div className="dash-metric-card primary-gauge">
          <div className="dash-card-header">
            <span className="dash-card-tag">{isToday ? 'AVANCE DE HOY' : 'AVANCE EN LA FECHA'}</span>
            <TrendingUp size={16} color="#818cf8" />
          </div>
          <div className="dash-card-gauge-wrap">
            <MultiSegmentRadialGauge
              segments={[
                { value: (stats.enviadas || 0) + (stats.validadas || 0), color: '#10b981' },
                { value: stats.rechazadas || 0, color: '#ef4444' },
                { value: stats.enRevision || 0, color: '#38bdf8' },
                { value: stats.descartadas || 0, color: '#94a3b8' }
              ]}
              total={totalEnFecha}
              centerValue={totalEnFecha}
              centerLabel="Total Obs"
              centerSublabel={isToday ? 'Hoy' : selectedFecha}
              size={120}
              strokeWidth={10}
            />
            <div className="dash-gauge-legend">
              {/* 1. Enviadas/Validadas */}
              <div
                className="dash-legend-row"
                style={{ cursor: 'pointer' }}
                onClick={() => setFilterEstado(filterEstado === 'ENVIADAS_VALIDADAS' ? 'TODOS' : 'ENVIADAS_VALIDADAS')}
                title="Filtrar enviadas y validadas"
              >
                <span className="dash-legend-dot" style={{ background: '#10b981' }} />
                <span className="dash-legend-name">Enviadas/Validadas:</span>
                <strong style={{ color: '#10b981' }}>
                  {(stats.enviadas || 0) + (stats.validadas || 0)}
                  <span style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: 500, marginLeft: '3px' }}>
                    ({stats.enviadas || 0} env / {stats.validadas || 0} val)
                  </span>
                </strong>
              </div>

              {/* 2. Rechazadas */}
              <div
                className="dash-legend-row"
                style={{ cursor: 'pointer' }}
                onClick={() => setFilterEstado(filterEstado === 'Rechazado' ? 'TODOS' : 'Rechazado')}
                title="Filtrar rechazadas"
              >
                <span className="dash-legend-dot" style={{ background: '#ef4444' }} />
                <span className="dash-legend-name">Rechazadas:</span>
                <strong style={{ color: (stats.rechazadas || 0) > 0 ? '#ef4444' : '#f1f5f9' }}>
                  {stats.rechazadas || 0}
                </strong>
              </div>

              {/* 3. En revision */}
              <div
                className="dash-legend-row"
                style={{ cursor: 'pointer' }}
                onClick={() => setFilterEstado(filterEstado === 'En Revisión' ? 'TODOS' : 'En Revisión')}
                title="Filtrar en revisión"
              >
                <span className="dash-legend-dot" style={{ background: '#38bdf8' }} />
                <span className="dash-legend-name">En revision:</span>
                <strong style={{ color: (stats.enRevision || 0) > 0 ? '#38bdf8' : '#f1f5f9' }}>
                  {stats.enRevision || 0}
                </strong>
              </div>

              {/* 4. Descartadas */}
              <div
                className="dash-legend-row"
                style={{ cursor: 'pointer' }}
                onClick={() => setFilterEstado(filterEstado === 'Descartado' ? 'TODOS' : 'Descartado')}
                title="Filtrar descartadas"
              >
                <span className="dash-legend-dot" style={{ background: '#94a3b8' }} />
                <span className="dash-legend-name">Descartadas:</span>
                <strong>{stats.descartadas || 0}</strong>
              </div>
            </div>
          </div>
          <div className="dash-card-footer">
            <span>{formatDateDisplay(selectedFecha)}</span>
          </div>
        </div>

        {/* Medidor 2: Enviadas / Validadas */}
        <div
          className={`dash-metric-card green-card ${filterEstado === 'ENVIADAS_VALIDADAS' ? 'active-filter' : ''}`}
          onClick={() => setFilterEstado(prev => (prev === 'ENVIADAS_VALIDADAS' ? 'TODOS' : 'ENVIADAS_VALIDADAS'))}
          style={{ cursor: 'pointer' }}
          title="Haz clic para ver las observaciones enviadas y validadas"
        >
          <div className="dash-card-header">
            <span className="dash-card-tag" style={{ color: '#10b981' }}>ENVIADAS / VALIDADAS</span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div className="dash-card-stat-main">
            <span className="dash-stat-big-num" style={{ color: '#10b981' }}>
              {(stats.enviadas || 0) + (stats.validadas || 0)}
            </span>
            <span className="dash-stat-unit">obs.</span>
          </div>
          <div className="dash-progress-track">
            <div
              className="dash-progress-fill"
              style={{
                width: `${totalEnFecha > 0 ? (((stats.enviadas || 0) + (stats.validadas || 0)) / totalEnFecha) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #10b981, #34d399)'
              }}
            />
          </div>
          <div className="dash-card-subinfo">
            <span>{stats.validadas || 0} validadas · {stats.enviadas || 0} enviadas</span>
            <strong>{totalEnFecha > 0 ? ((((stats.enviadas || 0) + (stats.validadas || 0)) / totalEnFecha) * 100).toFixed(0) : 0}%</strong>
          </div>
        </div>

        {/* Medidor 3: En Revisión */}
        <div
          className={`dash-metric-card blue-card ${filterEstado === 'En Revisión' ? 'active-filter' : ''}`}
          onClick={() => setFilterEstado(prev => (prev === 'En Revisión' ? 'TODOS' : 'En Revisión'))}
          style={{ cursor: 'pointer' }}
          title="Haz clic para ver las observaciones y sitios en revisión"
        >
          <div className="dash-card-header">
            <span className="dash-card-tag" style={{ color: '#38bdf8' }}>EN REVISIÓN</span>
            <Clock size={16} color="#38bdf8" />
          </div>
          <div className="dash-card-stat-main">
            <span className="dash-stat-big-num" style={{ color: '#38bdf8' }}>{stats.enRevision || 0}</span>
            <span className="dash-stat-unit">obs.</span>
            {stats.totalSitiosEnRevision > 0 && (
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginLeft: '0.45rem', fontWeight: 600 }}>
                ({stats.totalSitiosEnRevision} {stats.totalSitiosEnRevision === 1 ? 'sitio' : 'sitios'})
              </span>
            )}
          </div>
          <div className="dash-progress-track">
            <div
              className="dash-progress-fill"
              style={{
                width: `${totalEnFecha > 0 ? ((stats.enRevision || 0) / totalEnFecha) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #38bdf8, #60a5fa)'
              }}
            />
          </div>
          <div className="dash-card-subinfo">
            <span>{stats.totalSitiosEnRevision > 0 ? `${stats.totalSitiosEnRevision} sitios en revisión técnica` : 'Pendientes de confirmación'}</span>
            <strong>{totalEnFecha > 0 ? (((stats.enRevision || 0) / totalEnFecha) * 100).toFixed(0) : 0}%</strong>
          </div>
        </div>

        {/* Medidor 4: Cobertura Operativa de la Fecha */}
        <div className="dash-metric-card purple-card">
          <div className="dash-card-header">
            <span className="dash-card-tag" style={{ color: '#c084fc' }}>COBERTURA OPERATIVA</span>
            <MapPin size={16} color="#c084fc" />
          </div>
          <div className="dash-dual-stats">
            <div className="dash-dual-item">
              <span className="dash-dual-num" style={{ color: '#c084fc' }}>{stats.sitiosUnicos || 0}</span>
              <span className="dash-dual-label">Sitios Intervenidos</span>
            </div>
            <div className="dash-dual-divider" />
            <div className="dash-dual-item">
              <span className="dash-dual-num" style={{ color: '#818cf8' }}>{stats.tecnicosUnicos || 0}</span>
              <span className="dash-dual-label">Técnicos Activos</span>
            </div>
          </div>
          <div className="dash-card-subinfo" style={{ marginTop: '0.4rem' }}>
            <span>{avanceData.programacionesDelDia} jornadas programadas</span>
            <Users size={13} color="#94a3b8" />
          </div>
        </div>

        {/* Medidor 5: Tacómetro Global del Proyecto */}
        <div className="dash-metric-card global-gauge-card">
          <div className="dash-card-header">
            <span className="dash-card-tag">PROGRESO PROYECTO</span>
            <Award size={16} color="#fbbf24" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-0.3rem' }}>
            <SemicircleGauge percentage={globalMetrics.porcentajeGlobal} color="#10b981" size={150} />
          </div>
          <div className="dash-global-stats-bar">
            <div>
              <small>Total Obs:</small>
              <strong>{globalMetrics.total.toLocaleString()}</strong>
            </div>
            <div>
              <small>Resueltas:</small>
              <strong style={{ color: '#10b981' }}>{globalMetrics.resueltas.toLocaleString()}</strong>
            </div>
            <div>
              <small>Pendientes:</small>
              <strong style={{ color: '#fbbf24' }}>{globalMetrics.pendientes.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABLA PRINCIPAL: AVANCE DE LA FECHA SELECCIONADA ── */}
      <div className="dash-table-container">
        {/* Cabecera y Herramientas de la Tabla */}
        <div className="dash-table-header">
          <div className="dash-table-title-area">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Layers size={18} color="#818cf8" />
              <h2 className="dash-table-title">Avance del Día</h2>
              <span className="dash-table-count-badge">
                {filteredRows.length} {filteredRows.length === 1 ? 'registro' : 'registros'}
              </span>
              {isToday && (
                <span className="dash-today-tag">● Fecha actual (Hoy)</span>
              )}
            </div>
            <p className="dash-table-subtitle">
              Observaciones con fecha de revisión o en proceso de revisión técnica para el <strong>{formatDateDisplay(selectedFecha)}</strong>
            </p>
          </div>

          <div className="dash-table-actions">
            {/* Buscador reactivo */}
            <div className="dash-search-box">
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Buscar por técnico, sitio o revisor..."
                value={searchTable}
                onChange={e => setSearchTable(e.target.value)}
              />
              {searchTable && (
                <button type="button" onClick={() => setSearchTable('')} className="dash-clear-search">
                  ✕
                </button>
              )}
            </div>

            {/* Botón de Exportar a Excel (.xlsx) */}
            <button
              type="button"
              className="dash-export-btn"
              onClick={handleExportXLSX}
              disabled={filteredRows.length === 0}
              title="Descargar este reporte en formato Excel (.xlsx)"
            >
              <Download size={14} />
              <span>Exportar Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros Rápidos por Estado */}
        <div className="dash-filters-strip">
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filtrar estado:</span>
          {[
            { id: 'TODOS', label: 'Todos', count: avanceData.rows.length },
            {
              id: 'ENVIADAS_VALIDADAS',
              label: 'Enviadas/Validadas',
              count: `${(stats.enviadas || 0) + (stats.validadas || 0)} (${stats.enviadas || 0} env · ${stats.validadas || 0} val)`,
              color: '#10b981'
            },
            { id: 'Rechazado', label: 'Rechazadas', count: stats.rechazadas || 0, color: '#ef4444' },
            {
              id: 'En Revisión',
              label: 'En revision',
              count: stats.totalSitiosEnRevision
                ? `${stats.enRevision || 0} (${stats.totalSitiosEnRevision} sit)`
                : (stats.enRevision || 0),
              color: '#38bdf8'
            },
            { id: 'Descartado', label: 'Descartadas', count: stats.descartadas || 0, color: '#94a3b8' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              className={`dash-filter-pill ${filterEstado === f.id ? 'active' : ''}`}
              onClick={() => setFilterEstado(f.id)}
            >
              {f.color && <span className="dash-filter-dot" style={{ background: f.color }} />}
              <span>{f.label}</span>
              <span className="dash-filter-count">({f.count})</span>
            </button>
          ))}
        </div>

        {/* Tira de Sitios en Revisión si existen */}
        {stats.sitiosEnRevision && stats.sitiosEnRevision.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.85rem',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.22)',
              borderRadius: '8px',
              margin: '0.4rem 0 0.85rem 0',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#38bdf8', fontSize: '0.74rem', fontWeight: 700 }}>
              <Clock size={13} />
              <span>SITIOS EN REVISIÓN ({stats.sitiosEnRevision.length}):</span>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {stats.sitiosEnRevision.map(siteCode => (
                <button
                  key={siteCode}
                  type="button"
                  onClick={() => {
                    setFilterEstado('En Revisión')
                    setSearchTable(siteCode)
                  }}
                  style={{
                    background: searchTable === siteCode ? '#0284c7' : 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#f1f5f9',
                    padding: '0.18rem 0.55rem',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title={`Filtrar solo observaciones de ${siteCode}`}
                >
                  <MapPin size={10} color="#38bdf8" />
                  <span>{siteCode}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabla Responsive (sin código de lugar) */}
        <div className="dash-table-wrapper">
          <table className="dash-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ width: '140px' }}>CÓD. OBS</th>
                <th>NOMBRE DE TÉCNICO</th>
                <th>CÓDIGO DE SITIO</th>
                <th>ESTADO</th>
                <th>REVISADO POR</th>
                <th style={{ width: '60px', textAlign: 'center' }}>DETALLE</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr key={row.id_obs || idx} className="dash-table-row">
                  {/* Índice */}
                  <td className="dash-td-index">{idx + 1}</td>

                  {/* Código de Observación */}
                  <td className="dash-td-obs">
                    <span className="dash-obs-code">{row.id_obs}</span>
                  </td>

                  {/* Nombre de Técnico */}
                  <td className="dash-td-tech">
                    <div className="dash-tech-cell">
                      <div className="dash-tech-avatar">
                        <User size={13} color="#818cf8" />
                      </div>
                      <div className="dash-tech-info">
                        <span className="dash-tech-name">{row.tecnico}</span>
                        {row.cuadrilla && (
                          <span className="dash-tech-cuadrilla">{row.cuadrilla}</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Código de Sitio */}
                  <td className="dash-td-site">
                    <div className="dash-site-badge">
                      <MapPin size={12} color="#38bdf8" />
                      <span>{row.id_sitio}</span>
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="dash-td-estado">
                    {renderEstadoBadge(row.estado)}
                  </td>

                  {/* Nombre de Persona que Revisó */}
                  <td className="dash-td-revisor">
                    <div className="dash-revisor-cell">
                      {row.estado === 'En Revisión' ? (
                        <>
                          <Clock size={12} color="#38bdf8" />
                          <span className="dash-revisor-name" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            {row.revisor || 'En proceso'}
                          </span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={13} color="#a855f7" />
                          <span className="dash-revisor-name">{row.revisor}</span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Botón de detalle */}
                  <td className="dash-td-actions">
                    <button
                      type="button"
                      className="dash-row-btn"
                      title="Ver detalle de la observación"
                      onClick={() => setSelectedRowDetail(row)}
                    >
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={7}>
                    <div className="dash-empty-state">
                      <div className="dash-empty-icon">
                        <Calendar size={28} color="#6366f1" />
                      </div>
                      <h4 className="dash-empty-title">Sin registros para esta fecha</h4>
                      <p className="dash-empty-sub">
                        No se encontraron observaciones revisadas el <strong>{selectedFecha}</strong> con los filtros activos.
                      </p>
                      <div className="dash-empty-actions">
                        <button
                          type="button"
                          className="dash-btn-today"
                          onClick={() => {
                            setSelectedFecha('2026-10-21')
                            setFilterEstado('TODOS')
                            setSearchTable('')
                          }}
                        >
                          Ver avance del 21/10/2026
                        </button>
                        {!isToday && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}
                            onClick={() => {
                              setSelectedFecha(todayStr)
                              setFilterEstado('TODOS')
                              setSearchTable('')
                            }}
                          >
                            Ir a Hoy
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL DETALLE RÁPIDO DE OBSERVACIÓN ── */}
      {selectedRowDetail && (
        <div className="prog-modal-overlay">
          <div className="dash-modal-detail">
            <div className="dash-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="#818cf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f1f5f9' }}>
                  Detalle de Observación · {selectedRowDetail.id_obs}
                </h3>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setSelectedRowDetail(null)}
              >
                ✕
              </button>
            </div>

            <div className="dash-modal-body">
              <div className="dash-modal-grid">
                <div>
                  <label className="dash-m-label">Código de Sitio:</label>
                  <div className="dash-m-val">{selectedRowDetail.id_sitio}</div>
                </div>
                <div>
                  <label className="dash-m-label">Técnico Asignado:</label>
                  <div className="dash-m-val">{selectedRowDetail.tecnico} {selectedRowDetail.cuadrilla ? `· ${selectedRowDetail.cuadrilla}` : ''}</div>
                </div>
                <div>
                  <label className="dash-m-label">Revisado Por:</label>
                  <div className="dash-m-val" style={{ color: '#c084fc', fontWeight: 600 }}>{selectedRowDetail.revisor}</div>
                </div>
                <div>
                  <label className="dash-m-label">Estado:</label>
                  <div>{renderEstadoBadge(selectedRowDetail.estado)}</div>
                </div>
                <div>
                  <label className="dash-m-label">Fecha de Revisión:</label>
                  <div className="dash-m-val">{selectedRowDetail.fecha_subsanacion ? String(selectedRowDetail.fecha_subsanacion).slice(0, 10) : '-'}</div>
                </div>
              </div>

              {selectedRowDetail.detalle && (
                <div style={{ marginTop: '0.85rem' }}>
                  <label className="dash-m-label">Descripción / Detalle:</label>
                  <div className="dash-m-box">{selectedRowDetail.detalle}</div>
                </div>
              )}

              {selectedRowDetail.subsistema && (
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Subsistema: <strong>{selectedRowDetail.subsistema}</strong></span>
                  {selectedRowDetail.protocolo && <span>· Protocolo: <strong>{selectedRowDetail.protocolo}</strong></span>}
                </div>
              )}
            </div>

            <div className="dash-modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedRowDetail(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
