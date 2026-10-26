import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, XCircle,
  Ban, MapPin, Layers, Award, TrendingUp, RefreshCw, Search,
  ArrowRight, ExternalLink, Calendar, ChevronRight, ShieldCheck,
  Radio, Sparkles, Filter, Users, Globe, FileSpreadsheet
} from 'lucide-react'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'
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
        <span className="dash-semi-pct" style={{ color: '#003060', fontSize: '1.9rem', fontWeight: 800 }}>
          {percentage}%
        </span>
        <span className="dash-semi-label" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Avance Global
        </span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Subcomponente: Barra de Distribución Segmentada
// ────────────────────────────────────────────────────────────
function SegmentedProgressBar({ total = 0, subsanadas = 0, enRevision = 0, descartadas = 0, rechazadas = 0, pendientes = 0 }) {
  const pctSub = total > 0 ? (subsanadas / total) * 100 : 0
  const pctRev = total > 0 ? (enRevision / total) * 100 : 0
  const pctDesc = total > 0 ? (descartadas / total) * 100 : 0
  const pctRech = total > 0 ? (rechazadas / total) * 100 : 0
  const pctPend = Math.max(0, 100 - (pctSub + pctRev + pctDesc + pctRech))

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        height: '14px',
        width: '100%',
        borderRadius: '7px',
        background: 'rgba(0, 48, 96, 0.06)',
        display: 'flex',
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
      }}>
        {pctSub > 0 && (
          <div
            style={{ width: `${pctSub}%`, background: '#10b981', transition: 'width 0.8s ease' }}
            title={`Subsanadas: ${subsanadas} (${pctSub.toFixed(1)}%)`}
          />
        )}
        {pctRev > 0 && (
          <div
            style={{ width: `${pctRev}%`, background: '#38bdf8', transition: 'width 0.8s ease' }}
            title={`En Revisión: ${enRevision} (${pctRev.toFixed(1)}%)`}
          />
        )}
        {pctDesc > 0 && (
          <div
            style={{ width: `${pctDesc}%`, background: '#8b5cf6', transition: 'width 0.8s ease' }}
            title={`Descartadas: ${descartadas} (${pctDesc.toFixed(1)}%)`}
          />
        )}
        {pctRech > 0 && (
          <div
            style={{ width: `${pctRech}%`, background: '#ef4444', transition: 'width 0.8s ease' }}
            title={`Rechazadas: ${rechazadas} (${pctRech.toFixed(1)}%)`}
          />
        )}
        {pctPend > 0 && (
          <div
            style={{ width: `${pctPend}%`, background: '#f59e0b', transition: 'width 0.8s ease' }}
            title={`Pendientes: ${pendientes} (${pctPend.toFixed(1)}%)`}
          />
        )}
      </div>

      {/* Leyenda interactiva */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.6rem',
        marginTop: '0.75rem',
        fontSize: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Subsanadas:</span>
          <strong style={{ color: '#10b981' }}>{subsanadas.toLocaleString()}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8' }} />
          <span style={{ color: 'var(--text-secondary)' }}>En Revisión:</span>
          <strong style={{ color: '#0284c7' }}>{enRevision.toLocaleString()}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#8b5cf6' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Descartadas:</span>
          <strong style={{ color: '#8b5cf6' }}>{descartadas.toLocaleString()}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Rechazadas:</span>
          <strong style={{ color: '#ef4444' }}>{rechazadas.toLocaleString()}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Pendientes:</span>
          <strong style={{ color: '#d97706' }}>{pendientes.toLocaleString()}</strong>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: Dashboard Ejecutivo Global
// ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
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
      const matchGrupo = filterGrupo === 'TODOS' || s.grupo === filterGrupo
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
              fontSize: '0.82rem',
              fontWeight: 600,
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
              fontSize: '0.82rem',
              fontWeight: 600,
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

      {/* ── SECCIÓN 1: MEDIDORES GENERALES DE TODO EL PROYECTO ── */}
      <MetricGrid style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <MetricCard
          icon={<ClipboardList size={22} />}
          label="Total Observaciones"
          value={loading ? '—' : kpis.total.toLocaleString()}
          subtitle="100% de registros en el proyecto"
          variant="navy"
          onClick={() => navigate('/observaciones')}
          title="Ver todas las observaciones del proyecto"
        />

        <MetricCard
          icon={<AlertTriangle size={22} />}
          label="Pendientes"
          value={loading ? '—' : kpis.pendientes.toLocaleString()}
          subtitle="Por subsanar o programar"
          variant="amber"
          onClick={() => navigate('/observaciones')}
          title="Observaciones pendientes de atención"
        />

        <MetricCard
          icon={<CheckCircle2 size={22} />}
          label="Subsanadas / Subidas"
          value={loading ? '—' : kpis.subsanadas.toLocaleString()}
          subtitle={`${kpis.validadas} validadas · ${kpis.enviadas} enviadas`}
          variant="emerald"
          onClick={() => navigate('/observaciones')}
          title="Observaciones acreditadas y validadas"
        />

        <MetricCard
          icon={<Clock size={22} />}
          label="En Revisión"
          value={loading ? '—' : kpis.enRevision.toLocaleString()}
          subtitle="En validación con Gilat / Pronatel"
          variant="sky"
          onClick={() => navigate('/observaciones')}
          title="Observaciones en proceso de revisión técnica"
        />

        <MetricCard
          icon={<XCircle size={22} />}
          label="Rechazadas"
          value={loading ? '—' : kpis.rechazadas.toLocaleString()}
          subtitle="Observadas por calidad"
          variant="rose"
          onClick={() => navigate('/observaciones')}
          title="Observaciones rechazadas que requieren nueva visita"
        />

        <MetricCard
          icon={<Ban size={22} />}
          label="Descartadas"
          value={loading ? '—' : kpis.descartadas.toLocaleString()}
          subtitle="Cerradas / No aplican"
          variant="purple"
          onClick={() => navigate('/observaciones')}
          title="Observaciones descartadas en campo"
        />

        <MetricCard
          icon={<MapPin size={22} />}
          label="Total de Sitios"
          value={kpis.totalSitios}
          subtitle="Nodos georreferenciados"
          variant="indigo"
          onClick={() => navigate('/sitios')}
          title="Ver los 156 sitios del proyecto"
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
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#003060' }}>
                Progreso General de Levantamiento
              </h3>
            </div>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
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
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#003060' }}>
                Cobertura Territorial y Despliegue
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
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
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                ZONA 2 · Norte
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#003060', marginTop: '0.2rem' }}>
                53 Sitios
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Utcubamba, Bagua, Condorcanqui
              </span>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.85rem'
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                ZONA 7 · Sur
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#003060', marginTop: '0.2rem' }}>
                103 Sitios
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
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
                fontSize: '0.78rem',
                fontWeight: 600,
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
                fontSize: '0.78rem',
                fontWeight: 600,
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

      {/* ── SECCIÓN 3: AVANCE Y BALANCE POR LOS 6 GRUPOS TERRITORIALES ── */}
      <div style={{ marginTop: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#003060', margin: 0 }}>
              Balance por Grupo Territorial
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Consolidado de observaciones y porcentaje de avance para cada uno de los 6 grupos operativos.
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600, background: 'rgba(2, 132, 199, 0.08)', padding: '0.3rem 0.65rem', borderRadius: '6px' }}>
            6 Grupos Territoriales
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
                {/* Cabecera del grupo */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#003060' }}>
                      {g.grupo}
                    </h4>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {g.zona}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(0, 48, 96, 0.06)',
                    color: '#003060',
                    border: '1px solid rgba(0, 48, 96, 0.15)'
                  }}>
                    {g.sitiosCount} Sitios
                  </span>
                </div>

                {/* Porcentaje y barra de progreso */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Avance de Subsanación
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: g.porcentaje > 0 ? '#10b981' : '#64748b' }}>
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
                    <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL</span>
                    <strong style={{ fontSize: '0.82rem', color: '#003060' }}>{g.total}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.64rem', color: '#059669', display: 'block' }}>SUBS.</span>
                    <strong style={{ fontSize: '0.82rem', color: '#10b981' }}>{g.subsanadas}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.64rem', color: '#0284c7', display: 'block' }}>REV.</span>
                    <strong style={{ fontSize: '0.82rem', color: '#0284c7' }}>{g.enRevision}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.64rem', color: '#d97706', display: 'block' }}>PEND.</span>
                    <strong style={{ fontSize: '0.82rem', color: '#d97706' }}>{g.pendientes}</strong>
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
                    fontSize: '0.74rem',
                    fontWeight: 600,
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
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#003060' }}>
                Monitoreo Ejecutivo de Sitios
              </h3>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                background: 'rgba(0, 48, 96, 0.08)',
                color: '#003060'
              }}>
                {filteredSitios.length} {filteredSitios.length === 1 ? 'sitio' : 'sitios'}
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
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

            {/* Filtro por grupo */}
            <select
              className="filter-select"
              value={filterGrupo}
              onChange={e => setFilterGrupo(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
            >
              <option value="TODOS">Todos los Grupos ({sitios.length})</option>
              <option value="GRUPO 1">GRUPO 1</option>
              <option value="GRUPO 2">GRUPO 2</option>
              <option value="GRUPO 3">GRUPO 3</option>
              <option value="GRUPO 4">GRUPO 4</option>
              <option value="GRUPO 5">GRUPO 5</option>
              <option value="GRUPO 6">GRUPO 6</option>
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
                <th style={{ width: '110px' }}>GRUPO</th>
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
                      <div className="dash-site-badge" style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        <MapPin size={12} color="#003060" />
                        <span>{s.id_sitio}</span>
                      </div>
                    </td>

                    <td style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                      {s.localidad || s.nombre_nodo || '—'}
                      {s.distrito && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 400 }}>
                          ({s.distrito})
                        </span>
                      )}
                    </td>

                    <td style={{ fontSize: '0.76rem', fontWeight: 600, color: '#003060' }}>
                      {s.grupo}
                    </td>

                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#003060' }}>
                      {s.total}
                    </td>

                    <td style={{ textAlign: 'center', fontWeight: 700, color: s.subsanadas > 0 ? '#10b981' : 'var(--text-muted)' }}>
                      {s.subsanadas}
                    </td>

                    <td style={{ textAlign: 'center', fontWeight: 700, color: s.enRevision > 0 ? '#0284c7' : 'var(--text-muted)' }}>
                      {s.enRevision}
                    </td>

                    <td style={{ textAlign: 'center', fontWeight: 700, color: s.pendientes > 0 ? '#d97706' : 'var(--text-muted)' }}>
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
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, minWidth: '32px', textAlign: 'right', color: s.porcentaje > 0 ? '#10b981' : 'var(--text-muted)' }}>
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
          <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Mostrando los primeros 50 sitios con mayor volumen de observaciones de un total de {filteredSitios.length}.
          </div>
        )}
      </div>
    </div>
  )
}
