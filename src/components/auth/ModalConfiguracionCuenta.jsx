import React, { useState, useEffect, useMemo } from 'react'
import {
  Settings, User, Clock, Lock, Bell, Shield,
  CheckCircle2, AlertCircle, Eye, EyeOff, Volume2,
  ChevronRight, RefreshCw, X, Laptop, ShieldCheck,
  Building2, Phone, MapPin, KeyRound, Calendar
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePresentationMode } from '../../context/PresentationContext'
import { playNotificationChime } from '../../context/NotificationContext'
import {
  getNextScheduledLogoutTarget,
  formatTargetLabel,
  STORAGE_KEY_EXTENDED
} from './SessionTimeoutModal'

export default function ModalConfiguracionCuenta({ isOpen, onClose }) {
  const { user, profile, personalMember, isAdmin, updatePassword } = useAuth()
  const { presentationMode, togglePresentationMode } = usePresentationMode()

  const [activeTab, setActiveTab] = useState('perfil') // 'perfil' | 'horarios' | 'seguridad' | 'preferencias'

  // Estados para cambio de contraseña
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState('')

  // Estados de extensión de sesión
  const [extendedNotice, setExtendedNotice] = useState('')
  const [extendedTargetTime, setExtendedTargetTime] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_EXTENDED)
      return stored ? parseInt(stored, 10) : 0
    } catch {
      return 0
    }
  })

  // Permiso de notificaciones de escritorio
  const [desktopPermission, setDesktopPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'unsupported'
  })

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Calcular próxima ventana de cierre
  const nextTarget = useMemo(() => {
    return getNextScheduledLogoutTarget(new Date(), extendedTargetTime)
  }, [extendedTargetTime])

  const targetDateFormatted = useMemo(() => {
    if (!nextTarget) return '1:00 PM'
    try {
      return nextTarget.toLocaleString('es-PE', {
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return formatTargetLabel(nextTarget)
    }
  }, [nextTarget])

  // Tiempo estimado restante
  const remainingHoursMins = useMemo(() => {
    if (!nextTarget) return ''
    const diffMs = nextTarget.getTime() - Date.now()
    if (diffMs <= 0) return 'Inminente'
    const totalMinutes = Math.floor(diffMs / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    return `${hours} hrs y ${mins} min`
  }, [nextTarget])

  // Extender sesión
  const handleExtenderSesion = () => {
    const nextNext = getNextScheduledLogoutTarget(new Date(), nextTarget.getTime() + 60000)
    const targetMs = nextNext.getTime()
    try {
      localStorage.setItem(STORAGE_KEY_EXTENDED, String(targetMs))
      setExtendedTargetTime(targetMs)
      setExtendedNotice(`Sesión extendida exitosamente. La próxima alerta será el ${nextNext.toLocaleString('es-PE', { weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: true })}.`)
    } catch (e) {
      console.warn('Error al guardar extensión en localStorage:', e)
    }
  }

  // Cambio de contraseña
  const handleCambiarContrasena = async (e) => {
    e.preventDefault()
    setPassError('')
    setPassSuccess('')

    if (!newPassword || newPassword.length < 6) {
      setPassError('La nueva contraseña debe tener como mínimo 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPassError('Las contraseñas no coinciden. Verifica que estén escritas idénticas.')
      return
    }

    setSavingPass(true)
    try {
      const { error } = await updatePassword(newPassword)
      if (error) {
        setPassError(error.message || 'Error al actualizar la contraseña.')
      } else {
        setPassSuccess('¡Contraseña actualizada exitosamente! Usa tu nueva clave en tu próximo inicio de sesión.')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      setPassError(err.message || 'Ocurrió un error inesperado al actualizar la contraseña.')
    } finally {
      setSavingPass(false)
    }
  }

  // Solicitar o probar notificaciones de escritorio
  const handleSolicitarNotificaciones = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones de escritorio.')
      return
    }

    try {
      const perm = await Notification.requestPermission()
      setDesktopPermission(perm)
      if (perm === 'granted') {
        playNotificationChime()
        new Notification('🔔 Alertas COVEPA Activadas', {
          body: 'Las notificaciones del sistema están funcionando correctamente en este dispositivo.',
          icon: '/icon-192.png'
        })
      }
    } catch (err) {
      console.warn('Error solicitando permisos:', err)
    }
  }

  if (!isOpen) return null

  return (
    <div className="prog-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="prog-modal"
        style={{
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="prog-modal-header" style={{ flexShrink: 0 }}>
          <h3>
            <Settings size={20} color="#003060" />
            <span>Configuración de la Cuenta y Seguridad</span>
          </h3>
          <button className="btn-close" onClick={onClose} title="Cerrar ventana">
            <X size={18} />
          </button>
        </div>

        {/* Barra de Pestañas Superior */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-light)',
          background: '#f8fafc',
          padding: '0 1rem',
          gap: '0.4rem',
          flexShrink: 0,
          overflowX: 'auto'
        }}>
          {[
            { id: 'perfil', label: 'Mi Perfil', icon: <User size={15} /> },
            { id: 'horarios', label: 'Horarios de Cierre', icon: <Clock size={15} /> },
            { id: 'seguridad', label: 'Cambiar Contraseña', icon: <Lock size={15} /> },
            { id: 'preferencias', label: 'Preferencias y Alertas', icon: <Bell size={15} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.75rem 1rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2.5px solid #003060' : '2.5px solid transparent',
                color: activeTab === tab.id ? '#003060' : '#64748b',
                fontWeight: activeTab === tab.id ? 'var(--fw-bold)' : 'var(--fw-medium)',
                cursor: 'pointer',
                transition: 'all var(--transition)',
                whiteSpace: 'nowrap'
              }}
              className="t-body"
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Cuerpo del Modal con Scroll */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '1.4rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>

          {/* ════════════ PESTAÑA 1: MI PERFIL ════════════ */}
          {activeTab === 'perfil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Tarjeta de Identidad Superior */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                padding: '1.25rem',
                background: 'linear-gradient(135deg, #003060 0%, #0284c7 100%)',
                borderRadius: '12px',
                color: '#ffffff',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  border: '2px solid rgba(255,255,255,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'var(--fw-bold)',
                  fontSize: 'var(--text-xl)',
                  flexShrink: 0
                }}>
                  {presentationMode ? 'CP' : (personalMember?.nombre_completo ? personalMember.nombre_completo.slice(0, 2).toUpperCase() : 'U')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div className="t-title-section" style={{ color: '#ffffff', margin: 0 }}>
                    {presentationMode ? 'COVEPA Admin' : (personalMember?.nombre_completo || user?.email || 'Usuario COVEPA')}
                  </div>
                  <div className="t-meta" style={{ color: '#e0f2fe' }}>
                    {user?.email}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <span className="t-badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }}>
                      {isAdmin ? '🛡️ Administrador del Sistema' : `👤 ${profile?.rol ? profile.rol.toUpperCase() : 'TÉCNICO'}`}
                    </span>
                    <span className="t-badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                      ● Sesión Activa
                    </span>
                  </div>
                </div>
              </div>

              {/* Ficha de Detalles de Perfil */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.85rem'
              }}>
                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div className="t-meta" style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Building2 size={13} />
                    <span>EMPRESA ASIGNADA</span>
                  </div>
                  <div className="t-body" style={{ fontWeight: 'var(--fw-bold)', color: '#003060', marginTop: '0.25rem' }}>
                    {personalMember?.empresa || 'COVEPA S.A.C.'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div className="t-meta" style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Shield size={13} />
                    <span>CARGO / ESPECIALIDAD</span>
                  </div>
                  <div className="t-body" style={{ fontWeight: 'var(--fw-bold)', color: '#003060', marginTop: '0.25rem' }}>
                    {personalMember?.cargo || 'Supervisor de Calidad'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div className="t-meta" style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Phone size={13} />
                    <span>LÍNEA DE CONTACTO</span>
                  </div>
                  <div className="t-body" style={{ fontWeight: 'var(--fw-bold)', color: '#003060', marginTop: '0.25rem' }}>
                    {personalMember?.telefono || personalMember?.contacto_1 || 'No registrado'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div className="t-meta" style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={13} />
                    <span>CIUDAD DE BASE / ORIGEN</span>
                  </div>
                  <div className="t-body" style={{ fontWeight: 'var(--fw-bold)', color: '#003060', marginTop: '0.25rem' }}>
                    {personalMember?.ciudad_origen || personalMember?.origen || 'Chachapoyas / Amazonas'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ PESTAÑA 2: HORARIOS DE CIERRE AUTOMÁTICO ════════════ */}
          {activeTab === 'horarios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Notificación de extensión */}
              {extendedNotice && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <CheckCircle2 size={18} color="#16a34a" />
                  <span className="t-body">{extendedNotice}</span>
                </div>
              )}

              {/* Explicación de la Política de Seguridad */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem'
              }}>
                <div className="t-title-section" style={{ color: '#003060', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} color="#0284c7" />
                  <span>Política de Cierre Programado de Sesión</span>
                </div>
                <p className="t-body" style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Por seguridad de la información institucional y protección de sesiones en dispositivos compartidos o de campo, el sistema cuenta con dos horarios fijos de cierre automático diario cada 12 horas.
                </p>

                {/* Tarjetas de las 2 Ventanas Fijas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginTop: '0.5rem' }}>
                  <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ fontSize: 'var(--text-xl)' }}>🌙</div>
                    <div>
                      <div className="t-name" style={{ color: '#003060' }}>01:00 AM</div>
                      <div className="t-meta" style={{ color: '#64748b' }}>Ventana Nocturna (aviso 12:55 AM)</div>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ fontSize: 'var(--text-xl)' }}>☀️</div>
                    <div>
                      <div className="t-name" style={{ color: '#003060' }}>01:00 PM</div>
                      <div className="t-meta" style={{ color: '#64748b' }}>Ventana Diurna (aviso 12:55 PM)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado de la Sesión Actual */}
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div className="t-name" style={{ color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={16} />
                  <span>Próximo Cierre Programado para tu Sesión</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div className="t-title-section" style={{ color: '#003060', margin: 0 }}>
                      {targetDateFormatted}
                    </div>
                    <div className="t-meta" style={{ color: '#475569', marginTop: '0.15rem' }}>
                      Tiempo estimado de sesión activa restante: <strong>{remainingHoursMins}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExtenderSesion}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.55rem 1.1rem',
                      background: '#003060',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'var(--fw-bold)'
                    }}
                    className="t-body"
                  >
                    <span>⏱️ Extender 12 Horas Más</span>
                  </button>
                </div>
                <span className="t-meta" style={{ color: '#64748b' }}>
                  Si te encuentras en jornada extendida o realizando guardias nocturnas, pulsa "Extender" para posponer el aviso sin que se cierre tu sesión.
                </span>
              </div>
            </div>
          )}

          {/* ════════════ PESTAÑA 3: SEGURIDAD Y CLAVE ════════════ */}
          {activeTab === 'seguridad' && (
            <form onSubmit={handleCambiarContrasena} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {passError && (
                <div style={{
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={18} color="#dc2626" />
                  <span className="t-body">{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <CheckCircle2 size={18} color="#16a34a" />
                  <span className="t-body">{passSuccess}</span>
                </div>
              )}

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div className="t-name" style={{ color: '#003060', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <KeyRound size={17} color="#0284c7" />
                  <span>Actualizar Contraseña de Acceso</span>
                </div>
                <p className="t-meta" style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  Ingresa tu nueva contraseña para tu cuenta de usuario (<code>{user?.email}</code>). Debe contener un mínimo de 6 caracteres.
                </p>

                <div className="prog-form-group">
                  <label>Nueva Contraseña *</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="prog-form-control"
                      placeholder="Mínimo 6 caracteres..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ paddingRight: '2.5rem', width: '100%' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{
                        position: 'absolute',
                        right: '0.65rem',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                      title={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="prog-form-group">
                  <label>Confirmar Nueva Contraseña *</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="prog-form-control"
                    placeholder="Repite la nueva contraseña..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={savingPass || !newPassword}
                    style={{ padding: '0.65rem 1.4rem' }}
                  >
                    <span>{savingPass ? 'Guardando...' : 'Actualizar Contraseña'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ════════════ PESTAÑA 4: PREFERENCIAS Y NOTIFICACIONES ════════════ */}
          {activeTab === 'preferencias' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Notificaciones de Escritorio */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="t-name" style={{ color: '#003060', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Laptop size={17} color="#0284c7" />
                    <span>Notificaciones de Escritorio (Windows / Celular)</span>
                  </div>
                  <span
                    className="t-badge"
                    style={{
                      background: desktopPermission === 'granted' ? '#dcfce7' : '#fee2e2',
                      color: desktopPermission === 'granted' ? '#15803d' : '#b91c1c',
                      border: `1px solid ${desktopPermission === 'granted' ? '#86efac' : '#fca5a5'}`
                    }}
                  >
                    {desktopPermission === 'granted' ? '✓ Activas' : 'Inactivas / Bloqueadas'}
                  </span>
                </div>
                <p className="t-meta" style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  Te alertan cuando entra una nueva solicitud de revisión de campo o cuando el reporte diario por correo ha sido enviado, incluso con el navegador minimizado.
                </p>
                <div>
                  <button
                    type="button"
                    onClick={handleSolicitarNotificaciones}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 0.95rem',
                      background: '#f0f7ff',
                      border: '1px solid #bfdbfe',
                      color: '#1d4ed8',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'var(--fw-semibold)'
                    }}
                    className="t-meta"
                  >
                    <Bell size={14} />
                    <span>Solicitar / Probar Notificación de Escritorio</span>
                  </button>
                </div>
              </div>

              {/* Alertas Sonoras (Chime) */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div>
                  <div className="t-name" style={{ color: '#003060', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Volume2 size={17} color="#0284c7" />
                    <span>Campana Sonora de Alertas (Web Audio API)</span>
                  </div>
                  <p className="t-meta" style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                    Sintetizador armónico suave de 2 tonos que suena ante eventos clave en segundo plano.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => playNotificationChime()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem 0.95rem',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'var(--fw-semibold)',
                    whiteSpace: 'nowrap'
                  }}
                  className="t-meta"
                >
                  <Volume2 size={14} />
                  <span>Probar Sonido</span>
                </button>
              </div>

              {/* Modo Presentación / Confidencial */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div>
                  <div className="t-name" style={{ color: '#003060', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <ShieldCheck size={17} color="#0284c7" />
                    <span>Modo Presentación / Confidencial</span>
                  </div>
                  <p className="t-meta" style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                    Oculta números de teléfono y datos confidenciales del equipo al proyectar la pantalla en reuniones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={togglePresentationMode}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '20px',
                    border: '1px solid transparent',
                    cursor: 'pointer',
                    fontWeight: 'var(--fw-bold)',
                    background: presentationMode ? '#dcfce7' : '#f1f5f9',
                    color: presentationMode ? '#15803d' : '#475569',
                    borderColor: presentationMode ? '#86efac' : '#cbd5e1'
                  }}
                  className="t-meta"
                >
                  <span>{presentationMode ? '✅ Activado' : 'Desactivado'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Pie del Modal */}
        <div className="prog-modal-footer" style={{ flexShrink: 0, background: '#ffffff', borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

