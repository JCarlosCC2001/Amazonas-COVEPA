import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, CheckCircle2, Clock, MapPin, User,
  ChevronRight, AlertTriangle, ExternalLink,
  Copy, Check
} from 'lucide-react'
import {
  useNotifications,
  copyObservacionesList
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

  const handleCopyList = async (toastId, items) => {
    const ok = await copyObservacionesList(items)
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
        const isCopied = copiedToastId === toast.id
        const items = obs.items || []

        return (
          <div
            key={toast.id}
            className={`notif-toast-card ${isAccumulation ? 'toast-accumulation-card' : ''}`}
          >
            <div className={`notif-toast-accent ${isAccumulation ? (obs.queueType === 'auditores' ? 'accent-auditores' : 'accent-accumulation') : ''}`} />

            <div className="notif-toast-main">
              {/* Cabecera del Toast */}
              <div className="notif-toast-header">
                <div className="notif-toast-title-cluster">
                  {obs.isReporteEnviado ? (
                    <span className="notif-toast-badge-pill" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                      <CheckCircle2 size={12} />
                      <span>Reporte Diario Despachado</span>
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
                {isAccumulation ? (
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
                ) : isAccumulation ? (
                  <button
                    type="button"
                    className="notif-toast-action-btn btn-view-queue"
                    onClick={() => handleViewAllQueue('auditores')}
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
