import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, LogOut, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

// Constantes de programación fija (1:00 AM y 1:00 PM)
const WARNING_BEFORE_LOGOUT_MS = 5 * 60 * 1000 // 5 minutos de anticipación previa (minuto :55)
export const STORAGE_KEY_EXTENDED = 'covepa_session_extended_target'

/**
 * Calcula la próxima ventana programada de cierre (1:00 AM o 1:00 PM).
 * Si el usuario ya confirmó continuar para una ventana específica, avanza a la siguiente.
 */
export function getNextScheduledLogoutTarget(now = new Date(), extendedTargetTime = 0) {
  const candidates = []

  // Hoy 01:00 AM
  const d1 = new Date(now)
  d1.setHours(1, 0, 0, 0)
  candidates.push(d1)

  // Hoy 01:00 PM
  const d2 = new Date(now)
  d2.setHours(13, 0, 0, 0)
  candidates.push(d2)

  // Mañana 01:00 AM
  const d3 = new Date(now)
  d3.setDate(d3.getDate() + 1)
  d3.setHours(1, 0, 0, 0)
  candidates.push(d3)

  // Mañana 01:00 PM
  const d4 = new Date(now)
  d4.setDate(d4.getDate() + 1)
  d4.setHours(13, 0, 0, 0)
  candidates.push(d4)

  for (const c of candidates) {
    if (c.getTime() > now.getTime() && c.getTime() > extendedTargetTime) {
      return c
    }
  }

  return candidates[candidates.length - 1]
}

export function formatTargetLabel(targetDate) {
  if (!targetDate) return '1:00 PM'
  const hours = targetDate.getHours()
  return hours === 1 ? '1:00 AM' : '1:00 PM'
}

export default function SessionTimeoutModal() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [showWarning, setShowWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(300)
  const [targetLabel, setTargetLabel] = useState('1:00 PM')

  const isLoggingOutRef = useRef(false)
  const notifiedTargetRef = useRef(null)

  // Obtener el timestamp de extensión confirmado por el usuario en localStorage
  const getExtendedTarget = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_EXTENDED)
      if (stored) {
        const val = parseInt(stored, 10)
        if (!isNaN(val) && val > 0) return val
      }
    } catch {
      // Ignorar error de acceso a storage
    }
    return 0
  }

  // Cierre de sesión automático o manual
  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true
    setShowWarning(false)
    try {
      localStorage.removeItem(STORAGE_KEY_EXTENDED)
      await signOut()
    } catch (err) {
      console.warn('[SESSION] Error en cierre de sesión programado:', err)
    } finally {
      navigate('/login')
    }
  }, [signOut, navigate])

  // Continuar trabajando (el usuario confirma que desea mantener su sesión activa)
  const handleContinue = useCallback(() => {
    const now = new Date()
    const extendedUntil = getExtendedTarget()
    const target = getNextScheduledLogoutTarget(now, extendedUntil)

    try {
      localStorage.setItem(STORAGE_KEY_EXTENDED, target.getTime().toString())
    } catch {
      // Ignorar
    }

    setShowWarning(false)
  }, [])

  // Escuchar si otra pestaña confirmó continuar sesión
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY_EXTENDED && e.newValue) {
        const extTime = parseInt(e.newValue, 10)
        if (!isNaN(extTime)) {
          const now = Date.now()
          if (extTime > now) {
            setShowWarning(false)
          }
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Timer de comprobación periódico (cada 1 segundo)
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      if (isLoggingOutRef.current) return

      const now = new Date()
      const extendedUntil = getExtendedTarget()
      const target = getNextScheduledLogoutTarget(now, extendedUntil)
      const label = formatTargetLabel(target)
      setTargetLabel(label)

      const timeLeft = target.getTime() - now.getTime()

      if (timeLeft <= 0) {
        // Ventana programada de cierre cumplida (1:00 AM o 1:00 PM) sin respuesta
        console.log(`[SESSION] Ventana de cierre ${label} alcanzada. Cerrando sesión automáticamente.`)
        handleLogout()
      } else if (timeLeft <= WARNING_BEFORE_LOGOUT_MS) {
        // En los últimos 5 minutos: mostrar modal con contador
        setShowWarning(true)
        setSecondsRemaining(Math.max(0, Math.ceil(timeLeft / 1000)))

        // Emitir notificación nativa si la ventana no está visible
        if (notifiedTargetRef.current !== target.getTime()) {
          notifiedTargetRef.current = target.getTime()
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const notif = new Notification(`⏰ Cierre de sesión en 5 minutos (${label})`, {
                body: `El sistema Amazonas COVEPA cerrará tu sesión a las ${label}. Clic aquí si deseas continuar trabajando.`,
                icon: '/favicon.ico',
                tag: `covepa-logout-${target.getTime()}`,
                renotify: true
              })
              notif.onclick = () => {
                window.focus()
                notif.close()
              }
            } catch (err) {
              console.warn('[SESSION] Aviso de escritorio no emitido:', err)
            }
          }
        }
      } else {
        // Fuera de la zona de advertencia de 5 minutos
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
          Cierre de sesión programado ({targetLabel})
        </h3>

        <p className="session-timeout-desc">
          El sistema Amazonas COVEPA tiene programado un cierre de sesión regular a las <strong>{targetLabel}</strong>. Si continúas trabajando, confirma a continuación:
        </p>

        {/* Contador digital regresivo destacado */}
        <div className="session-timeout-countdown-box">
          <div className="timeout-countdown-display">
            <span className="countdown-time-digits">{timeFormatted}</span>
            <span className="countdown-time-unit">restantes</span>
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
          Si no confirmas antes de las <strong>{targetLabel}</strong>, la sesión se cerrará automáticamente por seguridad operativa.
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
            <span>Continuar Trabajando</span>
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
