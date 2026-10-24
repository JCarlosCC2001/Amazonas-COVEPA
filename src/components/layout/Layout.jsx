import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`app-layout ${collapsed ? 'layout-collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="main-content">
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

