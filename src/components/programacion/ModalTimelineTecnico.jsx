import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Clock, X, MapPin, User, ShieldCheck, ChevronLeft, ChevronRight,
  TrendingUp, RefreshCw, AlertCircle, Filter, CheckCircle2, MessageSquare,
  ArrowRight, Calendar, Sparkles
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getTimelineActividadTecnico } from '../../services/actividadService'
import { usePresentationMode } from '../../context/PresentationContext'

/**
 * Modal Ejecutivo: Línea de Actividad Horizontal del Técnico
 * Muestra visualmente a lo largo de un carril horizontal en qué momento exacto
 * el técnico ha estado pidiendo validaciones y moviendo observaciones.
 * Cumple con el estándar tipográfico Inter y la Regla 1 (LOCALIDAD al lado de CÓDIGO DE SITIO).
 */
export default function ModalTimelineTecnico({
  tecnico,
  cuadrilla,
  fecha,
  siteIds = [],
  onClose,
  onOpenObservationDetail = null
}) {
  const { presentationMode } = usePresentationMode()
  const trackRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [timelineData, setTimelineData] = useState({ events: [], summary: { total: 0, solicitudes: 0, sitiosCount: 0, ultimaHora: '—' } })
  const [filterTipo, setFilterTipo] = useState('ALL') // 'ALL' | 'SOLICITUDES'
  const [sortOrder, setSortOrder] = useState('ASC') // 'ASC' (mañana -> tarde) | 'DESC' (recientes primero)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const nombreTecnico = tecnico?.nombre_completo || 'Técnico'

  // Cargar datos de la línea de tiempo
  const loadTimeline = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await getTimelineActividadTecnico({
        nombreTecnico,
        fecha,
        siteIds,
        cuadrilla: cuadrilla || tecnico?.cuadrilla
      })
      setTimelineData(res)
      if (res.events.length > 0) {
        setSelectedEvent(res.events[res.events.length - 1]) // seleccionar el último por defecto
      } else {
        setSelectedEvent(null)
      }
    } catch (err) {
      console.error('[TIMELINE-LOAD-ERROR]', err)
      setErrorMsg(err.message || 'Error cargando la línea de actividad.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTimeline()

    // Suscripción en tiempo real a nuevas solicitudes
    let debounceTimer = null
    const handleRealtime = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        loadTimeline()
      }, 600)
    }

    const channel = supabase
      .channel(`timeline-live-${fecha}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historial_estados_observaciones' }, handleRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'observaciones' }, handleRealtime)
      .subscribe()

    return () => {
      clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [fecha, nombreTecnico])

  // Cerrar únicamente con tecla Escape (o botón X)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Desplazamiento horizontal con botones de navegación
  const handleScrollLeft = () => {
    if (trackRef.current) {
      trackRef.current.scrollBy({ left: -340, behavior: 'smooth' })
    }
  }

  const handleScrollRight = () => {
    if (trackRef.current) {
      trackRef.current.scrollBy({ left: 340, behavior: 'smooth' })
    }
  }

  // Filtrado y ordenamiento de eventos en memoria
  const displayedEvents = useMemo(() => {
    let list = timelineData.events || []

    if (filterTipo === 'SOLICITUDES') {
      list = list.filter(e => e.isSolicitud || e.estado === 'Solicitando Revisión')
    }

    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime() || 0
      const tb = new Date(b.timestamp).getTime() || 0
      return sortOrder === 'ASC' ? ta - tb : tb - ta
    })

    return sorted
  }, [timelineData.events, filterTipo, sortOrder])

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

  // Renderizador de badge semántico de estado
  const renderEstadoBadge = (st, customLabel = null, customClass = null) => {
    if (customLabel) {
      const cls = customClass || (st === 'Validado' ? 'validado' : st === 'Rechazado' ? 'rechazado' : 'pendiente')
      return <span className={`prog-avance-badge ${cls}`}>{customLabel}</span>
    }

    switch (st) {
      case 'Validado':
      case 'Enviado':
        return <span className="prog-avance-badge validado">✓ Validada</span>
      case 'En Revision':
      case 'En Revisión':
        return <span className="prog-avance-badge revision">🔍 Pasó a En Revisión</span>
      case 'Solicitando Revision':
      case 'Solicitando Revisión':
        return <span className="prog-avance-badge solicitud">⏳ Solicitó Revisión</span>
      case 'Rechazado':
        return <span className="prog-avance-badge rechazado">✕ Rechazada</span>
      case 'Descartado':
        return <span className="prog-avance-badge descartado">🚫 Descartada</span>
      default:
        return <span className="prog-avance-badge pendiente">● {st || 'Pendiente'}</span>
    }
  }

  // Color e ícono del nodo conector según el evento
  const getNodeIndicator = (ev) => {
    const st = typeof ev === 'string' ? ev : (ev?.estado || '')
    const isSol = typeof ev === 'object' && (ev?.isSolicitud || ev?.tipo === 'SOLICITUD' || st === 'Solicitando Revisión' || st === 'Solicitando Revision')

    if (isSol) {
      return {
        bg: '#fef3c7',
        border: '#f59e0b',
        iconColor: '#d97706',
        label: 'Solicitud'
      }
    }
    if ((typeof ev === 'object' && ev?.tipo === 'EN_REVISION') || st === 'En Revisión' || st === 'En Revision') {
      return {
        bg: '#e0f2fe',
        border: '#0284c7',
        iconColor: '#0284c7',
        label: 'Revisión'
      }
    }
    if (st === 'Validado' || st === 'Enviado') {
      return {
        bg: '#dcfce7',
        border: '#10b981',
        iconColor: '#059669',
        label: 'Validado'
      }
    }
    if (st === 'Rechazado') {
      return {
        bg: '#ffe4e6',
        border: '#f43f5e',
        iconColor: '#e11d48',
        label: 'Rechazado'
      }
    }
    return {
      bg: '#f1f5f9',
      border: '#94a3b8',
      iconColor: '#475569',
      label: 'Cambio'
    }
  }

  return (
    <div className="prog-details-modal-overlay">
      <div className="prog-details-modal prog-timeline-modal" style={{ maxWidth: '1060px' }}>
        {/* Cabecera Ejecutiva del Modal */}
        <div className="prog-details-modal-header">
          <div className="prog-details-header-main">
            <div className="prog-details-site-title-row">
              <div
                className="prog-details-site-badge-icon"
                style={{ background: '#eff6ff', color: '#003060', borderColor: '#bfdbfe' }}
              >
                <Clock size={22} />
              </div>
              <div className="prog-details-site-texts">
                <div className="prog-details-title-line">
                  <h2 className="prog-details-site-title" style={{ fontFamily: 'var(--font-sans)', letterSpacing: 'normal' }}>
                    Línea de Actividad y Solicitudes
                  </h2>
                  <span className="prog-details-site-loc" style={{ textTransform: 'capitalize', color: '#475569', fontSize: 'var(--text-base)' }}>
                    · {formattedDate}
                  </span>
                </div>
                <div className="prog-details-site-meta-pills">
                  {!presentationMode && (
                    <span className="meta-pill" style={{ background: '#003060', color: '#ffffff', borderColor: '#003060', fontWeight: 'var(--fw-bold)' }}>
                      👤 {nombreTecnico}
                    </span>
                  )}
                  {cuadrilla && (
                    <span className="meta-pill" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd', fontWeight: 'var(--fw-bold)' }}>
                      🛡️ {cuadrilla}
                    </span>
                  )}
                  {timelineData.summary.ultimaSolicitud ? (
                    <span className="meta-pill" style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a', fontWeight: 'var(--fw-bold)' }}>
                      ⏳ Última solicitud de revisión: <strong>{timelineData.summary.ultimaSolicitud.timeAgo}</strong> ({timelineData.summary.ultimaSolicitud.hora})
                    </span>
                  ) : (
                    <span className="meta-pill" style={{ background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }}>
                      ⏳ Sin solicitudes de revisión hoy
                    </span>
                  )}
                  <span className="meta-pill" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <strong>{timelineData.summary.solicitudes}</strong> {timelineData.summary.solicitudes === 1 ? 'solicitud' : 'solicitudes'}
                  </span>
                  {timelineData.summary.sitiosCount > 0 && (
                    <span className="meta-pill" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      📍 {timelineData.summary.sitiosCount} {timelineData.summary.sitiosCount === 1 ? 'sitio activo' : 'sitios activos'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="prog-details-modal-actions">
            <button
              type="button"
              className="prog-export-btn"
              onClick={loadTimeline}
              disabled={loading}
              title="Refrescar actividad en tiempo real"
              style={{ background: '#ffffff', color: '#003060', borderColor: '#cbd5e1' }}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              <span>Actualizar</span>
            </button>
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

        {/* Barra de Filtros y Controles del Timeline */}
        <div className="prog-timeline-ctrl-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Filtro de Tipo */}
            <div className="prog-timeline-btn-group">
              <button
                type="button"
                className={`prog-timeline-toggle-btn ${filterTipo === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterTipo('ALL')}
              >
                Todos los eventos ({timelineData.events.length})
              </button>
              <button
                type="button"
                className={`prog-timeline-toggle-btn ${filterTipo === 'SOLICITUDES' ? 'active' : ''}`}
                onClick={() => setFilterTipo('SOLICITUDES')}
                style={filterTipo === 'SOLICITUDES' ? { background: '#fef3c7', color: '#b45309', borderColor: '#f59e0b' } : undefined}
              >
                ⏳ Solo Solicitudes ({timelineData.summary.solicitudes})
              </button>
            </div>

            {/* Orden Cronológico */}
            <div className="prog-timeline-btn-group">
              <button
                type="button"
                className={`prog-timeline-toggle-btn ${sortOrder === 'ASC' ? 'active' : ''}`}
                onClick={() => setSortOrder('ASC')}
                title="De la mañana hacia la tarde"
              >
                Mañana ➔ Tarde
              </button>
              <button
                type="button"
                className={`prog-timeline-toggle-btn ${sortOrder === 'DESC' ? 'active' : ''}`}
                onClick={() => setSortOrder('DESC')}
                title="Más recientes primero"
              >
                Recientes primero
              </button>
            </div>
          </div>

          {/* Flechas de Desplazamiento Horizontal */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
              Navegar carril:
            </span>
            <button
              type="button"
              className="prog-timeline-arrow-btn"
              onClick={handleScrollLeft}
              title="Desplazar hacia la izquierda"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="prog-timeline-arrow-btn"
              onClick={handleScrollRight}
              title="Desplazar hacia la derecha"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Cuerpo del Modal: Carril Horizontal */}
        <div className="prog-details-modal-body prog-timeline-modal-body">
          {loading ? (
            <div className="modal-state-msg">
              <RefreshCw size={24} className="spin" color="#0284c7" />
              <span>Consultando línea de actividad cronológica de {nombreTecnico}...</span>
            </div>
          ) : errorMsg ? (
            <div className="modal-state-msg error">{errorMsg}</div>
          ) : displayedEvents.length === 0 ? (
            <div className="modal-empty-filter-state" style={{ padding: '3.5rem 1.5rem' }}>
              <Clock size={36} color="#94a3b8" style={{ marginBottom: '0.5rem' }} />
              <p style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: '#003060', margin: '0.2rem 0' }}>
                Sin solicitudes de validación registradas
              </p>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: '420px', textAlign: 'center' }}>
                {filterTipo === 'SOLICITUDES'
                  ? 'No hay registros en estado "Solicitando Revisión" para este técnico en la fecha.'
                  : 'No se encontraron eventos o cambios de estado para la fecha seleccionada.'}
              </span>
              {filterTipo === 'SOLICITUDES' && timelineData.events.length > 0 && (
                <button
                  type="button"
                  className="btn-reset-filter primary"
                  onClick={() => setFilterTipo('ALL')}
                  style={{ marginTop: '0.75rem' }}
                >
                  Ver todos los eventos ({timelineData.events.length})
                </button>
              )}
            </div>
          ) : (
            <div className="prog-timeline-h-container">
              {/* Contenedor del Carril Desplazable */}
              <div className="prog-timeline-h-track" ref={trackRef}>
                {/* Eje / Línea Horizontal Continua */}
                <div className="prog-timeline-h-axis" />

                {/* Hitos Horizontales */}
                {displayedEvents.map((ev, idx) => {
                  const nodeInd = getNodeIndicator(ev)
                  const isSelected = selectedEvent?.id === ev.id
                  const isCurrentSolicitud = ev.isSolicitud || ev.estado === 'Solicitando Revisión'

                  return (
                    <div
                      key={ev.id || `${ev.id_obs}-${idx}`}
                      className={`prog-timeline-h-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setSelectedEvent(ev)}
                    >
                      {/* 1. Encabezado del Hito: Hora exacta y tiempo relativo */}
                      <div className="prog-timeline-time-box">
                        <span className="prog-timeline-hour-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {ev.hora}
                        </span>
                        {ev.timeAgo && (
                          <span className="prog-timeline-rel-text">
                            {ev.timeAgo}
                          </span>
                        )}
                      </div>

                      {/* 2. Nodo Conector Visual en el Eje */}
                      <div className="prog-timeline-node-wrap">
                        <div
                          className={`prog-timeline-node-pin ${isCurrentSolicitud ? 'pulse' : ''}`}
                          style={{
                            background: nodeInd.bg,
                            borderColor: nodeInd.border,
                            color: nodeInd.iconColor
                          }}
                          title={`Estado: ${ev.estado}`}
                        >
                          <span style={{ fontSize: 'var(--text-3xs)', fontWeight: 'var(--fw-black)' }}>
                            {idx + 1}
                          </span>
                        </div>
                        <div className="prog-timeline-stalk" />
                      </div>

                      {/* 3. Tarjeta de Solicitud / Observación */}
                      <div className={`prog-timeline-card ${isSelected ? 'active' : ''} ${isCurrentSolicitud ? 'is-solicitud' : ''}`}>
                        {/* Cabecera de la Tarjeta: Código de Sitio · Localidad (Regla 1) */}
                        <div className="prog-timeline-card-site">
                          <MapPin size={12} color="#0284c7" style={{ flexShrink: 0 }} />
                          <span className="prog-timeline-site-code">{ev.id_sitio}</span>
                          {ev.localidad && (
                            <span className="prog-timeline-site-loc">· {ev.localidad}</span>
                          )}
                        </div>

                        {/* Código de Observación y Estado */}
                        <div className="prog-timeline-card-mid">
                          <span className="prog-avance-obs-code" style={{ fontSize: 'var(--text-xs)' }}>
                            {ev.id_obs}
                          </span>
                          <div>{renderEstadoBadge(ev.estado, ev.badgeLabel, ev.badgeClass)}</div>
                        </div>

                        {/* Detalle o Subsistema */}
                        {ev.subsistema && (
                          <div className="prog-timeline-card-subsys">
                            <span>{ev.subsistema}</span>
                            {ev.protocolo && <span>· {ev.protocolo}</span>}
                          </div>
                        )}

                        {/* Acción y estado del evento */}
                        <div className={`prog-timeline-update-box ${ev.badgeClass || (ev.isSolicitud ? 'solicitud' : 'revision')}`}>
                          <span className={`update-box-dot ${ev.badgeClass || (ev.isSolicitud ? 'solicitud' : 'revision')}`} />
                          <span className="update-box-label">Acción:</span>
                          <strong className="update-box-state">{ev.accionLabel || `Se actualizó a: ${ev.estado}`}</strong>
                        </div>

                        {/* Comentario / Sustento técnico */}
                        {ev.comentario ? (
                          <div className="prog-timeline-card-comment" title={ev.comentario}>
                            <MessageSquare size={11} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>{ev.comentario}</span>
                          </div>
                        ) : (
                          <div className="prog-timeline-card-comment-empty">
                            <span>Solicitud de revisión técnica registrada en campo</span>
                          </div>
                        )}

                        {/* Pie de Tarjeta: Usuario */}
                        <div className="prog-timeline-card-foot">
                          <span className="prog-timeline-user-text">
                            👤 {ev.usuario}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Panel Inferior: Detalle Rápido del Evento Seleccionado */}
              {selectedEvent && (
                <div className="prog-timeline-detail-panel">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span className="prog-avance-obs-code" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)' }}>
                        {selectedEvent.id_obs}
                      </span>
                      <div className="prog-timeline-card-site" style={{ margin: 0 }}>
                        <MapPin size={13} color="#0284c7" />
                        <strong style={{ color: '#003060' }}>{selectedEvent.id_sitio}</strong>
                        {selectedEvent.localidad && (
                          <span style={{ color: 'var(--text-secondary)' }}>· {selectedEvent.localidad}</span>
                        )}
                      </div>
                      <div>{renderEstadoBadge(selectedEvent.estado)}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        🕒 Registrado a las <strong>{selectedEvent.hora}</strong> ({selectedEvent.timeAgo})
                      </span>
                      {onOpenObservationDetail && (
                        <button
                          type="button"
                          className="prog-avance-row-btn"
                          onClick={() => onOpenObservationDetail(selectedEvent)}
                          title="Abrir ventana de dictamen / detalle de esta observación"
                          style={{ height: '26px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: 'var(--text-2xs)' }}
                        >
                          <span>Ver Dictamen</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stepper Horizontal Expandido con las 3 Etapas */}
                  <div className="prog-timeline-stepper">
                    {/* Paso 1: Pidió Revisión */}
                    <div className={`stepper-step ${selectedEvent.lifecycle?.solicitado || selectedEvent.isSolicitud ? 'done' : 'waiting'}`}>
                      <div className="stepper-step-head">
                        <span className="stepper-step-badge">1</span>
                        <strong className="stepper-step-title">Pidió Revisión</strong>
                      </div>
                      <div className="stepper-step-body">
                        <span className="stepper-step-time">
                          {selectedEvent.lifecycle?.solicitado ? selectedEvent.lifecycle.solicitado.hora : selectedEvent.hora}
                        </span>
                        <span className="stepper-step-ago">
                          {selectedEvent.lifecycle?.solicitado?.timeAgo || selectedEvent.timeAgo || 'Hoy'}
                        </span>
                        <span className="stepper-step-user" title={selectedEvent.lifecycle?.solicitado?.usuario || selectedEvent.usuario}>
                          👤 {selectedEvent.lifecycle?.solicitado?.usuario || selectedEvent.usuario}
                        </span>
                      </div>
                    </div>

                    <div className="stepper-arrow-divider">
                      <ArrowRight size={14} color="#94a3b8" />
                    </div>

                    {/* Paso 2: En Revisión */}
                    <div className={`stepper-step ${selectedEvent.lifecycle?.enRevision ? 'done' : (selectedEvent.estado === 'En Revisión' ? 'current' : 'waiting')}`}>
                      <div className="stepper-step-head">
                        <span className="stepper-step-badge">2</span>
                        <strong className="stepper-step-title">Pasó a En Revisión</strong>
                      </div>
                      <div className="stepper-step-body">
                        <span className="stepper-step-time">
                          {selectedEvent.lifecycle?.enRevision ? selectedEvent.lifecycle.enRevision.hora : (selectedEvent.estado === 'En Revisión' ? 'En proceso' : '—')}
                        </span>
                        <span className="stepper-step-ago">
                          {selectedEvent.lifecycle?.enRevision?.timeAgo || (selectedEvent.estado === 'En Revisión' ? 'Tomada por auditor' : 'En cola')}
                        </span>
                        <span className="stepper-step-user" title={selectedEvent.lifecycle?.enRevision?.usuario || 'Auditoría COVEPA'}>
                          🔍 {selectedEvent.lifecycle?.enRevision?.usuario || (selectedEvent.estado === 'En Revisión' ? selectedEvent.usuario : 'Auditor COVEPA')}
                        </span>
                      </div>
                    </div>

                    <div className="stepper-arrow-divider">
                      <ArrowRight size={14} color="#94a3b8" />
                    </div>

                    {/* Paso 3: Validada / Dictaminada */}
                    <div className={`stepper-step ${selectedEvent.lifecycle?.validado ? 'done-valid' : (selectedEvent.lifecycle?.rechazado ? 'done-reject' : (selectedEvent.estado === 'Validado' ? 'done-valid' : 'waiting'))}`}>
                      <div className="stepper-step-head">
                        <span className="stepper-step-badge">3</span>
                        <strong className="stepper-step-title">
                          {selectedEvent.lifecycle?.rechazado || selectedEvent.estado === 'Rechazado' ? 'Rechazada' : 'Validada'}
                        </strong>
                      </div>
                      <div className="stepper-step-body">
                        <span className="stepper-step-time">
                          {selectedEvent.lifecycle?.validado
                            ? selectedEvent.lifecycle.validado.hora
                            : selectedEvent.lifecycle?.rechazado
                            ? selectedEvent.lifecycle.rechazado.hora
                            : (selectedEvent.estado === 'Validado' ? selectedEvent.hora : '—')}
                        </span>
                        <span className="stepper-step-ago">
                          {selectedEvent.lifecycle?.validado?.timeAgo ||
                            selectedEvent.lifecycle?.rechazado?.timeAgo ||
                            (selectedEvent.estado === 'Validado' ? selectedEvent.timeAgo : 'Por dictaminar')}
                        </span>
                        <span className="stepper-step-user" title={selectedEvent.lifecycle?.validado?.usuario || selectedEvent.lifecycle?.rechazado?.usuario || 'Mesa de Calidad'}>
                          {selectedEvent.lifecycle?.validado || selectedEvent.estado === 'Validado' ? '✓ ' : selectedEvent.lifecycle?.rechazado ? '✕ ' : '⏳ '}
                          {selectedEvent.lifecycle?.validado?.usuario || selectedEvent.lifecycle?.rechazado?.usuario || (selectedEvent.estado === 'Validado' ? selectedEvent.usuario : 'Mesa de Control')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedEvent.detalle && (
                    <div style={{ marginTop: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', background: '#ffffff', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <strong>Detalle:</strong> {selectedEvent.detalle}
                    </div>
                  )}

                  {selectedEvent.comentario && (
                    <div style={{ marginTop: '0.35rem', fontSize: 'var(--text-xs)', color: '#003060', background: '#f0f9ff', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                      <strong>Comentario técnico:</strong> {selectedEvent.comentario}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
