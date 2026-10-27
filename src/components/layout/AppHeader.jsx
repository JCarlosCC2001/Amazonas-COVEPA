import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Eye, EyeOff, Shield, ShieldAlert, CheckCircle2, AlertTriangle, Layers, X, ExternalLink } from 'lucide-react'
import { usePresentationMode } from '../../context/PresentationContext'

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
  const [notifOpen, setNotifOpen] = useState(false)
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
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen])

  // Obtener metadata de la ruta actual
  const currentPath = location.pathname.toLowerCase()
  const pageInfo = PAGE_META[currentPath] || {
    title: 'Sistema COVEPA',
    subtitle: 'Gestión Operativa de Telecomunicaciones Amazonas'
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
            className={`app-header-action-btn btn-notif ${notifOpen ? 'open' : ''}`}
            title="Notificaciones del sistema"
            aria-label="Ver notificaciones"
          >
            <Bell size={18} />
            <span className="notif-badge-dot" />
          </button>

          {/* Menú desplegable de notificaciones */}
          {notifOpen && (
            <div className="notif-popover-card">
              <div className="notif-popover-header">
                <div className="notif-popover-title">
                  <Bell size={15} color="#003060" />
                  <span>Notificaciones del Proyecto</span>
                </div>
                <button
                  type="button"
                  className="notif-popover-close"
                  onClick={() => setNotifOpen(false)}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="notif-popover-list">
                <div className="notif-item">
                  <div className="notif-item-icon icon-success">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="notif-item-content">
                    <span className="notif-item-title">Sincronización en la Nube OK</span>
                    <span className="notif-item-desc">
                      Base de datos local y externa sincronizadas con éxito.
                    </span>
                  </div>
                </div>

                <div className="notif-item">
                  <div className="notif-item-icon icon-info">
                    <Layers size={16} />
                  </div>
                  <div className="notif-item-content">
                    <span className="notif-item-title">156 Sitios Georreferenciados</span>
                    <span className="notif-item-desc">
                      Zonas 2 y 7 con coordenadas y asignación de cuadrillas activas.
                    </span>
                  </div>
                </div>

                <div className="notif-item">
                  <div className="notif-item-icon icon-warning">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="notif-item-content">
                    <span className="notif-item-title">Auditoría Gilat Activa</span>
                    <span className="notif-item-desc">
                      Revisión de observaciones canalizada a través de supervisores Gilat.
                    </span>
                  </div>
                </div>
              </div>

              <div className="notif-popover-footer">
                <button
                  type="button"
                  className="notif-view-all-btn"
                  onClick={() => {
                    setNotifOpen(false)
                    navigate('/observaciones')
                  }}
                >
                  <span>Ir a Observaciones</span>
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
