import { useNavigate } from 'react-router-dom'
import { X, CheckCircle2, Clock, MapPin, User, ChevronRight } from 'lucide-react'
import { useNotifications } from '../../context/NotificationContext'

/**
 * Contenedor de Toasts Flotantes para Avisos en Tiempo Real
 * Muestra alertas visuales emergentes cuando un técnico solicita revisión técnica.
 */
export default function NotificationToastContainer() {
  const { toasts, dismissToast, markAsRead } = useNotifications()
  const navigate = useNavigate()

  if (!toasts || toasts.length === 0) return null

  const handleReview = (toast) => {
    markAsRead(toast.obs.id_obs)
    dismissToast(toast.id)
    navigate(`/observaciones?search=${encodeURIComponent(toast.obs.id_obs)}`)
  }

  return (
    <div className="notif-toasts-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const obs = toast.obs || {}
        const loc = obs.localidad ? ` · ${obs.localidad}` : ''

        return (
          <div key={toast.id} className="notif-toast-card">
            <div className="notif-toast-accent" />
            <div className="notif-toast-main">
              <div className="notif-toast-header">
                <div className="notif-toast-title-cluster">
                  <span className="notif-toast-badge-pill">
                    <Clock size={12} />
                    <span>Solicita Revisión</span>
                  </span>
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

              <div className="notif-toast-body">
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
              </div>

              <div className="notif-toast-footer">
                <button
                  type="button"
                  className="notif-toast-action-btn"
                  onClick={() => handleReview(toast)}
                >
                  <CheckCircle2 size={13} />
                  <span>Revisar Observación</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
