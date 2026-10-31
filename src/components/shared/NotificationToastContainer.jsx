import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, CheckCircle2, Clock, MapPin, User,
  ChevronRight, AlertTriangle, ExternalLink,
  Copy, Check
} from 'lucide-react'
import {
  useNotifications,
  copyObservacionesList,
  copyPlainCodesList
} from '../../context/NotificationContext'

/**
 * Contenedor de Toasts Flotantes para Avisos en Tiempo Real
 * Muestra alertas visuales emergentes individuales o consolidadas por acumulación,
 * permitiendo copiar de inmediato la lista de códigos y detalles al portapapeles.
 */
export default function NotificationToastContainer() {
  const { toasts, dismissToast, markAsRead } = useNotifications()
  const navigate = useNavigate()
  const [copiedToastId, setCopiedToastId] = useState(null)

  if (!toasts || toasts.length === 0) return null

  const handleCopyList = async (toastId, items, codes = null) => {
    let ok = false
    if (codes && codes.length > 0) {
      ok = await copyPlainCodesList(codes)
    } else {
      ok = await copyObservacionesList(items)
    }
    if (ok) {
      setCopiedToastId(toastId)
      setTimeout(() => {
        setCopiedToastId(null)
      }, 2500)
    }
  }

  const handleReview = (toast, targetObsId = null) => {
    const idToOpen = targetObsId || (toast.obs?.isAccumulationAlert ? toast.obs?.items?.[0]?.id_obs : toast.obs?.id_obs)
    if (idToOpen) {
      markAsRead(idToOpen)
      navigate(`/observaciones?search=${encodeURIComponent(idToOpen)}`)
    } else {
      const targetEstado = toast.obs?.estado_covepa || 'Solicitando Revisión'
      navigate(`/observaciones?estado=${encodeURIComponent(targetEstado)}`)
    }
    dismissToast(toast.id)
  }

  const handleViewAllQueue = (queueType) => {
    const targetEstado = queueType === 'auditores' ? 'En Revisión' : 'Solicitando Revisión'
    navigate(`/observaciones?estado=${encodeURIComponent(targetEstado)}`)
  }

  return (
    <div className="notif-toasts-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const obs = toast.obs || {}
        const loc = obs.localidad ? ` · ${obs.localidad}` : ''
        const isAccumulation = Boolean(obs.isAccumulationAlert && obs.items && obs.items.length > 0)
        const isTransicionBatch = Boolean(obs.isTransicionBatch && obs.codes && obs.codes.length > 0)
        const isCopied = copiedToastId === toast.id
        const items = obs.items || []

        return (
          <div
            key={toast.id}
            className={`notif-toast-card ${(isAccumulation || isTransicionBatch) ? 'toast-accumulation-card' : ''}`}
          >
            <div className={`notif-toast-accent ${(isAccumulation || isTransicionBatch) ? ((obs.queueType === 'auditores' || isTransicionBatch) ? 'accent-auditores' : 'accent-accumulation') : ''}`} />

            <div className="notif-toast-main">
              {/* Cabecera del Toast */}
              <div className="notif-toast-header">
                <div className="notif-toast-title-cluster">
                  {obs.isReporteEnviado ? (
                    <span className="notif-toast-badge-pill" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                      <CheckCircle2 size={12} />
                      <span>Reporte Diario Despachado</span>
                    </span>
                  ) : isTransicionBatch ? (
                    <span className="notif-toast-badge-pill badge-auditores">
                      <CheckCircle2 size={12} />
                      <span>Pase a En Revisión ({obs.codes.length})</span>
                    </span>
                  ) : isAccumulation ? (
                    <span className="notif-toast-badge-pill badge-accumulation">
                      <AlertTriangle size={12} />
                      <span>Observaciones en Revisión (+10m)</span>
                    </span>
                  ) : (
                    <span className="notif-toast-badge-pill badge-solicitud">
                      <Clock size={12} />
                      <span>Solicita Revisión</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="notif-toast-close"
                  onClick={() => dismissToast(toast.id)}
                  title="Cerrar aviso"
                  aria-label="Cerrar notificación"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Cuerpo del Toast */}
              <div className="notif-toast-body">
                {isTransicionBatch ? (
                  <>
                    <div className="notif-toast-code-row">
                      <span className="notif-toast-acc-title" style={{ color: '#0369a1' }}>
                        ¡{obs.codes.length} {obs.codes.length === 1 ? 'Observación pasó' : 'Observaciones pasaron'} a En Revisión!
                      </span>
                      <span className="notif-toast-count-tag" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                        {obs.codes.length} en revisión
                      </span>
                    </div>

                    {obs.detalle && (
                      <p className="notif-toast-detail-text notif-toast-acc-desc" style={{ marginTop: '0.25rem' }}>
                        {obs.detalle}
                      </p>
                    )}

                    {/* Chips de códigos */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px',
                      maxHeight: '68px',
                      overflowY: 'auto',
                      background: '#f8fafc',
                      padding: '6px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      marginTop: '0.35rem'
                    }}>
                      {obs.codes.map(c => (
                        <span key={c} style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          color: '#003060',
                          fontWeight: 'var(--fw-semibold)'
                        }} className="t-meta">
                          {c}
                        </span>
                      ))}
                    </div>

                    <div className="notif-toast-action-row" style={{ marginTop: '0.45rem' }}>
                      <button
                        type="button"
                        className={`notif-toast-copy-btn ${isCopied ? 'is-copied' : ''}`}
                        onClick={() => handleCopyList(toast.id, obs.items, obs.codes)}
                        style={!isCopied ? { background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' } : {}}
                        title="Copiar lista de códigos de observación al portapapeles"
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{isCopied ? '¡Códigos copiados al portapapeles!' : `Copiar ${obs.codes.length} códigos de observación`}</span>
                      </button>
                    </div>
                  </>
                ) : isAccumulation ? (
                  <>
                    <div className="notif-toast-code-row">
                      <span className="notif-toast-acc-title">
                        ¡{items.length} Observaciones en Revisión Demoradas!
                      </span>
                      <span className="notif-toast-count-tag">
                        {items.length} acumuladas
                      </span>
                    </div>

                    {obs.detalle && (
                      <p className="notif-toast-detail-text notif-toast-acc-desc">
                        {obs.detalle}
                      </p>
                    )}

                    {/* Botón para Copiar Códigos de Observaciones al Portapapeles */}
                    <div className="notif-toast-action-row">
                      <button
                        type="button"
                        className={`notif-toast-copy-btn ${isCopied ? 'is-copied' : ''}`}
                        onClick={() => handleCopyList(toast.id, items)}
                        title="Copiar exclusivamente los códigos de observación agrupados por tiempo de espera"
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{isCopied ? '¡Códigos copiados al portapapeles!' : 'Copiar códigos de observaciones'}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="notif-toast-code-row">
                      <span className="notif-toast-code">{obs.id_obs}</span>
                      <span className="notif-toast-site-pill" title={`${obs.id_sitio}${loc}`}>
                        <MapPin size={11} />
                        <span>{obs.id_sitio}{loc}</span>
                      </span>
                    </div>

                    {obs.detalle && (
                      <p className="notif-toast-detail-text">
                        {obs.detalle}
                      </p>
                    )}

                    {obs.revisor && (
                      <div className="notif-toast-author-row">
                        <User size={11} color="#64748b" />
                        <span>Técnico: <strong>{obs.revisor}</strong></span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Pie del Toast */}
              <div className="notif-toast-footer">
                {obs.isReporteEnviado ? (
                  <button
                    type="button"
                    className="notif-toast-action-btn"
                    onClick={() => {
                      navigate('/reportes')
                      dismissToast(toast.id)
                    }}
                    style={{ background: '#003060', color: '#ffffff' }}
                  >
                    <span>Ir a Reportes</span>
                    <ChevronRight size={13} />
                  </button>
                ) : (isAccumulation || isTransicionBatch) ? (
                  <button
                    type="button"
                    className="notif-toast-action-btn btn-view-queue"
                    onClick={() => {
                      handleViewAllQueue('auditores')
                      dismissToast(toast.id)
                    }}
                  >
                    <span>Ver en Observaciones</span>
                    <ExternalLink size={12} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="notif-toast-action-btn"
                    onClick={() => handleReview(toast)}
                  >
                    <CheckCircle2 size={13} />
                    <span>Revisar Observación</span>
                    <ChevronRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
