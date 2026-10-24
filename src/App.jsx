import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sitios from './pages/Sitios'
import Observaciones from './pages/Observaciones'
import Programacion from './pages/Programacion'
import Tecnicos from './pages/Tecnicos'
import Eficiencia from './pages/Eficiencia'
import KMZ from './pages/KMZ'
import Reportes from './pages/Reportes'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />

          {/* Rutas protegidas bajo el Layout principal */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sitios" element={<Sitios />} />
            <Route path="observaciones" element={<Observaciones />} />
            <Route path="programacion" element={<Programacion />} />
            <Route path="tecnicos" element={<Tecnicos />} />
            <Route path="eficiencia" element={<Eficiencia />} />
            <Route path="kmz" element={<KMZ />} />
            <Route path="reportes" element={<Reportes />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
