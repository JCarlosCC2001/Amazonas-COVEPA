import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import AppHeader from './AppHeader'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <div className={`app-layout ${collapsed ? 'layout-collapsed' : ''}`}>
      {/* Botón flotante para abrir sidebar en pantallas medianas y móviles */}
      <button
        type="button"
        className="mobile-sidebar-btn"
        onClick={() => setMobileOpen(prev => !prev)}
        aria-label="Abrir menú de navegación"
        title="Menú lateral"
      >
        <Menu size={22} />
      </button>

      {/* Backdrop oscuro con blur cuando el menú móvil está desplegado */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="main-content">
        <AppHeader />
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  )
}


