import { useState, useRef, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Eye, EyeOff, CheckCircle2,
  AlertTriangle, X, ExternalLink, Clock, MapPin,
  User, Trash2, RotateCcw, Flame, ChevronDown, ChevronUp
} from 'lucide-react'
import { usePresentationMode } from '../../context/PresentationContext'
import {
  useNotifications,
  formatTiempoRelativo,
  calcWaitMins,
  formatWaitTime,
  getWaitTierInfo
} from '../../context/NotificationContext'

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
  const {
    solicitudes,
    enRevision,
    unreadCount,
    readIds,
    tecnicosDemoradasCount,
    auditoresDemoradasCount,
    dismissedCount,
    clearAllNotifications,
    dismissNotification,
    restoreDismissedNotifications,
    desktopPermission,
    requestDesktopPermission,
    markAsRead,
    markAllAsRead,
    sitiosMap
  } = useNotifications()

  const [notifOpen, setNotifOpen] = useState(false)
  const [activeQueueTab, setActiveQueueTab] = useState('tecnicos') // 'tecnicos' | 'auditores'
  const [filterTier, setFilterTier] = useState('ALL') // 'ALL' | '10m' | '1h' | '2h' | '6h' | '12h'
  const [showDelayedCodesQuick, setShowDelayedCodesQuick] = useState(false)
  const [expandedItemDetails, setExpandedItemDetails] = useState(new Set())
  const notifRef = useRef(null)

  const toggleItemDetail = (e, idObs) => {
    e.stopPropagation()
    setExpandedItemDetails(prev => {
      const next = new Set(prev)
      if (next.has(idObs)) next.delete(idObs)
      else next.add(idObs)
      return next
    })
  }

  // Cerrar popover de notificaciones al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen])

  // Obtener metadata de la ruta actual
  const currentPath = location.pathname.toLowerCase()
  const pageInfo = PAGE_META[currentPath] || {
    title: 'Sistema COVEPA',
    subtitle: 'Gestión Operativa de Telecomunicaciones Amazonas'
  }

  // Lista activa según la pestaña seleccionada
  const currentQueueItems = activeQueueTab === 'tecnicos' ? (solicitudes || []) : (enRevision || [])
  const currentDemoradas = activeQueueTab === 'tecnicos' ? tecnicosDemoradasCount : auditoresDemoradasCount
  const activeUnreadCount = currentQueueItems.filter(s => !readIds.has(s.id_obs)).length

  // Conteo por franjas de tiempo de espera para los chips de filtro
  const tierCounts = useMemo(() => {
    const counts = { ALL: currentQueueItems.length, '10m': 0, '1h': 0, '2h': 0, '6h': 0, '12h': 0 }
    for (const item of currentQueueItems) {
      const mins = calcWaitMins(item.fecha_subsanacion)
      if (mins >= 10) counts['10m']++
      if (mins >= 60) counts['1h']++
      if (mins >= 120) counts['2h']++
      if (mins >= 360) counts['6h']++
      if (mins >= 720) counts['12h']++
    }
    return counts
  }, [currentQueueItems])

  // Filtrado de la lista según la franja seleccionada
  const filteredList = useMemo(() => {
    if (filterTier === 'ALL') return currentQueueItems
    return currentQueueItems.filter(item => {
      const mins = calcWaitMins(item.fecha_subsanacion)
      if (filterTier === '10m') return mins >= 10
      if (filterTier === '1h') return mins >= 60
      if (filterTier === '2h') return mins >= 120
      if (filterTier === '6h') return mins >= 360
      if (filterTier === '12h') return mins >= 720
      return true
    })
  }, [currentQueueItems, filterTier])

  const handleSelectNotif = (obs) => {
    markAsRead(obs.id_obs)
    setNotifOpen(false)
    navigate(`/observaciones?search=${encodeURIComponent(obs.id_obs)}`)
  }

  const handleViewAll = () => {
    setNotifOpen(false)
    const targetEstado = activeQueueTab === 'tecnicos' ? 'Solicitando Revisión' : 'En Revisión'
    navigate(`/observaciones?estado=${encodeURIComponent(targetEstado)}`)
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
            title={`Notificaciones (${unreadCount} pendientes entre Técnicos y En Revisión)`}
            aria-label="Ver notificaciones"
          >
            <Bell size={18} />
            {unreadCount > 0 ? (
              <span className="notif-badge-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
            ) : (
              <span className="notif-badge-dot notif-dot-idle" />
            )}
          </button>

          {/* Menú desplegable de notificaciones */}
          {notifOpen && (
            <div className="notif-popover-card">
              {/* Encabezado del Popover */}
              <div className="notif-popover-header">
                <div className="notif-popover-title">
                  <Bell size={15} color={activeQueueTab === 'tecnicos' ? '#ea580c' : '#0284c7'} />
                  <span>
                    Bandeja: {activeQueueTab === 'tecnicos' ? 'Técnicos' : 'En Revisión'} ({currentQueueItems.length})
                  </span>
                </div>
                <div className="notif-header-actions">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="notif-mark-read-btn"
                      onClick={markAllAsRead}
                      title="Marcar todas como vistas"
                    >
                      Marcar vistas
                    </button>
                  )}
                  {currentQueueItems.length > 0 && (
                    <button
                      type="button"
                      className="notif-clear-btn"
                      onClick={() => clearAllNotifications(activeQueueTab)}
                      title={`Limpiar cola de ${activeQueueTab === 'tecnicos' ? 'Técnicos' : 'En Revisión'}`}
                    >
                      <Trash2 size={12} />
                      <span>Limpiar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="notif-popover-close"
                    onClick={() => setNotifOpen(false)}
                    title="Cerrar menú"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Barra de Pestañas: Técnicos vs En Revisión */}
              <div className="notif-tabs-bar" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeQueueTab === 'tecnicos'}
                  className={`notif-tab-btn notif-tab-btn-tecnicos ${activeQueueTab === 'tecnicos' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveQueueTab('tecnicos')
                    setFilterTier('ALL')
                  }}
                >
                  <span className="notif-tab-icon">👷</span>
                  <span className="notif-tab-name">Técnicos</span>
                  <span className="notif-tab-count-pill">{solicitudes.length}</span>
                  {tecnicosDemoradasCount > 0 && (
                    <span
                      className="notif-tab-demora-pill"
                      title={`${tecnicosDemoradasCount} observaciones llevan más de 10 minutos esperando`}
                    >
                      <Flame size={11} />
                      {tecnicosDemoradasCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeQueueTab === 'auditores'}
                  className={`notif-tab-btn notif-tab-btn-auditores ${activeQueueTab === 'auditores' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveQueueTab('auditores')
                    setFilterTier('ALL')
                  }}
                >
                  <span className="notif-tab-icon">🔍</span>
                  <span className="notif-tab-name">En Revisión</span>
                  <span className="notif-tab-count-pill">{enRevision.length}</span>
                  {auditoresDemoradasCount > 0 && (
                    <span
                      className="notif-tab-demora-pill notif-demora-auditores"
                      title={`${auditoresDemoradasCount} observaciones llevan más de 10 minutos en auditoría`}
                    >
                      <Flame size={11} />
                      {auditoresDemoradasCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Chips de filtro por franjas de tiempo de espera */}
              {currentQueueItems.length > 0 && (
                <div className="notif-tier-chips" aria-label="Filtro por tiempo de espera">
                  <button
                    type="button"
                    className={`tier-chip ${filterTier === 'ALL' ? 'active' : ''}`}
                    onClick={() => setFilterTier('ALL')}
                  >
                    Todas ({tierCounts.ALL})
                  </button>
                  {tierCounts['10m'] > 0 && (
                    <button
                      type="button"
                      className={`tier-chip tier-chip-10m ${filterTier === '10m' ? 'active' : ''}`}
                      onClick={() => setFilterTier('10m')}
                      title="Esperando más de 10 minutos"
                    >
                      +10 min ({tierCounts['10m']})
                    </button>
                  )}
                  {tierCounts['1h'] > 0 && (
                    <button
                      type="button"
                      className={`tier-chip tier-chip-1h ${filterTier === '1h' ? 'active' : ''}`}
                      onClick={() => setFilterTier('1h')}
                      title="Esperando más de 1 hora"
                    >
                      +1h ({tierCounts['1h']})
                    </button>
                  )}
                  {tierCounts['2h'] > 0 && (
                    <button
                      type="button"
                      className={`tier-chip tier-chip-2h ${filterTier === '2h' ? 'active' : ''}`}
                      onClick={() => setFilterTier('2h')}
                      title="Esperando más de 2 horas"
                    >
                      +2h ({tierCounts['2h']})
                    </button>
                  )}
                  {tierCounts['6h'] > 0 && (
                    <button
                      type="button"
                      className={`tier-chip tier-chip-6h ${filterTier === '6h' ? 'active' : ''}`}
                      onClick={() => setFilterTier('6h')}
                      title="Esperando más de 6 horas"
                    >
                      +6h ({tierCounts['6h']})
                    </button>
                  )}
                  {tierCounts['12h'] > 0 && (
                    <button
                      type="button"
                      className={`tier-chip tier-chip-12h ${filterTier === '12h' ? 'active' : ''}`}
                      onClick={() => setFilterTier('12h')}
                      title="Esperando más de 12 horas"
                    >
                      +12h ({tierCounts['12h']})
                    </button>
                  )}
                </div>
              )}

              {/* Banner de alerta de acumulación (cuello de botella con 5 o más demoradas) */}
              {currentDemoradas >= 5 && (
                <div className="notif-accumulation-banner-container">
                  <div className="notif-accumulation-banner">
                    <AlertTriangle size={15} className="notif-acc-icon" />
                    <div className="notif-acc-text">
                      <strong>¡Alerta de acumulación ({currentDemoradas})!</strong>
                      <span>
                        Hay {currentDemoradas} observaciones con más de 10 min de espera en{' '}
                        {activeQueueTab === 'tecnicos' ? 'Técnicos' : 'En Revisión'}.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="notif-acc-toggle-arrow-btn"
                      onClick={() => setShowDelayedCodesQuick(prev => !prev)}
                      title={showDelayedCodesQuick ? 'Ocultar lista de códigos demorados' : 'Desplegar lista de códigos demorados'}
                      aria-expanded={showDelayedCodesQuick}
                    >
                      <span>{showDelayedCodesQuick ? 'Ocultar' : 'Ver códigos'}</span>
                      {showDelayedCodesQuick ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {showDelayedCodesQuick && (
                    <div className="notif-delayed-codes-quicklist">
                      <span className="notif-delayed-codes-title">
                        Observaciones con mayor tiempo de espera (+10m):
                      </span>
                      <div className="notif-delayed-chips-wrap">
                        {currentQueueItems
                          .filter(item => calcWaitMins(item.fecha_subsanacion) >= 10)
                          .map(item => {
                            const mins = calcWaitMins(item.fecha_subsanacion)
                            const tier = getWaitTierInfo(mins)
                            const loc = sitiosMap[item.id_sitio] || ''

                            return (
                              <button
                                key={item.id_obs}
                                type="button"
                                className="notif-delayed-chip-btn"
                                onClick={() => handleSelectNotif(item)}
                                title={`Abrir ${item.id_obs} (${item.id_sitio}${loc ? ` · ${loc}` : ''}) · Demora: ${formatWaitTime(mins)}`}
                              >
                                <span className="delayed-chip-code">{item.id_obs}</span>
                                <span className={`delayed-chip-tier ${tier.badgeClass}`}>
                                  {formatWaitTime(mins)}
                                </span>
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Lista de observaciones filtradas y ordenadas */}
              <div className="notif-popover-list">
                {filteredList.length === 0 ? (
                  <div className="notif-empty-state">
                    <CheckCircle2 size={32} color="#10b981" />
                    <span className="notif-empty-title">
                      {filterTier !== 'ALL'
                        ? 'Sin observaciones en este rango de espera'
                        : activeQueueTab === 'tecnicos'
                        ? '¡Sin solicitudes de técnicos pendientes!'
                        : '¡Sin observaciones pendientes en auditoría!'}
                    </span>
                    <span className="notif-empty-desc">
                      {filterTier !== 'ALL'
                        ? 'No hay registros en esta cola que cumplan con la franja seleccionada.'
                        : dismissedCount > 0
                        ? `Has limpiado notificaciones de la bandeja. Las nuevas alertas aparecerán automáticamente.`
                        : 'El flujo operativo está al día en esta cola.'}
                    </span>
                    {dismissedCount > 0 && filterTier === 'ALL' && (
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
                  filteredList.map((obs) => {
                    const isUnread = !readIds.has(obs.id_obs)
                    const loc = sitiosMap[obs.id_sitio] || ''
                    const waitMins = calcWaitMins(obs.fecha_subsanacion)
                    const waitTimeStr = formatWaitTime(waitMins)
                    const tier = getWaitTierInfo(waitMins)
                    const isItemExpanded = expandedItemDetails.has(obs.id_obs)

                    return (
                      <div
                        key={obs.id_obs}
                        className={`notif-item notif-item-solicitud ${activeQueueTab === 'auditores' ? 'item-auditores' : ''} ${isUnread ? 'is-unread' : ''}`}
                        onClick={() => handleSelectNotif(obs)}
                        title="Clic para ver detalle de la observación"
                      >
                        <div className={`notif-item-icon ${activeQueueTab === 'tecnicos' ? 'icon-solicitud' : 'icon-auditores'}`}>
                          {activeQueueTab === 'tecnicos' ? <Clock size={16} /> : <AlertTriangle size={16} />}
                        </div>
                        <div className="notif-item-content">
                          <div className="notif-solicitud-top">
                            <div className="notif-code-tier-group">
                              <span className="notif-obs-code">{obs.id_obs}</span>
                              <span className={`notif-wait-tier-badge ${tier.badgeClass}`}>
                                {tier.label}
                              </span>
                            </div>
                            <span className={`notif-status-badge ${activeQueueTab === 'tecnicos' ? 'status-tecnico' : 'status-revision'}`}>
                              {activeQueueTab === 'tecnicos' ? 'Solicita Revisión' : 'En Revisión'}
                            </span>
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

                          <div className="notif-time-row">
                            <span className={`notif-wait-time-text ${tier.isOver10m ? 'is-delayed' : ''}`}>
                              <Clock size={10} />
                              Espera: {waitTimeStr}
                            </span>
                            <span className="notif-time-ago">
                              {formatTiempoRelativo(obs.fecha_subsanacion)}
                            </span>
                          </div>

                          {/* Flecha para desplegar detalle de la observación */}
                          {obs.detalle && (
                            <div className="notif-item-detail-toggle-wrap">
                              <button
                                type="button"
                                className="notif-item-detail-toggle-btn"
                                onClick={(e) => toggleItemDetail(e, obs.id_obs)}
                                title={isItemExpanded ? 'Ocultar detalle' : 'Desplegar detalle'}
                                aria-expanded={isItemExpanded}
                              >
                                <span>{isItemExpanded ? 'Ocultar detalle' : 'Ver detalle'}</span>
                                {isItemExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                            </div>
                          )}

                          {isItemExpanded && obs.detalle && (
                            <div className="notif-item-unfolded-detail">
                              <p className="notif-unfolded-desc">{obs.detalle}</p>
                              {obs.subsistema && (
                                <span className="notif-unfolded-meta">Subsistema: <strong>{obs.subsistema}</strong></span>
                              )}
                            </div>
                          )}
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

              {/* Banner para activar notificaciones de escritorio / PWA si aún no están concedidas */}
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

              {/* Pie del Popover */}
              <div className="notif-popover-footer">
                <span className="notif-popover-count-text">
                  {activeUnreadCount > 0 ? `${activeUnreadCount} sin leer` : 'Al día'}
                  {dismissedCount > 0 ? ` · ${dismissedCount} limpiadas` : ''}
                </span>
                <button
                  type="button"
                  className="notif-view-all-btn"
                  onClick={handleViewAll}
                >
                  <span>Ver {activeQueueTab === 'tecnicos' ? 'Solicitudes' : 'En Revisión'}</span>
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
