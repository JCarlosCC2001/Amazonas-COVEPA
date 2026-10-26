import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    label: 'Sitios',
    path: '/sitios',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    label: 'Observaciones',
    path: '/observaciones',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    label: 'Programación',
    path: '/programacion',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: 'Personal',
    path: '/tecnicos',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'Eficiencia',
    path: '/eficiencia',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  {
    label: 'Centro de Descargas',
    path: '/kmz',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    label: 'Reportes',
    path: '/reportes',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
]

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleNavClick = () => {
    if (setMobileOpen) setMobileOpen(false)
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Header del sidebar */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#sgrad)" />
              <path d="M20 8L32 14V26L20 32L8 26V14L20 8Z" stroke="white" strokeWidth="2" fill="none" />
              <circle cx="20" cy="20" r="4" fill="white" />
              <defs>
                <linearGradient id="sgrad" x1="0" y1="0" x2="40" y2="40">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">COVEPA</span>
              <span className="sidebar-brand-sub">Observaciones</span>
            </div>
          )}
        </div>

        {/* Botón de cerrar en móvil */}
        <button
          type="button"
          className="sidebar-mobile-close"
          onClick={() => setMobileOpen && setMobileOpen(false)}
          aria-label="Cerrar menú"
          title="Cerrar menú"
        >
          <X size={20} />
        </button>

        {/* Botón de colapsar en escritorio */}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {collapsed
              ? <polyline points="9 18 15 12 9 6" />
              : <polyline points="15 18 9 12 15 6" />
            }
          </svg>
        </button>
      </div>

      {/* Navegación */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={handleNavClick}
            title={collapsed && !mobileOpen ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {(!collapsed || mobileOpen) && <span className="nav-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer del sidebar */}
      <div className="sidebar-footer">
        <div className={`sidebar-user ${collapsed && !mobileOpen ? 'sidebar-user-collapsed' : ''}`}>
          <div className="user-avatar">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="user-info">
              <span className="user-email">{user?.email}</span>
              <span className="user-role">Administrador</span>
            </div>
          )}
        </div>
        <button
          className="sidebar-logout"
          onClick={handleSignOut}
          title="Cerrar sesión"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {(!collapsed || mobileOpen) && <span>Salir</span>}
        </button>
      </div>
    </aside>
  )
}

