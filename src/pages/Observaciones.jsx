import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, Filter, RefreshCw, FileDown, X, Eye, ChevronLeft,
  ChevronRight, ClipboardList, AlertCircle, CheckCircle2,
  AlertTriangle, FileText, Save, LayoutList, Table2,
  ChevronDown, ChevronUp, MapPin, Loader2, Calendar
} from 'lucide-react'
import {
  fetchObservaciones, fetchObservacionesKPIs, fetchFiltrosObservaciones,
  updateObservacionCovepa, exportObservacionesCSV,
  fetchResumenPorSitio, fetchObservacionesPorSitio
} from '../services/observacionesService'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'

// ────────────────────────────────────────────────────────────
// Helper de estilos para badges de estado COVEPA
// ────────────────────────────────────────────────────────────
function estadoCovepaBadge(estado) {
  if (!estado) return 'badge-muted'
  if (estado === 'Validado') return 'badge-green'
  if (estado === 'Descartado') return 'badge-dark'
  if (estado === 'Pendiente') return 'badge-yellow'
  if (estado === 'Rechazado') return 'badge-red'
  if (estado === 'En Revision' || estado === 'En Revisión') return 'badge-blue'
  if (estado === 'Enviado') return 'badge-purple'
  return 'badge-muted'
}

// ────────────────────────────────────────────────────────────
// DRAWER — detalle completo + edición campos COVEPA
// ────────────────────────────────────────────────────────────
function ObsDrawer({ obs, onClose, onSaved }) {
  const [estadoCovepa, setEstadoCovepa] = useState(obs?.estado_covepa || '')
  const [fechaSubsanacion, setFechaSubsanacion] = useState(
    obs?.fecha_subsanacion ? obs.fecha_subsanacion.split('T')[0] : ''
  )
  const [comentarioCovepa, setComentarioCovepa] = useState(obs?.comentario_covepa || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (obs) {
      setEstadoCovepa(obs.estado_covepa || '')
      setFechaSubsanacion(obs.fecha_subsanacion ? obs.fecha_subsanacion.split('T')[0] : '')
      setComentarioCovepa(obs.comentario_covepa || '')
      setSaved(false)
      setSaveError('')
    }
  }, [obs?.id_obs])

  if (!obs) return null

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const updated = await updateObservacionCovepa(obs.id_obs, {
        estado_covepa: estadoCovepa,
        fecha_subsanacion: fechaSubsanacion || null,
        comentario_covepa: comentarioCovepa,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      if (onSaved) onSaved(updated)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const TextBlock = ({ label, value }) => (
    value ? (
      <div className="obs-text-block">
        <div className="obs-text-label">{label}</div>
        <pre className="obs-text-content">{value}</pre>
      </div>
    ) : null
  )

  return (
    <div className="obs-drawer-overlay" onClick={onClose}>
      <div className="obs-drawer" onClick={e => e.stopPropagation()}>
        {/* Header del drawer */}
        <div className="obs-drawer-header">
          <div className="obs-drawer-title-wrap">
            <div className="obs-drawer-icon">
              <FileText size={22} />
            </div>
            <div>
              <div className="obs-drawer-code">{obs.id_obs}</div>
              <div className="obs-drawer-meta">{obs.id_sitio} · {obs.protocolo || 'Sin protocolo'}</div>
            </div>
          </div>
          <div className="obs-drawer-badges-wrap">
            <span className={`estado-badge ${estadoCovepaBadge(obs.estado_covepa)}`}>
              {obs.estado_covepa || 'Pendiente'}
            </span>
            <button className="obs-close-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="obs-drawer-body">
          {/* IDENTIFICACIÓN */}
          <div className="obs-section-title">Identificación de la Observación</div>
          <div className="obs-grid-3">
            <div className="obs-detail-item"><span className="obs-dk">Sitio</span><span className="obs-dv" style={{fontFamily:'monospace',color:'var(--primary-light)'}}>{obs.id_sitio}</span></div>
            <div className="obs-detail-item"><span className="obs-dk">Protocolo</span><span className="obs-dv">{obs.protocolo || '—'}</span></div>
            <div className="obs-detail-item"><span className="obs-dk">Subsistema</span><span className="obs-dv">{obs.subsistema || '—'}</span></div>
            <div className="obs-detail-item"><span className="obs-dk">Ítem</span><span className="obs-dv">{obs.item || '—'}</span></div>
            <div className="obs-detail-item"><span className="obs-dk">Sub-ítem</span><span className="obs-dv">{obs.sub_item || '—'}</span></div>
            <div className="obs-detail-item">
              <span className="obs-dk">F. Subsanación</span>
              <span className="obs-dv" style={{color: obs.fecha_subsanacion ? 'var(--accent)' : 'var(--text-muted)'}}>
                {obs.fecha_subsanacion ? obs.fecha_subsanacion.split('T')[0] : 'Sin fecha'}
              </span>
            </div>
          </div>

          <div className="obs-detail-item" style={{marginTop:'0.75rem'}}>
            <span className="obs-dk">Detalle de la Observación</span>
            <span className="obs-dv" style={{fontSize:'0.9rem',color:'var(--text-primary)'}}>{obs.detalle || '—'}</span>
          </div>

          {/* ACUERDO DE SUBSANACIÓN */}
          {obs.acuerdo_subsanacion && (
            <>
              <div className="obs-section-title" style={{marginTop:'1.25rem'}}>Acuerdo de Subsanación</div>
              <div className="obs-detail-item">
                <span className="obs-dv" style={{color:'var(--accent)'}}>{obs.acuerdo_subsanacion}</span>
              </div>
            </>
          )}

          {/* COMENTARIOS DEL EXPEDIENTE */}
          <div className="obs-section-title" style={{marginTop:'1.25rem'}}>Comentarios del Expediente</div>
          <TextBlock label="Comentario Inicial" value={obs.comentario_inicial} />
          <TextBlock label="Comentario Complementario" value={obs.comentario_complementario === '0' ? null : obs.comentario_complementario} />
          <TextBlock label="Comentario Final" value={obs.comentario_final} />

          {/* GESTIÓN COVEPA — Editable */}
          <div className="obs-section-title" style={{marginTop:'1.5rem'}}>Gestión COVEPA</div>
          <div className="obs-covepa-form">
            <div className="obs-form-row">
              <div className="obs-form-group">
                <label className="obs-form-label">Estado COVEPA</label>
                <select
                  className="obs-form-select"
                  value={estadoCovepa}
                  onChange={e => {
                    const val = e.target.value
                    setEstadoCovepa(val)
                    if (val !== 'Pendiente') {
                      if (!fechaSubsanacion) {
                        setFechaSubsanacion(new Date().toISOString().split('T')[0])
                      }
                    } else {
                      setFechaSubsanacion('')
                    }
                  }}
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="Rechazado">Rechazado</option>
                  <option value="Descartado">Descartado</option>
                  <option value="En Revision">En Revision</option>
                  <option value="Validado">Validado</option>
                  <option value="Enviado">Enviado</option>
                </select>
              </div>
              <div className="obs-form-group">
                <label className="obs-form-label">Fecha de Subsanación</label>
                <input
                  type="date"
                  className="obs-form-input"
                  value={fechaSubsanacion}
                  onChange={e => setFechaSubsanacion(e.target.value)}
                />
              </div>
            </div>
            <div className="obs-form-group" style={{width:'100%'}}>
              <label className="obs-form-label">Comentario COVEPA</label>
              <textarea
                className="obs-form-textarea"
                value={comentarioCovepa}
                onChange={e => setComentarioCovepa(e.target.value)}
                placeholder="Agregar comentario interno de COVEPA..."
                rows={4}
              />
            </div>
            {saveError && (
              <div className="obs-save-error"><AlertCircle size={15}/> {saveError}</div>
            )}
            <button
              className={`obs-save-btn ${saved ? 'saved' : ''}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <><span className="btn-spinner"/> Guardando...</>
               : saved ? <><CheckCircle2 size={16}/> ¡Guardado!</>
               : <><Save size={16}/> Guardar cambios</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// VISTA AGRUPADA POR SITIO — LAZY LOADING por acordeón
// ────────────────────────────────────────────────────────────
function SitioAcordeon({ sitio, stats, filtros, onSelectObs }) {
  const [isOpen, setIsOpen] = useState(false)
  const [obsData, setObsData] = useState(null)
  const [loadingObs, setLoadingObs] = useState(false)
  const [errorObs, setErrorObs] = useState(null)

  const handleToggle = async () => {
    if (!isOpen && obsData === null) {
      setLoadingObs(true)
      setErrorObs(null)
      try {
        const data = await fetchObservacionesPorSitio(sitio, filtros)
        setObsData(data)
      } catch (err) {
        setErrorObs(err.message)
      } finally {
        setLoadingObs(false)
      }
    }
    setIsOpen(prev => !prev)
  }

  return (
    <div className={`agrupada-card ${isOpen ? 'open' : ''}`}>
      {/* Cabecera clickeable */}
      <button className="agrupada-card-header" onClick={handleToggle}>
        <div className="agrupada-site-info">
          <div className="agrupada-site-icon"><MapPin size={15}/></div>
          <span className="agrupada-site-code">{sitio}</span>
          <div className="agrupada-site-pills">
            {stats.pendientes > 0 && <span className="pill pill-yellow">{stats.pendientes} pendientes</span>}
            {stats.subsanadas > 0 && <span className="pill pill-green">{stats.subsanadas} subsanadas</span>}
            {stats.descartadas > 0 && <span className="pill pill-dark">{stats.descartadas} descartadas</span>}
          </div>
        </div>
        <div className="agrupada-site-meta">
          <span className="agrupada-total-pill">{stats.total} total</span>
          {loadingObs
            ? <Loader2 size={15} className="spinning" style={{color:'var(--primary-light)'}}/>
            : isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </div>
      </button>

      {/* Cuerpo: observaciones del sitio (lazy) */}
      {isOpen && (
        <div className="agrupada-obs-list">
          {loadingObs ? (
            <div className="agrupada-loading-row">
              <Loader2 size={16} className="spinning"/>
              <span>Cargando observaciones de {sitio}...</span>
            </div>
          ) : errorObs ? (
            <div className="agrupada-loading-row" style={{color:'#fca5a5'}}>
              <AlertCircle size={15}/> {errorObs}
            </div>
          ) : obsData?.length === 0 ? (
            <div className="agrupada-loading-row" style={{color:'var(--text-muted)'}}>
              Sin resultados con los filtros actuales
            </div>
          ) : (
            obsData?.map(o => (
              <button key={o.id_obs} className="agrupada-obs-row" onClick={() => onSelectObs({ ...o, id_sitio: sitio })}>
                <div className="agrupada-obs-left">
                  <span className="site-code-badge" style={{fontSize:'0.72rem'}}>{o.id_obs}</span>
                  <span className="agrupada-protocolo-tag">{o.protocolo || '—'}</span>
                </div>
                <div className="agrupada-obs-center">
                  <span className="obs-detalle-cell" title={o.detalle}>
                    {o.detalle ? (o.detalle.length > 75 ? o.detalle.substring(0, 75) + '…' : o.detalle) : '—'}
                  </span>
                </div>
                <div className="agrupada-obs-right">
                  <span className={`estado-badge ${estadoCovepaBadge(o.estado_covepa)}`}>{o.estado_covepa || 'Pendiente'}</span>
                  {o.fecha_subsanacion && (
                    <span style={{fontSize:'0.7rem',color:'var(--accent)'}}>
                      {o.fecha_subsanacion.split('T')[0]}
                    </span>
                  )}
                  <Eye size={14} style={{color:'var(--text-muted)',flexShrink:0}}/>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function GrupadaView({ resumen, loading, filtros, onSelectObs }) {
  const sitios = Object.keys(resumen).sort()

  if (loading) return (
    <div className="table-loading-state"><div className="loader-spinner"/><p>Cargando resumen por sitio...</p></div>
  )
  if (sitios.length === 0) return (
    <div className="table-empty-state"><ClipboardList size={48} opacity={0.3}/><h3>Sin resultados</h3><p>Ningún sitio tiene observaciones con los filtros aplicados.</p></div>
  )

  return (
    <div className="agrupada-container">
      <div className="agrupada-header">
        <span className="agrupada-total-label">
          {sitios.length} sitios con observaciones
        </span>
      </div>
      {sitios.map(sitio => (
        <SitioAcordeon
          key={sitio}
          sitio={sitio}
          stats={resumen[sitio]}
          filtros={filtros}
          onSelectObs={onSelectObs}
        />
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL: OBSERVACIONES
// ────────────────────────────────────────────────────────────
export default function Observaciones() {
  const [observaciones, setObservaciones] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [kpis, setKpis] = useState({ total: 0, pendientes: 0, descartadas: 0, subsanadas: 0 })
  const [filtros, setFiltros] = useState({ protocolos: [], estadosCovepa: [], sitios: [] })
  const [loading, setLoading] = useState(true)
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingAgrupada, setLoadingAgrupada] = useState(false)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [selectedObs, setSelectedObs] = useState(null)
  const [vista, setVista] = useState('tabla') // 'tabla' | 'agrupada'
  const [gruposData, setGruposData] = useState({})

  // Filtros activos (COVEPA)
  const [search, setSearch] = useState('')
  const [protocolo, setProtocolo] = useState('')
  const [estadoCovepa, setEstadoCovepa] = useState('')
  const [idSitio, setIdSitio] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const searchTimeout = useRef(null)

  const filtrosActivos = { search, protocolo, estadoCovepa, idSitio }

  // Carga inicial de filtros disponibles
  useEffect(() => {
    fetchFiltrosObservaciones().then(setFiltros)
  }, [])

  // Carga de datos
  const loadData = useCallback(async (resetPage = false) => {
    const currentPage = resetPage ? 1 : page
    if (resetPage) setPage(1)
    setLoading(true)
    setError(null)
    try {
      const result = await fetchObservaciones({ ...filtrosActivos, page: currentPage, pageSize })
      setObservaciones(result.data)
      setTotalCount(result.count)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, protocolo, estadoCovepa, idSitio, page])

  const loadKpis = useCallback(async () => {
    setLoadingKpis(true)
    try {
      const k = await fetchObservacionesKPIs(filtrosActivos)
      setKpis(k)
    } finally {
      setLoadingKpis(false)
    }
  }, [search, protocolo, estadoCovepa, idSitio])

  const loadAgrupada = useCallback(async () => {
    if (vista !== 'agrupada') return
    setLoadingAgrupada(true)
    try {
      const resumen = await fetchResumenPorSitio(filtrosActivos)
      setGruposData(resumen)
    } catch(err) {
      setError(err.message)
    } finally {
      setLoadingAgrupada(false)
    }
  }, [vista, search, protocolo, estadoCovepa, idSitio])

  useEffect(() => { loadData(true) }, [search, protocolo, estadoCovepa, idSitio])
  useEffect(() => { if (page > 1) loadData() }, [page])
  useEffect(() => { loadKpis() }, [search, protocolo, idSitio, estadoCovepa])
  useEffect(() => { loadAgrupada() }, [vista, search, protocolo, estadoCovepa, idSitio])

  const handleSearchChange = (val) => {
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setSearch(val), 300)
  }

  const clearFilters = () => {
    setSearch(''); setProtocolo(''); setEstadoCovepa(''); setIdSitio(''); setPage(1)
    const el = document.getElementById('obs-search-input')
    if (el) el.value = ''
  }

  const hasActiveFilters = Boolean(search || protocolo || estadoCovepa || idSitio)

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await exportObservacionesCSV(filtrosActivos)
      const cols = [
        'id_obs', 'id_sitio', 'protocolo', 'subsistema', 'detalle', 'item', 'sub_item',
        'comentario_inicial', 'comentario_complementario', 'comentario_final',
        'acuerdo_subsanacion', 'estado_covepa', 'fecha_subsanacion', 'comentario_covepa'
      ]
      const header = cols.join(',')
      const rows = data.map(r => cols.map(c => {
        const v = r[c] ?? ''
        const s = String(v).replace(/"/g, '""').replace(/\n/g, ' ')
        return `"${s}"`
      }).join(','))
      const csv = [header, ...rows].join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `observaciones_covepa_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleObsSaved = (updated) => {
    setObservaciones(prev => prev.map(o => o.id_obs === updated.id_obs ? { ...o, ...updated } : o))
    if (selectedObs?.id_obs === updated.id_obs) setSelectedObs(prev => ({ ...prev, ...updated }))
    loadKpis()
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="obs-container">
      {/* ── MEDIDORES / KPIs REUTILIZABLES COVEPA ── */}
      <MetricGrid columns={4}>
        <MetricCard
          icon={<ClipboardList size={22} />}
          label="Total en Filtro"
          value={loadingKpis ? '—' : kpis.total.toLocaleString()}
          subtitle="de 4,116 obs"
          variant="navy"
          onClick={() => setEstadoCovepa('')}
          active={!estadoCovepa}
        />
        <MetricCard
          icon={<AlertTriangle size={22} />}
          label="Pendientes COVEPA"
          value={loadingKpis ? '—' : kpis.pendientes.toLocaleString()}
          subtitle="Por subsanar"
          variant="amber"
          onClick={() => setEstadoCovepa(prev => prev === 'Pendiente' ? '' : 'Pendiente')}
          active={estadoCovepa === 'Pendiente'}
        />
        <MetricCard
          icon={<Calendar size={22} />}
          label="Con Fecha Subsanación"
          value={loadingKpis ? '—' : kpis.subsanadas.toLocaleString()}
          subtitle="Comprometidas"
          variant="emerald"
        />
        <MetricCard
          icon={<CheckCircle2 size={22} />}
          label="Descartadas COVEPA"
          value={loadingKpis ? '—' : kpis.descartadas.toLocaleString()}
          subtitle="Cerradas sin acción"
          variant="rose"
          onClick={() => setEstadoCovepa(prev => prev === 'Descartado' ? '' : 'Descartado')}
          active={estadoCovepa === 'Descartado'}
        />
      </MetricGrid>

      {/* ── Toolbar Filtros ── */}
      <div className="obs-toolbar">
        <div className="obs-search-box">
          <Search size={16} className="obs-search-icon" />
          <input
            id="obs-search-input"
            type="text"
            placeholder="Buscar por código, sitio, detalle, subsistema, medidor..."
            className="obs-search-input"
            onChange={e => handleSearchChange(e.target.value)}
          />
          {search && (
            <button
              className="clear-search-btn"
              onClick={() => {
                setSearch('')
                const el = document.getElementById('obs-search-input')
                if (el) el.value = ''
              }}
            >
              <X size={15}/>
            </button>
          )}
        </div>

        <div className="obs-filter-group">
          <div className="obs-select-wrap">
            <FileText size={13} className="select-icon"/>
            <select className="toolbar-select" value={protocolo} onChange={e => setProtocolo(e.target.value)}>
              <option value="">Todos los Protocolos</option>
              {filtros.protocolos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="obs-select-wrap">
            <MapPin size={13} className="select-icon"/>
            <select className="toolbar-select" value={idSitio} onChange={e => setIdSitio(e.target.value)}>
              <option value="">Todos los Sitios</option>
              {filtros.sitios.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="obs-select-wrap">
            <Filter size={13} className="select-icon"/>
            <select className="toolbar-select" value={estadoCovepa} onChange={e => setEstadoCovepa(e.target.value)}>
              <option value="">Estado COVEPA</option>
              {filtros.estadosCovepa.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {hasActiveFilters && (
            <button className="obs-clear-filters-btn" onClick={clearFilters} title="Limpiar todos los filtros">
              <X size={14}/> Limpiar
            </button>
          )}

          <button
            className="refresh-btn"
            onClick={() => { loadData(true); loadKpis(); loadAgrupada() }}
            disabled={loading}
            title="Refrescar datos"
          >
            <RefreshCw size={15} className={loading || loadingAgrupada ? 'spinning' : ''}/>
          </button>

          {/* Toggle vista tabla / agrupada */}
          <div className="vista-toggle">
            <button
              className={`vista-toggle-btn ${vista === 'tabla' ? 'active' : ''}`}
              onClick={() => setVista('tabla')}
              title="Vista tabla detallada"
            >
              <Table2 size={15}/> Tabla
            </button>
            <button
              className={`vista-toggle-btn ${vista === 'agrupada' ? 'active' : ''}`}
              onClick={() => setVista('agrupada')}
              title="Vista agrupada por sitio"
            >
              <LayoutList size={15}/> Por sitio
            </button>
          </div>

          <button className="obs-export-btn" onClick={handleExport} disabled={exporting} title="Exportar CSV">
            <FileDown size={15}/>
            <span>{exporting ? 'Exportando...' : 'Exportar CSV'}</span>
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="sitios-error-banner"><AlertCircle size={18}/> {error}</div>
      )}

      {/* ── Vista Agrupada o Tabla ── */}
      {vista === 'agrupada' ? (
        <div className="sitios-table-wrapper">
          <GrupadaView
            resumen={gruposData}
            loading={loadingAgrupada}
            filtros={{ protocolo, estadoCovepa, idSitio }}
            onSelectObs={obs => setSelectedObs(obs)}
          />
        </div>
      ) : (
        <div className="sitios-table-wrapper">
          {loading ? (
            <div className="table-loading-state"><div className="loader-spinner"/><p>Cargando observaciones...</p></div>
          ) : observaciones.length === 0 ? (
            <div className="table-empty-state">
              <ClipboardList size={48} opacity={0.3}/>
              <h3>Sin resultados</h3>
              <p>No se encontraron observaciones con los filtros aplicados.</p>
            </div>
          ) : (
            <table className="sitios-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Sitio</th>
                  <th>Protocolo</th>
                  <th>Subsistema</th>
                  <th>Detalle</th>
                  <th>Ítem</th>
                  <th>Estado COVEPA</th>
                  <th>F. Subsanación</th>
                  <th style={{textAlign:'center'}}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {observaciones.map(o => (
                  <tr key={o.id_obs} className="sitio-row" onClick={() => setSelectedObs(o)}>
                    <td><span className="site-code-badge">{o.id_obs}</span></td>
                    <td><span className="site-code-badge" style={{color:'var(--accent)'}}>{o.id_sitio}</span></td>
                    <td>
                      <span className="site-name" style={{fontSize:'0.82rem'}}>{o.protocolo || '—'}</span>
                    </td>
                    <td>
                      <span style={{color:'var(--text-secondary)',fontSize:'0.8rem'}}>{o.subsistema || '—'}</span>
                    </td>
                    <td>
                      <span className="obs-detalle-cell" title={o.detalle || ''}>
                        {o.detalle ? (o.detalle.length > 60 ? o.detalle.substring(0, 60) + '…' : o.detalle) : '—'}
                      </span>
                    </td>
                    <td style={{color:'var(--text-muted)',fontSize:'0.8rem'}}>
                      {o.item}{o.sub_item ? ` / ${o.sub_item}` : ''}
                    </td>
                    <td>
                      <span className={`estado-badge ${estadoCovepaBadge(o.estado_covepa)}`}>
                        {o.estado_covepa || 'Pendiente'}
                      </span>
                    </td>
                    <td>
                      <span style={{fontSize:'0.78rem',color: o.fecha_subsanacion ? 'var(--accent)' : 'var(--text-muted)'}}>
                        {o.fecha_subsanacion ? o.fecha_subsanacion.split('T')[0] : '—'}
                      </span>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <button
                        className="view-site-btn"
                        onClick={e => { e.stopPropagation(); setSelectedObs(o) }}
                        title="Ver y editar observación"
                      >
                        <Eye size={15}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Paginación */}
          {!loading && totalCount > 0 && (
            <div className="table-pagination">
              <span className="pagination-info">
                {(page - 1) * pageSize + 1} – {Math.min(page * pageSize, totalCount)} de {totalCount.toLocaleString()} observaciones
                {hasActiveFilters && <span style={{color:'var(--primary-light)',marginLeft:'0.5rem'}}> (filtradas)</span>}
              </span>
              <div className="pagination-controls">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft size={15}/> Anterior
                </button>
                <span className="current-page-tag">Pág. {page} / {totalPages}</span>
                <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Siguiente <ChevronRight size={15}/>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DRAWER */}
      {selectedObs && (
        <ObsDrawer
          obs={selectedObs}
          onClose={() => setSelectedObs(null)}
          onSaved={handleObsSaved}
        />
      )}
    </div>
  )
}
