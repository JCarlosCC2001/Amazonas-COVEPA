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
// Contexto de Audio compartido y desbloqueado con interacción de usuario para evitar avisos de Autoplay Policy
let sharedAudioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioContextClass()
    } catch {
      return null
    }
  }
  return sharedAudioCtx
}

// Escuchar la primera interacción del usuario para desbloquear el AudioContext limpiamente
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    window.removeEventListener('click', unlockAudio)
    window.removeEventListener('keydown', unlockAudio)
    window.removeEventListener('touchstart', unlockAudio)
  }
  window.addEventListener('click', unlockAudio, { passive: true })
  window.addEventListener('keydown', unlockAudio, { passive: true })
  window.addEventListener('touchstart', unlockAudio, { passive: true })
}

/**
 * Sintetizador Web Audio API para campana sutil de notificación
 */
export function playNotificationChime() {
  try {
    const ctx = getAudioContext()
    if (!ctx || ctx.state === 'suspended') return
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
 * Sintetizador Web Audio API: reproduce un chime distintivo de 3 tonos
 * para alertas de acumulación y cuellos de botella en colas de espera.
 */
export function playAccumulationChime() {
  try {
    const ctx = getAudioContext()
    if (!ctx || ctx.state === 'suspended') return
    const now = ctx.currentTime

    // 3 tonos armónicos ascendentes: Mi 5 (659.25 Hz), Sol# 5 (830.61 Hz), Si 5 (987.77 Hz)
    const freqs = [659.25, 830.61, 987.77]
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const startT = now + idx * 0.12
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, startT)
      gain.gain.setValueAtTime(0.14, startT)
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.38)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startT)
      osc.stop(startT + 0.38)
    })
  } catch {
    // Silenciar sin error
  }
}

/**
 * Calcula los minutos transcurridos desde una fecha ISO.
 * Si es nula o inválida, retorna 9999 (antigua / acumulada).
 */
export function calcWaitMins(isoString) {
  if (!isoString) return 9999
  const t = new Date(isoString).getTime()
  if (isNaN(t)) return 9999
  return Math.max(0, Math.floor((Date.now() - t) / 60000))
}

/**
 * Formato legible del tiempo de espera (minutos, horas, días).
 */
export function formatWaitTime(mins) {
  if (mins >= 9999) return '+12 horas'
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours < 24) {
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  return `${days}d`
}

/**
 * Determina la franja / bucket de espera de una observación:
 * <10m | +10m | +1h | +2h | +6h | +12h
 */
export function getWaitTierInfo(mins) {
  if (mins < 10) return { key: 'recent', label: '< 10m', badgeClass: 'tier-badge-recent', isOver10m: false }
  if (mins < 60) return { key: '10m', label: '+10 min', badgeClass: 'tier-badge-10m', isOver10m: true }
  if (mins < 120) return { key: '1h', label: '+1 hora', badgeClass: 'tier-badge-1h', isOver10m: true }
  if (mins < 360) return { key: '2h', label: '+2 horas', badgeClass: 'tier-badge-2h', isOver10m: true }
  if (mins < 720) return { key: '6h', label: '+6 horas', badgeClass: 'tier-badge-6h', isOver10m: true }
  return { key: '12h', label: '+12 horas', badgeClass: 'tier-badge-12h', isOver10m: true }
}

/**
 * Copia al portapapeles exclusivamente los códigos de observación agrupados
 * por los rangos de tiempo de espera requeridos (+12h, +6h, +2h, +1h, +10min),
 * sin código de sitio, nombre ni localidad.
 */
export async function copyObservacionesList(items) {
  if (!items || items.length === 0) return false

  const tiers = [
    { label: 'MÁS DE 12 HORAS', min: 720, max: Infinity },
    { label: 'MÁS DE 6 HORAS', min: 360, max: 720 },
    { label: 'MÁS DE 2 HORAS', min: 120, max: 360 },
    { label: 'MÁS DE 1 HORA', min: 60, max: 120 },
    { label: 'MÁS DE 10 MINUTOS', min: 10, max: 60 }
  ]

  const groups = []

  for (const tier of tiers) {
    const matching = items.filter(it => {
      const wait = typeof it === 'object'
        ? (it.waitMins !== undefined ? it.waitMins : calcWaitMins(it.fecha_subsanacion))
        : 0
      return wait >= tier.min && wait < tier.max
    })

    if (matching.length > 0) {
      // Filtrar y deduplicar únicamente los códigos de observación
      const codes = Array.from(
        new Set(
          matching
            .map(it => (typeof it === 'object' ? it.id_obs : String(it)))
            .filter(Boolean)
        )
      )
      if (codes.length > 0) {
        groups.push(`${tier.label} (${codes.length}):\n${codes.join(', ')}`)
      }
    }
  }

  // Si hubiera observaciones con menos de 10 minutos
  const recent = items.filter(it => {
    const wait = typeof it === 'object'
      ? (it.waitMins !== undefined ? it.waitMins : calcWaitMins(it.fecha_subsanacion))
      : 0
    return wait < 10
  })
  if (recent.length > 0) {
    const codes = Array.from(
      new Set(
        recent
          .map(it => (typeof it === 'object' ? it.id_obs : String(it)))
          .filter(Boolean)
      )
    )
    if (codes.length > 0) {
      groups.push(`MENOS DE 10 MINUTOS (${codes.length}):\n${codes.join(', ')}`)
    }
  }

  const fullText = groups.length > 0
    ? groups.join('\n\n')
    : items.map(it => (typeof it === 'object' ? it.id_obs : String(it))).filter(Boolean).join(', ')

  // 1. Intento primario con API Clipboard moderna
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(fullText)
      return true
    }
  } catch (err) {
    console.warn('Error con navigator.clipboard.writeText, recurriendo a fallback:', err)
  }

  // 2. Fallback robusto con textarea para compatibilidad móvil universal (Brave, Chrome, Safari)
  try {
    const textArea = document.createElement('textarea')
    textArea.value = fullText
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    textArea.setAttribute('readonly', '')
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    if (successful) return true
  } catch (fallbackErr) {
    console.warn('Error en fallback execCommand del portapapeles:', fallbackErr)
  }

  return false
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
  const [solicitudes, setSolicitudes] = useState([]) // Técnicos: Solicitando Revisión
  const [enRevision, setEnRevision] = useState([])     // Auditores: En Revisión
  const [accumulationAlert, setAccumulationAlert] = useState(null) // Alerta de acumulación consolidada
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
  const lastAlertTecnicosRef = useRef({ time: 0, count: 0 })
  const lastAlertAuditoresRef = useRef({ time: 0, count: 0 })

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
        icon: '/icon-192.png',
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
      // Evitar toasts duplicados para la misma observación activa, y si es alerta de acumulación reemplazar cualquier alerta de acumulación previa
      const filtered = prev.filter(t => {
        if (obs.isAccumulationAlert && t.obs.isAccumulationAlert) return false
        return t.obs.id_obs !== obs.id_obs
      })
      return [nuevoToast, ...filtered].slice(0, 3) // Máximo 3 toasts simultáneos
    })

    // Reproducir aviso sonoro suave
    playNotificationChime()

    // Auto-descartar después de exactamente 5 segundos a solicitud expresa del usuario
    const timeoutMs = 5000
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId))
    }, timeoutMs)
  }, [])

  // Evaluar alertas anti-spam por acumulación exclusivamente en cola de auditores (En Revisión)
  const evaluarAlertasAcumulacion = useCallback((solRows, revRows) => {
    const now = Date.now()
    const COOLDOWN_MS = 30 * 60 * 1000 // Pausa de 30 minutos entre avisos acumulados para no spamear

    // Evaluar acumulación de auditores (En Revisión): solo genera alerta si hay 5 o más demoradas (+10m)
    const revDemoradas = (revRows || []).filter(s => calcWaitMins(s.fecha_subsanacion) >= 10)

    if (revDemoradas.length >= 5) {
      const revDemoradasOrdenadas = [...revDemoradas].sort((a, b) => {
        const tA = new Date(a.fecha_subsanacion || 0).getTime()
        const tB = new Date(b.fecha_subsanacion || 0).getTime()
        return tA - tB
      })
      const masAntigua = revDemoradasOrdenadas[0]

      const loc = sitiosMapRef.current[masAntigua.id_sitio] || ''
      const minsAntigua = calcWaitMins(masAntigua.fecha_subsanacion)
      const tiempoTxt = formatWaitTime(minsAntigua)

      const titulo = `⚠️ Observaciones en Revisión Acumuladas (${revDemoradas.length})`
      const mensaje = `Hay ${revDemoradas.length} observaciones en revisión (+10 min) sin dictaminar. La más antigua lleva ${tiempoTxt} (${masAntigua.id_sitio}${loc ? ` · ${loc}` : ''}).`

      const alertObj = {
        id_obs: 'ALERTA-ACUMULACION-REVISION',
        isAccumulationAlert: true,
        tipo: 'acumulacion_revision',
        titulo: 'Observaciones en Revisión Demoradas',
        count: revDemoradas.length,
        detalle: mensaje,
        id_sitio: masAntigua.id_sitio,
        localidad: loc,
        revisor: masAntigua.revisor || 'Auditoría Gilat',
        fecha_subsanacion: masAntigua.fecha_subsanacion,
        items: revDemoradasOrdenadas.map(item => ({
          id_obs: item.id_obs,
          id_sitio: item.id_sitio,
          localidad: sitiosMapRef.current[item.id_sitio] || '',
          revisor: item.revisor,
          fecha_subsanacion: item.fecha_subsanacion,
          waitMins: calcWaitMins(item.fecha_subsanacion)
        }))
      }
      setAccumulationAlert(alertObj)

      const prev = lastAlertAuditoresRef.current
      const tiempoPasado = now - prev.time
      const aumentoSignificativo = revDemoradas.length >= prev.count + 3

      if (tiempoPasado >= COOLDOWN_MS || aumentoSignificativo) {
        lastAlertAuditoresRef.current = { time: now, count: revDemoradas.length }

        dispararToast({
          id_obs: `ALERTA-COLA-AUDITORES-${Date.now()}`,
          id_sitio: masAntigua.id_sitio,
          estado_covepa: 'En Revisión',
          revisor: masAntigua.revisor || 'Auditoría Gilat',
          detalle: mensaje,
          isAccumulationAlert: true,
          queueType: 'auditores',
          items: alertObj.items
        }, loc)

        playAccumulationChime()

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(titulo, {
              body: mensaje,
              icon: '/icon-192.png',
              tag: 'covepa-alerta-acumulacion-revision',
              renotify: true
            })
          } catch {}
        }
      }
    } else {
      setAccumulationAlert(null)
    }
  }, [dispararToast])

  // Consultar observaciones en Solicitando Revisión y En Revisión desde Supabase
  const fetchSolicitudes = useCallback(async (isRealtimeAlert = false) => {
    try {
      // 1. Solicitudes de Técnicos (Solicitando Revisión)
      const { data: solData, error: solErr } = await supabase
        .from('observaciones')
        .select('id_obs, id_sitio, estado_covepa, revisor, fecha_subsanacion, subsistema, detalle, comentario_covepa')
        .in('estado_covepa', ['Solicitando Revisión', 'Solicitando Revision'])
        .order('fecha_subsanacion', { ascending: true }) // De más antigua a más reciente

      // 2. Observaciones en Auditoría (En Revisión)
      const { data: revData, error: revErr } = await supabase
        .from('observaciones')
        .select('id_obs, id_sitio, estado_covepa, revisor, fecha_subsanacion, subsistema, detalle, comentario_covepa')
        .in('estado_covepa', ['En Revisión', 'En Revision'])
        .order('fecha_subsanacion', { ascending: true }) // De más antigua a más reciente

      if (solErr) console.warn('[NOTIF-FETCH] Error consultando solicitudes:', solErr.message)
      if (revErr) console.warn('[NOTIF-FETCH] Error consultando en revisión:', revErr.message)

      const solRows = solData || []
      const revRows = revData || []

      // Si no es la primera carga y detectamos una nueva solicitud entrante individual
      if (!isFirstLoadRef.current && isRealtimeAlert) {
        for (const row of solRows) {
          if (!knownIdsRef.current.has(row.id_obs)) {
            const loc = sitiosMapRef.current[row.id_sitio] || ''
            dispararToast(row, loc)
            dispararNotificacionEscritorio(row, loc)
            break
          }
        }
      }

      // Evaluar si se han acumulado (5+ con > 10 min de espera)
      evaluarAlertasAcumulacion(solRows, revRows)

      knownIdsRef.current = new Set([...solRows.map(r => r.id_obs), ...revRows.map(r => r.id_obs)])
      isFirstLoadRef.current = false

      setSolicitudes(solRows)
      setEnRevision(revRows)
    } catch (err) {
      console.warn('[NOTIF-FETCH] Error de red:', err)
    }
  }, [dispararToast, dispararNotificacionEscritorio, evaluarAlertasAcumulacion])

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
          icon: '/icon-192.png'
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

  // Marcar todas las solicitudes actuales como leídas (ambas colas)
  const markAllAsRead = () => {
    setReadIds(prev => {
      const updated = new Set(prev)
      for (const s of solicitudes) {
        updated.add(s.id_obs)
      }
      for (const r of enRevision) {
        updated.add(r.id_obs)
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

  // Alerta de acumulación consolidada si está activa y no descartada
  const activeAccumulation = (accumulationAlert && !dismissedIds.has(accumulationAlert.id_obs))
    ? [accumulationAlert]
    : []

  // Bandeja unificada: la alerta de acumulación aparece al inicio como aviso prioritario, seguida de las solicitudes de técnicos
  const unifiedNotifications = [...activeAccumulation, ...visibleSolicitudes]

  // Conteo consolidado de no leídas para la campana (+1 si la alerta de acumulación está sin leer)
  const isAccUnread = activeAccumulation.length > 0 && !readIds.has(accumulationAlert.id_obs)
  const unreadCount = visibleSolicitudes.filter(s => !readIds.has(s.id_obs)).length + (isAccUnread ? 1 : 0)
  const dismissedCount = solicitudes.filter(s => dismissedIds.has(s.id_obs)).length + (accumulationAlert && dismissedIds.has(accumulationAlert.id_obs) ? 1 : 0)

  // Limpiar todas las notificaciones de la bandeja
  const clearAllNotifications = useCallback(() => {
    setDismissedIds(prev => {
      const updated = new Set(prev)
      for (const s of solicitudes) updated.add(s.id_obs)
      if (accumulationAlert) updated.add(accumulationAlert.id_obs)
      return updated
    })
    setToasts([])
  }, [solicitudes, accumulationAlert])

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

  // Disparar manualmente una notificación de prueba con las observaciones actualmente en revisión
  const dispararPruebaRevision = useCallback(() => {
    const demoradas = enRevision.filter(s => calcWaitMins(s.fecha_subsanacion) >= 10)
    const listado = demoradas.length > 0 ? demoradas : enRevision
    if (listado.length === 0) return

    const ordenadas = [...listado].sort((a, b) => {
      const tA = new Date(a.fecha_subsanacion || 0).getTime()
      const tB = new Date(b.fecha_subsanacion || 0).getTime()
      return tA - tB
    })
    const masAntigua = ordenadas[0]
    const loc = sitiosMapRef.current[masAntigua.id_sitio] || ''
    const minsAntigua = calcWaitMins(masAntigua.fecha_subsanacion)
    const tiempoTxt = formatWaitTime(minsAntigua)

    const mensaje = `[PRUEBA] Hay ${ordenadas.length} observaciones en revisión (+10 min) en espera. La más antigua lleva ${tiempoTxt} (${masAntigua.id_sitio}${loc ? ` · ${loc}` : ''}).`

    const alertObj = {
      id_obs: 'ALERTA-ACUMULACION-REVISION',
      isAccumulationAlert: true,
      tipo: 'acumulacion_revision',
      titulo: 'Observaciones en Revisión Demoradas',
      count: ordenadas.length,
      detalle: mensaje,
      id_sitio: masAntigua.id_sitio,
      localidad: loc,
      revisor: masAntigua.revisor || 'Auditoría Gilat',
      fecha_subsanacion: masAntigua.fecha_subsanacion,
      items: ordenadas.map(item => ({
        id_obs: item.id_obs,
        id_sitio: item.id_sitio,
        localidad: sitiosMapRef.current[item.id_sitio] || '',
        revisor: item.revisor,
        fecha_subsanacion: item.fecha_subsanacion,
        waitMins: calcWaitMins(item.fecha_subsanacion)
      }))
    }

    setDismissedIds(prev => {
      const copy = new Set(prev)
      copy.delete('ALERTA-ACUMULACION-REVISION')
      return copy
    })
    setAccumulationAlert(alertObj)

    dispararToast({
      id_obs: `ALERTA-PRUEBA-REVISION-${Date.now()}`,
      id_sitio: masAntigua.id_sitio,
      estado_covepa: 'En Revisión',
      revisor: masAntigua.revisor || 'Auditoría Gilat',
      detalle: mensaje,
      isAccumulationAlert: true,
      queueType: 'auditores',
      items: alertObj.items
    }, loc)

    playAccumulationChime()

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`[PRUEBA] ⚠️ Observaciones en Revisión Acumuladas (${ordenadas.length})`, {
          body: `Hay ${ordenadas.length} observaciones en revisión (+10 min) en espera.`,
          icon: '/icon-192.png',
          tag: 'covepa-alerta-acumulacion-revision-prueba',
          renotify: true
        })
      } catch {}
    }
  }, [enRevision, dispararToast])

  // Exponer globalmente en window para pruebas en cualquier momento
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.probarNotificacionRevision = dispararPruebaRevision
    }
  }, [dispararPruebaRevision])

  // Auto-disparar una vez como prueba activa para que el usuario verifique la notificación en pantalla
  const hasTriggeredTestRef = useRef(false)
  useEffect(() => {
    if (enRevision.length > 0 && !hasTriggeredTestRef.current) {
      hasTriggeredTestRef.current = true
      const timer = setTimeout(() => {
        dispararPruebaRevision()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [enRevision, dispararPruebaRevision])

  return (
    <NotificationContext.Provider
      value={{
        solicitudes: unifiedNotifications,
        totalSolicitudes: unifiedNotifications.length,
        unreadCount,
        dismissedCount,
        clearAllNotifications,
        dismissNotification,
        restoreDismissedNotifications,
        dispararPruebaRevision,
        copyObservacionesList,
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
