import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, AlertTriangle, LogOut, CheckCircle2, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

// Constantes de tiempo de inactividad
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutos de inactividad total
const WARNING_BEFORE_LOGOUT_MS = 5 * 60 * 1000 // Alerta a los 5 minutos antes (minuto 25)
const STORAGE_KEY = 'covepa_last_activity_time'

export default function SessionTimeoutModal() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [showWarning, setShowWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(300)
  const isLoggingOutRef = useRef(false)
  const lastRecordedRef = useRef(Date.now())

  // Obtener la última actividad registrada (sincronizada en localStorage)
  const getLastActivity = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const val = parseInt(stored, 10)
        if (!isNaN(val) && val > 0) return val
      }
    } catch {
      // Ignorar error de acceso a storage
    }
    return lastRecordedRef.current
  }

  // Actualizar la última actividad
  const recordActivity = useCallback(() => {
    // Si la alerta ya está visible, no resetear automáticamente con movimientos leves de ratón
    // El usuario debe hacer clic expreso en "Continuar Sesión" para confirmar que sigue ahí
    if (showWarning) return

    const now = Date.now()
    // Limitar escritura a una vez cada 2 segundos para óptimo rendimiento
    if (now - lastRecordedRef.current > 2000) {
      lastRecordedRef.current = now
      try {
        localStorage.setItem(STORAGE_KEY, now.toString())
      } catch {
        // Ignorar
      }
    }
  }, [showWarning])

  // Cierre de sesión automático o manual
  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true
    setShowWarning(false)
    try {
      localStorage.removeItem(STORAGE_KEY)
      await signOut()
    } catch (err) {
      console.warn('Error en cierre de sesión por inactividad:', err)
    } finally {
      navigate('/login')
    }
  }, [signOut, navigate])

  // Continuar sesión (el usuario confirma que sigue trabajando)
  const handleContinue = useCallback(() => {
    const now = Date.now()
    lastRecordedRef.current = now
    try {
      localStorage.setItem(STORAGE_KEY, now.toString())
    } catch {
      // Ignorar
    }
    setShowWarning(false)
  }, [])

  // Escuchar eventos de interacción del usuario
  useEffect(() => {
    if (!user) return

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']
    const handleEvent = () => recordActivity()

    events.forEach(evt => {
      window.addEventListener(evt, handleEvent, { passive: true })
    })

    // Sincronizar actividad si el usuario interactúa en otra pestaña
    const handleStorageChange = e => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const extTime = parseInt(e.newValue, 10)
        if (!isNaN(extTime)) {
          lastRecordedRef.current = extTime
          // Si otra pestaña actualizó la actividad, ocultar advertencia
          const now = Date.now()
          const elapsed = now - extTime
          if (elapsed < INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_LOGOUT_MS) {
            setShowWarning(false)
          }
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      events.forEach(evt => {
        window.removeEventListener(evt, handleEvent)
      })
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [user, recordActivity])

  // Timer de comprobación periódico (cada 1 segundo)
  useEffect(() => {
    if (!user) return

    // Inicializar timestamp si no existe
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString())
    }

    const interval = setInterval(() => {
      if (isLoggingOutRef.current) return

      const now = Date.now()
      const lastActivity = getLastActivity()
      const elapsed = now - lastActivity
      const timeLeft = INACTIVITY_TIMEOUT_MS - elapsed

      if (timeLeft <= 0) {
        // Tiempo de inactividad de 30 minutos cumplido
        handleLogout()
      } else if (timeLeft <= WARNING_BEFORE_LOGOUT_MS) {
        // En los últimos 5 minutos: mostrar modal con contador
        setShowWarning(true)
        setSecondsRemaining(Math.max(0, Math.ceil(timeLeft / 1000)))
      } else {
        // Aún fuera de la zona de advertencia
        if (showWarning) setShowWarning(false)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [user, showWarning, handleLogout])

  if (!showWarning || !user) return null

  // Formatear minutos y segundos (MM:SS)
  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  return (
    <div className="session-timeout-overlay" role="dialog" aria-modal="true" aria-labelledby="timeout-title">
      <div className="session-timeout-card">
        {/* Ícono de alerta animado */}
        <div className="session-timeout-icon-wrap">
          <Clock size={36} className="timeout-clock-icon" />
          <span className="timeout-icon-pulse" />
        </div>

        <h3 id="timeout-title" className="session-timeout-heading">
          ¿Sigues ahí? Tu sesión está por expirar
        </h3>

        <p className="session-timeout-desc">
          No se ha detectado actividad reciente. Por seguridad operativa del sistema Amazonas COVEPA, tu sesión se cerrará automáticamente en:
        </p>

        {/* Contador digital regresivo destacado */}
        <div className="session-timeout-countdown-box">
          <div className="timeout-countdown-display">
            <span className="countdown-time-digits">{timeFormatted}</span>
            <span className="countdown-time-unit">minutos</span>
          </div>
          <div className="timeout-progress-bar-wrap">
            <div
              className="timeout-progress-bar-fill"
              style={{
                width: `${Math.min(100, Math.max(0, (secondsRemaining / 300) * 100))}%`
              }}
            />
          </div>
        </div>

        <p className="session-timeout-subtext">
          Haz clic en <strong>Continuar Sesión</strong> para mantenerte trabajando sin interrupciones.
        </p>

        {/* Botones de acción */}
        <div className="session-timeout-actions">
          <button
            type="button"
            className="session-timeout-btn-primary"
            onClick={handleContinue}
            autoFocus
          >
            <CheckCircle2 size={16} />
            <span>Continuar Sesión</span>
          </button>

          <button
            type="button"
            className="session-timeout-btn-secondary"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  )
}
