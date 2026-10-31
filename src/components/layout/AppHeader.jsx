import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Eye, EyeOff, CheckCircle2,
  X, ExternalLink, Clock, MapPin,
  User, Trash2, RotateCcw, AlertTriangle,
  Copy, Check, CheckCheck
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { pasarTodasSolicitudesAEnRevision } from '../../services/observacionesService'
import { usePresentationMode } from '../../context/PresentationContext'
import { useNotifications, formatTiempoRelativo, copyObservacionesList } from '../../context/NotificationContext'

const PAGE_META = {
  '/dashboard': {
    title: 'Dashboard General',
    subtitle: 'Monitoreo global de subsanación técnica · ZONA 2 y ZONA 7'
  },
  '/programacion': {
    title: 'Programación de Cuadrillas',
    subtitle: 'Planificación operativa de rutas y jornadas en campo'
  },
  '/observaciones': {
    title: 'Observaciones Técnicas',
    subtitle: 'Control y auditoría de levantamiento de observaciones'
  },
  '/tecnicos': {
    title: 'Personal y Cuadrillas',
    subtitle: 'Directorio de personal, cuadrillas y cuentas de acceso'
  },
  '/sitios': {
    title: 'Sitios y Nodos',
    subtitle: 'Catálogo georreferenciado de 156 sitios del proyecto'
  },
  '/kmz': {
    title: 'Centro de Descargas',
    subtitle: 'Cartografía satelital KMZ y exportaciones oficiales a Excel'
  },
  '/reportes': {
    title: 'Reportes Operativos',
    subtitle: 'Métricas de avance y desempeño técnico'
  },
  '/eficiencia': {
    title: 'Eficiencia Operativa',
    subtitle: 'Productividad y rendimiento de cuadrillas en campo'
  }
}

export default function AppHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { presentationMode, togglePresentationMode } = usePresentationMode()
  const { user } = useAuth()
  const [batchHeaderLoading, setBatchHeaderLoading] = useState(false)
  const {
    notificarPaseEnRevision,
    solicitudes,
    unreadCount,
    readIds,
    dismissedCount,
    clearAllNotifications,
    dismissNotification,
    restoreDismissedNotifications,
    dispararPruebaRevision,
    desktopPermission,
    requestDesktopPermission,
    markAsRead,
    markAllAsRead,
    sitiosMap
  } = useNotifications()

  const [notifOpen, setNotifOpen] = useState(false)
  const [copiedAccId, setCopiedAccId] = useState(null)
  const notifRef = useRef(null)

  // Cerrar popover de notificaciones al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [notifOpen])

  // Obtener metadata de la ruta actual
  const currentPath = location.pathname.toLowerCase()
  const pageInfo = PAGE_META[currentPath] || {
    title: 'Sistema COVEPA',
    subtitle: 'Gestión Operativa de Telecomunicaciones Amazonas'
  }

  const handleSelectNotif = (obs) => {
    markAsRead(obs.id_obs)
    setNotifOpen(false)
    navigate(`/observaciones?search=${encodeURIComponent(obs.id_obs)}`)
  }

  const handleBatchRevisionHeader = async () => {
    if (solicitudes.length === 0) return
    const conf = window.confirm(
      `¿Deseas pasar ${solicitudes.length} ${solicitudes.length === 1 ? 'observación' : 'observaciones'} a 'En Revisión'?\n\nSe actualizará su estado y se generará una notificación interactiva con la lista de códigos copiable.`
    )
    if (!conf) return
    setBatchHeaderLoading(true)
    try {
      const res = await pasarTodasSolicitudesAEnRevision({
        nombre: user?.nombre || user?.email || 'Coordinador COVEPA',
        email: user?.email,
        id: user?.id
      })
      if (res.count > 0) {
        setNotifOpen(false)
        if (notificarPaseEnRevision) {
          await notificarPaseEnRevision(res)
        }
      }
    } catch (err) {
      console.error('Error al pasar observaciones a En Revisión:', err)
      alert(`Error: ${err.message}`)
    } finally {
      setBatchHeaderLoading(false)
    }
  }

  const handleViewAll = () => {
    setNotifOpen(false)
    navigate('/observaciones?estado=Solicitando Revisión')
  }

  return (
    <header className="global-app-header">
      {/* Lado Izquierdo: Nombre de la página y subtítulo */}
      <div className="app-header-left">
        <div className="app-header-title-wrap">
          <h1 className="app-header-page-title">{pageInfo.title}</h1>
          <span className="app-header-page-subtitle">{pageInfo.subtitle}</span>
        </div>
      </div>

      {/* Lado Derecho: Modo Secreto / Presentación y Campanita de Notificaciones */}
      <div className="app-header-right">
        {/* Indicador / Conmutador de Modo Secreto (Modo Presentación) */}
        <button
          type="button"
          onClick={togglePresentationMode}
          className={`app-header-action-btn btn-secret-mode ${presentationMode ? 'active' : ''}`}
          title={
            presentationMode
              ? 'Modo Secreto ACTIVO: Se ocultan nombres de técnicos, teléfonos y datos sensibles. Clic para desactivar.'
              : 'Activar Modo Secreto: Oculta nombres de técnicos, números telefónicos y datos sensibles para presentaciones.'
          }
          aria-label="Conmutar Modo Secreto / Presentación"
        >
          {presentationMode ? (
            <>
              <EyeOff size={18} className="secret-icon-active" />
              <span className="secret-mode-label">Modo Secreto ON</span>
            </>
          ) : (
            <>
              <Eye size={18} className="secret-icon-inactive" />
              <span className="secret-mode-label secret-label-inactive">Modo Secreto</span>
            </>
          )}
        </button>

        {/* Campanita de Notificaciones */}
        <div className="notif-dropdown-wrapper" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen(prev => !prev)}
            className={`app-header-action-btn btn-notif ${notifOpen ? 'open' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
            title={`Notificaciones (${unreadCount} solicitudes de revisión pendientes)`}
            aria-label="Ver notificaciones"
          >
            <Bell size={18} />
            {unreadCount > 0 ? (
              <span className="notif-badge-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
            ) : (
              <span className="notif-badge-dot notif-dot-idle" />
            )}
          </button>

          {/* Menú desplegable normal de notificaciones */}
          {notifOpen && (
            <div className="notif-popover-card">
              <div className="notif-popover-header">
                <div className="notif-popover-title">
                  <Bell size={15} color="#ea580c" />
                  <span>Solicitudes de Revisión ({solicitudes.length})</span>
                </div>
                <div className="notif-header-actions">
                  {solicitudes.length > 0 && (
                    <button
                      type="button"
                      className="notif-batch-btn"
                      onClick={handleBatchRevisionHeader}
                      disabled={batchHeaderLoading}
                      title="Pasar todas las solicitudes a En Revisión"
                    >
                      <CheckCheck size={12} />
                      <span>{batchHeaderLoading ? 'Procesando...' : `Pasar a En Revisión (${solicitudes.length})`}</span>
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="notif-mark-read-btn"
                      onClick={markAllAsRead}
                      title="Marcar todas como leídas"
                    >
                      Marcar vistas
                    </button>
                  )}
                  <button
                    type="button"
                    className="notif-test-btn"
                    onClick={() => {
                      dispararPruebaRevision()
                      setNotifOpen(false)
                    }}
                    title="Disparar notificación de prueba de observaciones en revisión"
                  >
                    Probar Alerta
                  </button>
                  {solicitudes.length > 0 && (
                    <button
                      type="button"
                      className="notif-clear-btn"
                      onClick={clearAllNotifications}
                      title="Limpiar todas las notificaciones de la bandeja"
                    >
                      <Trash2 size={12} />
                      <span>Limpiar</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="notif-popover-list">
                {solicitudes.length === 0 ? (
                  <div className="notif-empty-state">
                    <CheckCircle2 size={32} color="#10b981" />
                    <span className="notif-empty-title">¡Bandeja limpia!</span>
                    <span className="notif-empty-desc">
                      {dismissedCount > 0
                        ? `Has limpiado ${dismissedCount} ${dismissedCount === 1 ? 'notificación' : 'notificaciones'}. Las nuevas alertas aparecerán automáticamente aquí.`
                        : 'No hay observaciones pendientes de revisión en este momento.'}
                    </span>
                    {dismissedCount > 0 && (
                      <button
                        type="button"
                        className="notif-restore-btn"
                        onClick={restoreDismissedNotifications}
                        title="Restaurar notificaciones limpiadas"
                      >
                        <RotateCcw size={12} />
                        <span>Restaurar ({dismissedCount})</span>
                      </button>
                    )}
                  </div>
                ) : (
                  solicitudes.map((obs) => {
                    if (obs.isAccumulationAlert) {
                      const isUnread = !readIds.has(obs.id_obs)
                      const isCopied = copiedAccId === obs.id_obs
                      const items = obs.items || []

                      return (
                        <div
                          key={obs.id_obs}
                          className={`notif-item notif-item-accumulation ${isUnread ? 'is-unread' : ''}`}
                          onClick={() => {
                            markAsRead(obs.id_obs)
                            setNotifOpen(false)
                            navigate('/observaciones?estado=En%20Revisi%C3%B3n')
                          }}
                          title="Clic para ver observaciones en revisión"
                        >
                          <div className="notif-item-icon icon-accumulation">
                            <AlertTriangle size={16} />
                          </div>

                          <div className="notif-item-content">
                            <div className="notif-solicitud-top">
                              <span className="notif-obs-code">ALERTA DE ACUMULACIÓN</span>
                              <span className="notif-status-badge badge-acc-pill">
                                {obs.count || items.length} en Revisión (+10m)
                              </span>
                            </div>

                            <p className="notif-acc-card-desc">
                              {obs.detalle}
                            </p>

                            <div className="notif-card-actions-row">
                              <button
                                type="button"
                                className={`notif-card-copy-btn ${isCopied ? 'is-copied' : ''}`}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  const ok = await copyObservacionesList(items)
                                  if (ok) {
                                    setCopiedAccId(obs.id_obs)
                                    setTimeout(() => setCopiedAccId(null), 2500)
                                  }
                                }}
                                title="Copiar exclusivamente los códigos de observación agrupados por tiempo de espera"
                              >
                                {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                <span>{isCopied ? '¡Códigos copiados!' : 'Copiar códigos de observaciones'}</span>
                              </button>
                            </div>

                            <span className="notif-time-ago">
                              {formatTiempoRelativo(obs.fecha_subsanacion)}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="notif-item-dismiss-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              dismissNotification(obs.id_obs)
                            }}
                            title="Descartar alerta de acumulación"
                            aria-label="Descartar notificación"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )
                    }

                    const isUnread = !readIds.has(obs.id_obs)
                    const loc = sitiosMap[obs.id_sitio] || ''
                    return (
                      <div
                        key={obs.id_obs}
                        className={`notif-item notif-item-solicitud ${isUnread ? 'is-unread' : ''}`}
                        onClick={() => handleSelectNotif(obs)}
                        title="Clic para ver detalle de la observación"
                      >
                        <div className="notif-item-icon icon-solicitud">
                          <Clock size={16} />
                        </div>
                        <div className="notif-item-content">
                          <div className="notif-solicitud-top">
                            <span className="notif-obs-code">{obs.id_obs}</span>
                            <span className="notif-status-badge">Solicita Revisión</span>
                          </div>

                          <div className="notif-site-line">
                            <MapPin size={11} />
                            <span>{obs.id_sitio}{loc ? ` · ${loc}` : ''}</span>
                          </div>

                          {obs.revisor && (
                            <div className="notif-requester-line">
                              <User size={11} />
                              <span>{obs.revisor}</span>
                            </div>
                          )}

                          <span className="notif-time-ago">
                            {formatTiempoRelativo(obs.fecha_subsanacion)}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="notif-item-dismiss-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            dismissNotification(obs.id_obs)
                          }}
                          title="Descartar notificación"
                          aria-label="Descartar notificación"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Banner para activar notificaciones de escritorio si aún no están concedidas */}
              {desktopPermission === 'default' && (
                <div className="notif-permission-banner">
                  <div className="notif-perm-texts">
                    <span className="notif-perm-title">Alertas en Windows y Celular</span>
                    <span className="notif-perm-sub">Avisos sonoros y emergentes si tienes la app minimizada</span>
                  </div>
                  <button
                    type="button"
                    onClick={requestDesktopPermission}
                    className="notif-perm-btn"
                  >
                    Activar
                  </button>
                </div>
              )}

              <div className="notif-popover-footer">
                <span className="notif-popover-count-text">
                  {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}
                  {dismissedCount > 0 ? ` · ${dismissedCount} limpiadas` : ''}
                </span>
                <button
                  type="button"
                  className="notif-view-all-btn"
                  onClick={handleViewAll}
                >
                  <span>Ver todas en Observaciones</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
