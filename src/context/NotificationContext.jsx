import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getCachedSitiosAsignados, ASIGNACIONES_BASE } from '../services/sitiosService'
import { DEFAULT_CUADRILLAS_CONFIG } from '../services/personalService'
import { asegurarProgramacionSitio } from '../services/programacionService'
import { registrarHistorialEstado, esRevisorGilat } from '../services/auditoriaSyncService'

const NotificationContext = createContext(null)

const STORAGE_KEY_READS = 'covepa_read_solicitudes'
const STORAGE_KEY_DISMISSED = 'covepa_dismissed_solicitudes'
const KNOWN_IDS_KEY = 'covepa_known_solicitud_ids'

// Mapa de respaldo: ID Sitio -> Nombre del técnico oficial asignado a su cuadrilla
const SITE_TECNICO_MAP = {}
try {
  (ASIGNACIONES_BASE || []).forEach(s => {
    const c = s.cuadrilla || s.grupo
    const cfg = DEFAULT_CUADRILLAS_CONFIG ? DEFAULT_CUADRILLAS_CONFIG[c] : null
    if (s.id_site && cfg?.tecnicoNombre) {
      SITE_TECNICO_MAP[s.id_site.trim().toUpperCase()] = cfg.tecnicoNombre
    }
  })
} catch (e) {
  console.warn('[NOTIF-CONTEXT] Error inicializando SITE_TECNICO_MAP:', e)
}

export function resolverTecnicoDeSitio(idSitio) {
  if (!idSitio) return ''
  const clean = idSitio.trim().toUpperCase()
  return SITE_TECNICO_MAP[clean] || ''
}

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
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    try {
      sharedAudioCtx = new AudioContextClass()
      if (sharedAudioCtx) {
        sharedAudioCtx.onstatechange = () => {
          if (sharedAudioCtx?.state === 'closed' || sharedAudioCtx?.state === 'interrupted') {
            sharedAudioCtx = null
          }
        }
        if (typeof sharedAudioCtx.addEventListener === 'function') {
          sharedAudioCtx.addEventListener('error', () => {
            try { sharedAudioCtx?.close?.() } catch {}
            sharedAudioCtx = null
          })
        }
      }
    } catch {
      sharedAudioCtx = null
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
    // Si el contexto de audio se rompió por cambio de dispositivo o renderizador, liberar referencia
    sharedAudioCtx = null
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
    // Si el contexto de audio se rompió por cambio de dispositivo o renderizador, liberar referencia
    sharedAudioCtx = null
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
        groups.push(`${tier.label} (${codes.length}):\n${codes.join('\n')}`)
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
      groups.push(`MENOS DE 10 MINUTOS (${codes.length}):\n${codes.join('\n')}`)
    }
  }

  const fullText = groups.length > 0
    ? groups.join('\n\n')
    : items.map(it => (typeof it === 'object' ? it.id_obs : String(it))).filter(Boolean).join('\n')

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
 * Copia al portapapeles una lista limpia de códigos de observación (un código por línea),
 * ideal para pegar directamente en Excel o reportes de revisión.
 */
export async function copyPlainCodesList(items) {
  if (!items || items.length === 0) return false

  const codes = Array.from(
    new Set(
      items
        .map(it => (typeof it === 'object' ? it.id_obs : String(it)))
        .filter(Boolean)
    )
  )

  if (codes.length === 0) return false
  const fullText = codes.join('\n')

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(fullText)
      return true
    }
  } catch (err) {
    console.warn('Error con navigator.clipboard.writeText, usando fallback:', err)
  }

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
    console.warn('Error en fallback execCommand:', fallbackErr)
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

/**
 * Despacha notificaciones nativas de sistema compatibles con Celulares (Android/iOS) y Escritorio (Windows/Mac)
 * - Celular: Utiliza ServiceWorkerRegistration.showNotification() (obligatorio en Android) y vibración física.
 * - Escritorio: Utiliza Service Worker o el constructor new Notification() con cierre automático.
 */
export async function despacharNotificacionSistema(titulo, options = {}) {
  // 1. Vibración táctil para dispositivos móviles (patrón háptico dinámico: dos toques cortos y uno mediano)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([120, 80, 120, 80, 240])
    } catch (_) {}
  }

  // 2. Comprobar si el usuario las desactivó manualmente en la app
  try {
    if (localStorage.getItem('covepa_desktop_notif_enabled') === 'false') return false
  } catch (_) {}

  // 3. Comprobar permisos del navegador
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false

  const notifOptions = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [120, 80, 120, 80, 240],
    ...options
  }

  // 4. Intentar vía Service Worker (REQUERIDO en Android Chrome, Edge móvil y Samsung Internet)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(titulo, notifOptions)
        return true
      }
    } catch (swErr) {
      console.warn('[NOTIF-SW] Error mostrando notificación vía Service Worker, recurriendo a fallback:', swErr)
    }
  }

  // 5. Fallback con constructor Notification (Windows Desktop, Mac, Linux)
  try {
    const notif = new Notification(titulo, notifOptions)
    if (options?.data?.url) {
      notif.onclick = () => {
        window.focus()
        window.location.href = options.data.url
        notif.close()
      }
    }
    setTimeout(() => {
      try { notif.close() } catch (_) {}
    }, 6000)
    return true
  } catch (notifErr) {
    console.warn('[NOTIF-WINDOW] Error mostrando notificación vía constructor Notification:', notifErr)
  }

  return false
}

export function NotificationProvider({ children }) {
  const [solicitudes, setSolicitudes] = useState([]) // Técnicos: Solicitando Revisión
  const [enRevision, setEnRevision] = useState([])     // Auditores: En Revisión
  const [reportesNotif, setReportesNotif] = useState([]) // Reportes automáticos despachados
  const lastReporteEnvioRef = useRef({})
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

  const { user, profile } = useAuth()
  const lastFetchTimeRef = useRef(0)
  const handledRealtimeEventsRef = useRef(new Map())
  const debouncedFetchTimerRef = useRef(null)

  const sitiosMapRef = useRef({})
  const [sitiosMapState, setSitiosMapState] = useState({})
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
      setSitiosMapState(map)
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

  // Despachar notificación nativa de Sistema (Android, iOS PWA, Windows, Mac)
  const dispararNotificacionEscritorio = useCallback(async (obs, localidad) => {
    const locText = localidad ? ` · ${localidad}` : ''
    const personaSolicitante = obs.solicitante || obs.usuario_nombre || obs.tecnico || obs.revisor || resolverTecnicoDeSitio(obs.id_sitio) || ''
    const solicitanteText = personaSolicitante ? `👤 Solicitado por: ${personaSolicitante}` : '👤 Solicitud técnica en campo'
    const detalleResumen = obs.detalle ? `\n📝 ${obs.detalle.slice(0, 95)}${obs.detalle.length > 95 ? '...' : ''}` : ''

    await despacharNotificacionSistema(`🔔 Solicitud: ${obs.id_obs}`, {
      body: `📍 ${obs.id_sitio}${locText}\n${solicitanteText}${detalleResumen}`,
      tag: `covepa-solicitud-${obs.id_obs}`,
      renotify: true,
      data: {
        url: `/observaciones?search=${encodeURIComponent(obs.id_obs)}`
      },
      actions: [
        { action: 'open_obs', title: '🔍 Revisar ahora' },
        { action: 'dismiss', title: '✖ Cerrar' }
      ]
    })
  }, [])

  // Despachar Toast flotante interactivo
  const dispararToast = useCallback((obs, localidad) => {
    const toastId = `toast-${obs.id_obs}-${Date.now()}`
    const personaSolicitante = obs.solicitante || obs.usuario_nombre || obs.tecnico || obs.revisor || resolverTecnicoDeSitio(obs.id_sitio) || ''
    const nuevoToast = {
      id: toastId,
      obs: {
        ...obs,
        solicitante: personaSolicitante,
        usuario_nombre: personaSolicitante,
        revisor: personaSolicitante || obs.revisor,
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
  const evaluarAlertasAcumulacion = useCallback((solRows, revRows, isRealtimeAlert = false) => {
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

      // REGLA CLAVE: Solo disparar toast emergente si es un evento real en tiempo real durante la sesión
      // NUNCA al abrir o refrescar la página (evita que las notificaciones salten al iniciar la app)
      if (isRealtimeAlert) {
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

          despacharNotificacionSistema(titulo, {
            body: mensaje,
            tag: 'covepa-alerta-acumulacion-revision',
            renotify: true,
            data: {
              url: '/observaciones?estado=En%20Revisi%C3%B3n'
            }
          })
        }
      } else {
        // En carga inicial, establecer la línea base silenciosamente sin molestar al usuario con popups
        lastAlertAuditoresRef.current = { time: now, count: revDemoradas.length }
      }
    } else {
      setAccumulationAlert(null)
    }
  }, [dispararToast])

  // Consultar observaciones en Solicitando Revisión y En Revisión desde Supabase
  const fetchSolicitudes = useCallback(async (isRealtimeAlert = false) => {
    if (!user) return
    try {
      // 1. Solicitudes de Técnicos (Solicitando Revisión) - solo columnas esenciales
      const { data: solData, error: solErr } = await supabase
        .from('observaciones')
        .select('id_obs, id_sitio, estado_covepa, revisor, fecha_subsanacion, subsistema')
        .in('estado_covepa', ['Solicitando Revisión', 'Solicitando Revision'])
        .order('fecha_subsanacion', { ascending: true }) // De más antigua a más reciente

      // 2. Observaciones en Auditoría (En Revisión) - solo columnas esenciales
      const { data: revData, error: revErr } = await supabase
        .from('observaciones')
        .select('id_obs, id_sitio, estado_covepa, revisor, fecha_subsanacion, subsistema')
        .in('estado_covepa', ['En Revisión', 'En Revision'])
        .order('fecha_subsanacion', { ascending: true }) // De más antigua a más reciente

      if (solErr) console.warn('[NOTIF-FETCH] Error consultando solicitudes:', solErr.message)
      if (revErr) console.warn('[NOTIF-FETCH] Error consultando en revisión:', revErr.message)

      const solRows = solData || []
      const revRows = revData || []

      // ── ENRIQUECER SOLICITUDES CON EL NOMBRE DEL TÉCNICO / SOLICITANTE ──
      if (solRows.length > 0) {
        try {
          const obsIds = solRows.map(r => r.id_obs)
          const { data: histData } = await supabase
            .from('historial_estados_observaciones')
            .select('id_obs, usuario_nombre, created_at')
            .in('id_obs', obsIds)
            .in('estado_nuevo', ['Solicitando Revisión', 'Solicitando Revision'])
            .order('created_at', { ascending: false })

          const histMap = {}
          if (Array.isArray(histData)) {
            histData.forEach(h => {
              if (h.id_obs && h.usuario_nombre && !histMap[h.id_obs]) {
                histMap[h.id_obs] = h.usuario_nombre
              }
            })
          }

          solRows.forEach(row => {
            const nombreSolicitante = histMap[row.id_obs] || (row.revisor && !esRevisorGilat(row.revisor) ? row.revisor : '') || resolverTecnicoDeSitio(row.id_sitio) || 'Técnico de Campo'
            row.solicitante = nombreSolicitante
            row.usuario_nombre = nombreSolicitante
            row.revisor = nombreSolicitante
          })
        } catch (e) {
          console.warn('[NOTIF-ENRICH] Error enriqueciendo solicitantes:', e)
          solRows.forEach(row => {
            const fallback = resolverTecnicoDeSitio(row.id_sitio) || 'Técnico de Campo'
            row.solicitante = fallback
            row.usuario_nombre = fallback
            row.revisor = fallback
          })
        }
      }

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

      // Evaluar si se han acumulado (5+ con > 10 min de espera) de forma silenciosa en carga inicial
      evaluarAlertasAcumulacion(solRows, revRows, isRealtimeAlert && !isFirstLoadRef.current)

      knownIdsRef.current = new Set([...solRows.map(r => r.id_obs), ...revRows.map(r => r.id_obs)])
      isFirstLoadRef.current = false

      setSolicitudes(solRows)
      setEnRevision(revRows)

      // 3. Consultar últimos reportes automáticos despachados (Diario y Semanal)
      const repItems = []
      try {
        // A. Consultar configuracion_reportes_correo para saber último envío oficial
        const { data: cfgData } = await supabase
          .from('configuracion_reportes_correo')
          .select('id, activo, hora_envio, asunto, destinatarios, destinatarios_cc, ultimo_envio_at')

        // B. Consultar historial_reportes_correo para auditoría detallada (columnas mínimas)
        const { data: histData } = await supabase
          .from('historial_reportes_correo')
          .select('id, tipo, asunto, destinatarios, destinatarios_cc, total_obs, validadas, rechazadas, en_espera, created_at')
          .eq('estado', 'exitoso')
          .order('created_at', { ascending: false })
          .limit(4)

        const tiposCapturados = new Set()

        // Procesar historial si existe
        if (Array.isArray(histData) && histData.length > 0) {
          for (const h of histData) {
            const fechaEnvio = h.created_at
            if (!fechaEnvio) continue
            const diffHoras = (Date.now() - new Date(fechaEnvio).getTime()) / (1000 * 60 * 60)
            if (diffHoras > 48) continue

            const tipoRep = (h.tipo === 'semanal' || (h.asunto || '').toLowerCase().includes('semanal')) ? 'semanal' : 'diario'
            tiposCapturados.add(tipoRep)

            let horaStr = 'recientemente'
            try {
              horaStr = new Date(fechaEnvio).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
            } catch (_) {}

            const destList = Array.isArray(h.destinatarios) ? h.destinatarios : []
            const destCCList = Array.isArray(h.destinatarios_cc) ? h.destinatarios_cc : []

            repItems.push({
              id_obs: `REPORTE-HIST-${h.id}`,
              isReporteNotif: true,
              isReporteEnviado: true,
              tipo_reporte: tipoRep,
              tipo_envio: h.tipo || 'oficial',
              titulo: tipoRep === 'semanal' ? '📬 Reporte Semanal Despachado' : '📬 Reporte Diario Despachado',
              detalle: `El reporte consolidado de observaciones fue despachado exitosamente por correo a las ${horaStr}.`,
              asunto: h.asunto || (tipoRep === 'semanal' ? '[COVEPA] Reporte Semanal de Observaciones' : '[COVEPA] Reporte Diario de Observaciones'),
              destinatariosCount: destList.length,
              destinatariosCCCount: destCCList.length,
              destinatarios: destList,
              destinatarios_cc: destCCList,
              total_obs: h.total_obs,
              validadas: h.validadas,
              rechazadas: h.rechazadas,
              en_espera: h.en_espera,
              fecha_subsanacion: fechaEnvio,
              id_sitio: 'COVEPA',
              localidad: 'Despacho por Correo'
            })
          }
        }

        // Si configuracion_reportes_correo tiene ultimo_envio_at y no fue capturado por historial
        if (Array.isArray(cfgData)) {
          for (const cfg of cfgData) {
            const fechaEnvio = cfg.ultimo_envio_at
            if (!fechaEnvio) continue
            const diffHoras = (Date.now() - new Date(fechaEnvio).getTime()) / (1000 * 60 * 60)
            if (diffHoras > 48) continue

            const tipoRep = cfg.id === 'config_semanal' ? 'semanal' : 'diario'
            if (tiposCapturados.has(tipoRep)) continue

            let horaStr = 'recientemente'
            try {
              horaStr = new Date(fechaEnvio).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
            } catch (_) {}

            const destList = Array.isArray(cfg.destinatarios) ? cfg.destinatarios : []
            const destCCList = Array.isArray(cfg.destinatarios_cc) ? cfg.destinatarios_cc : []

            repItems.push({
              id_obs: `REPORTE-${cfg.id}-${new Date(fechaEnvio).getTime()}`,
              isReporteNotif: true,
              isReporteEnviado: true,
              tipo_reporte: tipoRep,
              tipo_envio: 'oficial',
              titulo: tipoRep === 'semanal' ? '📬 Reporte Semanal Despachado' : '📬 Reporte Diario Despachado',
              detalle: `El reporte consolidado de observaciones fue despachado exitosamente por correo a las ${horaStr}.`,
              asunto: cfg.asunto || (tipoRep === 'semanal' ? '[COVEPA] Reporte Semanal de Observaciones' : '[COVEPA] Reporte Diario de Observaciones'),
              destinatariosCount: destList.length,
              destinatariosCCCount: destCCList.length,
              destinatarios: destList,
              destinatarios_cc: destCCList,
              fecha_subsanacion: fechaEnvio,
              id_sitio: 'COVEPA',
              localidad: 'Despacho por Correo'
            })
          }
        }
      } catch (repErr) {
        console.warn('[NOTIF-FETCH-REPORTES] Error consultando estado de reportes:', repErr)
      }

      // Detección de nuevo despacho de reporte en tiempo real
      if (!isFirstLoadRef.current && isRealtimeAlert && repItems.length > 0) {
        for (const rep of repItems) {
          const prevTime = lastReporteEnvioRef.current[rep.tipo_reporte]
          if (rep.fecha_subsanacion && rep.fecha_subsanacion !== prevTime) {
            dispararToast(rep, 'Despacho por Correo')
            despacharNotificacionSistema(rep.titulo, {
              body: `${rep.detalle}\nAsunto: ${rep.asunto}`,
              tag: `covepa-reporte-${rep.tipo_reporte}`,
              renotify: true,
              data: {
                url: '/reportes'
              }
            })
            break
          }
        }
      }

      const newTimestamps = {}
      for (const rep of repItems) {
        newTimestamps[rep.tipo_reporte] = rep.fecha_subsanacion
      }
      lastReporteEnvioRef.current = newTimestamps

      setReportesNotif(repItems)
      lastFetchTimeRef.current = Date.now()
    } catch (err) {
      console.warn('[NOTIF-FETCH] Error de red:', err)
    }
  }, [user, dispararToast, dispararNotificacionEscritorio, evaluarAlertasAcumulacion])

  // Despacho con debounce de fetchSolicitudes ante ráfagas de eventos Realtime
  const triggerDebouncedFetch = useCallback((silencioso = false) => {
    if (debouncedFetchTimerRef.current) clearTimeout(debouncedFetchTimerRef.current)
    debouncedFetchTimerRef.current = setTimeout(() => {
      fetchSolicitudes(silencioso)
    }, 1500)
  }, [fetchSolicitudes])

  // Carga inicial y Polling resiliente ultra-eficiente (cada 5 minutos de respaldo, condicionado a pestaña visible)
  useEffect(() => {
    if (!user) return

    fetchSolicitudes(false)

    // Polling de respaldo cada 5 minutos (300,000 ms) en vez de 30 segundos
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchSolicitudes(true)
      }
    }, 300000)

    // Reconsultar solo si el usuario regresa a la pestaña tras estar oculta (con cooldown de 3 minutos)
    const handleVisibility = () => {
      if (!document.hidden && Date.now() - lastFetchTimeRef.current > 180000) {
        fetchSolicitudes(true)
      }
    }
    const handleFocus = () => {
      if (!document.hidden && Date.now() - lastFetchTimeRef.current > 180000) {
        fetchSolicitudes(true)
      }
    }
    const handleOnline = () => fetchSolicitudes(true)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
    }
  }, [user, fetchSolicitudes])

  // Supabase Realtime: Escuchar cambios inmediatos en observaciones e historial
  useEffect(() => {
    if (!user) return

    const esAdminOCoord = profile?.rol === 'administrador' || profile?.rol === 'coordinador'

    const channel = supabase
      .channel('covepa-notificaciones-solicitudes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'observaciones' },
        (payload) => {
          const newRow = payload.new
          const oldRow = payload.old
          const now = Date.now()

          // Deduplicación en ráfaga para evitar bucles entre clientes
          const dedupeKey = `obs_${newRow?.id_obs}_${newRow?.estado_covepa}_${newRow?.revisor || ''}`
          const isDupe = handledRealtimeEventsRef.current.has(dedupeKey) && (now - handledRealtimeEventsRef.current.get(dedupeKey) < 30000)
          if (!isDupe) {
            handledRealtimeEventsRef.current.set(dedupeKey, now)
          }

          // Regla: Auto-programar sitio si hubo cambio de estado y no está programado en la fecha (solo admin/coord)
          if (!isDupe && esAdminOCoord && newRow && newRow.estado_covepa && newRow.estado_covepa !== oldRow?.estado_covepa) {
            asegurarProgramacionSitio({
              idSitio: newRow.id_sitio,
              idObs: newRow.id_obs,
              fecha: newRow.fecha_subsanacion
            }).catch(err => console.warn('[NOTIF-AUTO-PROG] Error asegurando programación:', err))
          }

          if (newRow && (newRow.estado_covepa === 'Solicitando Revisión' || newRow.estado_covepa === 'Solicitando Revision')) {
            const loc = sitiosMapRef.current[newRow.id_sitio] || ''
            const solicitanteNombre = newRow.revisor || resolverTecnicoDeSitio(newRow.id_sitio) || 'Técnico de Campo'
            const enrichedRow = {
              ...newRow,
              solicitante: solicitanteNombre,
              usuario_nombre: solicitanteNombre,
              revisor: solicitanteNombre
            }
            dispararToast(enrichedRow, loc)
            dispararNotificacionEscritorio(enrichedRow, loc)
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
            triggerDebouncedFetch(false)

            // ── TRAZABILIDAD AUTOMÁTICA DEL TÉCNICO AL SOLICITAR REVISIÓN ──
            // Solo administradores/coordinadores realizan la sincronización a BD y con deduplicación
            if (!isDupe && esAdminOCoord && newRow.estado_covepa !== oldRow?.estado_covepa) {
              const tecnicoNombre = newRow.revisor || 'Técnico de Campo (App Fotos)'
              registrarHistorialEstado({
                idObs: newRow.id_obs,
                idSitio: newRow.id_sitio,
                estadoAnterior: oldRow?.estado_covepa || 'Pendiente',
                estadoNuevo: 'Solicitando Revisión',
                usuarioNombre: tecnicoNombre,
                usuarioEmail: null,
                usuarioId: null,
                comentario: 'Solicitud de revisión técnica enviada desde campo',
                origen: 'app_fotos',
                fechaExacta: newRow.fecha_subsanacion || null
              }).catch(err => console.warn('[NOTIF-HISTORIAL] Error registrando solicitud en historial:', err))

              // Regla estricta: en 'revisor' solo va personal de Gilat. Si vino con el técnico, limpiarlo en observaciones
              if (newRow.revisor && !esRevisorGilat(newRow.revisor)) {
                supabase
                  .from('observaciones')
                  .update({ revisor: null })
                  .eq('id_obs', newRow.id_obs)
                  .eq('id_sitio', newRow.id_sitio)
                  .then(() => console.log(`[NOTIF-SYNC] Campo revisor de ${newRow.id_obs} limpiado a null (reservado exclusivamente a Gilat)`))
                  .catch(err => console.warn('[NOTIF-SYNC] Error limpiando revisor no-Gilat:', err))
              }
            }
          } else if (oldRow && (oldRow.estado_covepa === 'Solicitando Revisión' || oldRow.estado_covepa === 'Solicitando Revision')) {
            // Ya no está en solicitando revisión (se validó, rechazó, etc.)
            triggerDebouncedFetch(false)
          }

          // Regla: Detectar registro o modificación de demoras y tiempos desde la App de Fotos / Control COVEPA (solo admin/coord)
          if (!isDupe && esAdminOCoord && newRow && oldRow && (
            (newRow.justificacion_demora && newRow.justificacion_demora !== oldRow.justificacion_demora) ||
            (newRow.tiempo_ejecucion_real && newRow.tiempo_ejecucion_real !== oldRow.tiempo_ejecucion_real) ||
            (newRow.tiempo_ejecucion_demora && newRow.tiempo_ejecucion_demora !== oldRow.tiempo_ejecucion_demora)
          )) {
            const partes = []
            if (newRow.justificacion_demora && newRow.justificacion_demora !== oldRow.justificacion_demora) {
              partes.push(`⚠️ Demora: "${newRow.justificacion_demora}"`)
            }
            if (newRow.tiempo_ejecucion_real && newRow.tiempo_ejecucion_real !== oldRow.tiempo_ejecucion_real) {
              partes.push(`⏱️ T. Real: ${newRow.tiempo_ejecucion_real}`)
            }
            if (newRow.tiempo_ejecucion_demora && newRow.tiempo_ejecucion_demora !== oldRow.tiempo_ejecucion_demora) {
              partes.push(`⏳ T. Con Demora: ${newRow.tiempo_ejecucion_demora}`)
            }

            if (partes.length > 0) {
              registrarHistorialEstado({
                idObs: newRow.id_obs,
                idSitio: newRow.id_sitio,
                estadoAnterior: oldRow.estado_covepa || null,
                estadoNuevo: newRow.estado_covepa || 'Pendiente',
                usuarioNombre: newRow.revisor || 'Técnico de Campo (App Fotos)',
                usuarioEmail: null,
                usuarioId: null,
                comentario: partes.join(' · '),
                origen: 'app_fotos'
              }).catch(err => console.warn('[NOTIF-HISTORIAL] Error registrando demora de app_fotos:', err))
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'historial_estados_observaciones' },
        (payload) => {
          const row = payload.new
          const now = Date.now()
          const dedupeHistKey = `hist_${row?.id_obs}_${row?.id_sitio}_${row?.created_at}`
          const isHistDupe = handledRealtimeEventsRef.current.has(dedupeHistKey) && (now - handledRealtimeEventsRef.current.get(dedupeHistKey) < 30000)
          if (!isHistDupe) {
            handledRealtimeEventsRef.current.set(dedupeHistKey, now)
          }

          // Regla: Auto-programar sitio ante cualquier cambio de estado registrado en historial (solo admin/coord)
          if (!isHistDupe && esAdminOCoord && row && row.id_sitio) {
            asegurarProgramacionSitio({
              idSitio: row.id_sitio,
              idObs: row.id_obs,
              fecha: row.created_at
            }).catch(err => console.warn('[NOTIF-AUTO-PROG] Error asegurando programación:', err))
          }

          if (row && (row.estado_nuevo === 'Solicitando Revisión' || row.estado_nuevo === 'Solicitando Revision')) {
            const solicitanteNombre = row.usuario_nombre || resolverTecnicoDeSitio(row.id_sitio) || 'Técnico de Campo'
            const obsLike = {
              id_obs: row.id_obs,
              id_sitio: row.id_sitio,
              estado_covepa: row.estado_nuevo,
              revisor: solicitanteNombre,
              solicitante: solicitanteNombre,
              usuario_nombre: solicitanteNombre,
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
            triggerDebouncedFetch(false)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'configuracion_reportes_correo' },
        (payload) => {
          const newRow = payload.new
          const oldRow = payload.old
          if (newRow?.ultimo_envio_at && newRow.ultimo_envio_at !== oldRow?.ultimo_envio_at) {
            triggerDebouncedFetch(true)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'historial_reportes_correo' },
        (payload) => {
          if (payload.new?.estado === 'exitoso') {
            triggerDebouncedFetch(true)
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
  }, [user, profile?.rol, dispararToast, dispararNotificacionEscritorio, triggerDebouncedFetch])

  // Solicitar permiso de notificaciones de escritorio de Windows
  const requestDesktopPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    try {
      const perm = await Notification.requestPermission()
      setDesktopPermission(perm)
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
      for (const rep of reportesNotif) {
        updated.add(rep.id_obs)
      }
      if (accumulationAlert) {
        updated.add(accumulationAlert.id_obs)
      }
      return updated
    })
  }

  // Descartar un Toast flotante específico
  const dismissToast = (toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId))
  }

  // Filtrado de reportes visibles en la bandeja (no descartados/limpiados)
  const visibleReportes = reportesNotif.filter(r => !dismissedIds.has(r.id_obs))

  // Filtrado de solicitudes visibles en la bandeja (no descartadas/limpiadas)
  const visibleSolicitudes = solicitudes.filter(s => !dismissedIds.has(s.id_obs))

  // Alerta de acumulación consolidada si está activa y no descartada
  const activeAccumulation = (accumulationAlert && !dismissedIds.has(accumulationAlert.id_obs))
    ? [accumulationAlert]
    : []

  // Bandeja unificada: reportes de correo primero, alerta de acumulación, y solicitudes de técnicos
  const unifiedNotifications = [...visibleReportes, ...activeAccumulation, ...visibleSolicitudes]

  // Conteo consolidado de no leídas para la campana (+1 por cada reporte sin leer, +1 si alerta de acumulación sin leer)
  const isAccUnread = activeAccumulation.length > 0 && !readIds.has(accumulationAlert.id_obs)
  const unreadReportesCount = visibleReportes.filter(r => !readIds.has(r.id_obs)).length
  const unreadCount = visibleSolicitudes.filter(s => !readIds.has(s.id_obs)).length +
    (isAccUnread ? 1 : 0) +
    unreadReportesCount
  const dismissedCount = solicitudes.filter(s => dismissedIds.has(s.id_obs)).length +
    (accumulationAlert && dismissedIds.has(accumulationAlert.id_obs) ? 1 : 0) +
    reportesNotif.filter(r => dismissedIds.has(r.id_obs)).length

  // Limpiar todas las notificaciones de la bandeja
  const clearAllNotifications = useCallback(() => {
    setDismissedIds(prev => {
      const updated = new Set(prev)
      for (const s of solicitudes) updated.add(s.id_obs)
      if (accumulationAlert) updated.add(accumulationAlert.id_obs)
      for (const r of reportesNotif) updated.add(r.id_obs)
      return updated
    })
    setToasts([])
  }, [solicitudes, accumulationAlert, reportesNotif])

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

    despacharNotificacionSistema(`[PRUEBA] ⚠️ Observaciones Acumuladas (${ordenadas.length})`, {
      body: `⏱️ ${ordenadas.length} observaciones en espera sin dictaminar.\n📍 Más antigua: ${masAntigua.id_sitio}${loc ? ` · ${loc}` : ''} (${tiempoTxt})`,
      tag: 'covepa-alerta-acumulacion-revision-prueba',
      renotify: true,
      data: {
        url: '/observaciones?estado=En%20Revisi%C3%B3n'
      },
      actions: [
        { action: 'open_queue', title: '📋 Atender Cola' },
        { action: 'dismiss', title: '✖ Cerrar' }
      ]
    })
  }, [enRevision, dispararToast])

  // Disparar notificación tras el pase masivo de observaciones a En Revisión
  const notificarPaseEnRevision = useCallback(async ({ count, items, codes }) => {
    // Si no hubo observaciones pasadas, notificar con aviso informativo
    if (!codes || codes.length === 0) {
      const toastId = `toast-batch-empty-${Date.now()}`
      const emptyToast = {
        id: toastId,
        obs: {
          id_obs: `PASE-VACIO-${Date.now()}`,
          isTransicionVacia: true,
          titulo: 'Sin solicitudes pendientes',
          detalle: 'No hay observaciones en "Solicitando Revisión" en este momento. Todas las observaciones ya se encuentran en revisión o validadas.'
        },
        createdAt: Date.now()
      }
      setToasts(prev => [emptyToast, ...prev].slice(0, 3))
      playNotificationChime()
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId))
      }, 5000)
      return
    }

    // 1. Agrupar observaciones por sitio y localidad para saber de qué sitios se está pasando
    const currentSitiosMap = sitiosMapRef.current || {}
    const sitiosInvolucradosMap = new Map()

    ;(items || []).forEach(it => {
      const siteId = (it.id_sitio || 'Sin Sitio').trim().toUpperCase()
      if (!sitiosInvolucradosMap.has(siteId)) {
        const loc = currentSitiosMap[siteId] || it.localidad || ''
        sitiosInvolucradosMap.set(siteId, {
          id_sitio: siteId,
          localidad: loc,
          label: `${siteId}${loc ? ` · ${loc}` : ''}`,
          codes: []
        })
      }
      sitiosInvolucradosMap.get(siteId).codes.push(it.id_obs)
    })

    const sitiosList = Array.from(sitiosInvolucradosMap.values())

    // 2. Despachar Toast flotante interactivo enriquecido con sitios y localidades INMEDIATAMENTE
    const toastId = `toast-batch-revision-${Date.now()}`
    const nuevoToast = {
      id: toastId,
      obs: {
        id_obs: `PASE-REVISION-${Date.now()}`,
        isTransicionBatch: true,
        count: codes.length,
        titulo: `¡${codes.length} ${codes.length === 1 ? 'Observación pasó' : 'Observaciones pasaron'} a En Revisión!`,
        detalle: `${codes.length} ${codes.length === 1 ? 'observación pasó' : 'observaciones pasaron'} a En Revisión en ${sitiosList.length} ${sitiosList.length === 1 ? 'sitio' : 'sitios'}.`,
        items: items || [],
        codes: codes,
        sitios: sitiosList
      },
      createdAt: Date.now()
    }

    // Renderizar Toast en pantalla INMEDIATAMENTE sin bloquearse por portapapeles ni audio
    setToasts(prev => [nuevoToast, ...prev].slice(0, 3))
    try {
      playNotificationChime()
    } catch (_) {}

    // 15 segundos para dar tiempo suficiente para interactuar o re-copiar
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId))
    }, 15000)

    // 3. Copiar automáticamente los códigos al portapapeles en segundo plano
    copyPlainCodesList(codes).catch(err => {
      console.warn('Aviso no bloqueante al copiar códigos al portapapeles:', err)
    })

    // 4. Notificación nativa de sistema (Android / Windows) con resumen de sitios
    try {
      const resumenSitiosTexto = sitiosList.slice(0, 3).map(s => `📍 ${s.label} (${s.codes.length} obs)`).join('\n')
      despacharNotificacionSistema(`🚀 ${codes.length} Obs a En Revisión · ${sitiosList.length} Sitios`, {
        body: `📍 Sitios pasados:\n${resumenSitiosTexto}${sitiosList.length > 3 ? `\n(+ ${sitiosList.length - 3} sitios más)` : ''}\n📋 Códigos copiados al portapapeles`,
        tag: 'covepa-pase-en-revision',
        renotify: true,
        data: {
          url: '/observaciones?estado=En%20Revisi%C3%B3n'
        },
        actions: [
          { action: 'open_queue', title: '👁️ Ver Lista' },
          { action: 'dismiss', title: '✖ Listo' }
        ]
      })
    } catch (sysErr) {
      console.warn('Aviso notificación sistema no bloqueante:', sysErr)
    }

    // 5. Refrescar solicitudes en tiempo real
    fetchSolicitudes()
  }, [fetchSolicitudes])

  // Disparar manualmente una notificación de prueba de reporte despachado
  const dispararPruebaReporte = useCallback(() => {
    let horaActual = 'recientemente'
    try {
      horaActual = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    } catch (_) {}

    const pruebaReporte = {
      id_obs: `REPORTE-PRUEBA-${Date.now()}`,
      isReporteNotif: true,
      isReporteEnviado: true,
      tipo_reporte: 'diario',
      tipo_envio: 'prueba',
      titulo: '📬 Reporte Diario COVEPA Enviado',
      detalle: `El reporte consolidado de observaciones fue despachado exitosamente por correo a las ${horaActual}.`,
      asunto: 'Reporte Diario de Levantamiento de Observaciones Amazonas - Zona 2 y Zona 7',
      destinatariosCount: 4,
      destinatariosCCCount: 7,
      destinatarios: ['ccondor@covepa.pe'],
      fecha_subsanacion: new Date().toISOString(),
      id_sitio: 'COVEPA',
      localidad: 'Despacho por Correo'
    }

    setDismissedIds(prev => {
      const copy = new Set(prev)
      copy.delete(pruebaReporte.id_obs)
      return copy
    })
    setReportesNotif(prev => [pruebaReporte, ...prev.filter(r => r.id_obs !== pruebaReporte.id_obs)])

    dispararToast(pruebaReporte, 'Despacho por Correo')

    despacharNotificacionSistema('📬 Reporte Diario COVEPA Enviado', {
      body: `✉️ Despachado por correo a las ${horaActual}\n📊 Consolidado oficial de levantamiento de observaciones\n👥 4 principales · 7 en copia`,
      tag: 'covepa-reporte-despachado',
      renotify: true,
      data: {
        url: '/reportes'
      },
      actions: [
        { action: 'open_report', title: '📊 Ver Reporte' },
        { action: 'dismiss', title: '✖ Listo' }
      ]
    })
  }, [dispararToast])

  // Exponer globalmente en window para pruebas en cualquier momento
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.probarNotificacionRevision = dispararPruebaRevision
      window.probarNotificacionReporte = dispararPruebaReporte
    }
  }, [dispararPruebaRevision, dispararPruebaReporte])

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
        dispararPruebaReporte,
        reportesNotificaciones: reportesNotif,
        copyObservacionesList,
        copyPlainCodesList,
        notificarPaseEnRevision,
        readIds,
        toasts,
        desktopPermission,
        requestDesktopPermission,
        markAsRead,
        markAllAsRead,
        dismissToast,
        fetchSolicitudes,
        sitiosMap: sitiosMapState
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    return {
      solicitudes: [],
      enRevision: [],
      unreadCount: 0,
      unreadRevisionCount: 0,
      unreadTotalCount: 0,
      accumulationAlert: null,
      toasts: [],
      desktopPermission: 'default',
      isDropdownOpen: false,
      setIsDropdownOpen: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
      dismissIndividual: () => {},
      dismissAllPending: () => {},
      restoreDismissed: () => {},
      dismissedIdsCount: 0,
      dismissToast: () => {},
      notificarPaseEnRevision: async () => {},
      copyPlainCodesList: async () => false,
      requestDesktopPermission: async () => 'default'
    }
  }
  return context
}
