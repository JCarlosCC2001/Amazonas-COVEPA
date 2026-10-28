import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, XCircle,
  Ban, MapPin, Layers, Award, TrendingUp, RefreshCw, Search,
  ArrowRight, ExternalLink, Calendar, ChevronRight, ShieldCheck,
  Radio, Sparkles, Filter, Users, Globe, UploadCloud, User
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePresentationMode } from '../context/PresentationContext'
import MetricCard from '../components/shared/MetricCard'
import SegmentedProgressBar from '../components/shared/SegmentedProgressBar'
import { getDashboardProjectOverview } from '../services/dashboardService'

// ────────────────────────────────────────────────────────────
// Subcomponente: Tacómetro Semicircular de Avance Global SVG
// ────────────────────────────────────────────────────────────
function SemicircleGauge({ percentage = 0, color = '#10b981', size = 180 }) {
  const radius = 70
  const strokeWidth = 14
  const circumference = Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference

  return (
    <div className="dash-semi-gauge" style={{ width: size, height: size / 2 + 35 }}>
      <svg width={size} height={size / 2 + 18} viewBox="0 0 180 100">
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke="rgba(0, 48, 96, 0.08)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
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
        <span className="dash-semi-pct" style={{ color: '#003060', fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-black)' }}>
          {percentage}%
        </span>
        <span className="dash-semi-label" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 'var(--fw-semibold)' }}>
          Avance Global
        </span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: Dashboard Ejecutivo Global
// ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { presentationMode } = usePresentationMode()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

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

  // Filtros de la tabla de sitios
  const [searchSitio, setSearchSitio] = useState('')
  const [filterGrupo, setFilterGrupo] = useState('TODOS')

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

  // Sitios filtrados para la tabla de monitoreo
  const filteredSitios = useMemo(() => {
    const q = searchSitio.toLowerCase().trim()
    return sitios.filter(s => {
      const c = (s.cuadrilla || s.grupo || '').replace(/GRUPO/gi, 'CUADRILLA')
      const matchGrupo = filterGrupo === 'TODOS' || c === filterGrupo
      const matchSearch =
        !q ||
        s.id_sitio.toLowerCase().includes(q) ||
        (s.localidad && s.localidad.toLowerCase().includes(q)) ||
        (s.nombre_nodo && s.nombre_nodo.toLowerCase().includes(q)) ||
        (s.distrito && s.distrito.toLowerCase().includes(q))

      return matchGrupo && matchSearch
    })
  }, [sitios, filterGrupo, searchSitio])

  return (
    <div className="dash-page-container">
      {errorMsg && (
        <div className="dash-error-banner">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── SECCIÓN SUPERIOR: MEDIDORES (2x3) A LA IZQUIERDA Y PROGRESO GENERAL A LA DERECHA ── */}
      <div className="dash-top-split-layout">
        {/* Columna Izquierda: 6 Medidores en 2 Columnas x 3 Filas */}
        <div className="dash-metrics-grid-2x3">
          <MetricCard
            icon={<AlertTriangle size={20} />}
            label="Pendientes"
            value={loading ? '—' : kpis.pendientes.toLocaleString()}
            subtitle="Por subsanar en campo"
            variant="amber"
            onClick={() => navigate('/observaciones?estado=Pendiente')}
            title="Observaciones pendientes de atención"
          />

          <MetricCard
            icon={<Clock size={20} />}
            label="Solicitando Revisión"
            value={loading ? '—' : (kpis.solicitando || 0).toLocaleString()}
            subtitle="En espera de revisión"
            variant="orange"
            onClick={() => navigate('/observaciones?estado=Solicitando Revisión')}
            title="Observaciones que solicitan revisión técnica"
          />

          <MetricCard
            icon={<UploadCloud size={20} />}
            label="En Revisión"
            value={loading ? '—' : (kpis.enRevision || 0).toLocaleString()}
            subtitle="Auditoría en proceso"
            variant="sky"
            onClick={() => navigate('/observaciones?estado=En Revisión')}
            title="Observaciones en proceso de auditoría"
          />

          <MetricCard
            icon={<CheckCircle2 size={20} />}
            label="Validadas"
            value={loading ? '—' : (kpis.validadas || 0).toLocaleString()}
            subtitle="Subsanación conforme"
            variant="emerald"
            onClick={() => navigate('/observaciones?estado=Validado')}
            title="Observaciones acreditadas y validadas"
          />

          <MetricCard
            icon={<XCircle size={20} />}
            label="Rechazadas"
            value={loading ? '—' : (kpis.rechazadas || 0).toLocaleString()}
            subtitle="Observadas por calidad"
            variant="rose"
            onClick={() => navigate('/observaciones?estado=Rechazado')}
            title="Observaciones rechazadas que requieren nueva visita"
          />

          <MetricCard
            icon={<Ban size={20} />}
            label="Descartadas"
            value={loading ? '—' : (kpis.descartadas || 0).toLocaleString()}
            subtitle="Cerradas / No aplican"
            variant="purple"
            onClick={() => navigate('/observaciones?estado=Descartado')}
            title="Observaciones descartadas en campo"
          />
        </div>

        {/* Columna Derecha: Progreso General de Levantamiento */}
        <div className="dash-progreso-panel">
          <div className="dash-progreso-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} color="#003060" />
              <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                Progreso General de Levantamiento
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span className="dash-progreso-resueltas-badge">
                {kpis.resueltas} Obs. Resueltas
              </span>
              <button
                type="button"
                className={`dash-refresh-btn ${loading ? 'is-spinning' : ''}`}
                onClick={loadOverview}
                disabled={loading}
                title="Recargar métricas consolidadas"
                style={{ padding: '0.25rem 0.55rem', fontSize: 'var(--text-xs)' }}
              >
                <RefreshCw size={13} />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.85rem 0 0.35rem 0' }}>
            <SemicircleGauge percentage={kpis.porcentajeGlobal} color="#10b981" size={190} />
          </div>

          <div style={{ marginTop: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 'var(--fw-semibold)' }}>
              <span>Distribución de Observaciones</span>
              <span>{kpis.total.toLocaleString()} Registros Totales</span>
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
        </div>

        {/* Columna 3 (Derecha): Cobertura Territorial (Zona 2 arriba, Zona 7 abajo) */}
        <div className="dash-cobertura-panel">
          <div className="dash-cobertura-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={18} color="#003060" />
              <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                Cobertura Territorial
              </h3>
            </div>
            <span className="dash-cobertura-total-badge">
              156 Sitios Totales
            </span>
          </div>

          <div className="dash-cobertura-zones-col">
            {/* Zona 2 Arriba */}
            <div
              className="dash-cobertura-zone-card"
              onClick={() => navigate('/sitios')}
              title="Ver sitios en Zona 2 (Norte)"
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  ZONA 2 · Norte
                </span>
                <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', color: '#0369a1', background: '#e0f2fe', padding: '0.12rem 0.45rem', borderRadius: '4px', border: '1px solid #bae6fd' }}>
                  34% Sitios
                </span>
              </div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-black)', color: '#003060', margin: '0.2rem 0 0.1rem 0', fontVariantNumeric: 'tabular-nums' }}>
                53 Sitios
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Utcubamba, Bagua, Condorcanqui
              </span>
            </div>

            {/* Zona 7 Abajo */}
            <div
              className="dash-cobertura-zone-card"
              onClick={() => navigate('/sitios')}
              title="Ver sitios en Zona 7 (Sur)"
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  ZONA 7 · Sur
                </span>
                <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', color: '#0369a1', background: '#e0f2fe', padding: '0.12rem 0.45rem', borderRadius: '4px', border: '1px solid #bae6fd' }}>
                  66% Sitios
                </span>
              </div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-black)', color: '#003060', margin: '0.2rem 0 0.1rem 0', fontVariantNumeric: 'tabular-nums' }}>
                103 Sitios
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Chachapoyas, Luya, Bongará, Mendoza
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 3: BALANCE POR CUADRILLA + PRODUCCIÓN SEMANAL (SPLIT LAYOUT) ── */}
      <div style={{ marginTop: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: '#003060', margin: 0 }}>
              Balance y Producción por Cuadrilla
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Avance acumulado por cuadrilla operativa y registro de producción diaria de observaciones subsanadas en la semana.
            </p>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: '#0284c7', fontWeight: 'var(--fw-semibold)', background: 'rgba(2, 132, 199, 0.08)', padding: '0.3rem 0.65rem', borderRadius: '6px' }}>
            6 Cuadrillas Operativas
          </span>
        </div>

        <div className="dash-cuadrillas-split-layout">
          {/* Columna Izquierda: Los 6 Cuadros de Cuadrilla (2x3 Compactos) */}
          <div className="dash-cuadrillas-cards-grid">
            {grupos.map(g => {
              return (
                <div key={g.grupo} className="dash-cuadrilla-compact-card">
                  {/* Cabecera de la cuadrilla (sin zona) */}
                  <div className="dash-cuadrilla-header">
                    <div className="dash-cuadrilla-title-box">
                      <div className="dash-cuadrilla-title-row">
                        <h4 className="dash-cuadrilla-name">
                          {g.grupo}
                        </h4>
                        {!presentationMode && g.tecnico && (
                          <span
                            className="dash-cuadrilla-tech-badge"
                            title={`Técnico a cargo: ${g.tecnico}`}
                          >
                            <User size={10} />
                            <span>{g.tecnico}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="dash-cuadrilla-sites-badge">
                      {g.sitiosCount} Sitios
                    </span>
                  </div>

                  {/* Porcentaje y barra de progreso */}
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

                  {/* 4 Métricas clave (TOTAL, SUBS., REV., PEND.) */}
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
              )
            })}
          </div>

          {/* Columna Derecha: Tabla de Producción Semanal */}
          <div className="dash-weekly-card">
            <div className="dash-weekly-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} color="#003060" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                    Producción Semanal de Cuadrillas
                  </h3>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                    {semanaActual?.rangoSemana ? `Semana: ${semanaActual.rangoSemana}` : 'Semana en curso'}
                  </span>
                </div>
              </div>
              <span className="dash-progreso-resueltas-badge" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {totalGeneralSemana} Obs. Levantadas
              </span>
            </div>

            <div className="dash-weekly-table-wrap">
              <table className="dash-weekly-table">
                <thead>
                  <tr>
                    <th className="th-left">Cuadrilla</th>
                    <th className="th-left">Técnico</th>
                    {diasSemana.map(d => (
                      <th
                        key={d.dateStr}
                        className={d.isToday ? 'th-today' : ''}
                        title={d.diaNombre}
                      >
                        <div>{d.shortLabel}</div>
                        {d.isToday && (
                          <div style={{ fontSize: 'var(--text-2xs)', color: '#0284c7', fontWeight: 'var(--fw-black)' }}>
                            HOY
                          </div>
                        )}
                      </th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(g => (
                    <tr key={g.grupo}>
                      <td className="td-left" style={{ fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                        {g.grupo}
                      </td>
                      <td className="td-left" style={{ color: 'var(--text-secondary)' }}>
                        {!presentationMode ? (g.tecnico || '—') : '—'}
                      </td>
                      {diasSemana.map(d => {
                        const count = g.semana?.[d.dateStr] || 0
                        return (
                          <td key={d.dateStr} className={d.isToday ? 'td-today' : ''}>
                            <span className={`dash-weekly-count-badge ${count > 0 ? 'has-val' : 'is-zero'}`}>
                              {count > 0 ? count : '—'}
                            </span>
                          </td>
                        )
                      })}
                      <td>
                        <span className="dash-weekly-total-badge">
                          {g.totalSemana || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="td-left" style={{ fontWeight: 'var(--fw-black)', color: '#003060' }}>
                      TOTAL DIARIO
                    </td>
                    {diasSemana.map(d => {
                      const totDia = totalesPorDia[d.dateStr] || 0
                      return (
                        <td key={d.dateStr} className={d.isToday ? 'td-today' : ''}>
                          <span className={`dash-weekly-count-badge ${totDia > 0 ? 'has-val' : 'is-zero'}`}>
                            {totDia > 0 ? totDia : '—'}
                          </span>
                        </td>
                      )
                    })}
                    <td>
                      <span className="dash-weekly-foot-total">
                        {totalGeneralSemana}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 4: MONITOR DE SITIOS DEL PROYECTO (156 NODOS) ── */}
      <div style={{
        marginTop: '2rem',
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.4rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Cabecera y Buscador de Sitios */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          paddingBottom: '1rem',
          marginBottom: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="#003060" />
              <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                Monitoreo Ejecutivo de Sitios
              </h3>
              <span style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--fw-bold)',
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                background: 'rgba(0, 48, 96, 0.08)',
                color: '#003060'
              }}>
                {filteredSitios.length} {filteredSitios.length === 1 ? 'sitio' : 'sitios'}
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Detalle de observaciones y porcentaje de resolución de cada nodo del proyecto.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Buscador */}
            <div className="dash-search-box" style={{ maxWidth: '240px' }}>
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

            {/* Filtro por cuadrilla */}
            <select
              className="filter-select"
              value={filterGrupo}
              onChange={e => setFilterGrupo(e.target.value)}
              style={{ fontSize: 'var(--text-sm)', padding: '0.4rem 0.65rem' }}
            >
              <option value="TODOS">Todas las Cuadrillas ({sitios.length})</option>
              <option value="CUADRILLA 1">CUADRILLA 1</option>
              <option value="CUADRILLA 2">CUADRILLA 2</option>
              <option value="CUADRILLA 3">CUADRILLA 3</option>
              <option value="CUADRILLA 4">CUADRILLA 4</option>
              <option value="CUADRILLA 5">CUADRILLA 5</option>
              <option value="CUADRILLA 6">CUADRILLA 6</option>
            </select>
          </div>
        </div>

        {/* Tabla compacta de sitios */}
        <div className="dash-table-wrapper" style={{ maxHeight: '480px', overflowY: 'auto' }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ width: '160px' }}>CÓDIGO DE SITIO</th>
                <th>LOCALIDAD / NODO</th>
                <th style={{ width: '120px' }}>CUADRILLA</th>
                <th style={{ width: '85px', textAlign: 'center' }}>TOTAL</th>
                <th style={{ width: '85px', textAlign: 'center' }}>SUBS.</th>
                <th style={{ width: '85px', textAlign: 'center' }}>EN REV.</th>
                <th style={{ width: '85px', textAlign: 'center' }}>PEND.</th>
                <th style={{ width: '130px' }}>AVANCE</th>
                <th style={{ width: '70px', textAlign: 'center' }}>VER</th>
              </tr>
            </thead>
            <tbody>
              {filteredSitios.slice(0, 50).map((s, idx) => {
                return (
                  <tr key={s.id_sitio} className="dash-table-row">
                    <td className="dash-td-index">{idx + 1}</td>

                    <td className="dash-td-site">
                      <div className="dash-site-badge" style={{ fontWeight: 'var(--fw-bold)', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>
                        <MapPin size={12} color="#003060" />
                        <span>{s.id_sitio}</span>
                      </div>
                    </td>

                    <td style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: '#1e293b' }}>
                      {s.localidad || s.nombre_nodo || '—'}
                      {s.distrito && (
                        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 'var(--fw-regular)' }}>
                          ({s.distrito})
                        </span>
                      )}
                    </td>

                    <td style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>{s.grupo}</span>
                        {!presentationMode && s.tecnico && (
                          <span style={{ fontSize: 'var(--text-2xs)', color: '#0284c7', fontWeight: 'var(--fw-semibold)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <User size={10} color="#0284c7" />
                            <span>{s.tecnico}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'center', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                      {s.total}
                    </td>

                    <td style={{ textAlign: 'center', fontWeight: 'var(--fw-bold)', color: s.subsanadas > 0 ? '#10b981' : 'var(--text-muted)' }}>
                      {s.subsanadas}
                    </td>

                    <td style={{ textAlign: 'center', fontWeight: 'var(--fw-bold)', color: s.enRevision > 0 ? '#0284c7' : 'var(--text-muted)' }}>
                      {s.enRevision}
                    </td>

                    <td style={{ textAlign: 'center', fontWeight: 'var(--fw-bold)', color: s.pendientes > 0 ? '#d97706' : 'var(--text-muted)' }}>
                      {s.pendientes}
                    </td>

                    <td>
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
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', minWidth: '32px', textAlign: 'right', color: s.porcentaje > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          {s.porcentaje}%
                        </span>
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="dash-row-btn"
                        onClick={() => navigate('/observaciones')}
                        title={`Ver observaciones de ${s.id_sitio}`}
                      >
                        <ExternalLink size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}

              {filteredSitios.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No se encontraron sitios con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredSitios.length > 50 && (
          <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Mostrando los primeros 50 sitios con mayor volumen de observaciones de un total de {filteredSitios.length}.
          </div>
        )}
      </div>
    </div>
  )
}
