import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/sitios': 'Gestión de Sitios',
  '/observaciones': 'Observaciones',
  '/programacion': 'Programación',
  '/tecnicos': 'Personal y Cuadrillas',
  '/eficiencia': 'Métricas de Eficiencia',
  '/kmz': 'Exportar KMZ',
  '/reportes': 'Reportes',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || 'Sistema'

  return (
    <div className={`app-layout ${collapsed ? 'layout-collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="main-content">
        <header className="top-header">
          <div className="header-left">
            <h2 className="header-title">{title}</h2>
            <span className="header-date">
              {new Date().toLocaleDateString('es-MX', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </span>
          </div>
          <div className="header-right">
            <div className="header-badge">
              <span className="badge-dot" />
              Sistema activo
            </div>
          </div>
        </header>
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
