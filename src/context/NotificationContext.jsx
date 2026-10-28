import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCachedSitiosAsignados } from '../services/sitiosService'
import { asegurarProgramacionSitio } from '../services/programacionService'

const NotificationContext = createContext(null)

const STORAGE_KEY_READS = 'covepa_read_solicitudes'
const STORAGE_KEY_DISMISSED = 'covepa_dismissed_solicitudes'
const KNOWN_IDS_KEY = 'covepa_known_solicitud_ids'

/**
 * Sintetizador Web Audio API: reproduce un chime armónico sutil de 2 tonos
 * Sin dependencias de archivos de audio externos, instantáneo y ligero.
 */
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // Tono 1: Re 5 (587.33 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0.12, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.32)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.32)

    // Tono 2: La 5 (880.00 Hz) con ligero delay armónico
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880.00, now + 0.11)
    gain2.gain.setValueAtTime(0.15, now + 0.11)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.11)
    osc2.stop(now + 0.55)
  } catch {
    // Si el navegador bloquea audio por políticas de interacción, silenciar sin error
  }
}

/**
 * Helper para formatear tiempo relativo legible en español
 */
export function formatTiempoRelativo(isoString) {
  if (!isoString) return 'Reciente'
  try {
    const fecha = new Date(isoString)
    if (isNaN(fecha.getTime())) return 'Reciente'
    const diffSeg = Math.floor((Date.now() - fecha.getTime()) / 1000)

    if (diffSeg < 45) return 'Hace unos segundos'
    if (diffSeg < 3600) return `Hace ${Math.floor(diffSeg / 60)} min`
    if (diffSeg < 86400) {
      const horas = Math.floor(diffSeg / 3600)
      return horas === 1 ? 'Hace 1 hora' : `Hace ${horas} horas`
    }
    const dias = Math.floor(diffSeg / 86400)
    if (dias === 1) return 'Ayer'
    if (dias < 7) return `Hace ${dias} días`
    return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return 'Reciente'
  }
}

export function NotificationProvider({ children }) {
  const [solicitudes, setSolicitudes] = useState([])
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_READS)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DISMISSED)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [toasts, setToasts] = useState([])
  const [desktopPermission, setDesktopPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'unsupported'
  })

  const sitiosMapRef = useRef({})
  const isFirstLoadRef = useRef(true)
  const knownIdsRef = useRef(new Set())

  // Cargar catálogo de sitios asignados para mapear localidades en notificaciones
  useEffect(() => {
    getCachedSitiosAsignados().then(list => {
      const map = {}
      for (const s of (list || [])) {
        map[s.id_site] = s.localidad || s.nombre_nodo || ''
      }
      sitiosMapRef.current = map
    }).catch(() => {})
  }, [])

  // Guardar IDs leídos en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_READS, JSON.stringify(Array.from(readIds)))
    } catch (e) {
      console.warn('Error guardando readIds en localStorage:', e)
    }
  }, [readIds])

  // Guardar IDs descartados/limpiados en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DISMISSED, JSON.stringify(Array.from(dismissedIds)))
    } catch (e) {
      console.warn('Error guardando dismissedIds en localStorage:', e)
    }
  }, [dismissedIds])

  // Despachar notificación nativa de Windows / Navegador
  const dispararNotificacionEscritorio = useCallback((obs, localidad) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    try {
      const locText = localidad ? ` · ${localidad}` : ''
      const revisorText = obs.revisor ? `Solicitado por: ${obs.revisor}` : 'Técnico en campo solicita revisión técnica.'
      const notif = new Notification(`🔔 Solicitud de Revisión: ${obs.id_obs}`, {
        body: `${obs.id_sitio}${locText}\n${revisorText}`,
        icon: '/favicon.ico',
        tag: `covepa-solicitud-${obs.id_obs}`,
        renotify: true
      })

      notif.onclick = () => {
        window.focus()
        window.location.href = `/observaciones?search=${encodeURIComponent(obs.id_obs)}`
        notif.close()
      }
    } catch (err) {
      console.warn('Aviso de notificación de escritorio no emitido:', err)
    }
  }, [])

  // Despachar Toast flotante interactivo
  const dispararToast = useCallback((obs, localidad) => {
    const toastId = `toast-${obs.id_obs}-${Date.now()}`
    const nuevoToast = {
      id: toastId,
      obs: {
        ...obs,
        localidad: localidad || sitiosMapRef.current[obs.id_sitio] || ''
      },
      createdAt: Date.now()
    }

    setToasts(prev => {
      // Evitar toasts duplicados para la misma observación activa
      const filtered = prev.filter(t => t.obs.id_obs !== obs.id_obs)
      return [nuevoToast, ...filtered].slice(0, 3) // Máximo 3 toasts simultáneos
    })

    // Reproducir aviso sonoro suave
    playNotificationChime()

    // Auto-descartar después de 8 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId))
    }, 8500)
  }, [])

  // Consultar observaciones en Solicitando Revisión desde Supabase
  const fetchSolicitudes = useCallback(async (isRealtimeAlert = false) => {
    try {
      const { data, error } = await supabase
        .from('observaciones')
        .select('id_obs, id_sitio, estado_covepa, revisor, fecha_subsanacion, subsistema, detalle, comentario_covepa')
        .in('estado_covepa', ['Solicitando Revisión', 'Solicitando Revision'])
        .order('fecha_subsanacion', { ascending: false })

      if (error) {
        console.warn('[NOTIF-FETCH] Error consultando observaciones:', error.message)
        return
      }

      const rows = data || []

      // Si no es la primera carga y detectamos una nueva observación que no teníamos registrada
      if (!isFirstLoadRef.current && isRealtimeAlert) {
        for (const row of rows) {
          if (!knownIdsRef.current.has(row.id_obs)) {
            const loc = sitiosMapRef.current[row.id_sitio] || ''
            dispararToast(row, loc)
            dispararNotificacionEscritorio(row, loc)
            break
          }
        }
      }

      // Actualizar registro de conocidos
      knownIdsRef.current = new Set(rows.map(r => r.id_obs))
      isFirstLoadRef.current = false

      setSolicitudes(rows)
    } catch (err) {
      console.warn('[NOTIF-FETCH] Error de red:', err)
    }
  }, [dispararToast, dispararNotificacionEscritorio])

  // Carga inicial y Polling resiliente cada 30 segundos
  useEffect(() => {
    fetchSolicitudes(false)

    const interval = setInterval(() => {
      fetchSolicitudes(true)
    }, 30000)

    // Reconsultar si el usuario regresa a la pestaña activa
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchSolicitudes(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchSolicitudes])

  // Supabase Realtime: Escuchar cambios inmediatos en observaciones e historial
  useEffect(() => {
    const channel = supabase
      .channel('covepa-notificaciones-solicitudes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'observaciones' },
        (payload) => {
          const newRow = payload.new
          const oldRow = payload.old

          // Regla: Auto-programar sitio si hubo cambio de estado y no está programado en la fecha
          if (newRow && newRow.estado_covepa && newRow.estado_covepa !== oldRow?.estado_covepa) {
            asegurarProgramacionSitio({
              idSitio: newRow.id_sitio,
              idObs: newRow.id_obs,
              fecha: newRow.fecha_subsanacion
            }).catch(err => console.warn('[NOTIF-AUTO-PROG] Error asegurando programación:', err))
          }

          if (newRow && (newRow.estado_covepa === 'Solicitando Revisión' || newRow.estado_covepa === 'Solicitando Revision')) {
            const loc = sitiosMapRef.current[newRow.id_sitio] || ''
            dispararToast(newRow, loc)
            dispararNotificacionEscritorio(newRow, loc)
            // Marcar como no leída para que aumente el contador y reactivar si estaba descartada
            setReadIds(prev => {
              const updated = new Set(prev)
              updated.delete(newRow.id_obs)
              return updated
            })
            setDismissedIds(prev => {
              if (prev.has(newRow.id_obs)) {
                const updated = new Set(prev)
                updated.delete(newRow.id_obs)
                return updated
              }
              return prev
            })
            fetchSolicitudes(false)
          } else if (oldRow && (oldRow.estado_covepa === 'Solicitando Revisión' || oldRow.estado_covepa === 'Solicitando Revision')) {
            // Ya no está en solicitando revisión (se validó, rechazó, etc.)
            fetchSolicitudes(false)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'historial_estados_observaciones' },
        (payload) => {
          const row = payload.new

          // Regla: Auto-programar sitio ante cualquier cambio de estado registrado en historial
          if (row && row.id_sitio) {
            asegurarProgramacionSitio({
              idSitio: row.id_sitio,
              idObs: row.id_obs,
              fecha: row.created_at
            }).catch(err => console.warn('[NOTIF-AUTO-PROG] Error asegurando programación:', err))
          }

          if (row && (row.estado_nuevo === 'Solicitando Revisión' || row.estado_nuevo === 'Solicitando Revision')) {
            const obsLike = {
              id_obs: row.id_obs,
              id_sitio: row.id_sitio,
              estado_covepa: row.estado_nuevo,
              revisor: row.usuario_nombre,
              fecha_subsanacion: row.created_at,
              detalle: row.comentario
            }
            const loc = sitiosMapRef.current[row.id_sitio] || ''
            dispararToast(obsLike, loc)
            dispararNotificacionEscritorio(obsLike, loc)
            setDismissedIds(prev => {
              if (prev.has(row.id_obs)) {
                const updated = new Set(prev)
                updated.delete(row.id_obs)
                return updated
              }
              return prev
            })
            fetchSolicitudes(false)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[NOTIF-REALTIME] Canal de notificaciones en tiempo real conectado.')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dispararToast, dispararNotificacionEscritorio, fetchSolicitudes])

  // Solicitar permiso de notificaciones de escritorio de Windows
  const requestDesktopPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    try {
      const perm = await Notification.requestPermission()
      setDesktopPermission(perm)
      if (perm === 'granted') {
        playNotificationChime()
        new Notification('🔔 Alertas COVEPA Activadas', {
          body: 'Recibirás avisos instantáneos cuando un técnico solicite revisión.',
          icon: '/favicon.ico'
        })
      }
      return perm
    } catch (err) {
      console.warn('Error solicitando permiso de notificación:', err)
      return 'denied'
    }
  }

  // Marcar una observación individual como leída
  const markAsRead = (idObs) => {
    if (!idObs) return
    setReadIds(prev => new Set([...prev, idObs]))
  }

  // Marcar todas las solicitudes actuales como leídas
  const markAllAsRead = () => {
    setReadIds(prev => {
      const updated = new Set(prev)
      for (const s of solicitudes) {
        updated.add(s.id_obs)
      }
      return updated
    })
  }

  // Descartar un Toast flotante específico
  const dismissToast = (toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId))
  }

  // Filtrado de solicitudes visibles en la bandeja (no descartadas/limpiadas)
  const visibleSolicitudes = solicitudes.filter(s => !dismissedIds.has(s.id_obs))
  const unreadCount = visibleSolicitudes.filter(s => !readIds.has(s.id_obs)).length
  const dismissedCount = solicitudes.filter(s => dismissedIds.has(s.id_obs)).length

  // Limpiar todas las notificaciones de la bandeja
  const clearAllNotifications = useCallback(() => {
    setDismissedIds(prev => {
      const updated = new Set(prev)
      for (const s of solicitudes) {
        updated.add(s.id_obs)
      }
      return updated
    })
    setToasts([])
  }, [solicitudes])

  // Descartar/limpiar una notificación individual
  const dismissNotification = useCallback((idObs) => {
    if (!idObs) return
    setDismissedIds(prev => new Set([...prev, idObs]))
    setToasts(prev => prev.filter(t => t.obs.id_obs !== idObs))
  }, [])

  // Restaurar todas las notificaciones limpiadas
  const restoreDismissedNotifications = useCallback(() => {
    setDismissedIds(new Set())
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        solicitudes: visibleSolicitudes,
        totalSolicitudes: solicitudes.length,
        unreadCount,
        dismissedCount,
        clearAllNotifications,
        dismissNotification,
        restoreDismissedNotifications,
        readIds,
        toasts,
        desktopPermission,
        requestDesktopPermission,
        markAsRead,
        markAllAsRead,
        dismissToast,
        fetchSolicitudes,
        sitiosMap: sitiosMapRef.current
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications debe usarse dentro de un NotificationProvider')
  }
  return context
}
