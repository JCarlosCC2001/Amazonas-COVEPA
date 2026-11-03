import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, TrendingUp,
  ShieldCheck, ExternalLink, Calendar, Award, UserCheck,
  Zap, MapPin, Layers, ChevronRight, Activity, Ban
} from 'lucide-react'
import MetricCard from '../shared/MetricCard'
import ErpTable from '../shared/ErpTable'

/**
 * GilatMetricsView — Pestaña Ejecutiva de Desempeño y SLA de Gilat Networks
 *
 * Muestra el análisis de velocidad de validación, tiempos de respuesta (SLA),
 * avance diario y desglose por auditor certificado de Gilat.
 * Cumple estrictamente con el Estándar Tipográfico Inter y números tabulares.
 */
export default function GilatMetricsView({
  metrics = null,
  loading = false,
  onRefresh = null
}) {
  const navigate = useNavigate()
  const [periodoFiltro, setPeriodoFiltro] = useState('14d') // '7d' | '14d' | 'all'
  const [bottomTab, setBottomTab] = useState('ranking') // 'ranking' | 'cola'

  const kpis = metrics?.kpis || {
    totalDictaminadas: 0,
    totalValidadas: 0,
    totalRechazadas: 0,
    tasaAprobacion: 0,
    tiempoPromedioHoras: 0,
    tiempoPromedioDias: 0,
    colaEsperaActual: 0,
    dictaminadasHoy: 0,
    velocidadDiariaPromedio: 0,
    descartadas: 0,
    mayorEspera: null
  }

  // Filtrado de la serie diaria según el período seleccionado
  const serieFiltrada = useMemo(() => {
    const raw = metrics?.serieDiaria || []
    if (periodoFiltro === '7d') return raw.slice(-7)
    if (periodoFiltro === '14d') return raw.slice(-14)
    return raw
  }, [metrics?.serieDiaria, periodoFiltro])

  // Máximo valor diario para escalar las barras proporcionalmente
  const maxDaily = useMemo(() => {
    if (!serieFiltrada || serieFiltrada.length === 0) return 10
    const max = Math.max(...serieFiltrada.map(d => d.total || 0))
    return max > 0 ? max : 10
  }, [serieFiltrada])

  // Columnas para la tabla de auditores
  const auditoresColumns = useMemo(() => [
    {
      key: 'index',
      label: '#',
      width: '44px',
      align: 'center',
      sortable: false,
      render: (_, idx) => (
        <span className="dash-td-index">
          {idx + 1}
        </span>
      )
    },
    {
      key: 'nombre',
      label: 'AUDITOR GILAT',
      sortable: true,
      render: a => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              background: '#003060',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'var(--fw-bold)'
            }}
            className="t-meta"
          >
            {a.nombre.charAt(0)}
          </div>
          <div>
            <div className="t-name" style={{ color: '#003060' }}>
              {a.nombre}
            </div>
            <div className="t-meta" style={{ color: 'var(--text-muted)' }}>
              Auditor Certificado Gilat
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'total',
      label: 'TOTAL REVISADAS',
      width: '130px',
      align: 'center',
      sortable: true,
      render: a => (
        <span className="t-name" style={{ color: '#003060', fontVariantNumeric: 'tabular-nums' }}>
          {a.total.toLocaleString()}
        </span>
      )
    },
    {
      key: 'validadas',
      label: 'VALIDADAS',
      width: '120px',
      align: 'center',
      sortable: true,
      render: a => (
        <span
          className="t-meta"
          style={{
            fontWeight: 'var(--fw-bold)',
            color: '#059669',
            background: 'rgba(16, 185, 129, 0.1)',
            padding: '0.2rem 0.5rem',
            borderRadius: '999px',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {a.validadas.toLocaleString()}
        </span>
      )
    },
    {
      key: 'rechazadas',
      label: 'RECHAZADAS',
      width: '120px',
      align: 'center',
      sortable: true,
      render: a => (
        <span
          className="t-meta"
          style={{
            fontWeight: 'var(--fw-bold)',
            color: '#dc2626',
            background: 'rgba(239, 68, 68, 0.1)',
            padding: '0.2rem 0.5rem',
            borderRadius: '999px',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {a.rechazadas.toLocaleString()}
        </span>
      )
    },
    {
      key: 'tasaAprobacion',
      label: '% APROBACIÓN',
      width: '140px',
      sortable: true,
      render: a => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, a.tasaAprobacion)}%`,
                height: '100%',
                background: a.tasaAprobacion >= 70 ? '#10b981' : (a.tasaAprobacion >= 50 ? '#f59e0b' : '#ef4444'),
                borderRadius: '3px'
              }}
            />
          </div>
          <span
            className="t-meta"
            style={{
              fontWeight: 'var(--fw-bold)',
              minWidth: '42px',
              textAlign: 'right',
              color: a.tasaAprobacion >= 70 ? '#059669' : '#d97706',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {a.tasaAprobacion}%
          </span>
        </div>
      )
    },
    {
      key: 'tiempoPromedioHoras',
      label: 'TIEMPO SLA',
      width: '120px',
      align: 'center',
      sortable: true,
      render: a => (
        <span className="t-meta" style={{ fontWeight: 'var(--fw-bold)', color: '#0284c7', fontVariantNumeric: 'tabular-nums' }}>
          {a.tiempoPromedioHoras !== null ? `${a.tiempoPromedioHoras} hrs` : '—'}
        </span>
      )
    },
    {
      key: 'ritmoDiario',
      label: 'RITMO DIARIO',
      width: '110px',
      align: 'center',
      sortable: true,
      render: a => (
        <span className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
          {a.ritmoDiario} / día
        </span>
      )
    },
    {
      key: 'estadoActividad',
      label: 'ESTADO',
      width: '130px',
      align: 'center',
      render: a => {
        if (a.activoHoy) {
          return (
            <span
              className="t-badge"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#059669',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.2rem 0.5rem',
                borderRadius: '999px',
                fontWeight: 'var(--fw-bold)'
              }}
            >
              🟢 Activo Hoy
            </span>
          )
        }
        if (a.activoEstaSemana) {
          return (
            <span
              className="t-badge"
              style={{
                background: 'rgba(2, 132, 199, 0.1)',
                color: '#0284c7',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                padding: '0.2rem 0.5rem',
                borderRadius: '999px',
                fontWeight: 'var(--fw-semibold)'
              }}
            >
              🔵 Esta Semana
            </span>
          )
        }
        return (
          <span
            className="t-badge"
            style={{
              background: '#f1f5f9',
              color: 'var(--text-muted)',
              padding: '0.2rem 0.5rem',
              borderRadius: '999px'
            }}
          >
            ⚪ Inactivo
          </span>
        )
      }
    }
  ], [])

  // Columnas para la tabla de observaciones en cola
  const colaColumns = useMemo(() => [
    {
      key: 'index',
      label: '#',
      width: '44px',
      align: 'center',
      sortable: false,
      render: (_, idx) => (
        <span className="dash-td-index">
          {idx + 1}
        </span>
      )
    },
    {
      key: 'id_sitio',
      label: 'SITIO Y LOCALIDAD',
      sortable: true,
      render: c => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              className="dash-site-badge"
              style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--fw-bold)' }}
            >
              <MapPin size={11} color="#003060" />
              <span>{c.id_sitio}</span>
            </span>
            <span className="t-name" style={{ color: '#1e293b' }}>
              · {c.localidad}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'id_obs',
      label: 'CÓDIGO OBS',
      width: '130px',
      sortable: true,
      render: c => (
        <span className="t-meta" style={{ fontWeight: 'var(--fw-bold)', color: '#003060', fontVariantNumeric: 'tabular-nums' }}>
          {c.id_obs}
        </span>
      )
    },
    {
      key: 'subsistema',
      label: 'SUBSISTEMA / ÍTEM',
      render: c => (
        <div className="t-meta" style={{ color: 'var(--text-secondary)' }}>
          <strong style={{ color: '#334155' }}>{c.subsistema || 'GENERAL'}</strong>
          {c.item && <span> · {c.item}</span>}
        </div>
      )
    },
    {
      key: 'estado_covepa',
      label: 'ESTADO ACTUAL',
      width: '140px',
      align: 'center',
      render: c => (
        <span
          className="t-badge"
          style={{
            background: c.estado_covepa === 'En Revisión' ? 'rgba(2, 132, 199, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            color: c.estado_covepa === 'En Revisión' ? '#0284c7' : '#d97706',
            fontWeight: 'var(--fw-bold)',
            padding: '0.2rem 0.55rem',
            borderRadius: '6px'
          }}
        >
          {c.estado_covepa}
        </span>
      )
    },
    {
      key: 'waitHrs',
      label: 'TIEMPO EN ESPERA',
      width: '140px',
      align: 'center',
      sortable: true,
      render: c => (
        <div style={{ textAlign: 'center' }}>
          <span
            className="t-name"
            style={{
              fontWeight: 'var(--fw-bold)',
              color: c.waitHrs >= 48 ? '#dc2626' : (c.waitHrs >= 24 ? '#d97706' : '#0284c7'),
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {c.waitHrs} hrs
          </span>
          <div className="t-meta" style={{ color: 'var(--text-muted)' }}>
            ({c.waitDays} días)
          </div>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'VER',
      width: '60px',
      align: 'center',
      render: c => (
        <button
          type="button"
          className="dash-row-btn"
          onClick={() => navigate(`/observaciones?search=${encodeURIComponent(c.id_sitio)}`)}
          title={`Ver detalle de ${c.id_obs}`}
        >
          <ExternalLink size={13} />
        </button>
      )
    }
  ], [navigate])

  return (
    <div className="dash-gilat-view">
      {/* ── TIRA SUPERIOR DE 6 MEDIDORES EJECUTIVOS (KPIs GILAT) ── */}
      <div className="dash-metrics-strip-6col">
        <MetricCard
          icon={<Clock size={18} />}
          label="SLA Respuesta"
          value={loading ? '—' : `${kpis.tiempoPromedioHoras}h`}
          subtitle={`${kpis.tiempoPromedioDias} días promedio`}
          variant="sky"
          title="Tiempo promedio transcurrido desde solicitud hasta dictamen de Gilat"
        />

        <MetricCard
          icon={<CheckCircle2 size={18} />}
          label="Validadas Gilat"
          value={loading ? '—' : kpis.totalValidadas.toLocaleString()}
          subtitle={`${kpis.tasaAprobacion}% aprobación`}
          variant="emerald"
          onClick={() => navigate('/observaciones?estado=Validado')}
          title="Observaciones aprobadas y validadas por Gilat"
        />

        <MetricCard
          icon={<XCircle size={18} />}
          label="Rechazadas Gilat"
          value={loading ? '—' : kpis.totalRechazadas.toLocaleString()}
          subtitle={`${(100 - kpis.tasaAprobacion).toFixed(1)}% rechazo`}
          variant="rose"
          onClick={() => navigate('/observaciones?estado=Rechazado')}
          title="Observaciones devueltas o rechazadas por Gilat"
        />

        <MetricCard
          icon={<AlertTriangle size={18} />}
          label="En Cola Gilat"
          value={loading ? '—' : kpis.colaEsperaActual.toLocaleString()}
          subtitle={kpis.dictaminadasHoy > 0 ? `${kpis.dictaminadasHoy} resueltas hoy` : 'Pendiente dictamen'}
          variant="amber"
          onClick={() => navigate('/observaciones?estado=En Revisión')}
          title="Observaciones actualmente en espera de respuesta de Gilat"
        />

        <MetricCard
          icon={<TrendingUp size={18} />}
          label="Ritmo Diario"
          value={loading ? '—' : `${kpis.velocidadDiariaPromedio}`}
          subtitle="Obs / día activo"
          variant="navy"
          title="Promedio de observaciones revisadas por Gilat en cada jornada activa"
        />

        <MetricCard
          icon={<ShieldCheck size={18} />}
          label="Mayor Espera"
          value={loading ? '—' : (kpis.mayorEspera ? `${kpis.mayorEspera.waitHrs}h` : '0h')}
          subtitle={kpis.mayorEspera ? `${kpis.mayorEspera.id_sitio}` : 'Sin cola'}
          variant="purple"
          onClick={() => kpis.mayorEspera && navigate(`/observaciones?search=${encodeURIComponent(kpis.mayorEspera.id_sitio)}`)}
          title={kpis.mayorEspera ? `Observación ${kpis.mayorEspera.id_obs} esperando hace ${kpis.mayorEspera.waitHrs} horas` : 'No hay observaciones en cola'}
        />
      </div>

      {/* ── PANEL CENTRAL: AVANCE DIARIO Y REPARTO DE AUDITORES ── */}
      <div className="dash-gilat-middle-grid">
        {/* Gráfica de Barras Interactivas: Avance y Velocidad por Día */}
        <div className="dash-weekly-card" style={{ flex: 1.4, minWidth: '320px' }}>
          <div className="dash-weekly-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={17} color="#003060" />
              <div>
                <h3 className="dash-weekly-title" style={{ color: '#003060', margin: 0 }}>
                  Velocidad Diaria de Validaciones
                </h3>
                <p className="t-meta" style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Observaciones dictaminadas por día por auditores de Gilat
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="t-meta" style={{ color: 'var(--text-muted)', fontWeight: 'var(--fw-semibold)' }}>
                Período:
              </span>
              <button
                type="button"
                className={`dash-pill-filter ${periodoFiltro === '7d' ? 'is-active' : ''}`}
                onClick={() => setPeriodoFiltro('7d')}
              >
                7 días
              </button>
              <button
                type="button"
                className={`dash-pill-filter ${periodoFiltro === '14d' ? 'is-active' : ''}`}
                onClick={() => setPeriodoFiltro('14d')}
              >
                14 días
              </button>
              <button
                type="button"
                className={`dash-pill-filter ${periodoFiltro === 'all' ? 'is-active' : ''}`}
                onClick={() => setPeriodoFiltro('all')}
              >
                Todo
              </button>
            </div>
          </div>

          {/* Gráfica Visual de Barras Apiladas (Validadas / Rechazadas) */}
          <div className="dash-gilat-chart-container">
            {serieFiltrada.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }} className="t-meta">
                Sin registros de actividad para el período seleccionado.
              </div>
            ) : (
              <div className="dash-gilat-bars-track">
                {serieFiltrada.map(d => {
                  const pctVal = maxDaily > 0 ? ((d.validadas / maxDaily) * 100) : 0
                  const pctRech = maxDaily > 0 ? ((d.rechazadas / maxDaily) * 100) : 0
                  const totalHeight = Math.min(100, pctVal + pctRech)

                  return (
                    <div
                      key={d.dateStr}
                      className={`dash-gilat-bar-col ${d.isToday ? 'is-today' : ''}`}
                      title={`${d.diaSemana} ${d.dateStr}: ${d.total} dictaminadas (${d.validadas} validadas, ${d.rechazadas} rechazadas). Revisor líder: ${d.revisorLider || '—'}`}
                    >
                      <div className="dash-gilat-bar-count" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {d.total}
                      </div>

                      <div className="dash-gilat-bar-slot">
                        <div
                          className="dash-gilat-bar-stack"
                          style={{ height: `${Math.max(8, totalHeight)}%` }}
                        >
                          <div
                            className="dash-gilat-bar-segment val"
                            style={{ height: `${totalHeight > 0 ? (pctVal / (pctVal + pctRech)) * 100 : 0}%` }}
                          />
                          <div
                            className="dash-gilat-bar-segment rech"
                            style={{ height: `${totalHeight > 0 ? (pctRech / (pctVal + pctRech)) * 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="dash-gilat-bar-label">
                        <span className="dash-gilat-bar-day">{d.diaSemana}</span>
                        <span className="dash-gilat-bar-date" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.label}</span>
                        {d.isToday && <span className="dash-gilat-today-dot" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Leyenda de la gráfica */}
            <div className="dash-gilat-chart-legend">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981' }} />
                <span className="t-meta" style={{ color: '#059669', fontWeight: 'var(--fw-semibold)' }}>
                  Validadas ({kpis.totalValidadas})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444' }} />
                <span className="t-meta" style={{ color: '#dc2626', fontWeight: 'var(--fw-semibold)' }}>
                  Rechazadas ({kpis.totalRechazadas})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
                <span className="t-meta" style={{ color: 'var(--text-muted)' }}>
                  Total auditadas por Gilat: <strong style={{ color: '#003060', fontVariantNumeric: 'tabular-nums' }}>{kpis.totalDictaminadas}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Lateral: Cuota y Tarjetas Resumen de Auditores */}
        <div className="dash-weekly-card" style={{ flex: 1, minWidth: '300px' }}>
          <div className="dash-weekly-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={17} color="#003060" />
              <div>
                <h3 className="dash-weekly-title" style={{ color: '#003060', margin: 0 }}>
                  Auditores Oficiales Gilat
                </h3>
                <p className="t-meta" style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Participación y efectividad por revisor
                </p>
              </div>
            </div>
            <span
              className="dash-subtab-badge"
              style={{ background: 'rgba(0, 48, 96, 0.08)', color: '#003060', fontWeight: 'var(--fw-bold)' }}
            >
              {metrics?.rankingAuditores?.length || 0} Auditores
            </span>
          </div>

          <div className="dash-gilat-auditors-list">
            {(metrics?.rankingAuditores || []).map(a => (
              <div key={a.nombre} className="dash-gilat-auditor-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: '#003060',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'var(--fw-bold)'
                      }}
                      className="t-badge"
                    >
                      {a.nombre.charAt(0)}
                    </div>
                    <div>
                      <div className="t-name" style={{ color: '#003060' }}>{a.nombre}</div>
                      <div className="t-meta" style={{ color: 'var(--text-muted)' }}>
                        {a.activoHoy ? '🟢 Activo hoy' : (a.activoEstaSemana ? '🔵 Esta semana' : '⚪ Inactivo')}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className="t-name" style={{ color: '#003060', fontVariantNumeric: 'tabular-nums' }}>
                      {a.total} obs
                    </div>
                    <div className="t-meta" style={{ color: '#059669', fontWeight: 'var(--fw-bold)', fontVariantNumeric: 'tabular-nums' }}>
                      {a.tasaAprobacion}% apr.
                    </div>
                  </div>
                </div>

                {/* Barra de progreso de cuota del total */}
                <div style={{ height: '5px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden', marginBottom: '0.35rem' }}>
                  <div
                    style={{
                      width: `${a.cuotaPorcentaje}%`,
                      height: '100%',
                      background: '#003060',
                      borderRadius: '3px'
                    }}
                  />
                </div>

                {/* Sub-KPIs compactos del auditor */}
                <div className="dash-gilat-auditor-subkpis">
                  <span className="t-meta" style={{ color: 'var(--text-muted)' }}>
                    Val: <strong style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{a.validadas}</strong>
                  </span>
                  <span className="t-meta" style={{ color: 'var(--text-muted)' }}>
                    Rech: <strong style={{ color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{a.rechazadas}</strong>
                  </span>
                  <span className="t-meta" style={{ color: 'var(--text-muted)' }}>
                    SLA: <strong style={{ color: '#0284c7', fontVariantNumeric: 'tabular-nums' }}>{a.tiempoPromedioHoras !== null ? `${a.tiempoPromedioHoras}h` : '—'}</strong>
                  </span>
                  <span className="t-meta" style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    Cuota: <strong style={{ color: '#003060', fontVariantNumeric: 'tabular-nums' }}>{a.cuotaPorcentaje}%</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PANEL INFERIOR: TABLA EJECUTIVA CON SUB-PESTAÑAS (RANKING AUDITORES / COLA DE ESPERA) ── */}
      <div className="dash-weekly-card" style={{ marginTop: '0.75rem' }}>
        <div className="dash-weekly-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className={`dash-pill-filter ${bottomTab === 'ranking' ? 'is-active' : ''}`}
              onClick={() => setBottomTab('ranking')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <UserCheck size={14} />
              <span>Desempeño Detallado de Auditores</span>
              <span className="dash-subtab-badge">{(metrics?.rankingAuditores || []).length}</span>
            </button>

            <button
              type="button"
              className={`dash-pill-filter ${bottomTab === 'cola' ? 'is-active' : ''}`}
              onClick={() => setBottomTab('cola')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Clock size={14} />
              <span>Observaciones en Cola de Espera</span>
              <span className="dash-subtab-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#d97706' }}>
                {kpis.colaEsperaActual}
              </span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="t-meta" style={{ color: 'var(--text-muted)' }}>
              {bottomTab === 'ranking' ? 'Consolidado histórico de revisiones' : 'Observaciones esperando dictamen de Gilat'}
            </span>
          </div>
        </div>

        {bottomTab === 'ranking' && (
          <ErpTable
            columns={auditoresColumns}
            data={metrics?.rankingAuditores || []}
            keyField="nombre"
            loading={loading}
            loadingMessage="Cargando desempeño de auditores..."
            emptyTitle="Sin auditores registrados"
            emptyDescription="No se encontraron dictámenes de Gilat registrados."
            entityName="auditores"
            minWidth="880px"
          />
        )}

        {bottomTab === 'cola' && (
          <ErpTable
            columns={colaColumns}
            data={metrics?.colaDetalle || []}
            keyField="id_obs"
            loading={loading}
            loadingMessage="Cargando cola de espera..."
            emptyTitle="Cola de espera vacía"
            emptyDescription="¡Excelente! No hay observaciones pendientes esperando revisión por parte de Gilat."
            entityName="observaciones en cola"
            minWidth="880px"
            onRowClick={c => navigate(`/observaciones?search=${encodeURIComponent(c.id_sitio)}`)}
          />
        )}
      </div>
    </div>
  )
}

