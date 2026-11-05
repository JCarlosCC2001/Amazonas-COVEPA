import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function ProtectedRoute({ children, requiredRoute }) {
  const { user, loading, canAccessRoute } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="loader-screen">
        <div className="loader-spinner" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const routeToCheck = requiredRoute || location.pathname
  if (canAccessRoute && !canAccessRoute(routeToCheck)) {
    return <Navigate to="/" replace />
  }

  return children
}
