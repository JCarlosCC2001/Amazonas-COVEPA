import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, Filter, RefreshCw, FileDown, X, Eye, ChevronLeft,
  ChevronRight, ClipboardList, AlertCircle, CheckCircle2,
  AlertTriangle, FileText, Save, LayoutList, Table2,
  ChevronDown, ChevronUp, MapPin, Loader2, Calendar, Ban
} from 'lucide-react'
import {
  fetchObservaciones, fetchObservacionesKPIs, fetchFiltrosObservaciones,
  updateObservacionCovepa, exportObservacionesCSV,
  fetchResumenPorSitio, fetchObservacionesPorSitio
} from '../services/observacionesService'
import { getCachedSitiosAsignados } from '../services/sitiosService'
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
function ObsDrawer({ obs, sitiosMap = {}, onClose, onSaved }) {
  const [estadoCovepa, setEstadoCovepa] = useState(obs?.estado_covepa || '')
  const [fechaSubsanacion, setFechaSubsanacion] = useState(
    obs?.fecha_subsanacion ? obs.fecha_subsanacion.split('T')[0] : ''
  )
  const [comentarioCovepa, setComentarioCovepa] = useState(obs?.comentario_covepa || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const sitioInfo = sitiosMap[obs?.id_sitio] || {}
  const localidad = sitioInfo.localidad || sitioInfo.nombre_nodo || ''

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

  // Cerrar drawer con tecla Escape
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const TextBlock = ({ label, value }) => (
    value ? (
      <div className="obs-text-block">
        <div className="obs-text-label">{label}</div>
        <pre className="obs-text-content">{value}</pre>
      </div>
    ) : null
  )

  return (
    <div className="obs-drawer-overlay">
      <div className="obs-drawer">
        {/* Header del drawer */}
        <div className="obs-drawer-header">
          <div className="obs-drawer-title-wrap">
            <div className="obs-drawer-icon">
              <FileText size={22} />
            </div>
            <div>
              <div className="obs-drawer-code">{obs.id_obs}</div>
              <div className="obs-drawer-meta">
                <span style={{ fontWeight: 700, color: '#003060' }}>{obs.id_sitio}</span>
                {localidad ? <span style={{ color: '#0284c7' }}> · {localidad}</span> : ''} · {obs.protocolo || 'Sin protocolo'}
              </div>
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
            <div className="obs-detail-item">
              <span className="obs-dk">Sitio y Localidad</span>
              <span className="obs-dv" style={{fontFamily:'monospace',color:'var(--primary-light)'}}>
                {obs.id_sitio}{localidad ? ` · ${localidad}` : ''}
              </span>
            </div>
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
function SitioAcordeon({ sitio, stats, filtros, sitioInfo, onSelectObs }) {
  const [isOpen, setIsOpen] = useState(false)
  const [obsData, setObsData] = useState(null)
  const [loadingObs, setLoadingObs] = useState(false)
  const [errorObs, setErrorObs] = useState(null)

  const localidad = sitioInfo?.localidad || sitioInfo?.nombre_nodo || ''

  const loadSitioObs = async () => {
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

  const handleToggle = () => {
    if (!isOpen && obsData === null) {
      loadSitioObs()
    }
    setIsOpen(prev => !prev)
  }

  // Refrescar observaciones si el acordeón está abierto y cambian los filtros
  useEffect(() => {
    if (isOpen) {
      loadSitioObs()
    } else {
      setObsData(null)
    }
  }, [isOpen, filtros.search, filtros.protocolo, filtros.estadoCovepa, filtros.idSitio])

  return (
    <div className={`agrupada-card ${isOpen ? 'open' : ''}`}>
      {/* Cabecera clickeable responsiva */}
      <button className="agrupada-card-header" onClick={handleToggle} type="button">
        <div className="agrupada-site-info">
          <div className="agrupada-site-icon"><MapPin size={16}/></div>
          <div className="agrupada-site-headings">
            <div className="agrupada-site-title-line">
              <span className="agrupada-site-code">{sitio}</span>
              <span className="agrupada-site-loc"> · {localidad || 'Amazonas'}</span>
            </div>
            {sitioInfo?.zona && (
              <span className="agrupada-site-zone-pill">{sitioInfo.zona}</span>
            )}
          </div>
          <div className="agrupada-site-pills">
            {stats.pendientes > 0 && <span className="pill pill-yellow">{stats.pendientes} pendientes</span>}
            {stats.subsanadas > 0 && <span className="pill pill-green">{stats.subsanadas} subsanadas</span>}
            {stats.enRevision > 0 && <span className="pill pill-blue">{stats.enRevision} en revisión</span>}
            {stats.descartadas > 0 && <span className="pill pill-dark">{stats.descartadas} descartadas</span>}
          </div>
        </div>
        <div className="agrupada-site-meta">
          <span className="agrupada-total-pill">{stats.total} total</span>
          {loadingObs
            ? <Loader2 size={16} className="spinning" style={{color:'var(--primary-light)'}}/>
            : isOpen ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
        </div>
      </button>

      {/* Cuerpo: observaciones del sitio (lazy y adaptables a móvil) */}
      {isOpen && (
        <div className="agrupada-obs-list">
          {loadingObs ? (
            <div className="agrupada-loading-row">
              <Loader2 size={16} className="spinning"/>
              <span>Cargando observaciones de {sitio}{localidad ? ` (${localidad})` : ''}...</span>
            </div>
          ) : errorObs ? (
            <div className="agrupada-loading-row" style={{color:'#dc2626'}}>
              <AlertCircle size={15}/> {errorObs}
            </div>
          ) : obsData?.length === 0 ? (
            <div className="agrupada-loading-row" style={{color:'var(--text-muted)'}}>
              Sin observaciones con los filtros actuales
            </div>
          ) : (
            obsData?.map(o => (
              <div
                key={o.id_obs}
                className="agrupada-obs-row"
                onClick={() => onSelectObs({ ...o, id_sitio: sitio })}
              >
                <div className="agrupada-obs-col-main">
                  <div className="agrupada-obs-badges">
                    <span className="site-code-badge" style={{fontSize:'0.74rem'}}>{o.id_obs}</span>
                    {o.protocolo && (
                      <span className="agrupada-protocolo-tag" title={o.protocolo}>{o.protocolo}</span>
                    )}
                    {o.item && (
                      <span className="agrupada-item-tag" title={o.sub_item ? `${o.item} / ${o.sub_item}` : o.item}>
                        {o.item}
                      </span>
                    )}
                  </div>
                  <div className="agrupada-obs-detalle" title={o.detalle || ''}>
                    {o.detalle || '—'}
                  </div>
                  {o.acuerdo_subsanacion && (
                    <div className="agrupada-obs-acuerdo">
                      <strong>Acuerdo:</strong> {o.acuerdo_subsanacion}
                    </div>
                  )}
                </div>
                <div className="agrupada-obs-col-status">
                  <span className={`estado-badge ${estadoCovepaBadge(o.estado_covepa)}`}>
                    {o.estado_covepa || 'Pendiente'}
                  </span>
                  {o.fecha_subsanacion && (
                    <span className="agrupada-obs-fecha" title="Fecha de subsanación">
                      <Calendar size={12}/> {o.fecha_subsanacion.split('T')[0]}
                    </span>
                  )}
                  <button
                    type="button"
                    className="agrupada-view-btn"
                    onClick={(e) => { e.stopPropagation(); onSelectObs({ ...o, id_sitio: sitio }) }}
                    title="Ver y editar observación"
                  >
                    <Eye size={14}/> <span>Ver</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function GrupadaView({ resumen, loading, filtros, sitiosMap = {}, onSelectObs }) {
  const sitios = Object.keys(resumen).sort()

  if (loading) return (
    <div className="table-loading-state">
      <div className="loader-spinner"/>
      <p>Cargando observaciones agrupadas por sitio...</p>
    </div>
  )
  if (sitios.length === 0) return (
    <div className="table-empty-state">
      <ClipboardList size={48} opacity={0.3}/>
      <h3>Sin resultados</h3>
      <p>Ningún sitio tiene observaciones con los filtros aplicados.</p>
    </div>
  )

  const totalObs = Object.values(resumen).reduce((sum, s) => sum + (s.total || 0), 0)

  return (
    <div className="agrupada-container">
      <div className="agrupada-header">
        <span className="agrupada-total-label">
          <strong>{sitios.length}</strong> sitios con <strong>{totalObs.toLocaleString()}</strong> observaciones
        </span>
      </div>
      {sitios.map(sitio => (
        <SitioAcordeon
          key={sitio}
          sitio={sitio}
          sitioInfo={sitiosMap[sitio]}
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
  const [kpis, setKpis] = useState({ total: 0, pendientes: 0, subsanadas: 0, rechazadas: 0, descartadas: 0 })
  const [filtros, setFiltros] = useState({ protocolos: [], estadosCovepa: [], sitios: [] })
  const [loading, setLoading] = useState(true)
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingAgrupada, setLoadingAgrupada] = useState(false)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [selectedObs, setSelectedObs] = useState(null)
  const [vista, setVista] = useState('agrupada') // 'agrupada' (por sitio) es la vista principal predeterminada
  const [gruposData, setGruposData] = useState({})
  const [sitiosMap, setSitiosMap] = useState({})

  // Filtros activos (COVEPA)
  const [search, setSearch] = useState('')
  const [protocolo, setProtocolo] = useState('')
  const [estadoCovepa, setEstadoCovepa] = useState('')
  const [idSitio, setIdSitio] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const searchTimeout = useRef(null)

  const filtrosActivos = { search, protocolo, estadoCovepa, idSitio }

  // Carga inicial de filtros disponibles y catálogo de localidades
  useEffect(() => {
    fetchFiltrosObservaciones().then(setFiltros)
    getCachedSitiosAsignados().then(list => {
      const map = {}
      for (const s of (list || [])) {
        map[s.id_site] = s
      }
      setSitiosMap(map)
    })
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

  useEffect(() => {
    if (vista === 'tabla') {
      loadData(true)
    }
  }, [vista, search, protocolo, estadoCovepa, idSitio])
  useEffect(() => { if (vista === 'tabla' && page > 1) loadData() }, [page])
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
  const totalSitios = idSitio ? 1 : (filtros.sitios?.length || 156)

  return (
    <div className="obs-container">
      {/* ── MEDIDORES / KPIs REUTILIZABLES COVEPA (6 MÉTRICAS OPERATIVAS) ── */}
      <MetricGrid columns={6}>
        <MetricCard
          icon={<ClipboardList size={22} />}
          label="Total Observaciones"
          value={loadingKpis ? '—' : kpis.total.toLocaleString()}
          subtitle="de 4,116 registros"
          variant="navy"
          onClick={() => setEstadoCovepa('')}
          active={!estadoCovepa}
          title="Ver todas las observaciones registradas"
        />
        <MetricCard
          icon={<AlertCircle size={22} />}
          label="Pendientes"
          value={loadingKpis ? '—' : kpis.pendientes.toLocaleString()}
          subtitle="Por subsanar"
          variant="amber"
          onClick={() => setEstadoCovepa(prev => prev === 'Pendiente' ? '' : 'Pendiente')}
          active={estadoCovepa === 'Pendiente'}
          title="Filtrar por observaciones pendientes de subsanar"
        />
        <MetricCard
          icon={<CheckCircle2 size={22} />}
          label="Subsanadas / Subidas"
          value={loadingKpis ? '—' : kpis.subsanadas.toLocaleString()}
          subtitle="Validadas / Enviadas"
          variant="emerald"
          onClick={() => setEstadoCovepa(prev => prev === 'Validado' ? '' : 'Validado')}
          active={estadoCovepa === 'Validado'}
          title="Filtrar por observaciones validadas o subsanadas"
        />
        <MetricCard
          icon={<AlertTriangle size={22} />}
          label="Rechazadas"
          value={loadingKpis ? '—' : (kpis.rechazadas || 0).toLocaleString()}
          subtitle="Observadas por calidad"
          variant="rose"
          onClick={() => setEstadoCovepa(prev => prev === 'Rechazado' ? '' : 'Rechazado')}
          active={estadoCovepa === 'Rechazado'}
          title="Filtrar por observaciones rechazadas"
        />
        <MetricCard
          icon={<Ban size={22} />}
          label="Descartadas"
          value={loadingKpis ? '—' : kpis.descartadas.toLocaleString()}
          subtitle="Cerradas en campo"
          variant="purple"
          onClick={() => setEstadoCovepa(prev => prev === 'Descartado' ? '' : 'Descartado')}
          active={estadoCovepa === 'Descartado'}
          title="Filtrar por observaciones descartadas"
        />
        <MetricCard
          icon={<MapPin size={22} />}
          label="Total de Sitios"
          value={totalSitios}
          subtitle="Nodos georreferenciados"
          variant="sky"
          onClick={() => setIdSitio('')}
          active={Boolean(idSitio)}
          title={idSitio ? "Mostrar todos los sitios" : "156 sitios asignados en Amazonas"}
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
              {filtros.sitios.map(s => {
                const loc = sitiosMap[s]?.localidad
                return (
                  <option key={s} value={s}>
                    {s}{loc ? ` · ${loc}` : ''}
                  </option>
                )
              })}
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

          <div className="obs-toolbar-actions">
            <button
              className="refresh-btn"
              onClick={() => { loadData(true); loadKpis(); loadAgrupada() }}
              disabled={loading || loadingAgrupada}
              title="Refrescar datos"
            >
              <RefreshCw size={15} className={loading || loadingAgrupada ? 'spinning' : ''}/>
            </button>

            {/* Toggle vista: Por sitio (predeterminada) / Tabla */}
            <div className="vista-toggle">
              <button
                className={`vista-toggle-btn ${vista === 'agrupada' ? 'active' : ''}`}
                onClick={() => setVista('agrupada')}
                title="Vista agrupada por sitio"
              >
                <LayoutList size={15}/> Por sitio
              </button>
              <button
                className={`vista-toggle-btn ${vista === 'tabla' ? 'active' : ''}`}
                onClick={() => setVista('tabla')}
                title="Vista tabla detallada"
              >
                <Table2 size={15}/> Tabla
              </button>
            </div>

            <button className="obs-export-btn" onClick={handleExport} disabled={exporting} title="Exportar CSV">
              <FileDown size={15}/>
              <span>{exporting ? 'Exportando...' : 'Exportar CSV'}</span>
            </button>
          </div>
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
            filtros={filtrosActivos}
            sitiosMap={sitiosMap}
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
                  <th>Sitio / Localidad</th>
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
                    <td>
                      <div className="table-site-cell">
                        <span className="site-code-badge" style={{color:'var(--accent)'}}>{o.id_sitio}</span>
                        {sitiosMap[o.id_sitio]?.localidad && (
                          <span className="table-site-loc">{sitiosMap[o.id_sitio].localidad}</span>
                        )}
                      </div>
                    </td>
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
          sitiosMap={sitiosMap}
          onClose={() => setSelectedObs(null)}
          onSaved={handleObsSaved}
        />
      )}
    </div>
  )
}
