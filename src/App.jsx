import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { PresentationProvider } from './context/PresentationContext'
import { NotificationProvider } from './context/NotificationContext'
import ErrorBoundary from './components/shared/ErrorBoundary'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Layout from './components/layout/Layout'
import Login from './pages/Login'

// M2: Code splitting por ruta — cada página se carga solo cuando se navega a ella
const Dashboard     = lazy(() => import('./pages/Dashboard'))
const Sitios        = lazy(() => import('./pages/Sitios'))
const Observaciones = lazy(() => import('./pages/Observaciones'))
const Programacion  = lazy(() => import('./pages/Programacion'))
const Tecnicos      = lazy(() => import('./pages/Tecnicos'))
const Eficiencia    = lazy(() => import('./pages/Eficiencia'))
const KMZ           = lazy(() => import('./pages/KMZ'))
const Reportes      = lazy(() => import('./pages/Reportes'))

// Spinner liviano mientras carga la página
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '200px',
      color: 'var(--color-text-muted)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      gap: '0.5rem',
    }}>
      <span style={{
        width: '16px',
        height: '16px',
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        display: 'inline-block',
      }} />
      Cargando…
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PresentationProvider>
          <BrowserRouter>
            <NotificationProvider>
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
                  <Route path="dashboard"     element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                  <Route path="sitios"        element={<Suspense fallback={<PageLoader />}><Sitios /></Suspense>} />
                  <Route path="observaciones" element={<Suspense fallback={<PageLoader />}><Observaciones /></Suspense>} />
                  <Route path="programacion"  element={<Suspense fallback={<PageLoader />}><Programacion /></Suspense>} />
                  <Route path="tecnicos"      element={<Suspense fallback={<PageLoader />}><Tecnicos /></Suspense>} />
                  <Route path="eficiencia"    element={<Suspense fallback={<PageLoader />}><Eficiencia /></Suspense>} />
                  <Route path="kmz"           element={<Suspense fallback={<PageLoader />}><KMZ /></Suspense>} />
                  <Route path="reportes"      element={<Suspense fallback={<PageLoader />}><Reportes /></Suspense>} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </NotificationProvider>
          </BrowserRouter>
        </PresentationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
