import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, XCircle,
  Ban, MapPin, Layers, Award, TrendingUp, RefreshCw, Search,
  ArrowRight, ExternalLink, Calendar, ChevronRight, ShieldCheck,
  Radio, Sparkles, Filter, Users, UploadCloud, User, RotateCcw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePresentationMode } from '../context/PresentationContext'
import MetricCard from '../components/shared/MetricCard'
import SegmentedProgressBar from '../components/shared/SegmentedProgressBar'
import CuadrillasMatrixTable from '../components/shared/CuadrillasMatrixTable'
import ErpTable from '../components/shared/ErpTable'
import { getDashboardProjectOverview } from '../services/dashboardService'

// ────────────────────────────────────────────────────────────
// Subcomponente: Tacómetro Semicircular de Avance Global SVG
// ────────────────────────────────────────────────────────────
function SemicircleGauge({ percentage = 0, color = '#10b981', size = 150 }) {
  const radius = 55
  const strokeWidth = 11
  const circumference = Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference

  return (
    <div className="dash-semi-gauge" style={{ width: size, height: size / 2 + 28 }}>
      <svg width={size} height={size / 2 + 14} viewBox="0 0 160 90">
        <path
          d="M 25 80 A 55 55 0 0 1 135 80"
          fill="none"
          stroke="rgba(0, 48, 96, 0.08)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d="M 25 80 A 55 55 0 0 1 135 80"
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
        <span className="dash-semi-pct" style={{ color: '#003060' }}>
          {percentage}%
        </span>
        <span className="dash-semi-label" style={{ color: 'var(--text-muted)' }}>
          Avance Global
        </span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: Dashboard Ejecutivo Global (Opción B)
// ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { presentationMode } = usePresentationMode()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // Control de sub-pestaña ejecutiva activa (100vh sin scroll de página)
  const [tab, setTab] = useState('operativo') // 'operativo' | 'sitios'

  // Estado con las métricas consolidadas del proyecto
  const [data, setData] = useState({
    kpis: {
      total: 4116,
      pendientes: 0,
      solicitando: 0,
      subsanadas: 0,
      validadas: 0,
      enRevision: 0,
      descartadas: 0,
      rechazadas: 0,
      resueltas: 0,
      porcentajeGlobal: 0,
      totalSitios: 156
    },
    grupos: [],
    sitios: [],
    semanaActual: { dias: [], rangoSemana: '', todayStr: '' }
  })

  // Filtros de la pestaña de monitoreo de sitios
  const [searchSitio, setSearchSitio] = useState('')
  const [filterGrupo, setFilterGrupo] = useState('TODOS')
  const [filterZona, setFilterZona] = useState('TODAS')

  // Carga reactiva de métricas consolidadas
  const loadOverview = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await getDashboardProjectOverview()
      setData(res)
    } catch (err) {
      console.error('Error cargando métricas consolidadas:', err)
      setErrorMsg(err.message || 'Error al conectar con la base de datos de Supabase.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()

    // Suscripción Realtime a cambios en observaciones para mantener actualizados los medidores
    let debounceTimer = null
    const debouncedReload = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        loadOverview()
      }, 500)
    }

    const channel = supabase
      .channel('covepa-dashboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'observaciones' },
        debouncedReload
      )
      .subscribe()

    // Recargar al volver a la pestaña
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadOverview()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadOverview])

  const { kpis, grupos, sitios, semanaActual } = data

  const diasSemana = semanaActual?.dias || []

  const totalGeneralSemana = useMemo(() => {
    return (grupos || []).reduce((acc, g) => acc + (g.totalSemana || 0), 0)
  }, [grupos])

  const totalesPorDia = useMemo(() => {
    const map = {}
    diasSemana.forEach(d => {
      map[d.dateStr] = (grupos || []).reduce((acc, g) => acc + (g.semana?.[d.dateStr] || 0), 0)
    })
    return map
  }, [diasSemana, grupos])

  // Estadísticas consolidadas por Zona (calculadas en base a sitios reales)
  const statsZona2 = useMemo(() => {
    const zSitios = (sitios || []).filter(s => {
      const z = (s.zona || '').toUpperCase()
      return z.includes('2') || z.includes('NORTE')
    })
    const totalObs = zSitios.reduce((acc, s) => acc + (s.total || 0), 0)
    const subsanadas = zSitios.reduce((acc, s) => acc + (s.subsanadas || 0), 0)
    const enRevision = zSitios.reduce((acc, s) => acc + (s.enRevision || 0) + (s.solicitando || 0), 0)
    const pendientes = zSitios.reduce((acc, s) => acc + (s.pendientes || 0), 0)
    const descartadas = zSitios.reduce((acc, s) => acc + (s.descartadas || 0), 0)
    const rechazadas = zSitios.reduce((acc, s) => acc + (s.rechazadas || 0), 0)
    const resueltas = subsanadas + descartadas
    const porcentaje = totalObs > 0 ? Math.round((resueltas / totalObs) * 100) : 0
    return {
      sitiosCount: zSitios.length || 53,
      porcentajeSitios: Math.round(((zSitios.length || 53) / (sitios.length || 156)) * 100),
      totalObs: totalObs || 1398,
      subsanadas,
      enRevision,
      pendientes,
      descartadas,
      rechazadas,
      resueltas,
      porcentaje
    }
  }, [sitios])

  const statsZona7 = useMemo(() => {
    const zSitios = (sitios || []).filter(s => {
      const z = (s.zona || '').toUpperCase()
      return z.includes('7') || z.includes('SUR')
    })
    const totalObs = zSitios.reduce((acc, s) => acc + (s.total || 0), 0)
    const subsanadas = zSitios.reduce((acc, s) => acc + (s.subsanadas || 0), 0)
    const enRevision = zSitios.reduce((acc, s) => acc + (s.enRevision || 0) + (s.solicitando || 0), 0)
    const pendientes = zSitios.reduce((acc, s) => acc + (s.pendientes || 0), 0)
    const descartadas = zSitios.reduce((acc, s) => acc + (s.descartadas || 0), 0)
    const rechazadas = zSitios.reduce((acc, s) => acc + (s.rechazadas || 0), 0)
    const resueltas = subsanadas + descartadas
    const porcentaje = totalObs > 0 ? Math.round((resueltas / totalObs) * 100) : 0
    return {
      sitiosCount: zSitios.length || 103,
      porcentajeSitios: Math.round(((zSitios.length || 103) / (sitios.length || 156)) * 100),
      totalObs: totalObs || 2718,
      subsanadas,
      enRevision,
      pendientes,
      descartadas,
      rechazadas,
      resueltas,
      porcentaje
    }
  }, [sitios])

  // Sitios filtrados para la pestaña de monitoreo
  const filteredSitios = useMemo(() => {
    const q = searchSitio.toLowerCase().trim()
    return (sitios || []).filter(s => {
      const c = (s.cuadrilla || s.grupo || '').replace(/GRUPO/gi, 'CUADRILLA')
      const matchGrupo = filterGrupo === 'TODOS' || c === filterGrupo
      const z = (s.zona || '').toUpperCase()
      const matchZona =
        filterZona === 'TODAS' ||
        (filterZona === 'ZONA 2' && (z.includes('2') || z.includes('NORTE'))) ||
        (filterZona === 'ZONA 7' && (z.includes('7') || z.includes('SUR')))

      const matchSearch =
        !q ||
        (s.id_sitio && s.id_sitio.toLowerCase().includes(q)) ||
        (s.localidad && s.localidad.toLowerCase().includes(q)) ||
        (s.nombre_nodo && s.nombre_nodo.toLowerCase().includes(q)) ||
        (s.distrito && s.distrito.toLowerCase().includes(q))

      return matchGrupo && matchZona && matchSearch
    })
  }, [sitios, filterGrupo, filterZona, searchSitio])

  // Ordenamiento y Paginación de la Tabla ErpTable de Sitios
  const [sitiosSortField, setSitiosSortField] = useState('total')
  const [sitiosSortDirection, setSitiosSortDirection] = useState('desc')
  const [sitiosPage, setSitiosPage] = useState(1)
  const sitiosPageSize = 25

  // Reset de página al cambiar filtros
  useEffect(() => {
    setSitiosPage(1)
  }, [searchSitio, filterGrupo, filterZona])

  const handleSitiosSort = useCallback((field) => {
    setSitiosSortField(prevField => {
      if (prevField === field) {
        setSitiosSortDirection(prevDir => (prevDir === 'asc' ? 'desc' : 'asc'))
        return prevField
      }
      setSitiosSortDirection('desc')
      return field
    })
    setSitiosPage(1)
  }, [])

  // Ordenamiento de sitios
  const sortedSitios = useMemo(() => {
    if (!sitiosSortField) return filteredSitios
    return [...filteredSitios].sort((a, b) => {
      let aVal = a[sitiosSortField] ?? ''
      let bVal = b[sitiosSortField] ?? ''
      if (typeof aVal === 'string') {
        return sitiosSortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      return sitiosSortDirection === 'asc'
        ? (Number(aVal) > Number(bVal) ? 1 : -1)
        : (Number(aVal) < Number(bVal) ? 1 : -1)
    })
  }, [filteredSitios, sitiosSortField, sitiosSortDirection])

  // Paginación de sitios
  const paginatedSitios = useMemo(() => {
    const start = (sitiosPage - 1) * sitiosPageSize
    return sortedSitios.slice(start, start + sitiosPageSize)
  }, [sortedSitios, sitiosPage, sitiosPageSize])

  // Definición de columnas para el componente reutilizable ErpTable
  const sitiosColumns = useMemo(() => [
    {
      key: 'index',
      label: '#',
      width: '44px',
      align: 'center',
      sortable: false,
      render: (_, idx) => (
        <span className="dash-td-index">
          {(sitiosPage - 1) * sitiosPageSize + idx + 1}
        </span>
      )
    },
    {
      key: 'id_sitio',
      label: 'CÓDIGO DE SITIO',
      width: '145px',
      sortable: true,
      render: s => (
        <div className="dash-site-badge" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <MapPin size={12} color="#003060" />
          <span>{s.id_sitio}</span>
        </div>
      )
    },
    {
      key: 'localidad',
      label: 'LOCALIDAD / NODO',
      sortable: true,
      render: s => (
        <div className="t-name" style={{ color: '#1e293b' }}>
          {s.localidad || s.nombre_nodo || '—'}
          {s.distrito && (
            <span className="t-meta" style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
              ({s.distrito})
            </span>
          )}
        </div>
      )
    },
    {
      key: 'zona',
      label: 'ZONA',
      width: '100px',
      sortable: true,
      render: s => (
        <span className="dash-subtab-badge" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {s.zona || (s.id_sitio?.includes('AM-00') ? 'ZONA 2' : 'ZONA 7')}
        </span>
      )
    },
    {
      key: 'grupo',
      label: 'CUADRILLA',
      width: '150px',
      sortable: true,
      render: s => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="t-name" style={{ color: '#003060' }}>{s.grupo}</span>
          {!presentationMode && s.tecnico && (
            <span className="t-meta" style={{ color: '#0284c7', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <User size={10} color="#0284c7" />
              <span>{s.tecnico}</span>
            </span>
          )}
        </div>
      )
    },
    {
      key: 'total',
      label: 'TOTAL',
      width: '75px',
      align: 'center',
      sortable: true,
      render: s => (
        <span style={{ fontWeight: 'var(--fw-bold)', color: '#003060', fontVariantNumeric: 'tabular-nums' }}>
          {s.total}
        </span>
      )
    },
    {
      key: 'subsanadas',
      label: 'SUBS.',
      width: '75px',
      align: 'center',
      sortable: true,
      render: s => (
        <span style={{ fontWeight: 'var(--fw-bold)', color: s.subsanadas > 0 ? '#10b981' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {s.subsanadas}
        </span>
      )
    },
    {
      key: 'enRevision',
      label: 'REV.',
      width: '75px',
      align: 'center',
      sortable: true,
      render: s => (
        <span style={{ fontWeight: 'var(--fw-bold)', color: s.enRevision > 0 ? '#0284c7' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {s.enRevision}
        </span>
      )
    },
    {
      key: 'pendientes',
      label: 'PEND.',
      width: '75px',
      align: 'center',
      sortable: true,
      render: s => (
        <span style={{ fontWeight: 'var(--fw-bold)', color: s.pendientes > 0 ? '#d97706' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {s.pendientes}
        </span>
      )
    },
    {
      key: 'porcentaje',
      label: 'AVANCE',
      width: '130px',
      sortable: true,
      render: s => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, s.porcentaje)}%`,
                height: '100%',
                background: '#10b981',
                borderRadius: '3px'
              }}
            />
          </div>
          <span className="t-meta" style={{ fontWeight: 'var(--fw-bold)', minWidth: '32px', textAlign: 'right', color: s.porcentaje > 0 ? '#10b981' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {s.porcentaje}%
          </span>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'VER',
      width: '60px',
      align: 'center',
      sortable: false,
      render: s => (
        <button
          type="button"
          className="dash-row-btn"
          onClick={e => {
            e.stopPropagation()
            navigate(`/observaciones?search=${encodeURIComponent(s.id_sitio)}`)
          }}
          title={`Ver observaciones del sitio ${s.id_sitio}`}
        >
          <ExternalLink size={13} />
        </button>
      )
    }
  ], [sitiosPage, sitiosPageSize, presentationMode, navigate])

  return (
    <div className="dash-page-container">
      {errorMsg && (
        <div className="dash-error-banner">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── BARRA SUPERIOR DE PESTAÑAS EJECUTIVAS (ZERO-SCROLL TABS) ── */}
      <div className="dash-subtabs-bar">
        <div className="dash-subtabs-group">
          <button
            type="button"
            className={`dash-subtab-btn ${tab === 'operativo' ? 'is-active' : ''}`}
            onClick={() => setTab('operativo')}
          >
            <TrendingUp size={14} />
            <span>Resumen Operativo</span>
            <span className="dash-subtab-badge-accent">{kpis.porcentajeGlobal}% Avance</span>
          </button>

          <button
            type="button"
            className={`dash-subtab-btn ${tab === 'sitios' ? 'is-active' : ''}`}
            onClick={() => setTab('sitios')}
          >
            <MapPin size={14} />
            <span>Monitoreo de Sitios</span>
            <span className="dash-subtab-badge">{sitios.length}</span>
          </button>
        </div>

        <div className="dash-subtabs-actions">
          <span className="dash-header-badge">
            <span className="dash-live-dot" />
            <span>En vivo</span>
          </span>
          <button
            type="button"
            className={`dash-refresh-btn ${loading ? 'is-spinning' : ''}`}
            onClick={loadOverview}
            disabled={loading}
            title="Recargar métricas consolidadas"
          >
            <RefreshCw size={13} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          PESTAÑA 1: RESUMEN OPERATIVO (100% PANTALLA SIN SCROLL)
          ════════════════════════════════════════════════════════════ */}
      {tab === 'operativo' && (
        <div className="dash-operativo-view">
          {/* Tira superior: 6 Medidores en 1 sola fila horizontal compacta */}
          <div className="dash-metrics-strip-6col">
            <MetricCard
              icon={<AlertTriangle size={18} />}
              label="Pendientes"
              value={loading ? '—' : kpis.pendientes.toLocaleString()}
              subtitle="Por subsanar"
              variant="amber"
              onClick={() => navigate('/observaciones?estado=Pendiente')}
              title="Observaciones pendientes de atención en campo"
            />

            <MetricCard
              icon={<Clock size={18} />}
              label="Solicitando Rev."
              value={loading ? '—' : (kpis.solicitando || 0).toLocaleString()}
              subtitle="En espera"
              variant="orange"
              onClick={() => navigate('/observaciones?estado=Solicitando Revisión')}
              title="Observaciones que solicitan revisión técnica"
            />

            <MetricCard
              icon={<UploadCloud size={18} />}
              label="En Revisión"
              value={loading ? '—' : (kpis.enRevision || 0).toLocaleString()}
              subtitle="Auditoría"
              variant="sky"
              onClick={() => navigate('/observaciones?estado=En Revisión')}
              title="Observaciones en auditoría de calidad"
            />

            <MetricCard
              icon={<CheckCircle2 size={18} />}
              label="Validadas"
              value={loading ? '—' : (kpis.validadas || 0).toLocaleString()}
              subtitle="Conformes"
              variant="emerald"
              onClick={() => navigate('/observaciones?estado=Validado')}
              title="Observaciones acreditadas y validadas"
            />

            <MetricCard
              icon={<XCircle size={18} />}
              label="Rechazadas"
              value={loading ? '—' : (kpis.rechazadas || 0).toLocaleString()}
              subtitle="Observadas"
              variant="rose"
              onClick={() => navigate('/observaciones?estado=Rechazado')}
              title="Observaciones rechazadas por calidad"
            />

            <MetricCard
              icon={<Ban size={18} />}
              label="Descartadas"
              value={loading ? '—' : (kpis.descartadas || 0).toLocaleString()}
              subtitle="Cerradas"
              variant="purple"
              onClick={() => navigate('/observaciones?estado=Descartado')}
              title="Observaciones descartadas en campo"
            />
          </div>

          {/* Bloque central: Tacómetro & Progreso a la izquierda + Matriz Semanal a la derecha */}
          <div className="dash-operativo-middle-grid">
            {/* Panel de Progreso General */}
            <div className="dash-progreso-panel">
              <div className="dash-progreso-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <TrendingUp size={16} color="#003060" />
                  <h3 className="t-name" style={{ margin: 0, color: '#003060' }}>
                    Progreso General de Levantamiento
                  </h3>
                </div>
                <span className="dash-progreso-resueltas-badge">
                  {kpis.resueltas} Resueltas
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.4rem 0 0.2rem 0' }}>
                <SemicircleGauge percentage={kpis.porcentajeGlobal} color="#10b981" size={150} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 'var(--fw-semibold)' }} className="t-meta">
                  <span>Distribución de Observaciones</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{kpis.total.toLocaleString()} Registros Totales</span>
                </div>
                <SegmentedProgressBar
                  total={kpis.total}
                  subsanadas={kpis.subsanadas}
                  enRevision={(kpis.enRevision || 0) + (kpis.solicitando || 0)}
                  descartadas={kpis.descartadas}
                  rechazadas={kpis.rechazadas}
                  pendientes={kpis.pendientes}
                />
              </div>

              {/* Acceso rápido a las dos zonas */}
              <div className="dash-zone-mini-chips">
                <div
                  className="dash-zone-mini-chip"
                  onClick={() => {
                    setFilterZona('ZONA 2')
                    setTab('sitios')
                  }}
                  title="Ver sitios de Zona 2 (Norte)"
                >
                  <span className="dash-zone-mini-title">ZONA 2 · Norte (53 sitios)</span>
                  <span className="dash-zone-mini-val">{statsZona2.porcentaje}%</span>
                </div>

                <div
                  className="dash-zone-mini-chip"
                  onClick={() => {
                    setFilterZona('ZONA 7')
                    setTab('sitios')
                  }}
                  title="Ver sitios de Zona 7 (Sur)"
                >
                  <span className="dash-zone-mini-title">ZONA 7 · Sur (103 sitios)</span>
                  <span className="dash-zone-mini-val">{statsZona7.porcentaje}%</span>
                </div>
              </div>
            </div>

            {/* Matriz de Producción Semanal (Componente Reutilizable) */}
            <CuadrillasMatrixTable
              icon={<Calendar size={16} color="#003060" />}
              title="Observaciones Validadas por Cuadrilla"
              subtitle={semanaActual?.rangoSemana ? `Semana: ${semanaActual.rangoSemana}` : 'Semana en curso'}
              badgeText={`${totalGeneralSemana} Validadas`}
              columns={diasSemana.map(d => ({
                key: d.dateStr,
                label: d.shortLabel,
                subLabel: d.isToday ? 'HOY' : null,
                isToday: d.isToday,
                title: d.diaNombre
              }))}
              rows={grupos}
              totals={totalesPorDia}
              grandTotal={totalGeneralSemana}
              footLabel="TOTAL DIARIO"
              presentationMode={presentationMode}
            />
          </div>

          {/* Tira inferior: 6 Tarjetas de Cuadrillas en 1 sola fila horizontal */}
          <div className="dash-cuadrillas-strip-6col">
            {grupos.map(g => (
              <div key={g.grupo} className="dash-cuadrilla-compact-card">
                <div className="dash-cuadrilla-header">
                  <div className="dash-cuadrilla-title-box">
                    <div className="dash-cuadrilla-title-row">
                      <h4 className="dash-cuadrilla-name">{g.grupo}</h4>
                      {!presentationMode && g.tecnico && (
                        <span className="dash-cuadrilla-tech-badge" title={`Técnico a cargo: ${g.tecnico}`}>
                          <User size={9} />
                          <span>{g.tecnico}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="dash-cuadrilla-sites-badge">
                    {g.sitiosCount} Sitios
                  </span>
                </div>

                <div className="dash-cuadrilla-progress-wrap">
                  <div className="dash-cuadrilla-progress-info">
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 'var(--fw-semibold)' }}>
                      Avance
                    </span>
                    <strong style={{ color: g.porcentaje > 0 ? '#10b981' : '#64748b' }}>
                      {g.porcentaje}%
                    </strong>
                  </div>
                  <div className="dash-cuadrilla-progress-bar">
                    <div
                      className="dash-cuadrilla-progress-fill"
                      style={{ width: `${Math.min(100, g.porcentaje)}%` }}
                    />
                  </div>
                </div>

                <div className="dash-cuadrilla-kpis-grid">
                  <div className="dash-cuadrilla-kpi-item">
                    <span style={{ color: 'var(--text-muted)' }}>TOTAL</span>
                    <strong style={{ color: '#003060' }}>{g.total}</strong>
                  </div>
                  <div className="dash-cuadrilla-kpi-item">
                    <span style={{ color: '#059669' }}>SUBS.</span>
                    <strong style={{ color: '#10b981' }}>{g.subsanadas}</strong>
                  </div>
                  <div className="dash-cuadrilla-kpi-item">
                    <span style={{ color: '#0284c7' }}>REV.</span>
                    <strong style={{ color: '#0284c7' }}>{g.enRevision}</strong>
                  </div>
                  <div className="dash-cuadrilla-kpi-item">
                    <span style={{ color: '#d97706' }}>PEND.</span>
                    <strong style={{ color: '#d97706' }}>{g.pendientes}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          PESTAÑA 2: MONITOREO DE SITIOS (SCROLL INTERNO DE TABLA)
          ════════════════════════════════════════════════════════════ */}
      {tab === 'sitios' && (
        <div className="dash-sitios-view">
          {/* Barra de herramientas y filtros */}
          <div className="dash-sites-toolbar-row">
            <div className="dash-sites-title-box">
              <Layers size={17} color="#003060" />
              <div>
                <h3 className="dash-sites-heading">
                  Monitoreo Ejecutivo de Sitios
                </h3>
              </div>
              <span className="dash-subtab-badge">
                {filteredSitios.length} {filteredSitios.length === 1 ? 'sitio' : 'sitios'}
              </span>
            </div>

            <div className="dash-sites-filters-wrap">
              {/* Buscador */}
              <div className="dash-search-box dash-sites-search-box">
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Buscar código o localidad..."
                  value={searchSitio}
                  onChange={e => setSearchSitio(e.target.value)}
                />
                {searchSitio && (
                  <button type="button" onClick={() => setSearchSitio('')} className="dash-clear-search">
                    ✕
                  </button>
                )}
              </div>

              {/* Filtro por Zona */}
              <select
                className="filter-select t-meta"
                value={filterZona}
                onChange={e => setFilterZona(e.target.value)}
                style={{ padding: '0.35rem 0.6rem' }}
              >
                <option value="TODAS">Todas las Zonas</option>
                <option value="ZONA 2">ZONA 2 · Norte (53 sitios)</option>
                <option value="ZONA 7">ZONA 7 · Sur (103 sitios)</option>
              </select>

              {/* Filtro por Cuadrilla */}
              <select
                className="filter-select t-meta"
                value={filterGrupo}
                onChange={e => setFilterGrupo(e.target.value)}
                style={{ padding: '0.35rem 0.6rem' }}
              >
                <option value="TODOS">Todas las Cuadrillas</option>
                <option value="CUADRILLA 1">CUADRILLA 1</option>
                <option value="CUADRILLA 2">CUADRILLA 2</option>
                <option value="CUADRILLA 3">CUADRILLA 3</option>
                <option value="CUADRILLA 4">CUADRILLA 4</option>
                <option value="CUADRILLA 5">CUADRILLA 5</option>
                <option value="CUADRILLA 6">CUADRILLA 6</option>
              </select>

              {(searchSitio || filterGrupo !== 'TODOS' || filterZona !== 'TODAS') && (
                <button
                  type="button"
                  className="dash-refresh-btn"
                  onClick={() => {
                    setSearchSitio('')
                    setFilterGrupo('TODOS')
                    setFilterZona('TODAS')
                  }}
                  title="Restablecer filtros"
                  style={{ padding: '0.35rem 0.6rem' }}
                >
                  <RotateCcw size={12} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabla ErpTable reutilizable con cabecera ordenable, sticky y paginación */}
          <ErpTable
            columns={sitiosColumns}
            data={paginatedSitios}
            keyField="id_sitio"
            loading={loading}
            loadingMessage="Cargando sitios..."
            emptyIcon={<MapPin size={40} style={{ opacity: 0.35 }} />}
            emptyTitle="Sin sitios encontrados"
            emptyDescription="No se encontraron sitios con los filtros aplicados."
            sortField={sitiosSortField}
            sortDirection={sitiosSortDirection}
            onSort={handleSitiosSort}
            onRowClick={s => navigate(`/observaciones?search=${encodeURIComponent(s.id_sitio)}`)}
            rowClassName="dash-table-row"
            page={sitiosPage}
            pageSize={sitiosPageSize}
            totalCount={filteredSitios.length}
            onPageChange={setSitiosPage}
            hasActiveFilters={!!searchSitio || filterGrupo !== 'TODOS' || filterZona !== 'TODAS'}
            entityName="sitios"
            minWidth="940px"
          />
        </div>
      )}
    </div>
  )
}
