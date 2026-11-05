import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Search, Filter, RefreshCw, SlidersHorizontal, X, Eye, ChevronLeft,
  ChevronRight, ClipboardList, AlertCircle, CheckCircle2,
  AlertTriangle, FileText, Save, LayoutList, Table2,
  ChevronDown, ChevronUp, MapPin, Loader2, Calendar, Ban, UploadCloud, Layers, Clock,
  Users, Check, Info, History, CheckCheck, Send
} from 'lucide-react'
import HistorialEstadosTimeline from '../components/shared/HistorialEstadosTimeline'
import UltimoCambioBadge from '../components/shared/UltimoCambioBadge'
import TimeMaskInput, { diffTimeHHMM } from '../components/shared/TimeMaskInput'
import {
  fetchObservaciones, fetchObservacionesKPIs, fetchFiltrosObservaciones,
  updateObservacionCovepa, exportObservacionesCSV,
  fetchResumenPorSitio, fetchObservacionesPorSitio,
  pasarTodasSolicitudesAEnRevision,
  sincronizarEstadoConControlFotos,
  esRevisorGilat
} from '../services/observacionesService'
import {
  sincronizarAuditoriaObservacion,
  sincronizarComentarioObservacion,
  sincronizarJustificacionDemora,
  sincronizarTiemposEjecucion,
  resolverNombreAuditor
} from '../services/auditoriaSyncService'
import { getPersonalActivo } from '../services/programacionService'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../context/NotificationContext'
import { getCachedSitiosAsignados } from '../services/sitiosService'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'
import ErpTable from '../components/shared/ErpTable'
import { estadoCovepaBadge, hasMeaningfulText, getPeruDateStr, getPeruISOString } from '../utils/helpers'

// ────────────────────────────────────────────────────────────
// VENTANA EMERGENTE — Detalle Completo de Observación (Flujo Programación)
// ────────────────────────────────────────────────────────────
function ModalDetalleObservacion({ obs, sitiosMap = {}, gilatOptions = [], onClose, onSaved }) {
  const { user, personalMember, canEditDemoras, isAdmin, isReadOnly } = useAuth()
  const [obsLocal, setObsLocal] = useState(obs)
  const [updating, setUpdating] = useState(false)
  const [commentVal, setCommentVal] = useState(obs?.comentario_covepa || '')
  const [savingComment, setSavingComment] = useState(false)
  const [savedComment, setSavedComment] = useState(false)
  const [delayVal, setDelayVal] = useState(obs?.justificacion_demora || '')
  const [savingDelay, setSavingDelay] = useState(false)
  const [savedDelay, setSavedDelay] = useState(false)
  const [realTimeVal, setRealTimeVal] = useState(obs?.tiempo_ejecucion_real || '')
  const [delayTimeVal, setDelayTimeVal] = useState(obs?.tiempo_ejecucion_demora || '')
  const [savingTime, setSavingTime] = useState(false)
  const [savedTime, setSavedTime] = useState(false)
  const [showDemoraBox, setShowDemoraBox] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)
  const [historialRefreshKey, setHistorialRefreshKey] = useState(0)
  const isDirtyCommentRef = useRef(false)
  const commentValRef = useRef(commentVal)
  commentValRef.current = commentVal
  const isDirtyDelayRef = useRef(false)
  const delayValRef = useRef(delayVal)
  delayValRef.current = delayVal
  const isDirtyTimeRef = useRef(false)
  const realTimeRef = useRef(realTimeVal)
  realTimeRef.current = realTimeVal
  const delayTimeRef = useRef(delayTimeVal)
  delayTimeRef.current = delayTimeVal

  const sitioInfo = sitiosMap[obsLocal?.id_sitio] || {}
  const localidad = sitioInfo.localidad || sitioInfo.nombre_nodo || ''
  const cuadrilla = sitioInfo.cuadrilla || ''
  const zona = sitioInfo.zona || ''

  useEffect(() => {
    if (obs) {
      setObsLocal(obs)
      setCommentVal(obs.comentario_covepa || '')
      setDelayVal(obs.justificacion_demora || '')
      setRealTimeVal(obs.tiempo_ejecucion_real || '')
      setDelayTimeVal(obs.tiempo_ejecucion_demora || '')
      isDirtyCommentRef.current = false
      isDirtyDelayRef.current = false
      isDirtyTimeRef.current = false
      setShowDemoraBox(Boolean((obs.justificacion_demora && obs.justificacion_demora.trim()) || (obs.tiempo_ejecucion_real && obs.tiempo_ejecucion_real.trim()) || (obs.tiempo_ejecucion_demora && obs.tiempo_ejecucion_demora.trim())))

      // Carga bajo demanda de textos pesados (evita descargarlos en la lista general para ahorrar egress)
      if (obs.comentario_final === undefined || obs.comentario_pronatel === undefined || obs.comentario_inicial === undefined) {
        supabase
          .from('observaciones')
          .select('comentario_inicial, comentario_complementario, comentario_final, comentario_pronatel, acuerdo_subsanacion')
          .eq('id_obs', obs.id_obs)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setObsLocal(prev => ({ ...prev, ...data }))
            }
          })
          .catch(err => console.warn('Advertencia cargando textos bajo demanda:', err))
      }
    }
  }, [obs?.id_obs])

  const currentEstado = obsLocal?.estado_covepa || (obsLocal?.fecha_subsanacion ? 'Validado' : 'Pendiente')
  const isEnRevCurrent = currentEstado === 'Pendiente' || currentEstado === 'Solicitando Revisión' || currentEstado === 'Solicitando Revision' || currentEstado === 'En Revision' || currentEstado === 'En Revisión' || currentEstado === 'Documentación' || currentEstado === 'Documentacion'
  const currentRevisor = isEnRevCurrent ? '' : (obsLocal?.revisor || obsLocal?.validado_por || '')
  const currentFecha = isEnRevCurrent ? '' : (obsLocal?.fecha_subsanacion || '')
  const showRevisorYFecha = !isEnRevCurrent

  // Guardado de comentario en tiempo real (COVEPA)
  const saveCommentNow = useCallback(async () => {
    if (!isDirtyCommentRef.current || !obsLocal?.id_obs) return
    setSavingComment(true)
    try {
      const val = commentValRef.current || ''
      // Nota: Nunca autocompleta ni modifica el campo revisor
      const responsableSesion = resolverNombreAuditor(user, personalMember)
      await sincronizarComentarioObservacion(obsLocal.id_obs, val, obsLocal.id_sitio, {
        usuarioNombre: responsableSesion,
        usuarioEmail: user?.email,
        usuarioId: user?.id,
        origen: 'observaciones',
        estadoActual: obsLocal.estado_covepa || 'Pendiente'
      })
      setHistorialRefreshKey(k => k + 1)
      isDirtyCommentRef.current = false
      setSavedComment(true)
      setTimeout(() => setSavedComment(false), 2500)
      if (onSaved) {
        onSaved({ ...obsLocal, comentario_covepa: val })
      }
    } catch (err) {
      console.error('Error al guardar comentario COVEPA:', err)
    } finally {
      setSavingComment(false)
    }
  }, [obsLocal, onSaved, user, personalMember])

  // Guardado de justificación de demora en tiempo real (COVEPA)
  const saveDelayNow = useCallback(async () => {
    if (!isDirtyDelayRef.current || !obsLocal?.id_obs) return
    setSavingDelay(true)
    try {
      const val = delayValRef.current || ''
      const justificacionLimpia = val.trim() !== '' ? val.trim() : null
      const responsableSesion = resolverNombreAuditor(user, personalMember)
      await sincronizarJustificacionDemora(obsLocal.id_obs, justificacionLimpia, obsLocal.id_sitio, {
        usuarioNombre: responsableSesion,
        usuarioEmail: user?.email,
        usuarioId: user?.id,
        origen: 'observaciones',
        estadoActual: obsLocal.estado_covepa || 'Pendiente'
      })
      isDirtyDelayRef.current = false
      setSavedDelay(true)
      setTimeout(() => setSavedDelay(false), 2500)
      setHistorialRefreshKey(k => k + 1)
      const ahoraIso = justificacionLimpia ? new Date().toISOString() : null
      setObsLocal(prev => ({ ...prev, justificacion_demora: justificacionLimpia, fecha_registro_demora: ahoraIso }))
      if (onSaved) {
        onSaved({ ...obsLocal, justificacion_demora: justificacionLimpia, fecha_registro_demora: ahoraIso })
      }
    } catch (err) {
      console.error('Error al guardar justificación de demora:', err)
    } finally {
      setSavingDelay(false)
    }
  }, [obsLocal, onSaved, user, personalMember])

  // Guardado de tiempos de ejecución en tiempo real (COVEPA)
  const saveTimeNow = useCallback(async () => {
    if (!isDirtyTimeRef.current || !obsLocal?.id_obs) return
    setSavingTime(true)
    try {
      const tReal = realTimeRef.current ? realTimeRef.current.trim() : null
      const tDemora = delayTimeRef.current ? delayTimeRef.current.trim() : null
      const responsableSesion = resolverNombreAuditor(user, personalMember)
      await sincronizarTiemposEjecucion(obsLocal.id_obs, { tiempoReal: tReal, tiempoDemora: tDemora }, obsLocal.id_sitio, {
        usuarioNombre: responsableSesion,
        usuarioEmail: user?.email,
        usuarioId: user?.id,
        origen: 'observaciones',
        estadoActual: obsLocal.estado_covepa || 'Pendiente'
      })
      isDirtyTimeRef.current = false
      setSavedTime(true)
      setTimeout(() => setSavedTime(false), 2500)
      setHistorialRefreshKey(k => k + 1)
      if (onSaved) {
        onSaved({ ...obsLocal, tiempo_ejecucion_real: tReal, tiempo_ejecucion_demora: tDemora })
      }
    } catch (err) {
      console.error('Error al guardar tiempos de ejecución:', err)
    } finally {
      setSavingTime(false)
    }
  }, [obsLocal, onSaved, user, personalMember])

  const diffInfo = useMemo(() => diffTimeHHMM(realTimeVal, delayTimeVal), [realTimeVal, delayTimeVal])
  const hasDelayData = Boolean((delayVal && delayVal.trim()) || (realTimeVal && realTimeVal.trim()) || (delayTimeVal && delayTimeVal.trim()))
  const isDemoraExpanded = hasDelayData || showDemoraBox

  const handleCommentChange = (e) => {
    setCommentVal(e.target.value)
    isDirtyCommentRef.current = true
  }

  const handleBlurComment = () => {
    saveCommentNow()
  }

  const handleDelayChange = (e) => {
    setDelayVal(e.target.value)
    isDirtyDelayRef.current = true
  }

  const handleBlurDelay = () => {
    saveDelayNow()
  }

  const handleCloseWithAutoSave = useCallback(async () => {
    if (isDirtyCommentRef.current) {
      await saveCommentNow()
    }
    if (isDirtyDelayRef.current) {
      await saveDelayNow()
    }
    if (isDirtyTimeRef.current) {
      await saveTimeNow()
    }
    onClose()
  }, [onClose, saveCommentNow, saveDelayNow])

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseWithAutoSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCloseWithAutoSave])

  // 1. Cambio de Estado — Flujo idéntico a Programación (sincronización con Control Fotos + Historial)
  const handleSetEstado = async (nuevoEstado) => {
    setUpdating(true)
    try {
      // 1. Responsable del cambio: SIEMPRE obtenido de la sesión activa
      const responsableSesion = resolverNombreAuditor(user, personalMember)

      // 2. Revisor asignado: Solo conservar si es de GILAT, NUNCA autocompletar con la sesión
      // En 'En Revisión', 'Solicitando Revisión' o 'Documentación' NUNCA debe haber revisor asignado
      const esEnRev = nuevoEstado === 'En Revisión' || nuevoEstado === 'En Revision' || nuevoEstado === 'Solicitando Revisión' || nuevoEstado === 'Solicitando Revision' || nuevoEstado === 'Documentación' || nuevoEstado === 'Documentacion'
      const revisorGilatActual = esEnRev ? null : (esRevisorGilat(obsLocal.revisor, gilatOptions) ? obsLocal.revisor : null)

      const comentarioActual = commentValRef.current ?? obsLocal.comentario_covepa ?? null
      const fechaIso = getPeruISOString()

      await sincronizarEstadoConControlFotos(
        obsLocal.id_obs,
        nuevoEstado,
        revisorGilatActual,
        comentarioActual,
        {
          idSitio: obsLocal.id_sitio,
          fechaSubsanacionPrevia: obsLocal.fecha_subsanacion,
          estadoAnterior: obsLocal.estado_covepa || (obsLocal.fecha_subsanacion ? 'Validado' : 'Pendiente'),
          usuarioNombre: responsableSesion,
          usuarioEmail: user?.email,
          usuarioId: personalMember?.id_personal || user?.id,
          origen: 'observaciones'
        }
      )

      const updatedRow = {
        ...obsLocal,
        estado_covepa: nuevoEstado,
        fecha_subsanacion: fechaIso,
        revisor: revisorGilatActual,
        comentario_covepa: comentarioActual
      }

      setObsLocal(updatedRow)
      setHistorialRefreshKey(k => k + 1)
      if (onSaved) onSaved(updatedRow)
    } catch (err) {
      alert('Error actualizando estado de observación: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  // 2. Modificar Revisor — Flujo idéntico a Programación
  const handleUpdateRevisor = async (newRevisor) => {
    setUpdating(true)
    try {
      const st = obsLocal?.estado_covepa || ''
      if (st === 'En Revisión' || st === 'En Revision' || st === 'Solicitando Revisión' || st === 'Solicitando Revision') {
        alert('Una observación con estado En Revisión no puede tener revisor asignado.')
        return
      }
      // Regla: En revisores solo va personal de Gilat
      const val = (newRevisor && esRevisorGilat(newRevisor, gilatOptions)) ? newRevisor : null
      await updateObservacionCovepa(obsLocal.id_obs, { revisor: val, id_sitio: obsLocal.id_sitio })
      const updatedRow = { ...obsLocal, revisor: val }
      setObsLocal(updatedRow)
      if (onSaved) onSaved(updatedRow)
    } catch (err) {
      alert('Error actualizando revisor: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  // 3. Modificar Fecha — Flujo idéntico a Programación
  const handleUpdateFecha = async (newFecha) => {
    setUpdating(true)
    try {
      const valFecha = newFecha ? getPeruISOString(newFecha) : null
      await updateObservacionCovepa(obsLocal.id_obs, { fecha_subsanacion: valFecha, id_sitio: obsLocal.id_sitio })
      const updatedRow = { ...obsLocal, fecha_subsanacion: valFecha }
      setObsLocal(updatedRow)
      if (onSaved) onSaved(updatedRow)
    } catch (err) {
      alert('Error actualizando fecha: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  if (!obsLocal) return null

  return (
    <div className="prog-details-modal-overlay">
      <div className="prog-details-modal" style={{ maxWidth: '920px', width: '95%' }} onClick={e => e.stopPropagation()}>
        {/* Cabecera de la Ventana Emergente */}
        <div className="prog-details-modal-header">
          <div className="prog-details-header-main">
            <div className="prog-details-site-title-row">
              <div className="prog-details-site-badge-icon">
                <FileText size={20} />
              </div>
              <div className="prog-details-site-texts">
                <div className="prog-details-title-line">
                  <span className="prog-details-site-title">{obsLocal.id_obs}</span>
                  <span className="prog-details-site-loc">· {obsLocal.id_sitio}{localidad ? ` · ${localidad}` : ''}{zona ? ` · ${zona}` : ''}</span>
                </div>
                <div className="prog-details-site-meta-pills">
                  {cuadrilla && (
                    <span className="meta-pill" style={{ color: '#003060', fontWeight: 'var(--fw-bold)' }}>
                      {cuadrilla}
                    </span>
                  )}
                  {obsLocal.hito && (
                    <span className="meta-pill" style={{ color: '#0369a1' }}>
                      Hito: <strong>{obsLocal.hito}</strong>
                    </span>
                  )}
                  {obsLocal.protocolo && (
                    <span className="meta-pill">
                      Protocolo: <strong>{obsLocal.protocolo}</strong>
                    </span>
                  )}
                  {obsLocal.subsistema && (
                    <span className="meta-pill">
                      Subsistema: <strong>{obsLocal.subsistema}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="prog-details-modal-actions">
            <button
              type="button"
              className="prog-modal-close-btn"
              onClick={handleCloseWithAutoSave}
              title="Cerrar ventana emergente (Esc)"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Cuerpo con Scroll de la Ventana Emergente */}
        <div className="prog-details-modal-body">
          {/* 1. SECCIÓN PRINCIPAL: GESTIÓN DE AUDITORÍA COVEPA (IDÉNTICO A PROGRAMACIÓN) */}
          <div className="prog-obs-card-item" style={{ border: '1px solid #bae6fd', background: '#f8fbfe', borderRadius: '12px', padding: '1rem' }}>
            <div className="prog-obs-card-header" style={{ marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: '#003060', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Auditoría COVEPA:
                </span>
                <span className={`estado-badge ${estadoCovepaBadge(currentEstado)}`}>
                  {currentEstado}
                </span>
              </div>

              {/* Selector de Estado interactivo idéntico al de Programación */}
              <div className="prog-obs-status-select-wrap">
                <select
                  value={currentEstado}
                  disabled={updating || isReadOnly}
                  onChange={(e) => handleSetEstado(e.target.value)}
                  className={`prog-obs-status-select status-${(currentEstado || '').toLowerCase().replace(/\s+/g, '-')}`}
                  style={isReadOnly ? { cursor: 'not-allowed', opacity: 0.9 } : undefined}
                >
                  <option value="Pendiente">● Pendiente</option>
                  <option value="Solicitando Revisión">⏳ Solicitando Revisión</option>
                  <option value="En Revisión">🔍 En Revisión</option>
                  <option value="Documentación">📄 Documentación</option>
                  <option value="Validado">✓ Validado</option>
                  <option value="Descartado">🚫 Descartado</option>
                  <option value="Rechazado">✕ Rechazado</option>
                </select>
              </div>
            </div>

            {/* Insignia Directa de Último Cambio y Trazabilidad (Exclusivo Administrador) */}
            {isAdmin && (
              <div style={{ marginBottom: '0.75rem' }}>
                <UltimoCambioBadge
                  idObs={obsLocal.id_obs}
                  refreshKey={historialRefreshKey}
                  initialOpen={showHistorial}
                />
              </div>
            )}

            {/* Barra de Auditoría: Revisor GILAT y Fecha */}
            {showRevisorYFecha && (
              <div className="prog-obs-audit-bar" style={{ marginBottom: '0.75rem' }}>
                <div className="audit-col">
                  <label className="audit-label">
                    <Users size={12} color="#0284c7" />
                    <span>Revisado por:</span>
                  </label>
                  <select
                    value={esRevisorGilat(currentRevisor, gilatOptions) ? currentRevisor : ''}
                    disabled={updating || isReadOnly}
                    onChange={(e) => handleUpdateRevisor(e.target.value)}
                    className="audit-select"
                    title="Persona de GILAT que revisó esta observación"
                    style={isReadOnly ? { cursor: 'not-allowed' } : undefined}
                  >
                    <option value="">-- Seleccionar Revisor (GILAT) --</option>
                    {gilatOptions.map(p => (
                      <option key={p.id || p.nombre_completo} value={p.nombre_completo}>
                        {p.nombre_completo} {p.cargo && p.cargo !== 'Empresa' ? `(${p.cargo})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="audit-col">
                  <label className="audit-label">
                    <Clock size={12} color="#0284c7" />
                    <span>
                      {currentEstado === 'Validado' ? 'F. Validación:' :
                       currentEstado === 'Descartado' ? 'F. Descarte:' :
                       currentEstado === 'Rechazado' ? 'F. Rechazo:' :
                       currentEstado === 'Enviado' ? 'F. Envío:' : 'Fecha:'}
                    </span>
                  </label>
                  <input
                    type="date"
                    value={currentFecha ? String(currentFecha).split('T')[0].split(' ')[0] : ''}
                    disabled={updating || isReadOnly}
                    onChange={(e) => handleUpdateFecha(e.target.value)}
                    className="audit-date-input"
                    title="Modificar fecha de subsanación/revisión"
                    style={isReadOnly ? { cursor: 'not-allowed' } : undefined}
                  />
                </div>
              </div>
            )}

            {/* Caja de Comentario COVEPA con autoguardado */}
            <div className="obs-content-box box-covepa" style={{ margin: 0 }}>
              <div className="box-covepa-top">
                <span className="box-label">💬 Comentario / Evidencias COVEPA:</span>
                <div className="covepa-save-cluster">
                  {savingComment && (
                    <span className="save-tag saving">
                      <RefreshCw size={11} className="spin" /> Guardando...
                    </span>
                  )}
                  {savedComment && (
                    <span className="save-tag saved">
                      <Check size={12} /> Guardado
                    </span>
                  )}
                </div>
              </div>
              <textarea
                value={commentVal}
                readOnly={isReadOnly}
                onChange={isReadOnly ? undefined : handleCommentChange}
                onBlur={isReadOnly ? undefined : handleBlurComment}
                placeholder={isReadOnly ? 'Sin comentarios COVEPA registrados (Solo lectura).' : 'Escribe comentarios de subsanación, evidencias o notas técnicas COVEPA...'}
                className="covepa-comment-textarea"
                rows={3}
                style={isReadOnly ? { background: '#f8fafc', cursor: 'default' } : undefined}
              />
            </div>

            {/* Caja de Justificación de Demora y Tiempos de Ejecución Colapsable */}
            {!isDemoraExpanded ? (
              canEditDemoras ? (
                <div style={{ marginTop: '0.85rem' }}>
                  <button
                    type="button"
                    className="btn-add-demora"
                    onClick={() => setShowDemoraBox(true)}
                  >
                    <AlertTriangle size={13} color="#d97706" />
                    <span>+ Agregar Demora / Tiempos</span>
                  </button>
                </div>
              ) : null
            ) : (
              <div className="obs-content-box box-demora" style={{ margin: '0.85rem 0 0 0', borderLeft: '4px solid #f59e0b', background: '#fffdf5', border: '1px solid #fde68a', borderLeftWidth: '4px', borderRadius: '8px', padding: '0.75rem' }}>
                <div className="box-covepa-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span className="box-label" style={{ color: '#b45309', fontWeight: 'var(--fw-bold)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <AlertTriangle size={13} color="#d97706" /> Tiempos de Ejecución y Control de Demoras:
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="covepa-save-cluster">
                      {(savingDelay || savingTime) && (
                        <span className="save-tag saving">
                          <RefreshCw size={11} className="spin" /> Guardando...
                        </span>
                      )}
                      {(savedDelay || savedTime) && (
                        <span className="save-tag saved">
                          <Check size={12} /> Guardado
                        </span>
                      )}
                    </div>
                    {!hasDelayData && canEditDemoras && (
                      <button
                        type="button"
                        className="btn-collapse-demora"
                        onClick={() => setShowDemoraBox(false)}
                        title="Ocultar sección de demoras"
                      >
                        <ChevronUp size={13} />
                        <span>Ocultar</span>
                      </button>
                    )}
                  </div>
                </div>

              {/* Selectores con máscara de tiempo (HH:MM) */}
              <div className="time-cluster-grid">
                <TimeMaskInput
                  label="⏱️ Tiempo Real de Ejecución:"
                  value={realTimeVal}
                  placeholder="00:00"
                  disabled={!canEditDemoras}
                  title="Tiempo neto/real trabajado en la subsanación (HH:MM)"
                  onChange={(val) => {
                    if (!canEditDemoras) return
                    setRealTimeVal(val)
                    isDirtyTimeRef.current = true
                  }}
                  onBlur={canEditDemoras ? saveTimeNow : undefined}
                />
                <TimeMaskInput
                  label="⏳ Tiempo de Ejecución con Demoras:"
                  value={delayTimeVal}
                  placeholder="00:00"
                  variant="warning"
                  disabled={!canEditDemoras}
                  title="Tiempo total considerando demoras o incidentes (HH:MM)"
                  onChange={(val) => {
                    if (!canEditDemoras) return
                    setDelayTimeVal(val)
                    isDirtyTimeRef.current = true
                  }}
                  onBlur={canEditDemoras ? saveTimeNow : undefined}
                />
              </div>

              {diffInfo && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0.45rem' }}>
                  {diffInfo.hasDelay && (
                    <span className="time-diff-badge delay">
                      ⚠️ Retraso neto: +{diffInfo.formatted} ({diffInfo.diffMins} min adicionales)
                    </span>
                  )}
                  {diffInfo.isEqual && (
                    <span className="time-diff-badge ontime">
                      ✓ Ejecutado dentro del plazo regular estimado
                    </span>
                  )}
                  {diffInfo.isFaster && (
                    <span className="time-diff-badge faster">
                      ⚡ Finalizado {diffInfo.formatted} antes del tiempo estimado
                    </span>
                  )}
                </div>
              )}

              <textarea
                value={delayVal}
                readOnly={!canEditDemoras}
                onChange={canEditDemoras ? handleDelayChange : undefined}
                onBlur={canEditDemoras ? handleBlurDelay : undefined}
                placeholder={!canEditDemoras ? 'Sin justificación de demora registrada.' : 'Si esta observación tomó más tiempo del debido o tuvo incidentes, redacta aquí el sustento técnico (dejar vacío si no hubo problemas de demora)...'}
                className="covepa-comment-textarea"
                rows={2}
                style={{ borderColor: '#fde68a', background: !canEditDemoras ? '#fafafa' : undefined, cursor: !canEditDemoras ? 'default' : undefined }}
              />
              {obsLocal?.fecha_registro_demora && (
                <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: '#b45309' }}>
                  <Calendar size={11} color="#b45309" />
                  <span>Demora registrada: {getPeruDateStr(obsLocal.fecha_registro_demora)}</span>
                </div>
              )}
              <div style={{ fontSize: 'var(--text-meta)', marginTop: '0.35rem', color: '#78716c' }}>
                {delayVal && delayVal.trim() ? (
                  <span style={{ color: '#b45309', fontWeight: 'var(--fw-medium)' }}>
                    ⚠️ Incidente registrado: observación con retraso justificado
                  </span>
                ) : (
                  <span style={{ color: '#059669', fontWeight: 'var(--fw-medium)' }}>
                    ✓ Sin incidentes de demora (subsanación en plazo regular)
                  </span>
                )}
              </div>
            </div>
            )}
          </div>

          {/* 2. INFORMACIÓN COMPLETA DE LA BASE DE DATOS */}
          <div className="obs-modal-section-title">
            <Info size={14} /> Ficha Técnica Completa de la Observación
          </div>

          <div className="obs-modal-meta-grid">
            <div className="obs-meta-card">
              <span className="obs-meta-label">Código Obs</span>
              <span className="obs-meta-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                {obsLocal.id_obs}
              </span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">Hito</span>
              <span className="obs-meta-value">{obsLocal.hito || '—'}</span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">Sitio</span>
              <span className="obs-meta-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {obsLocal.id_sitio}
              </span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">Localidad</span>
              <span className="obs-meta-value">{localidad || '—'}</span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">Zona</span>
              <span className="obs-meta-value">{zona || '—'}</span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">Cuadrilla</span>
              <span className="obs-meta-value">{cuadrilla || 'Sin Cuadrilla'}</span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">Protocolo</span>
              <span className="obs-meta-value">{obsLocal.protocolo || '—'}</span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">Subsistema</span>
              <span className="obs-meta-value">{obsLocal.subsistema || '—'}</span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">Ítem</span>
              <span className="obs-meta-value">{obsLocal.item || '—'}</span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">Sub-ítem</span>
              <span className="obs-meta-value">{obsLocal.sub_item || '—'}</span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">Estado GILAT</span>
              <span className="obs-meta-value" style={{ fontWeight: 'var(--fw-bold)', color: '#0369a1' }}>
                {obsLocal.estado_gilat || '—'}
              </span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">Estado PRONATEL</span>
              <span className="obs-meta-value" style={{ fontWeight: 'var(--fw-bold)', color: '#6b21a8' }}>
                {obsLocal.estado_pronatel || '—'}
              </span>
            </div>
            <div className="obs-meta-card">
              <span className="obs-meta-label">F. Subsanación</span>
              <span className="obs-meta-value" style={{ fontFamily: 'var(--font-mono)', color: obsLocal.fecha_subsanacion ? '#059669' : '#64748b' }}>
                {obsLocal.fecha_subsanacion ? getPeruDateStr(obsLocal.fecha_subsanacion) : 'Sin fecha'}
              </span>
            </div>
          </div>

          {/* Cajas de Detalle y Acuerdos */}
          <div className="prog-obs-blocks-wrap">
            {/* Detalle */}
            {hasMeaningfulText(obsLocal.detalle) && (
              <div className="obs-content-box box-detalle">
                <span className="box-label">Detalle de la Observación:</span>
                <div className="box-body-text">{obsLocal.detalle}</div>
              </div>
            )}

            {/* Acuerdo de Subsanación */}
            {hasMeaningfulText(obsLocal.acuerdo_subsanacion) && (
              <div className="obs-content-box box-acuerdo">
                <span className="box-label">Acuerdo de Subsanación:</span>
                <div className="box-body-text">{obsLocal.acuerdo_subsanacion}</div>
              </div>
            )}

            {/* Comentario Inicial */}
            {hasMeaningfulText(obsLocal.comentario_inicial) && (
              <div className="obs-content-box box-inicial">
                <span className="box-label">Comentario Inicial (Expediente):</span>
                <div className="box-body-text">{obsLocal.comentario_inicial}</div>
              </div>
            )}

            {/* Comentario Complementario */}
            {hasMeaningfulText(obsLocal.comentario_complementario) && obsLocal.comentario_complementario !== '0' && (
              <div className="obs-content-box box-complementario">
                <span className="box-label">Comentario Complementario:</span>
                <div className="box-body-text">{obsLocal.comentario_complementario}</div>
              </div>
            )}

            {/* Comentario Final */}
            {hasMeaningfulText(obsLocal.comentario_final) && (
              <div className="obs-content-box box-final">
                <span className="box-label">Comentario Final:</span>
                <div className="box-body-text">{obsLocal.comentario_final}</div>
              </div>
            )}

            {/* Comentario PRONATEL */}
            {hasMeaningfulText(obsLocal.comentario_pronatel) && (
              <div className="obs-content-box box-pronatel">
                <span className="box-label">Comentario PRONATEL:</span>
                <div className="box-body-text">{obsLocal.comentario_pronatel}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// VISTA AGRUPADA POR SITIO — LAZY LOADING por acordeón
// ────────────────────────────────────────────────────────────
// Componente reutilizable para cabeceras ordenables
function TableHeaderSortable({ label, field, currentField, currentDirection, onSort, className = '', align = 'left' }) {
  const isSorted = currentField === field
  const isAsc = currentDirection === 'asc'

  return (
    <th
      className={`${className} th-sortable ${isSorted ? 'is-sorted' : ''}`}
      onClick={() => onSort(field)}
      style={{ textAlign: align }}
      title={`Ordenar por ${label} (${isSorted ? (isAsc ? 'Mayor a menor Z-A / 9-1' : 'Menor a mayor A-Z / 1-9') : 'Clic para ordenar A-Z'})`}
    >
      <div className={`sort-header-inner align-${align}`}>
        <span>{label}</span>
        <span className={`sort-indicator ${isSorted ? 'active' : 'inactive'}`}>
          {isSorted ? (isAsc ? '▲' : '▼') : '↕'}
        </span>
      </div>
    </th>
  )
}

function SitioAcordeon({ sitio, stats, filtros, sitioInfo, onSelectObs, gilatOptions = [] }) {
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
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px', flexWrap: 'wrap' }}>
              {sitioInfo?.cuadrilla && (
                <span className="agrupada-site-zone-pill" style={{ background: 'rgba(0, 48, 96, 0.08)', color: '#003060', border: '1px solid rgba(0, 48, 96, 0.15)', fontWeight: 'var(--fw-bold)' }}>
                  {sitioInfo.cuadrilla}
                </span>
              )}
              {sitioInfo?.zona && (
                <span className="agrupada-site-zone-pill">{sitioInfo.zona}</span>
              )}
            </div>
          </div>
          <div className="agrupada-site-pills">
            {stats.pendientes > 0 && <span className="pill pill-yellow">{stats.pendientes} pendientes</span>}
            {stats.enviadas > 0 && <span className="pill pill-purple">{stats.enviadas} subidas</span>}
            {stats.validadas > 0 && <span className="pill pill-green">{stats.validadas} validadas</span>}
            {stats.rechazadas > 0 && <span className="pill pill-red">{stats.rechazadas} rechazadas</span>}
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

      {/* Cuerpo: observaciones del sitio con el mismo formato que en la vista de tabla */}
      {isOpen && (
        <div className="agrupada-obs-list" style={{ padding: 0 }}>
          {loadingObs ? (
            <div className="agrupada-loading-row" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <Loader2 size={16} className="spinning"/>
              <span>Cargando observaciones de {sitio}{localidad ? ` (${localidad})` : ''}...</span>
            </div>
          ) : errorObs ? (
            <div className="agrupada-loading-row" style={{ color: '#dc2626', padding: '1.25rem' }}>
              <AlertCircle size={15}/> {errorObs}
            </div>
          ) : obsData?.length === 0 ? (
            <div className="agrupada-loading-row" style={{ color: 'var(--text-muted)', padding: '1.5rem' }}>
              Sin observaciones con los filtros actuales
            </div>
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table className="sitios-table" style={{ margin: 0, width: '100%' }}>
                <colgroup>
                  <col className="col-obs-cod" />
                  <col className="col-obs-cuadrilla" />
                  <col className="col-obs-sitio" />
                  <col className="col-obs-localidad" />
                  <col className="col-obs-zona" />
                  <col className="col-obs-estado" />
                  <col className="col-obs-fecha" />
                  <col className="col-obs-revisor" />
                  <col className="col-obs-demora" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="col-obs-cod">Código</th>
                    <th className="col-obs-cuadrilla">Cuadrilla</th>
                    <th className="col-obs-sitio">
                      <span className="col-header-full">Código de Sitio</span>
                      <span className="col-header-short">Sitio</span>
                    </th>
                    <th className="col-obs-localidad">Localidad</th>
                    <th className="col-obs-zona">Zona</th>
                    <th className="col-obs-estado">
                      <span className="col-header-full">Estado COVEPA</span>
                      <span className="col-header-short">Estado</span>
                    </th>
                    <th className="col-obs-fecha">
                      <span className="col-header-full">Fecha de Revisión</span>
                      <span className="col-header-short">Fecha</span>
                    </th>
                    <th className="col-obs-revisor">Revisado por</th>
                    <th className="col-obs-demora" style={{ textAlign: 'center' }}>¿Tuvo Demora?</th>
                  </tr>
                </thead>
                <tbody>
                  {obsData.map(o => {
                    const revisorNombre = o.revisor || o.validado_por || ''
                    return (
                      <tr
                        key={o.id_obs}
                        className="sitio-row"
                        onClick={() => onSelectObs({ ...o, id_sitio: sitio })}
                      >
                        <td className="col-obs-cod"><span className="site-code-badge">{o.id_obs}</span></td>
                        <td className="col-obs-cuadrilla">
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.22rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 'var(--fw-bold)',
                              background: 'rgba(0, 48, 96, 0.08)',
                              border: '1px solid rgba(0, 48, 96, 0.18)',
                              color: '#003060',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {sitioInfo?.cuadrilla || 'Sin Cuadrilla'}
                          </span>
                        </td>
                        <td className="col-obs-sitio">
                          <span className="site-code-badge" style={{ color: 'var(--accent)' }}>
                            {sitio}
                          </span>
                        </td>
                        <td className="col-obs-localidad">
                          <span className="obs-localidad-text" title={localidad || ''}>
                            {localidad || '—'}
                          </span>
                        </td>
                        <td className="col-obs-zona">
                          {sitioInfo?.zona ? (
                            <span className="obs-zona-pill">{sitioInfo.zona}</span>
                          ) : (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td className="col-obs-estado">
                          <span className={`estado-badge ${estadoCovepaBadge(o.estado_covepa)}`}>
                            {o.estado_covepa || 'Pendiente'}
                          </span>
                        </td>
                        <td className="col-obs-fecha">
                          <span style={{ fontSize: 'var(--text-sm)', color: o.fecha_subsanacion ? 'var(--accent)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {o.fecha_subsanacion ? getPeruDateStr(o.fecha_subsanacion) : '—'}
                          </span>
                        </td>
                        <td className="col-obs-revisor">
                          {(() => {
                            const stNorm = o.estado_covepa || ''
                            const isEnRev = stNorm === 'En Revisión' || stNorm === 'En Revision' || stNorm === 'Solicitando Revisión' || stNorm === 'Solicitando Revision' || stNorm === 'Pendiente'
                            const revNom = isEnRev ? '' : revisorNombre
                            return (!isEnRev && esRevisorGilat(revNom, gilatOptions)) ? (
                              <span className="obs-revisor-pill" title={revNom}>
                                <Users size={12} color="#2563eb" style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {revNom}
                                </span>
                              </span>
                            ) : (
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>—</span>
                            )
                          })()}
                        </td>
                        <td className="col-obs-demora cell-obs-demora" style={{ textAlign: 'center' }}>
                          {o.justificacion_demora && o.justificacion_demora.trim() ? (
                            <span
                              className="obs-demora-pill"
                              title={`Justificación:\n${o.justificacion_demora}${o.fecha_registro_demora ? `\n\nFecha de registro: ${getPeruDateStr(o.fecha_registro_demora)}` : ''}`}
                            >
                              <AlertTriangle size={12} color="#d97706" style={{ flexShrink: 0 }} />
                              Tuvo Demora
                            </span>
                          ) : (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GrupadaView({ resumen, loading, filtros, sitiosMap = {}, onSelectObs, gilatOptions = [] }) {
  const sitios = Object.keys(resumen).sort()

  if (loading) return (
    <div className="table-loading-state" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', padding: '3.5rem 1.5rem', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
      <div className="loader-spinner"/>
      <p>Cargando observaciones agrupadas por sitio...</p>
    </div>
  )
  if (sitios.length === 0) return (
    <div className="table-empty-state" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', padding: '3.5rem 1.5rem', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
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
          gilatOptions={gilatOptions}
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
  const [kpis, setKpis] = useState({ total: 0, pendientes: 0, solicitando: 0, enRevision: 0, documentacion: 0, validadas: 0, rechazadas: 0, descartadas: 0 })
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
  const [tecnicos, setTecnicos] = useState([])

  // Personal auditor y revisor oficial de GILAT (100% desde la Base de Datos)
  const gilatOptions = useMemo(() => {
    return (tecnicos || [])
      .filter(t => {
        if (!t || !t.nombre_completo) return false
        const emp = (t.empresa || '').toUpperCase()
        return emp.includes('GILAT')
      })
      .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))
  }, [tecnicos])

  // Filtros activos (COVEPA)
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [protocolo, setProtocolo] = useState('')
  const [estadoCovepa, setEstadoCovepa] = useState(() => searchParams.get('estado') || '')
  const [idSitio, setIdSitio] = useState('')
  const [cuadrilla, setCuadrilla] = useState('')
  const [filtroDemora, setFiltroDemora] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Ordenamiento interactivo por cabeceras de columna
  const [sortField, setSortField] = useState('codigo') // 'codigo' | 'cuadrilla' | 'sitio' | 'localidad' | 'zona' | 'estado' | 'fecha' | 'revisor' | 'demora'
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' | 'desc'

  const { user, personalMember, isReadOnly } = useAuth()
  const { notificarPaseEnRevision } = useNotifications()
  const [batchLoading, setBatchLoading] = useState(false)

  // Pasar todas las observaciones que solicitan revisión a En Revisión (un solo clic, sin ventanas emergentes de navegador)
  const handlePasarTodasAEnRevision = async () => {
    if (batchLoading) return

    setBatchLoading(true)
    try {
      const nombreResponsable = resolverNombreAuditor(user, personalMember, 'Coordinador COVEPA')
      const res = await pasarTodasSolicitudesAEnRevision({
        nombre: nombreResponsable,
        email: user?.email,
        id: personalMember?.id_personal || user?.id
      })

      if (res.count > 0) {
        if (notificarPaseEnRevision) {
          await notificarPaseEnRevision(res)
        }
        await Promise.all([
          loadKpis(),
          loadData(true),
          vista === 'agrupada' ? loadAgrupada() : Promise.resolve()
        ])
      } else if (res.programaciones && res.programaciones.length > 0) {
        if (notificarPaseEnRevision) {
          await notificarPaseEnRevision({
            count: res.programaciones.length,
            items: [],
            codes: res.programaciones.map(p => p.idSitio || p.cuadrilla || 'Programación').filter(Boolean)
          })
        }
      } else {
        if (notificarPaseEnRevision) {
          await notificarPaseEnRevision({ count: 0, items: [], codes: [] })
        }
        await loadKpis()
      }
    } catch (err) {
      console.error('[BATCH-REVISION] Error al pasar observaciones a En Revisión:', err)
    } finally {
      setBatchLoading(false)
    }
  }

  // Panel flotante superpuesto para filtros (Popover)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const filterPopoverRef = useRef(null)

  useEffect(() => {
    if (!filterPopoverOpen) return
    const handleClickOutside = (e) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target)) {
        setFilterPopoverOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setFilterPopoverOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [filterPopoverOpen])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (cuadrilla) count++
    if (protocolo) count++
    if (idSitio) count++
    if (estadoCovepa) count++
    if (filtroDemora) count++
    return count
  }, [cuadrilla, protocolo, idSitio, estadoCovepa, filtroDemora])

  const clearAdvancedFilters = () => {
    setCuadrilla('')
    setProtocolo('')
    setIdSitio('')
    setEstadoCovepa('')
    setFiltroDemora('')
    setPage(1)
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const searchTimeout = useRef(null)

  // Sincronizar parámetros de URL provenientes de notificaciones
  useEffect(() => {
    const q = searchParams.get('search')
    const est = searchParams.get('estado')
    if (q !== null && q !== undefined) {
      setSearch(q)
      setVista('lista')
    }
    if (est !== null && est !== undefined) {
      setEstadoCovepa(est)
    }
  }, [searchParams])

  const siteIdsForCuadrilla = useMemo(() => {
    if (!cuadrilla) return null
    return Object.values(sitiosMap)
      .filter(s => (s.cuadrilla || s.grupo || '').replace(/GRUPO/gi, 'CUADRILLA') === cuadrilla)
      .map(s => s.id_site)
  }, [cuadrilla, sitiosMap])

  const filtrosActivos = useMemo(() => ({
    search,
    protocolo,
    estadoCovepa,
    idSitio,
    idSitios: siteIdsForCuadrilla,
    filtroDemora
  }), [search, protocolo, estadoCovepa, idSitio, siteIdsForCuadrilla, filtroDemora])

  const loadKpis = useCallback(async () => {
    setLoadingKpis(true)
    try {
      const k = await fetchObservacionesKPIs()
      setKpis(k)
    } finally {
      setLoadingKpis(false)
    }
  }, [])

  // Carga de datos
  const loadData = useCallback(async (resetPage = false) => {
    const currentPage = resetPage ? 1 : page
    if (resetPage) setPage(1)
    setLoading(true)
    setError(null)
    try {
      const result = await fetchObservaciones({
        ...filtrosActivos,
        page: currentPage,
        pageSize,
        sortBy: sortField,
        sortOrder: sortDirection
      })
      setObservaciones(result.data)
      setTotalCount(result.count)

      // Si viene una observación específica por URL (desde notificación), abrir su modal directamente
      const targetQuery = searchParams.get('search')
      if (targetQuery && result.data && result.data.length > 0) {
        const cleanTarget = targetQuery.trim().toLowerCase()
        const match = result.data.find(o => o.id_obs.toLowerCase() === cleanTarget)
        if (match) {
          setSelectedObs(match)
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filtrosActivos, page, pageSize, sortField, sortDirection, searchParams])

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
  }, [vista, filtrosActivos])

  // Carga inicial coordinada: KPIs globales, catálogo de localidades, personal y opciones de filtros
  useEffect(() => {
    Promise.all([
      loadKpis(),
      fetchFiltrosObservaciones().then(setFiltros).catch(() => {}),
      getCachedSitiosAsignados().then(list => {
        const map = {}
        for (const s of (list || [])) {
          map[s.id_site] = s
        }
        setSitiosMap(map)
      }).catch(() => {}),
      getPersonalActivo().then(list => setTecnicos(list || [])).catch(() => {})
    ])
  }, [loadKpis])

  useEffect(() => {
    if (vista === 'tabla') {
      loadData(true)
    }
  }, [vista, search, protocolo, estadoCovepa, idSitio, cuadrilla, filtroDemora])
  useEffect(() => { if (vista === 'tabla' && page > 1) loadData() }, [page])
  useEffect(() => { if (vista === 'tabla') loadData(false) }, [sortField, sortDirection])
  useEffect(() => { loadAgrupada() }, [vista, search, protocolo, estadoCovepa, idSitio, cuadrilla, filtroDemora])

  const handleSearchChange = (val) => {
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setSearch(val), 300)
  }

  const clearFilters = () => {
    setSearch(''); setProtocolo(''); setEstadoCovepa(''); setIdSitio(''); setCuadrilla(''); setFiltroDemora(''); setPage(1)
    const el = document.getElementById('obs-search-input')
    if (el) el.value = ''
  }

  const hasActiveFilters = Boolean(search || protocolo || estadoCovepa || idSitio || cuadrilla || filtroDemora)

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await exportObservacionesCSV(filtrosActivos)
      const cols = [
        'id_obs', 'cuadrilla', 'id_sitio', 'localidad', 'zona', 'hito', 'protocolo', 'subsistema', 'detalle', 'item', 'sub_item',
        'comentario_inicial', 'comentario_complementario', 'comentario_final',
        'acuerdo_subsanacion', 'estado_gilat', 'estado_pronatel', 'comentario_pronatel', 'estado_covepa', 'fecha_subsanacion', 'revisor', 'comentario_covepa', 'justificacion_demora'
      ]
      const header = cols.join(',')
      const rows = data.map(r => cols.map(c => {
        let v = r[c] ?? ''
        if (c === 'cuadrilla') v = sitiosMap[r.id_sitio]?.cuadrilla || ''
        if (c === 'localidad') v = sitiosMap[r.id_sitio]?.localidad || ''
        if (c === 'zona') v = sitiosMap[r.id_sitio]?.zona || ''
        if (c === 'revisor') {
          const st = r.estado_covepa || ''
          const isEnRev = st === 'En Revisión' || st === 'En Revision' || st === 'Solicitando Revisión' || st === 'Solicitando Revision' || st === 'Pendiente'
          v = (isEnRev || !esRevisorGilat(v, gilatOptions)) ? '' : v
        }
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
    if (vista === 'agrupada') {
      loadAgrupada()
    }
  }

  const observacionesOrdenadas = useMemo(() => {
    if (!observaciones || observaciones.length === 0) return []
    const list = [...observaciones]
    const dir = sortDirection === 'asc' ? 1 : -1

    return list.sort((a, b) => {
      const sInfoA = sitiosMap[a.id_sitio] || {}
      const sInfoB = sitiosMap[b.id_sitio] || {}

      switch (sortField) {
        case 'codigo': {
          const valA = a.id_obs || ''
          const valB = b.id_obs || ''
          return dir * valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
        }
        case 'cuadrilla': {
          const valA = sInfoA.cuadrilla || ''
          const valB = sInfoB.cuadrilla || ''
          return dir * valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
        }
        case 'sitio': {
          const valA = a.id_sitio || ''
          const valB = b.id_sitio || ''
          return dir * valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
        }
        case 'localidad': {
          const valA = sInfoA.localidad || ''
          const valB = sInfoB.localidad || ''
          return dir * valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
        }
        case 'zona': {
          const valA = sInfoA.zona || ''
          const valB = sInfoB.zona || ''
          return dir * valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
        }
        case 'estado': {
          const valA = a.estado_covepa || 'Pendiente'
          const valB = b.estado_covepa || 'Pendiente'
          return dir * valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
        }
        case 'fecha': {
          const valA = a.fecha_subsanacion || ''
          const valB = b.fecha_subsanacion || ''
          if (!valA && !valB) return 0
          if (!valA) return 1
          if (!valB) return -1
          return dir * (new Date(valA) - new Date(valB))
        }
        case 'revisor': {
          const valA = a.revisor || a.validado_por || ''
          const valB = b.revisor || b.validado_por || ''
          if (!valA && !valB) return 0
          if (!valA) return 1
          if (!valB) return -1
          return dir * valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
        }
        case 'demora': {
          const hasDemoraA = Boolean(a.justificacion_demora && a.justificacion_demora.trim()) ? 1 : 0
          const hasDemoraB = Boolean(b.justificacion_demora && b.justificacion_demora.trim()) ? 1 : 0
          return dir * (hasDemoraB - hasDemoraA)
        }
        default:
          return 0
      }
    })
  }, [observaciones, sortField, sortDirection, sitiosMap])

  const totalPages = Math.ceil(totalCount / pageSize) || 1
  const totalSitios = idSitio ? 1 : (filtros.sitios?.length || 156)

  const obsColumns = useMemo(() => [
    {
      key: 'codigo',
      label: 'Código',
      className: 'col-obs-cod',
      align: 'left',
      sortable: true,
      render: (o) => <span className="site-code-badge">{o.id_obs}</span>
    },
    {
      key: 'cuadrilla',
      label: 'Cuadrilla',
      className: 'col-obs-cuadrilla',
      align: 'left',
      sortable: true,
      render: (o) => {
        const sInfo = sitiosMap[o.id_sitio] || {}
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '0.22rem 0.55rem',
              borderRadius: '6px',
              fontWeight: 'var(--fw-bold)',
              background: 'rgba(0, 48, 96, 0.08)',
              border: '1px solid rgba(0, 48, 96, 0.18)',
              color: '#003060',
              whiteSpace: 'nowrap'
            }}
            className="t-meta"
          >
            {sInfo.cuadrilla || 'Sin Cuadrilla'}
          </span>
        )
      }
    },
    {
      key: 'sitio',
      label: (
        <>
          <span className="col-header-full">Código de Sitio</span>
          <span className="col-header-short">Sitio</span>
        </>
      ),
      title: 'Código de Sitio',
      className: 'col-obs-sitio',
      align: 'left',
      sortable: true,
      render: (o) => (
        <span className="site-code-badge" style={{ color: 'var(--accent)' }}>
          {o.id_sitio}
        </span>
      )
    },
    {
      key: 'localidad',
      label: 'Localidad',
      className: 'col-obs-localidad',
      align: 'left',
      sortable: true,
      render: (o) => {
        const sInfo = sitiosMap[o.id_sitio] || {}
        return (
          <span className="obs-localidad-text" title={sInfo.localidad || ''}>
            {sInfo.localidad || '—'}
          </span>
        )
      }
    },
    {
      key: 'zona',
      label: 'Zona',
      className: 'col-obs-zona',
      cellClassName: 'cell-obs-zona',
      align: 'center',
      sortable: true,
      render: (o) => {
        const sInfo = sitiosMap[o.id_sitio] || {}
        return sInfo.zona ? (
          <span className="obs-zona-pill">{sInfo.zona}</span>
        ) : (
          <span className="t-meta" style={{ color: 'var(--text-muted)' }}>—</span>
        )
      }
    },
    {
      key: 'estado',
      label: (
        <>
          <span className="col-header-full">Estado COVEPA</span>
          <span className="col-header-short">Estado</span>
        </>
      ),
      title: 'Estado COVEPA',
      className: 'col-obs-estado',
      align: 'left',
      sortable: true,
      render: (o) => (
        <span className={`estado-badge ${estadoCovepaBadge(o.estado_covepa)}`}>
          {o.estado_covepa || 'Pendiente'}
        </span>
      )
    },
    {
      key: 'fecha',
      label: (
        <>
          <span className="col-header-full">Fecha de Revisión</span>
          <span className="col-header-short">Fecha</span>
        </>
      ),
      title: 'Fecha de Revisión',
      className: 'col-obs-fecha',
      cellClassName: 'cell-obs-fecha',
      align: 'center',
      sortable: true,
      render: (o) => (
        <span className="t-meta" style={{ color: o.fecha_subsanacion ? 'var(--accent)' : 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {o.fecha_subsanacion ? getPeruDateStr(o.fecha_subsanacion) : '—'}
        </span>
      )
    },
    {
      key: 'revisor',
      label: 'Revisado por',
      className: 'col-obs-revisor',
      align: 'left',
      sortable: true,
      render: (o) => {
        const stNorm = o.estado_covepa || ''
        const isEnRev = stNorm === 'En Revisión' || stNorm === 'En Revision' || stNorm === 'Solicitando Revisión' || stNorm === 'Solicitando Revision' || stNorm === 'Pendiente'
        const revisorNombre = isEnRev ? '' : (o.revisor || o.validado_por || '')
        return (!isEnRev && esRevisorGilat(revisorNombre, gilatOptions)) ? (
          <span className="obs-revisor-pill" title={revisorNombre}>
            <Users size={12} color="#2563eb" style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {revisorNombre}
            </span>
          </span>
        ) : (
          <span className="t-meta" style={{ color: 'var(--text-muted)' }}>—</span>
        )
      }
    },
    {
      key: 'demora',
      label: '¿Tuvo Demora?',
      className: 'col-obs-demora',
      cellClassName: 'cell-obs-demora',
      align: 'center',
      sortable: true,
      render: (o) => (
        o.justificacion_demora && o.justificacion_demora.trim() ? (
          <span
            className="obs-demora-pill"
            title={`Justificación:\n${o.justificacion_demora}${o.fecha_registro_demora ? `\n\nFecha de registro: ${getPeruDateStr(o.fecha_registro_demora)}` : ''}`}
          >
            <AlertTriangle size={12} color="#d97706" style={{ flexShrink: 0 }} />
            Tuvo Demora
          </span>
        ) : (
          <span className="t-meta" style={{ color: 'var(--text-muted)' }}>—</span>
        )
      )
    }
  ], [sitiosMap, gilatOptions])

  return (
    <div className="obs-container">
      {/* ── ZONA FIJA SUPERIOR: MEDIDORES + TOOLBAR + ERROR (PÁGINA ESTÁTICA) ── */}
      <div className="obs-fixed-top">
        <MetricGrid columns={8}>
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
          subtitle="Por subsanar en campo"
          variant="amber"
          onClick={() => setEstadoCovepa(prev => prev === 'Pendiente' ? '' : 'Pendiente')}
          active={estadoCovepa === 'Pendiente'}
          title="Filtrar por observaciones pendientes de subsanar"
        />
        <MetricCard
          icon={<Clock size={22} />}
          label="Solicitando Revisión"
          value={loadingKpis ? '—' : (kpis.solicitando || 0).toLocaleString()}
          subtitle="En espera de revisión"
          variant="orange"
          onClick={() => setEstadoCovepa(prev => (prev === 'Solicitando Revisión' || prev === 'Solicitando Revision') ? '' : 'Solicitando Revisión')}
          active={estadoCovepa === 'Solicitando Revisión' || estadoCovepa === 'Solicitando Revision'}
          title="Filtrar por observaciones que solicitan revisión"
        />
        <MetricCard
          icon={<UploadCloud size={22} />}
          label="En Revisión"
          value={loadingKpis ? '—' : (kpis.enRevision || 0).toLocaleString()}
          subtitle="Auditoría en proceso"
          variant="sky"
          onClick={() => setEstadoCovepa(prev => (prev === 'En Revision' || prev === 'En Revisión') ? '' : 'En Revisión')}
          active={estadoCovepa === 'En Revision' || estadoCovepa === 'En Revisión'}
          title="Filtrar por observaciones en proceso de auditoría"
        />
        <MetricCard
          icon={<FileText size={22} />}
          label="Documentación"
          value={loadingKpis ? '—' : (kpis.documentacion || 0).toLocaleString()}
          subtitle="En proceso de informe"
          variant="indigo"
          onClick={() => setEstadoCovepa(prev => (prev === 'Documentación' || prev === 'Documentacion') ? '' : 'Documentación')}
          active={estadoCovepa === 'Documentación' || estadoCovepa === 'Documentacion'}
          title="Filtrar por observaciones en proceso de documentación"
        />
        <MetricCard
          icon={<CheckCircle2 size={22} />}
          label="Validadas"
          value={loadingKpis ? '—' : (kpis.validadas || 0).toLocaleString()}
          subtitle="Subsanación conforme"
          variant="emerald"
          onClick={() => setEstadoCovepa(prev => prev === 'Validado' ? '' : 'Validado')}
          active={estadoCovepa === 'Validado'}
          title="Filtrar por observaciones validadas formalmente"
        />
        <MetricCard
          icon={<AlertTriangle size={22} />}
          label="Rechazadas"
          value={loadingKpis ? '—' : (kpis.rechazadas || 0).toLocaleString()}
          subtitle="Observadas por calidad"
          variant="rose"
          onClick={() => setEstadoCovepa(prev => prev === 'Rechazado' ? '' : 'Rechazado')}
          active={estadoCovepa === 'Rechazado'}
          title="Filtrar por observaciones rechazadas que requieren corrección"
        />
        <MetricCard
          icon={<Ban size={22} />}
          label="Descartadas"
          value={loadingKpis ? '—' : (kpis.descartadas || 0).toLocaleString()}
          subtitle="Cerradas / no procede"
          variant="purple"
          onClick={() => setEstadoCovepa(prev => prev === 'Descartado' ? '' : 'Descartado')}
          active={estadoCovepa === 'Descartado'}
          title="Filtrar por observaciones descartadas"
        />
      </MetricGrid>

      {/* ── Toolbar Filtros — Fila 1: Buscador + Filtros | Fila 2: Acciones + Switch ── */}
      <div className="obs-toolbar">
        {/* Fila 1: Buscador y Filtros comparten el espacio */}
        <div className="obs-toolbar-row-search-filter">
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
                title="Borrar texto de búsqueda"
              >
                <X size={15}/>
              </button>
            )}
          </div>

          {/* Ancla y Tarjeta Superpuesta de Filtros (Popover) */}
          <div className="obs-filter-popover-anchor" ref={filterPopoverRef}>
            <button
              type="button"
              className={`obs-filter-trigger-btn ${activeFilterCount > 0 ? 'has-active' : ''}`}
              onClick={() => setFilterPopoverOpen(prev => !prev)}
              title="Filtros avanzados"
            >
              <SlidersHorizontal size={15} />
              <span>Filtros</span>
              {activeFilterCount > 0 && (
                <span className="obs-filter-count-badge">{activeFilterCount}</span>
              )}
            </button>

            {filterPopoverOpen && (
              <div className="obs-filter-popover-card">
                <div className="obs-filter-popover-header">
                  <div className="t-name flex items-center gap-1.5" style={{ color: 'var(--primary)' }}>
                    <Filter size={14} />
                    <span>Filtros de observaciones</span>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      className="obs-popover-clear-btn"
                      onClick={clearAdvancedFilters}
                      title="Restablecer filtros"
                    >
                      <X size={12} /> Limpiar ({activeFilterCount})
                    </button>
                  )}
                </div>

                <div className="obs-filter-popover-body">
                  {/* Cuadrilla */}
                  <div className="obs-popover-field">
                    <label className="obs-popover-label">
                      <Layers size={12} /> Cuadrilla
                    </label>
                    <select
                      className="popover-select"
                      value={cuadrilla}
                      onChange={e => { setCuadrilla(e.target.value); setPage(1) }}
                    >
                      <option value="">Todas las Cuadrillas</option>
                      <option value="CUADRILLA 1">CUADRILLA 1</option>
                      <option value="CUADRILLA 2">CUADRILLA 2</option>
                      <option value="CUADRILLA 3">CUADRILLA 3</option>
                      <option value="CUADRILLA 4">CUADRILLA 4</option>
                      <option value="CUADRILLA 5">CUADRILLA 5</option>
                      <option value="CUADRILLA 6">CUADRILLA 6</option>
                    </select>
                  </div>

                  {/* Protocolo */}
                  <div className="obs-popover-field">
                    <label className="obs-popover-label">
                      <FileText size={12} /> Protocolo
                    </label>
                    <select
                      className="popover-select"
                      value={protocolo}
                      onChange={e => { setProtocolo(e.target.value); setPage(1) }}
                    >
                      <option value="">Todos los Protocolos</option>
                      {filtros.protocolos.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sitio */}
                  <div className="obs-popover-field">
                    <label className="obs-popover-label">
                      <MapPin size={12} /> Sitio / Localidad
                    </label>
                    <select
                      className="popover-select"
                      value={idSitio}
                      onChange={e => { setIdSitio(e.target.value); setPage(1) }}
                    >
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

                  {/* Estado COVEPA */}
                  <div className="obs-popover-field">
                    <label className="obs-popover-label">
                      <Filter size={12} /> Estado COVEPA
                    </label>
                    <select
                      className="popover-select"
                      value={estadoCovepa}
                      onChange={e => { setEstadoCovepa(e.target.value); setPage(1) }}
                    >
                      <option value="">Todos los Estados</option>
                      {filtros.estadosCovepa.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Demora / Incidentes */}
                  <div className="obs-popover-field">
                    <label className="obs-popover-label">
                      <AlertTriangle size={12} /> Demora / Incidentes
                    </label>
                    <select
                      className="popover-select"
                      value={filtroDemora}
                      onChange={e => { setFiltroDemora(e.target.value); setPage(1) }}
                    >
                      <option value="">Todas (Demora / Incidentes)</option>
                      <option value="CON_DEMORA">⚠️ Con Demora Justificada</option>
                      <option value="SIN_DEMORA">✓ Sin Demora (Normal)</option>
                    </select>
                  </div>
                </div>

                <div className="obs-filter-popover-footer">
                  <button
                    type="button"
                    className="obs-popover-apply-btn"
                    onClick={() => setFilterPopoverOpen(false)}
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botón Refrescar (en Fila 1 junto al buscador y filtros) */}
          <button
            className="refresh-btn"
            onClick={() => { loadData(true); loadKpis(); loadAgrupada() }}
            disabled={loading || loadingAgrupada}
            title="Refrescar datos"
          >
            <RefreshCw size={15} className={loading || loadingAgrupada ? 'spinning' : ''}/>
          </button>
        </div>

        {/* Fila 2: Solo Botón Revisión a la izquierda y Switch a la derecha */}
        <div className="obs-toolbar-row-actions">
          {/* Botón Pasar a En Revisión (Oculto para modo solo lectura / Invitado) */}
          {!isReadOnly ? (
            <button
              type="button"
              className={`obs-batch-revision-btn ${(kpis.solicitando || 0) === 0 ? 'is-empty' : ''}`}
              onClick={handlePasarTodasAEnRevision}
              disabled={batchLoading}
              title={
                (kpis.solicitando || 0) > 0
                  ? `Pasar las ${kpis.solicitando} observaciones en espera a 'En Revisión'`
                  : 'Pasar observaciones solicitando revisión a En Revisión'
              }
            >
              {batchLoading ? (
                <RefreshCw size={14} className="spinning" />
              ) : (
                <CheckCheck size={15} />
              )}
              <span className="obs-batch-text-desktop">
                {batchLoading ? 'Procesando...' : 'Pasar a En Revisión'}
              </span>
              <span className="obs-batch-text-mobile">
                {batchLoading ? 'Procesando...' : 'Revisar'}
              </span>
              <span className="obs-batch-count-badge">
                {kpis.solicitando || 0}
              </span>
            </button>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 'var(--fw-medium)', padding: '0.4rem 0.6rem' }}>
              <span>👁️ Modo Solo Lectura</span>
            </div>
          )}

          {/* Toggle vista: Por sitio (predeterminada) / Tabla */}
          <div className="vista-toggle">
            <button
              className={`vista-toggle-btn ${vista === 'agrupada' ? 'active' : ''}`}
              onClick={() => setVista('agrupada')}
              title="Vista agrupada por sitio"
            >
              <LayoutList size={14}/> <span>Por sitio</span>
            </button>
            <button
              className={`vista-toggle-btn ${vista === 'tabla' ? 'active' : ''}`}
              onClick={() => setVista('tabla')}
              title="Vista tabla detallada"
            >
              <Table2 size={14}/> <span>Tabla</span>
            </button>
          </div>
        </div>
      </div>

        {/* ── Error ── */}
        {error && (
          <div className="sitios-error-banner"><AlertCircle size={18}/> {error}</div>
        )}
      </div>

      {/* ── Vista Agrupada o Tabla ── */}
      {vista === 'agrupada' ? (
        <div className="obs-agrupada-wrapper">
          <GrupadaView
            resumen={gruposData}
            loading={loadingAgrupada}
            filtros={filtrosActivos}
            sitiosMap={sitiosMap}
            onSelectObs={obs => setSelectedObs(obs)}
            gilatOptions={gilatOptions}
          />
        </div>
      ) : (
        <ErpTable
          columns={obsColumns}
          data={observacionesOrdenadas}
          keyField="id_obs"
          loading={loading}
          loadingMessage="Cargando observaciones..."
          emptyIcon={<ClipboardList size={48} opacity={0.3} />}
          emptyTitle="Sin resultados"
          emptyDescription="No se encontraron observaciones con los filtros aplicados."
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={o => setSelectedObs(o)}
          rowClassName="sitio-row"
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          hasActiveFilters={hasActiveFilters}
          entityName="observaciones"
          minWidth={null}
        />
      )}

      {/* VENTANA EMERGENTE — DETALLE COMPLETO DE OBSERVACIÓN */}
      {selectedObs && (
        <ModalDetalleObservacion
          obs={selectedObs}
          sitiosMap={sitiosMap}
          gilatOptions={gilatOptions}
          onClose={() => setSelectedObs(null)}
          onSaved={handleObsSaved}
        />
      )}
    </div>
  )
}
