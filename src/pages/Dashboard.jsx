import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, XCircle,
  Ban, MapPin, Layers, Award, TrendingUp, RefreshCw, Search,
  ArrowRight, ExternalLink, Calendar, ChevronRight, ShieldCheck,
  Radio, Sparkles, Filter, Users, Globe, FileSpreadsheet, UploadCloud, User
} from 'lucide-react'
import { usePresentationMode } from '../context/PresentationContext'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'
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
      subsanadas: 0,
      enRevision: 0,
      descartadas: 0,
      rechazadas: 0,
      resueltas: 0,
      porcentajeGlobal: 0,
      totalSitios: 156
    },
    grupos: [],
    sitios: []
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
  }, [loadOverview])

  const { kpis, grupos, sitios } = data

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
      {/* ── CABECERA PRINCIPAL DEL DASHBOARD ── */}
      <div className="dash-header-card">
        <div className="dash-header-title-box">
          <div className="dash-header-badge">
            <span className="dash-live-dot" />
            <span>ESTADO GLOBAL DEL PROYECTO · EN VIVO</span>
          </div>
          <h1 className="dash-main-title">Dashboard Ejecutivo — Amazonas COVEPA</h1>
          <p className="dash-main-sub">
            Monitoreo general de todo el proyecto: avance consolidado de subsanación técnica en los 156 sitios de la Región Amazonas (ZONA 2 y ZONA 7).
          </p>
        </div>

        {/* Acciones directas de la barra */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="prog-btn-secondary"
            onClick={() => navigate('/programacion')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.95rem',
              borderRadius: '8px',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--fw-semibold)',
              background: 'rgba(0, 48, 96, 0.05)',
              border: '1px solid rgba(0, 48, 96, 0.2)',
              color: '#003060',
              cursor: 'pointer'
            }}
            title="Abrir módulo de Programación y revisar el Avance Diario"
          >
            <Calendar size={15} color="#003060" />
            <span>Avance Diario (Programación)</span>
          </button>

          <button
            type="button"
            className="prog-btn-secondary"
            onClick={() => navigate('/observaciones')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.95rem',
              borderRadius: '8px',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--fw-semibold)',
              background: 'rgba(14, 165, 233, 0.08)',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              color: '#0284c7',
              cursor: 'pointer'
            }}
            title="Ir al listado completo de observaciones"
          >
            <ClipboardList size={15} color="#0284c7" />
            <span>Ver Observaciones</span>
          </button>

          <button
            type="button"
            className={`dash-refresh-btn ${loading ? 'is-spinning' : ''}`}
            onClick={loadOverview}
            disabled={loading}
            title="Recargar métricas consolidadas"
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

      {/* ── SECCIÓN 1: MEDIDORES GENERALES DE TODO EL PROYECTO (7 MÉTRICAS OPERATIVAS) ── */}
      <MetricGrid columns={7}>
        <MetricCard
          icon={<ClipboardList size={22} />}
          label="Total Observaciones"
          value={loading ? '—' : kpis.total.toLocaleString()}
          subtitle="100% registros proyecto"
          variant="navy"
          onClick={() => navigate('/observaciones')}
          title="Ver todas las observaciones del proyecto"
        />

        <MetricCard
          icon={<AlertTriangle size={22} />}
          label="Pendientes"
          value={loading ? '—' : kpis.pendientes.toLocaleString()}
          subtitle="Por subsanar en campo"
          variant="amber"
          onClick={() => navigate('/observaciones')}
          title="Observaciones pendientes de atención"
        />

        <MetricCard
          icon={<Clock size={22} />}
          label="Solicitando Revisión"
          value={loading ? '—' : (kpis.solicitando || 0).toLocaleString()}
          subtitle="En espera de revisión"
          variant="orange"
          onClick={() => navigate('/observaciones')}
          title="Observaciones que solicitan revisión técnica"
        />

        <MetricCard
          icon={<UploadCloud size={22} />}
          label="En Revisión"
          value={loading ? '—' : (kpis.enRevision || 0).toLocaleString()}
          subtitle="Auditoría en proceso"
          variant="sky"
          onClick={() => navigate('/observaciones')}
          title="Observaciones en proceso de auditoría"
        />

        <MetricCard
          icon={<CheckCircle2 size={22} />}
          label="Validadas"
          value={loading ? '—' : (kpis.validadas || 0).toLocaleString()}
          subtitle="Subsanación conforme"
          variant="emerald"
          onClick={() => navigate('/observaciones')}
          title="Observaciones acreditadas y validadas"
        />

        <MetricCard
          icon={<XCircle size={22} />}
          label="Rechazadas"
          value={loading ? '—' : (kpis.rechazadas || 0).toLocaleString()}
          subtitle="Observadas por calidad"
          variant="rose"
          onClick={() => navigate('/observaciones')}
          title="Observaciones rechazadas que requieren nueva visita"
        />

        <MetricCard
          icon={<Ban size={22} />}
          label="Descartadas"
          value={loading ? '—' : (kpis.descartadas || 0).toLocaleString()}
          subtitle="Cerradas / No aplican"
          variant="purple"
          onClick={() => navigate('/observaciones')}
          title="Observaciones descartadas en campo"
        />
      </MetricGrid>

      {/* ── SECCIÓN 2: BALANCE Y CONTROL GLOBAL DE OPERACIONES ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.25rem',
        marginTop: '0.25rem'
      }}>
        {/* Panel 1: Tacómetro & Balance de Resolución */}
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '1.4rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} color="#003060" />
              <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                Progreso General de Levantamiento
              </h3>
            </div>
            <span style={{
              fontSize: 'var(--text-2xs)',
              fontWeight: 'var(--fw-bold)',
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}>
              {kpis.resueltas} Obs. Resueltas
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '1rem 0 0.5rem 0' }}>
            <SemicircleGauge percentage={kpis.porcentajeGlobal} color="#10b981" size={190} />
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 'var(--fw-semibold)' }}>
              <span>Distribución de Observaciones</span>
              <span>{kpis.total.toLocaleString()} Registros Totales</span>
            </div>
            <SegmentedProgressBar
              total={kpis.total}
              subsanadas={kpis.subsanadas}
              enRevision={kpis.enRevision}
              descartadas={kpis.descartadas}
              rechazadas={kpis.rechazadas}
              pendientes={kpis.pendientes}
            />
          </div>
        </div>

        {/* Panel 2: Cobertura Territorial y Recursos Activos */}
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '1.4rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={18} color="#003060" />
              <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                Cobertura Territorial y Despliegue
              </h3>
            </div>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 'var(--fw-semibold)' }}>
              Región Amazonas
            </span>
          </div>

          {/* Estadísticas de Zonas y Recursos */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.85rem',
            margin: '1rem 0'
          }}>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.85rem'
            }}>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>
                ZONA 2 · Norte
              </span>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-black)', color: '#003060', marginTop: '0.2rem' }}>
                53 Sitios
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Utcubamba, Bagua, Condorcanqui
              </span>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.85rem'
            }}>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>
                ZONA 7 · Sur
              </span>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-black)', color: '#003060', marginTop: '0.2rem' }}>
                103 Sitios
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Chachapoyas, Luya, Bongará, Mendoza
              </span>
            </div>
          </div>

          {/* Accesos Rápidos a Módulos Operativos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            <button
              type="button"
              className="prog-btn-secondary"
              onClick={() => navigate('/kmz')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                padding: '0.65rem',
                borderRadius: '8px',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--fw-semibold)',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                cursor: 'pointer'
              }}
            >
              <FileSpreadsheet size={14} color="#166534" />
              <span>Centro Descargas KMZ</span>
            </button>

            <button
              type="button"
              className="prog-btn-secondary"
              onClick={() => navigate('/sitios')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                padding: '0.65rem',
                borderRadius: '8px',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--fw-semibold)',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                cursor: 'pointer'
              }}
            >
              <MapPin size={14} color="#1d4ed8" />
              <span>Catálogo 156 Nodos</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 3: AVANCE Y BALANCE POR LAS 6 CUADRILLAS OPERATIVAS ── */}
      <div style={{ marginTop: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: '#003060', margin: 0 }}>
              Balance por Cuadrilla Operativa
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Consolidado de observaciones y porcentaje de avance para cada una de las 6 cuadrillas operativas.
            </p>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: '#0284c7', fontWeight: 'var(--fw-semibold)', background: 'rgba(2, 132, 199, 0.08)', padding: '0.3rem 0.65rem', borderRadius: '6px' }}>
            6 Cuadrillas Operativas
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem'
        }}>
          {grupos.map(g => {
            return (
              <div
                key={g.grupo}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
              >
                {/* Cabecera de la cuadrilla */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--fw-black)', color: '#003060', letterSpacing: '-0.01em' }}>
                        {g.grupo}
                      </h4>
                      {!presentationMode && g.tecnico && (
                        <span
                          style={{
                            fontSize: 'var(--text-xs)',
                            fontWeight: 'var(--fw-bold)',
                            padding: '1px 7px',
                            borderRadius: '4px',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title={`Técnico a cargo: ${g.tecnico}`}
                        >
                          <User size={11} />
                          <span>{g.tecnico}</span>
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      {g.zona}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--fw-bold)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(0, 48, 96, 0.06)',
                    color: '#003060',
                    border: '1px solid rgba(0, 48, 96, 0.15)',
                    flexShrink: 0
                  }}>
                    {g.sitiosCount} Sitios
                  </span>
                </div>

                {/* Porcentaje y barra de progreso */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--fw-semibold)' }}>
                      Avance de Subsanación
                    </span>
                    <strong style={{ fontSize: 'var(--text-sm)', color: g.porcentaje > 0 ? '#10b981' : '#64748b' }}>
                      {g.porcentaje}%
                    </strong>
                  </div>
                  <div style={{ height: '7px', borderRadius: '4px', background: '#e2e8f0', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, g.porcentaje)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10b981, #0284c7)',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                </div>

                {/* Métricas clave del grupo */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.4rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.6rem 0.4rem',
                  textAlign: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', display: 'block' }}>TOTAL</span>
                    <strong style={{ fontSize: 'var(--text-sm)', color: '#003060' }}>{g.total}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--text-2xs)', color: '#059669', display: 'block' }}>SUBS.</span>
                    <strong style={{ fontSize: 'var(--text-sm)', color: '#10b981' }}>{g.subsanadas}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--text-2xs)', color: '#0284c7', display: 'block' }}>REV.</span>
                    <strong style={{ fontSize: 'var(--text-sm)', color: '#0284c7' }}>{g.enRevision}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--text-2xs)', color: '#d97706', display: 'block' }}>PEND.</span>
                    <strong style={{ fontSize: 'var(--text-sm)', color: '#d97706' }}>{g.pendientes}</strong>
                  </div>
                </div>

                {/* Botón ver detalles */}
                <button
                  type="button"
                  onClick={() => navigate('/observaciones')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: '1px solid rgba(0, 48, 96, 0.15)',
                    color: '#003060',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--fw-semibold)',
                    cursor: 'pointer',
                    marginTop: 'auto'
                  }}
                >
                  <span>Ver observaciones de {g.grupo}</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            )
          })}
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
