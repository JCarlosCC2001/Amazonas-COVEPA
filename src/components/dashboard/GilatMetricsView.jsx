import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, Award, UserCheck,
  Zap, MapPin, Layers, Activity,
  ArrowRightLeft, Building2, Shield, History
} from 'lucide-react'
import MetricCard from '../shared/MetricCard'
import ErpTable from '../shared/ErpTable'

/**
 * GilatMetricsView — Pestaña Ejecutiva de Desempeño y SLA de Gilat Networks vs Reacción COVEPA
 *
 * Muestra:
 * - T2 (SLA Gilat): Último ciclo de validación desde 'En Revisión' hasta 'Validado', 'Rechazado' o 'Documentación',
 *   en horario contractual (09:00 a 19:00 + extensión activa en la misma jornada), excluyendo dictámenes de COVEPA.
 * - T1 (Reacción COVEPA): Tiempo desde que el técnico solicita revisión en campo ('Solicitando Revisión')
 *   hasta que pasa a 'En Revisión' o 'Documentación'.
 * - Bitácora verificable de últimos ciclos cerrados (T1 + T2) y colas vivas con hora exacta de historial.
 * Cumple estrictamente con el Estándar Tipográfico Inter y números tabulares.
 */
export default function GilatMetricsView({
  metrics = null,
  loading = false
}) {
  const navigate = useNavigate()
  const [periodoFiltro, setPeriodoFiltro] = useState('14d') // '7d' | '14d' | 'all'
  const [bottomTab, setBottomTab] = useState('ranking') // 'ranking' | 'reaccion-covepa' | 'ultimos-ciclos' | 'cola-gilat' | 'cola-covepa'

  const kpis = metrics?.kpis || {
    totalDictaminadas: 0,
    totalValidadas: 0,
    totalRechazadas: 0,
    tasaAprobacion: 0,
    tiempoPromedioHoras: 0,
    tiempoMedianaHoras: 0,
    tiempoP90Horas: 0,
    tiempoCorridoHoras: 0,
    tiempoPromedioDias: 0,
    tasaSlaGilat: 0,
    totalCiclosGilatMedidos: 0,
    tiempoCovepaHoras: 0,
    tiempoCovepaMedianaHoras: 0,
    tiempoCovepaMinutos: 0,
    medianaCovepaMinutos: 0,
    p90CovepaMinutos: 0,
    tiempoCovepaCorridoHoras: 0,
    tiempoCovepaDias: 0,
    tasaSlaCovepa: 0,
    totalCiclosCovepaMedidos: 0,
    cicloTotalHoras: 0,
    cicloTotalMedianaHoras: 0,
    cicloTotalDias: 0,
    colaEsperaActual: 0,
    colaCovepaActual: 0,
    dictaminadasHoy: 0,
    velocidadDiariaPromedio: 0,
    descartadas: 0,
    mayorEspera: null,
    mayorEsperaCovepa: null
  }

  // Proporción porcentual del ciclo total de gestión
  const pctGilat = kpis.cicloTotalHoras > 0
    ? Math.round((kpis.tiempoPromedioHoras / kpis.cicloTotalHoras) * 100)
    : 50
  const pctCovepa = kpis.cicloTotalHoras > 0
    ? (100 - pctGilat)
    : 50

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

  // 1. Columnas para la tabla de auditores Gilat
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
              Auditor Certificado Gilat ({a.ciclosMedidos || 0} ciclos medidos)
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
      width: '115px',
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
      width: '115px',
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
      label: 'SLA EFECTIVO (9-19H)',
      width: '150px',
      align: 'center',
      sortable: true,
      render: a => (
        <div style={{ textAlign: 'center' }}>
          <span className="t-meta" style={{ fontWeight: 'var(--fw-bold)', color: '#0284c7', fontVariantNumeric: 'tabular-nums' }}>
            {a.tiempoPromedioHoras !== null ? `${a.tiempoPromedioHoras} hrs` : '—'}
          </span>
          {a.tiempoMedianaHoras !== null && (
            <div className="t-meta" style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              Mediana: {a.tiempoMedianaHoras}h
            </div>
          )}
        </div>
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

  // 2. Columnas para la tabla de reacción interna COVEPA (Campo -> En Revisión)
  const covepaColumns = useMemo(() => [
    {
      key: 'index',
      label: '#',
      width: '44px',
      align: 'center',
      sortable: false,
      render: (_, idx) => <span className="dash-td-index">{idx + 1}</span>
    },
    {
      key: 'nombre',
      label: 'RESPONSABLE COVEPA',
      sortable: true,
      render: u => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              background: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'var(--fw-bold)'
            }}
            className="t-meta"
          >
            {u.nombre.charAt(0)}
          </div>
          <div>
            <div className="t-name" style={{ color: '#003060' }}>{u.nombre}</div>
            <div className="t-meta" style={{ color: 'var(--text-muted)' }}>
              Atención de solicitudes de campo (Solicitando → En Revisión)
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'totalAtendidas',
      label: 'SOLICITUDES ATENDIDAS',
      width: '160px',
      align: 'center',
      sortable: true,
      render: u => (
        <span className="t-name" style={{ color: '#003060', fontVariantNumeric: 'tabular-nums' }}>
          {u.totalAtendidas.toLocaleString()}
        </span>
      )
    },
    {
      key: 'medianaMinutos',
      label: 'MEDIANA REACCIÓN',
      width: '150px',
      align: 'center',
      sortable: true,
      render: u => (
        <span
          className="t-meta"
          style={{
            fontWeight: 'var(--fw-bold)',
            color: u.medianaMinutos <= 30 ? '#059669' : (u.medianaMinutos <= 60 ? '#d97706' : '#dc2626'),
            background: u.medianaMinutos <= 30 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {u.medianaMinutos} min
        </span>
      )
    },
    {
      key: 'promedioMinutos',
      label: 'PROMEDIO EFECTIVO',
      width: '150px',
      align: 'center',
      sortable: true,
      render: u => (
        <div style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          <span className="t-meta" style={{ fontWeight: 'var(--fw-bold)', color: '#003060' }}>
            {u.promedioMinutos} min ({u.promedioHoras}h)
          </span>
          <div className="t-meta" style={{ color: 'var(--text-muted)' }}>
            P90: {u.p90Minutos} min
          </div>
        </div>
      )
    },
    {
      key: 'tasaCumplimientoSla',
      label: '% SLA (≤ 30 MIN)',
      width: '150px',
      align: 'center',
      sortable: true,
      render: u => (
        <span
          className="t-meta"
          style={{
            fontWeight: 'var(--fw-bold)',
            color: u.tasaCumplimientoSla >= 70 ? '#059669' : '#d97706',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {u.tasaCumplimientoSla}% ({u.dentroMeta}/{u.totalAtendidas})
        </span>
      )
    }
  ], [])

  // 3. Columnas para la bitácora de últimos ciclos cerrados (T1 + T2 por observación)
  const ciclosColumns = useMemo(() => [
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
      key: 'id_sitio',
      label: 'SITIO Y LOCALIDAD',
      sortable: true,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span className="dash-site-badge" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--fw-bold)' }}>
            <MapPin size={11} color="#003060" />
            <span>{c.id_sitio}</span>
          </span>
          <span className="t-name" style={{ color: '#1e293b' }}>
            · {c.localidad}
          </span>
        </div>
      )
    },
    {
      key: 'estadoFinal',
      label: 'DICTAMEN',
      width: '130px',
      align: 'center',
      render: c => {
        const isVal = c.estadoFinal === 'Validado'
        const isDoc = c.estadoFinal === 'Documentación'
        return (
          <span
            className="t-badge"
            style={{
              background: isVal ? 'rgba(16, 185, 129, 0.12)' : (isDoc ? 'rgba(139, 92, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
              color: isVal ? '#059669' : (isDoc ? '#7c3aed' : '#dc2626'),
              fontWeight: 'var(--fw-bold)',
              padding: '0.2rem 0.55rem',
              borderRadius: '6px'
            }}
          >
            {c.estadoFinal}
          </span>
        )
      }
    },
    {
      key: 'revisor',
      label: 'AUDITOR GILAT',
      width: '150px',
      render: c => (
        <span className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
          {c.revisor}
        </span>
      )
    },
    {
      key: 'reaccionCovepaTexto',
      label: 'T1 REACCIÓN COVEPA',
      width: '140px',
      align: 'center',
      render: c => (
        <div style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          <span className="t-meta" style={{ fontWeight: 'var(--fw-bold)', color: '#003060' }}>
            {c.reaccionCovepaTexto}
          </span>
          {c.tecnicoSolicitante && c.tecnicoSolicitante !== '—' && (
            <div className="t-meta" style={{ color: 'var(--text-muted)' }}>
              {c.tecnicoSolicitante}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'effHrs',
      label: 'T2 ÚLTIMO TIEMPO GILAT',
      width: '165px',
      align: 'center',
      sortable: true,
      render: c => (
        <div style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          <span
            className="t-name"
            style={{
              fontWeight: 'var(--fw-bold)',
              color: c.effHrs <= 4 ? '#059669' : (c.effHrs <= 10 ? '#d97706' : '#dc2626')
            }}
          >
            {c.tiempoGilatTexto} ({c.effHrs}h)
          </span>
          <div className="t-meta" style={{ color: 'var(--text-muted)' }}>
            Corrido: {c.tiempoGilatCorridoTexto} · Ciclo #{c.totalCiclos}
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
          onClick={() => navigate(`/observaciones?search=${encodeURIComponent(c.id_obs)}`)}
          title={`Ver detalle de ${c.id_obs}`}
        >
          <ExternalLink size={13} />
        </button>
      )
    }
  ], [navigate])

  // 4. Columnas para la tabla de observaciones en cola viva
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
      label: 'SUBSISTEMA / RESPONSABLE',
      render: c => (
        <div className="t-meta" style={{ color: 'var(--text-secondary)' }}>
          <strong style={{ color: '#334155' }}>{c.subsistema || 'GENERAL'}</strong>
          {c.responsableEntrada && c.responsableEntrada !== '—' && (
            <span> · Por: {c.responsableEntrada}</span>
          )}
        </div>
      )
    },
    {
      key: 'estado_covepa',
      label: 'ESTADO ACTUAL',
      width: '150px',
      align: 'center',
      render: c => {
        let bg = 'rgba(2, 132, 199, 0.12)'
        let col = '#0284c7'
        if (c.estado_covepa === 'Solicitando Revisión') {
          bg = 'rgba(245, 158, 11, 0.12)'
          col = '#d97706'
        } else if (c.estado_covepa === 'Documentación') {
          bg = 'rgba(139, 92, 246, 0.12)'
          col = '#7c3aed'
        }
        return (
          <span
            className="t-badge"
            style={{
              background: bg,
              color: col,
              fontWeight: 'var(--fw-bold)',
              padding: '0.2rem 0.55rem',
              borderRadius: '6px'
            }}
          >
            {c.estado_covepa}
          </span>
        )
      }
    },
    {
      key: 'waitHrs',
      label: 'ESPERA EFECTIVA (9-19H)',
      width: '165px',
      align: 'center',
      sortable: true,
      render: c => (
        <div style={{ textAlign: 'center' }}>
          <span
            className="t-name"
            style={{
              fontWeight: 'var(--fw-bold)',
              color: c.waitHrs >= 10 ? '#dc2626' : (c.waitHrs >= 4 ? '#d97706' : '#0284c7'),
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {c.waitText || `${c.waitHrs} hrs`}
          </span>
          <div className="t-meta" style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            Corrido: {c.waitTextCorrido || `${c.waitHrsCorridas}h`}
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
          onClick={() => navigate(`/observaciones?search=${encodeURIComponent(c.id_obs)}`)}
          title={`Ver detalle de ${c.id_obs}`}
        >
          <ExternalLink size={13} />
        </button>
      )
    }
  ], [navigate])

  return (
    <div className="dash-gilat-view">
      {/* ── TIRA SUPERIOR DE 6 MEDIDORES EJECUTIVOS (GILAT VS COVEPA) ── */}
      <div className="dash-metrics-strip-6col">
        <MetricCard
          icon={<Clock size={18} />}
          label="SLA Gilat (Último Ciclo)"
          value={loading ? '—' : `${kpis.tiempoPromedioHoras}h`}
          subtitle={`Mediana: ${kpis.tiempoMedianaHoras}h · P90: ${kpis.tiempoP90Horas}h`}
          variant="sky"
          onClick={() => setBottomTab('ultimos-ciclos')}
          title={`Último tiempo desde 'En Revisión' hasta 'Validado/Rechazado/Documentación' en horario contractual 09:00-19:00 + ext. (Promedio 24h corrido: ${kpis.tiempoCorridoHoras}h sobre ${kpis.totalCiclosGilatMedidos} observaciones)`}
        />

        <MetricCard
          icon={<Zap size={18} />}
          label="Reacción COVEPA (Campo)"
          value={loading ? '—' : `${kpis.medianaCovepaMinutos} min`}
          subtitle={`Prom: ${kpis.tiempoCovepaMinutos}m (${kpis.tiempoCovepaHoras}h) · ${kpis.tasaSlaCovepa}% ≤30m`}
          variant="navy"
          onClick={() => setBottomTab('reaccion-covepa')}
          title={`Tiempo de reacción de COVEPA cuando el técnico solicita revisión en campo ('Solicitando Revisión' → 'En Revisión'). Mediana: ${kpis.medianaCovepaMinutos} min, Promedio efectivo: ${kpis.tiempoCovepaMinutos} min (${kpis.totalCiclosCovepaMedidos} solicitudes medidas)`}
        />

        <MetricCard
          icon={<CheckCircle2 size={18} />}
          label="Validadas Gilat"
          value={loading ? '—' : kpis.totalValidadas.toLocaleString()}
          subtitle={`${kpis.tasaAprobacion}% aprobación`}
          variant="emerald"
          onClick={() => navigate('/observaciones?estado=Validado')}
          title="Observaciones aprobadas y validadas por auditores de Gilat"
        />

        <MetricCard
          icon={<XCircle size={18} />}
          label="Rechazadas Gilat"
          value={loading ? '—' : kpis.totalRechazadas.toLocaleString()}
          subtitle={`${(100 - kpis.tasaAprobacion).toFixed(1)}% rechazo`}
          variant="rose"
          onClick={() => navigate('/observaciones?estado=Rechazado')}
          title="Observaciones devueltas o rechazadas por auditores de Gilat"
        />

        <MetricCard
          icon={<AlertTriangle size={18} />}
          label="Bandeja Gilat"
          value={loading ? '—' : kpis.colaEsperaActual.toLocaleString()}
          subtitle="En Revisión externa"
          variant="amber"
          onClick={() => setBottomTab('cola-gilat')}
          title="Observaciones actualmente en 'En Revisión' esperando dictamen de Gilat"
        />

        <MetricCard
          icon={<Layers size={18} />}
          label="Bandeja COVEPA"
          value={loading ? '—' : kpis.colaCovepaActual.toLocaleString()}
          subtitle="Solicitando / Docum."
          variant="purple"
          onClick={() => setBottomTab('cola-covepa')}
          title="Observaciones en gestión interna COVEPA ('Solicitando Revisión' o 'Documentación')"
        />
      </div>

      {/* ── BARRA DE COMPARATIVA ANALÍTICA DE CICLO Y TIEMPOS DE RESPUESTA ── */}
      <div
        className="dash-weekly-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 1rem',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowRightLeft size={15} color="#003060" />
            <span className="t-name" style={{ color: '#003060' }}>
              Ciclo de Auditoría (Horario 9am–7pm + ext.):
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span
              className="t-badge"
              style={{
                background: 'rgba(2, 132, 199, 0.1)',
                color: '#0284c7',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px'
              }}
              title="Último tiempo de validación Gilat desde 'En Revisión' hasta 'Validado / Rechazado / Documentación' (excluye dictámenes de COVEPA)"
            >
              🛡️ T2 Gilat: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{kpis.tiempoPromedioHoras}h</strong> (Med: {kpis.tiempoMedianaHoras}h · {kpis.tasaSlaGilat}% ≤4h)
            </span>
            <span style={{ color: 'var(--text-muted)' }}>+</span>
            <span
              className="t-badge"
              style={{
                background: 'rgba(0, 48, 96, 0.08)',
                color: '#003060',
                border: '1px solid rgba(0, 48, 96, 0.2)',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px'
              }}
              title="Tiempo de reacción interna COVEPA desde que el técnico solicita revisión en campo ('Solicitando Revisión') hasta 'En Revisión'"
            >
              🏢 T1 Reacción COVEPA: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{kpis.tiempoCovepaMinutos} min</strong> (Med: {kpis.medianaCovepaMinutos}m · {kpis.tasaSlaCovepa}% ≤30m)
            </span>
            <span style={{ color: 'var(--text-muted)' }}>=</span>
            <span
              className="t-badge"
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#059669',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px'
              }}
              title="Ciclo completo acumulado desde la solicitud del técnico hasta el dictamen de Gilat"
            >
              ⏱️ T3 Ciclo Total: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{kpis.cicloTotalHoras}h</strong> (Med: {kpis.cicloTotalMedianaHoras}h)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '170px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span className="t-meta" style={{ color: '#0284c7', fontWeight: 'var(--fw-semibold)' }}>
                Gilat {pctGilat}%
              </span>
              <span className="t-meta" style={{ color: '#003060', fontWeight: 'var(--fw-semibold)' }}>
                COVEPA {pctCovepa}%
              </span>
            </div>
            <div style={{ height: '6px', borderRadius: '3px', background: '#e2e8f0', display: 'flex', overflow: 'hidden' }}>
              <div
                style={{ width: `${pctGilat}%`, background: '#0284c7' }}
                title={`Gilat: ${pctGilat}% del tiempo de ciclo (${kpis.tiempoPromedioHoras}h)`}
              />
              <div
                style={{ width: `${pctCovepa}%`, background: '#003060' }}
                title={`COVEPA: ${pctCovepa}% del tiempo de ciclo (${kpis.tiempoCovepaHoras}h)`}
              />
            </div>
          </div>
        </div>
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
                  Participación y SLA efectivo del último ciclo
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
                  {a.tiempoMedianaHoras !== null && (
                    <span className="t-meta" style={{ color: 'var(--text-muted)' }}>
                      Med: <strong style={{ color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{a.tiempoMedianaHoras}h</strong>
                    </span>
                  )}
                  <span className="t-meta" style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    Cuota: <strong style={{ color: '#003060', fontVariantNumeric: 'tabular-nums' }}>{a.cuotaPorcentaje}%</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PANEL INFERIOR: TABLA EJECUTIVA CON 5 SUB-PESTAÑAS ── */}
      <div className="dash-weekly-card" style={{ marginTop: '0.75rem' }}>
        <div className="dash-weekly-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`dash-pill-filter ${bottomTab === 'ranking' ? 'is-active' : ''}`}
              onClick={() => setBottomTab('ranking')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <UserCheck size={14} />
              <span>Auditores Gilat</span>
              <span className="dash-subtab-badge">{(metrics?.rankingAuditores || []).length}</span>
            </button>

            <button
              type="button"
              className={`dash-pill-filter ${bottomTab === 'reaccion-covepa' ? 'is-active' : ''}`}
              onClick={() => setBottomTab('reaccion-covepa')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Zap size={14} />
              <span>Reacción COVEPA (Campo)</span>
              <span className="dash-subtab-badge" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7' }}>
                {(metrics?.rankingCovepa || []).length}
              </span>
            </button>

            <button
              type="button"
              className={`dash-pill-filter ${bottomTab === 'ultimos-ciclos' ? 'is-active' : ''}`}
              onClick={() => setBottomTab('ultimos-ciclos')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <History size={14} />
              <span>Últimos Ciclos (T1 + T2)</span>
              <span className="dash-subtab-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>
                {(metrics?.ultimosCiclosDetalle || []).length}
              </span>
            </button>

            <button
              type="button"
              className={`dash-pill-filter ${bottomTab === 'cola-gilat' ? 'is-active' : ''}`}
              onClick={() => setBottomTab('cola-gilat')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Shield size={14} />
              <span>Bandeja Gilat (En Revisión)</span>
              <span className="dash-subtab-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#d97706' }}>
                {kpis.colaEsperaActual}
              </span>
            </button>

            <button
              type="button"
              className={`dash-pill-filter ${bottomTab === 'cola-covepa' ? 'is-active' : ''}`}
              onClick={() => setBottomTab('cola-covepa')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Building2 size={14} />
              <span>Bandeja COVEPA (Solicitando / Doc.)</span>
              <span className="dash-subtab-badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#7c3aed' }}>
                {kpis.colaCovepaActual}
              </span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="t-meta" style={{ color: 'var(--text-muted)' }}>
              {bottomTab === 'ranking' && 'Desempeño y SLA del último ciclo de validación por auditor Gilat'}
              {bottomTab === 'reaccion-covepa' && 'Velocidad de reacción de nuestro equipo cuando los técnicos solicitan revisión en campo'}
              {bottomTab === 'ultimos-ciclos' && 'Auditoría verificable de las últimas 50 observaciones dictaminadas (T1 COVEPA + T2 Gilat)'}
              {bottomTab === 'cola-gilat' && 'Observaciones en "En Revisión" esperando dictamen de Gilat (hora real desde historial)'}
              {bottomTab === 'cola-covepa' && 'Observaciones en preparación interna COVEPA ("Solicitando Revisión" o "Documentación")'}
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

        {bottomTab === 'reaccion-covepa' && (
          <ErpTable
            columns={covepaColumns}
            data={metrics?.rankingCovepa || []}
            keyField="nombre"
            loading={loading}
            loadingMessage="Calculando tiempos de reacción COVEPA..."
            emptyTitle="Sin registros de reacción"
            emptyDescription="No se encontraron transiciones desde Solicitando Revisión hacia En Revisión."
            entityName="responsables COVEPA"
            minWidth="780px"
          />
        )}

        {bottomTab === 'ultimos-ciclos' && (
          <ErpTable
            columns={ciclosColumns}
            data={metrics?.ultimosCiclosDetalle || []}
            keyField="id_obs"
            loading={loading}
            loadingMessage="Cargando bitácora de últimos ciclos de validación..."
            emptyTitle="Sin ciclos cerrados"
            emptyDescription="No se encontraron ciclos cerrados desde En Revisión hasta dictamen."
            entityName="observaciones auditadas"
            minWidth="920px"
            onRowClick={c => navigate(`/observaciones?search=${encodeURIComponent(c.id_obs)}`)}
          />
        )}

        {bottomTab === 'cola-gilat' && (
          <ErpTable
            columns={colaColumns}
            data={metrics?.colaDetalle || []}
            keyField="id_obs"
            loading={loading}
            loadingMessage="Cargando bandeja de revisión Gilat..."
            emptyTitle="Bandeja Gilat al día"
            emptyDescription="¡Excelente! No hay observaciones pendientes esperando revisión por parte de Gilat."
            entityName="observaciones en revisión Gilat"
            minWidth="880px"
            onRowClick={c => navigate(`/observaciones?search=${encodeURIComponent(c.id_obs)}`)}
          />
        )}

        {bottomTab === 'cola-covepa' && (
          <ErpTable
            columns={colaColumns}
            data={metrics?.colaCovepaDetalle || []}
            keyField="id_obs"
            loading={loading}
            loadingMessage="Cargando bandeja interna COVEPA..."
            emptyTitle="Bandeja COVEPA al día"
            emptyDescription="No hay observaciones pendientes en gestión interna COVEPA (Solicitando Revisión o Documentación)."
            entityName="observaciones en gestión COVEPA"
            minWidth="880px"
            onRowClick={c => navigate(`/observaciones?search=${encodeURIComponent(c.id_obs)}`)}
          />
        )}
      </div>
    </div>
  )
}
