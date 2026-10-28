import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, CheckCircle2, Clock, MapPin, User,
  ChevronRight, ChevronDown, ChevronUp, AlertTriangle,
  Flame, ExternalLink
} from 'lucide-react'
import {
  useNotifications,
  calcWaitMins,
  formatWaitTime,
  getWaitTierInfo
} from '../../context/NotificationContext'

/**
 * Contenedor de Toasts Flotantes para Avisos en Tiempo Real
 * Muestra alertas visuales emergentes individuales o consolidadas por acumulación,
 * permitiendo desplegar la lista detallada de códigos de observaciones mediante flecha.
 */
export default function NotificationToastContainer() {
  const { toasts, dismissToast, markAsRead } = useNotifications()
  const navigate = useNavigate()
  const [expandedToastIds, setExpandedToastIds] = useState(new Set())

  if (!toasts || toasts.length === 0) return null

  const toggleExpand = (toastId) => {
    setExpandedToastIds(prev => {
      const updated = new Set(prev)
      if (updated.has(toastId)) {
        updated.delete(toastId)
      } else {
        updated.add(toastId)
      }
      return updated
    })
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
        const isExpanded = expandedToastIds.has(toast.id)
        const items = obs.items || []

        return (
          <div
            key={toast.id}
            className={`notif-toast-card ${isAccumulation ? 'toast-accumulation-card' : ''} ${isExpanded ? 'toast-is-expanded' : ''}`}
          >
            <div className={`notif-toast-accent ${isAccumulation ? (obs.queueType === 'auditores' ? 'accent-auditores' : 'accent-accumulation') : ''}`} />

            <div className="notif-toast-main">
              {/* Cabecera del Toast */}
              <div className="notif-toast-header">
                <div className="notif-toast-title-cluster">
                  {isAccumulation ? (
                    <span className={`notif-toast-badge-pill ${obs.queueType === 'auditores' ? 'badge-auditores' : 'badge-accumulation'}`}>
                      <Flame size={12} />
                      <span>{obs.queueType === 'auditores' ? 'Cola En Revisión' : 'Cola Técnicos'} (+10m)</span>
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
                        ¡{items.length} Observaciones Demoradas!
                      </span>
                      <span className="notif-toast-count-tag">
                        {items.length} pendientes
                      </span>
                    </div>

                    {obs.detalle && (
                      <p className="notif-toast-detail-text notif-toast-acc-desc">
                        {obs.detalle}
                      </p>
                    )}

                    {/* Botón con Flecha para Desplegar la lista de códigos de observaciones */}
                    <button
                      type="button"
                      className={`notif-toast-expand-btn ${isExpanded ? 'is-expanded' : ''}`}
                      onClick={() => toggleExpand(toast.id)}
                      aria-expanded={isExpanded}
                      title={isExpanded ? 'Ocultar lista de códigos' : 'Desplegar lista de códigos demorados'}
                    >
                      <span className="notif-expand-btn-text">
                        {isExpanded ? 'Ocultar lista de observaciones' : `Ver lista de ${items.length} códigos en espera`}
                      </span>
                      <span className="notif-expand-arrow-icon">
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </span>
                    </button>

                    {/* Lista desplegada de códigos de observaciones */}
                    {isExpanded && (
                      <div className="notif-toast-expanded-list">
                        {items.map((item) => {
                          const waitMins = calcWaitMins(item.fecha_subsanacion)
                          const waitStr = formatWaitTime(waitMins)
                          const tier = getWaitTierInfo(waitMins)
                          const itemLoc = item.localidad ? ` · ${item.localidad}` : ''

                          return (
                            <div
                              key={item.id_obs}
                              className="notif-toast-list-item"
                              onClick={() => handleReview(toast, item.id_obs)}
                              title={`Clic para abrir la observación ${item.id_obs}`}
                            >
                              <div className="notif-toast-item-top">
                                <span className="notif-toast-item-code">{item.id_obs}</span>
                                <span className={`notif-toast-tier-pill ${tier.badgeClass}`}>
                                  {tier.label}
                                </span>
                              </div>

                              <div className="notif-toast-item-site">
                                <MapPin size={10} />
                                <span>{item.id_sitio}{itemLoc}</span>
                              </div>

                              {item.revisor && (
                                <div className="notif-toast-item-user">
                                  <User size={10} />
                                  <span>{item.revisor}</span>
                                </div>
                              )}

                              <div className="notif-toast-item-time">
                                <Clock size={10} />
                                <span>Demora: <strong>{waitStr}</strong></span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
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
                {isAccumulation ? (
                  <button
                    type="button"
                    className="notif-toast-action-btn btn-view-queue"
                    onClick={() => handleViewAllQueue(obs.queueType)}
                  >
                    <span>Ir a Observaciones</span>
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
