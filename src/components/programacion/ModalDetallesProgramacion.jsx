import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Calendar, Trash2, MapPin, CheckCircle2, Clock, AlertCircle,
  X, Search, RefreshCw, Eye, ShieldCheck, Check, AlertTriangle,
  Users, Edit3, User, FileSpreadsheet, Download, Send,
  History, ChevronUp, ChevronDown, FileText
} from 'lucide-react'
import HistorialEstadosTimeline from '../shared/HistorialEstadosTimeline'
import UltimoCambioBadge from '../shared/UltimoCambioBadge'
import TimeMaskInput, { diffTimeHHMM } from '../shared/TimeMaskInput'
import { getObservacionesSitioDetalle } from '../../services/programacionService'
import { updateObservacionCovepa, sincronizarEstadoConControlFotos, esRevisorGilat } from '../../services/observacionesService'
import {
  sincronizarAuditoriaObservacion,
  sincronizarComentarioObservacion,
  sincronizarJustificacionDemora,
  sincronizarTiemposEjecucion,
  resolverNombreAuditor
} from '../../services/auditoriaSyncService'
import { getZonaBySiteId } from '../../services/sitiosService'
import { useAuth } from '../../hooks/useAuth'
import ModalConfirmacionEstado, { esEstadoProtegido, esEstadoRequiereConfirmacion } from '../shared/ModalConfirmacionEstado'
import { hasMeaningfulText, getPeruDateStr, getPeruISOString, getInitials, getCargoClass } from '../../utils/helpers'
import { supabase } from '../../lib/supabase'
// SUBCOMPONENTE: Modal Detalle de Programación y Observaciones
// Ventana emergente centrada con edición, eliminación, gestión de observaciones
// y guardado automático de comentarios al cerrar.
// ────────────────────────────────────────────────────────────
export default function ModalDetallesProgramacion({
  sitioId,
  prog,
  allSitios = [],
  tecnicos = [],
  sitiosMap = {},
  onClose,
  onEditProg,
  onDeleteProg,
  onObservationUpdated
}) {
  const { user, personalMember, canEditDemoras, isAdmin, isReadOnly, canEditProgramacion } = useAuth()
  const [currentSitioId, setCurrentSitioId] = useState(sitioId || '')
  const [observaciones, setObservaciones] = useState([])
  const [comments, setComments] = useState({})
  const [delays, setDelays] = useState({})
  const [tiemposReal, setTiemposReal] = useState({})
  const [tiemposDemora, setTiemposDemora] = useState({})
  const [savingTimeId, setSavingTimeId] = useState(null)
  const [savedTimeId, setSavedTimeId] = useState(null)
  const [expandedDemoraIds, setExpandedDemoraIds] = useState({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [savingCommentId, setSavingCommentId] = useState(null)
  const [savedCommentId, setSavedCommentId] = useState(null)
  const [savingDelayId, setSavingDelayId] = useState(null)
  const [savedDelayId, setSavedDelayId] = useState(null)
  const [expandedHistorialId, setExpandedHistorialId] = useState(null)
  const [historialRefreshKeys, setHistorialRefreshKeys] = useState({})
  const [confirmModalData, setConfirmModalData] = useState(null)

  // Ref con los comentarios y justificaciones modificados (dirty) para autoguardarlos al cerrar
  const dirtyCommentsRef = useRef(new Set())
  const commentsRef = useRef({})
  commentsRef.current = comments
  const dirtyDelaysRef = useRef(new Set())
  const delaysRef = useRef({})
  delaysRef.current = delays
  const dirtyTiemposRef = useRef(new Set())
  const tiemposRealRef = useRef({})
  tiemposRealRef.current = tiemposReal
  const tiemposDemoraRef = useRef({})
  tiemposDemoraRef.current = tiemposDemora

  const team = (prog?.equipo && prog.equipo.length > 0) ? prog.equipo : [prog?.personal || {}]

  // Personal auditor y revisor oficial de GILAT (100% desde la Base de Datos)
  const gilatOptions = useMemo(() => {
    return (tecnicos || [])
      .filter(t => {
        if (!t || !t.nombre_completo) return false
        const emp = (t.empresa || '').toUpperCase()
        return emp.includes('GILAT')
      })
      .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))
  }, [tecnicos])

  useEffect(() => {
    if (sitioId) setCurrentSitioId(sitioId)
  }, [sitioId])

  const loadObs = useCallback(async () => {
    if (!currentSitioId) return
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await getObservacionesSitioDetalle(currentSitioId)
      setObservaciones(data)
      const initialComments = {}
      const initialDelays = {}
      const initialTiemposReal = {}
      const initialTiemposDemora = {}
      data.forEach(o => {
        initialComments[o.id_obs] = o.comentario_covepa || ''
        initialDelays[o.id_obs] = o.justificacion_demora || ''
        initialTiemposReal[o.id_obs] = o.tiempo_ejecucion_real || ''
        initialTiemposDemora[o.id_obs] = o.tiempo_ejecucion_demora || ''
      })
      setComments(initialComments)
      setDelays(initialDelays)
      setTiemposReal(initialTiemposReal)
      setTiemposDemora(initialTiemposDemora)
      dirtyCommentsRef.current.clear()
      dirtyDelaysRef.current.clear()
      dirtyTiemposRef.current.clear()
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }, [currentSitioId])

  useEffect(() => {
    loadObs()
  }, [loadObs])

  // Interceptar solicitud de cambio de estado: restringe opciones protegidas a Administrador
  // y despliega ventana emergente de confirmación ante estados protegidos (Pre-validado, Crítico, Rechazado)
  const handleRequestEstadoChange = (obs, targetValue) => {
    const rawSt = obs.estado_covepa ? obs.estado_covepa.trim() : null
    const currentEstado = rawSt || (obs.fecha_subsanacion ? 'Validado' : 'Pendiente')
    if (targetValue === currentEstado) return

    // 1. Regla de seguridad estricta: si la observación ya está en un estado protegido, solo Administrador puede modificarla
    if (!isAdmin && esEstadoProtegido(currentEstado)) {
      alert(`Esta observación se encuentra en estado "${currentEstado}". Solo un Administrador tiene autorización para modificar su estado.`)
      return
    }

    // 2. Regla de seguridad estricta: solo Administrador puede asignar estados protegidos
    if (!isAdmin && esEstadoProtegido(targetValue)) {
      alert('Solo el administrador tiene autorización para asignar los estados Pre-validado, Crítico o Descartado.')
      return
    }

    // 3. Ventanita emergente de confirmación: SOLO si tiene que ver con Crítico, Descartado o Pre-validado
    if (esEstadoRequiereConfirmacion(currentEstado) || esEstadoRequiereConfirmacion(targetValue)) {
      setConfirmModalData({
        obs,
        targetValue,
        currentEstado
      })
      return
    }

    handleSetEstado(obs, targetValue)
  }

  // Acción rápida: Marcar observación (Puente con App de fotos de campo)
  const handleSetEstado = async (obs, nuevoEstado) => {
    const rawSt = obs.estado_covepa ? obs.estado_covepa.trim() : null
    const currentEstado = rawSt || (obs.fecha_subsanacion ? 'Validado' : 'Pendiente')
    // Validar autorización de administrador para estados protegidos (tanto de origen como de destino)
    if (!isAdmin && (esEstadoProtegido(currentEstado) || esEstadoProtegido(nuevoEstado))) {
      alert('Solo el administrador tiene autorización para modificar observaciones en estados protegidos (Pre-validado, Crítico o Descartado).')
      return
    }
    setUpdatingId(obs.id_obs)
    try {
      // 1. Responsable del cambio: SIEMPRE obtenido de la sesión activa
      const responsableSesion = resolverNombreAuditor(user, personalMember)

      // 2. Revisor asignado: Solo conservar si es estrictamente de GILAT, NUNCA autocompletar con la sesión
      // En 'En Revisión', 'Solicitando Revisión' o 'Documentación' NUNCA debe haber revisor asignado
      const esEnRev = nuevoEstado === 'En Revisión' || nuevoEstado === 'En Revision' || nuevoEstado === 'Solicitando Revisión' || nuevoEstado === 'Solicitando Revision' || nuevoEstado === 'Documentación' || nuevoEstado === 'Documentacion'
      const revisorGilatActual = esEnRev ? null : (esRevisorGilat(obs.revisor, gilatOptions) ? obs.revisor : null)

      const comentarioActual = comments[obs.id_obs] ?? obs.comentario_covepa ?? null
      const fechaIso = getPeruISOString()

      // Sincronización oficial con Control Fotos + Historial de Estados
      await sincronizarEstadoConControlFotos(
        obs.id_obs,
        nuevoEstado,
        revisorGilatActual,
        comentarioActual,
        {
          idSitio: obs.id_sitio || currentSitioId,
          fechaSubsanacionPrevia: obs.fecha_subsanacion,
          estadoAnterior: obs.estado_covepa,
          usuarioNombre: responsableSesion,
          usuarioEmail: user?.email,
          usuarioId: user?.id,
          origen: 'programacion'
        }
      )

      // Actualizar localmente conservando el revisor asignado
      setObservaciones(prev => prev.map(o => {
        if (o.id_obs === obs.id_obs) {
          return {
            ...o,
            estado_covepa: nuevoEstado,
            fecha_subsanacion: fechaIso,
            revisor: revisorGilatActual,
            comentario_covepa: comentarioActual
          }
        }
        return o
      }))

      // Notificar refresco de la línea de tiempo si está desplegada
      setHistorialRefreshKeys(prev => ({
        ...prev,
        [obs.id_obs]: (prev[obs.id_obs] || 0) + 1
      }))

      onObservationUpdated()
    } catch (err) {
      alert('Error actualizando observación: ' + err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  // Modificar revisor
  const handleUpdateRevisor = async (obs, newRevisor) => {
    try {
      const st = obs.estado_covepa || ''
      if (st === 'En Revisión' || st === 'En Revision' || st === 'Solicitando Revisión' || st === 'Solicitando Revision') {
        alert('Una observación con estado En Revisión no puede tener revisor asignado.')
        return
      }
      // Regla: En revisores solo va personal de Gilat
      const val = (newRevisor && esRevisorGilat(newRevisor, gilatOptions)) ? newRevisor : null
      const siteId = obs.id_sitio || currentSitioId
      await updateObservacionCovepa(obs.id_obs, { revisor: val, id_sitio: siteId })
      setObservaciones(prev => prev.map(o => {
        if (o.id_obs === obs.id_obs) {
          return { ...o, revisor: val }
        }
        return o
      }))
      onObservationUpdated()
    } catch (err) {
      alert('Error actualizando revisor: ' + err.message)
    }
  }

  // Modificar fecha de validación o descarte
  const handleUpdateFecha = async (obs, newFecha) => {
    try {
      const valFecha = newFecha ? getPeruISOString(newFecha) : null
      const siteId = obs.id_sitio || currentSitioId
      await updateObservacionCovepa(obs.id_obs, { fecha_subsanacion: valFecha, id_sitio: siteId })
      setObservaciones(prev => prev.map(o => {
        if (o.id_obs === obs.id_obs) {
          return { ...o, fecha_subsanacion: valFecha }
        }
        return o
      }))
      onObservationUpdated()
    } catch (err) {
      alert('Error actualizando fecha: ' + err.message)
    }
  }

  // Manejo de cambio en comentario
  const handleCommentChange = (obsId, value) => {
    setComments(prev => ({ ...prev, [obsId]: value }))
    dirtyCommentsRef.current.add(obsId)
  }

  // Guardado al perder el foco (blur)
  const handleBlurComment = async (obsId) => {
    if (!dirtyCommentsRef.current.has(obsId)) return
    setSavingCommentId(obsId)
    try {
      const val = commentsRef.current[obsId] ?? ''
      const obsTarget = observaciones.find(o => o.id_obs === obsId)
      const responsableSesion = resolverNombreAuditor(user, personalMember)
      await sincronizarComentarioObservacion(obsId, val, currentSitioId, {
        usuarioNombre: responsableSesion,
        usuarioEmail: user?.email,
        usuarioId: user?.id,
        origen: 'programacion',
        estadoActual: obsTarget?.estado_covepa || 'Pendiente'
      })
      dirtyCommentsRef.current.delete(obsId)
      setSavedCommentId(obsId)
      setHistorialRefreshKeys(prev => ({ ...prev, [obsId]: (prev[obsId] || 0) + 1 }))
      setTimeout(() => {
        setSavedCommentId(prev => (prev === obsId ? null : prev))
      }, 2000)
      onObservationUpdated()
    } catch (err) {
      console.error('Error al guardar comentario:', err)
    } finally {
      setSavingCommentId(null)
    }
  }

  // Manejo de cambio en justificación de demora / incidente
  const handleDelayChange = (obsId, value) => {
    setDelays(prev => ({ ...prev, [obsId]: value }))
    dirtyDelaysRef.current.add(obsId)
  }

  // Guardado al perder el foco (blur) en justificación de demora
  const handleBlurDelay = async (obsId) => {
    if (!dirtyDelaysRef.current.has(obsId)) return
    setSavingDelayId(obsId)
    try {
      const val = delaysRef.current[obsId] ?? ''
      const justificacionLimpia = val.trim() !== '' ? val.trim() : null
      const obsTarget = observaciones.find(o => o.id_obs === obsId)
      const responsableSesion = resolverNombreAuditor(user, personalMember)
      await sincronizarJustificacionDemora(obsId, justificacionLimpia, currentSitioId, {
        usuarioNombre: responsableSesion,
        usuarioEmail: user?.email,
        usuarioId: user?.id,
        origen: 'programacion',
        estadoActual: obsTarget?.estado_covepa || 'Pendiente'
      })
      dirtyDelaysRef.current.delete(obsId)
      setSavedDelayId(obsId)
      setTimeout(() => {
        setSavedDelayId(prev => (prev === obsId ? null : prev))
      }, 2000)
      const ahoraIso = justificacionLimpia ? new Date().toISOString() : null
      setObservaciones(prev => prev.map(o => o.id_obs === obsId ? { ...o, justificacion_demora: justificacionLimpia, fecha_registro_demora: ahoraIso } : o))
      setHistorialRefreshKeys(prev => ({ ...prev, [obsId]: (prev[obsId] || 0) + 1 }))
      onObservationUpdated()
    } catch (err) {
      console.error('Error al guardar justificación de demora:', err)
    } finally {
      setSavingDelayId(null)
    }
  }

  // Manejo de cambio en tiempos de ejecución (HH:MM)
  const handleTimeRealChange = (obsId, value) => {
    setTiemposReal(prev => ({ ...prev, [obsId]: value }))
    dirtyTiemposRef.current.add(obsId)
  }

  const handleTimeDemoraChange = (obsId, value) => {
    setTiemposDemora(prev => ({ ...prev, [obsId]: value }))
    dirtyTiemposRef.current.add(obsId)
  }

  // Guardado al perder el foco (blur) en tiempos de ejecución
  const handleBlurTime = async (obsId) => {
    if (!dirtyTiemposRef.current.has(obsId)) return
    setSavingTimeId(obsId)
    try {
      const tReal = tiemposRealRef.current[obsId] ? tiemposRealRef.current[obsId].trim() : null
      const tDemora = tiemposDemoraRef.current[obsId] ? tiemposDemoraRef.current[obsId].trim() : null
      const obsTarget = observaciones.find(o => o.id_obs === obsId)
      const responsableSesion = resolverNombreAuditor(user, personalMember)
      await sincronizarTiemposEjecucion(obsId, { tiempoReal: tReal, tiempoDemora: tDemora }, currentSitioId, {
        usuarioNombre: responsableSesion,
        usuarioEmail: user?.email,
        usuarioId: user?.id,
        origen: 'programacion',
        estadoActual: obsTarget?.estado_covepa || 'Pendiente'
      })
      dirtyTiemposRef.current.delete(obsId)
      setSavedTimeId(obsId)
      setTimeout(() => {
        setSavedTimeId(prev => (prev === obsId ? null : prev))
      }, 2000)
      setObservaciones(prev => prev.map(o => o.id_obs === obsId ? { ...o, tiempo_ejecucion_real: tReal, tiempo_ejecucion_demora: tDemora } : o))
      setHistorialRefreshKeys(prev => ({ ...prev, [obsId]: (prev[obsId] || 0) + 1 }))
      onObservationUpdated()
    } catch (err) {
      console.error('Error al guardar tiempos de ejecución:', err)
    } finally {
      setSavingTimeId(null)
    }
  }

  // Guardado automático global de comentarios y demoras pendientes al cerrar la ventana
  const handleCloseWithAutoSave = useCallback(async () => {
    const dirtyIds = Array.from(dirtyCommentsRef.current)
    const dirtyDelayIds = Array.from(dirtyDelaysRef.current)
    const dirtyTimeIds = Array.from(dirtyTiemposRef.current)
    const promises = []

    if (dirtyIds.length > 0) {
      promises.push(
        ...dirtyIds.map(id =>
          sincronizarComentarioObservacion(id, commentsRef.current[id] ?? '', currentSitioId)
        )
      )
      dirtyCommentsRef.current.clear()
    }

    if (dirtyDelayIds.length > 0) {
      const responsableSesion = resolverNombreAuditor(user, personalMember)
      promises.push(
        ...dirtyDelayIds.map(id => {
          const val = delaysRef.current[id] ?? ''
          return sincronizarJustificacionDemora(id, val.trim() !== '' ? val.trim() : null, currentSitioId, {
            usuarioNombre: responsableSesion,
            usuarioEmail: user?.email,
            usuarioId: user?.id,
            origen: 'programacion'
          })
        })
      )
      dirtyDelaysRef.current.clear()
    }

    if (dirtyTimeIds.length > 0) {
      const responsableSesion = resolverNombreAuditor(user, personalMember)
      promises.push(
        ...dirtyTimeIds.map(id => {
          const tReal = tiemposRealRef.current[id] ? tiemposRealRef.current[id].trim() : null
          const tDemora = tiemposDemoraRef.current[id] ? tiemposDemoraRef.current[id].trim() : null
          return sincronizarTiemposEjecucion(id, { tiempoReal: tReal, tiempoDemora: tDemora }, currentSitioId, {
            usuarioNombre: responsableSesion,
            usuarioEmail: user?.email,
            usuarioId: user?.id,
            origen: 'programacion'
          })
        })
      )
      dirtyTiemposRef.current.clear()
    }

    if (promises.length > 0) {
      try {
        await Promise.all(promises)
        onObservationUpdated()
      } catch (err) {
        console.error('Error al autoguardar al cerrar:', err)
      }
    }
    onClose()
  }, [onClose, onObservationUpdated, currentSitioId])

  // Listener para cerrar con tecla ESC guardando automáticamente
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        handleCloseWithAutoSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCloseWithAutoSave])

  // Guardado automático al cerrar pestaña o recargar página (beforeunload) y al desmontar
  useEffect(() => {
    const handleBeforeUnload = () => {
      const dirtyIds = Array.from(dirtyCommentsRef.current)
      const dirtyDelayIds = Array.from(dirtyDelaysRef.current)
      const dirtyTimeIds = Array.from(dirtyTiemposRef.current)
      if (dirtyIds.length > 0) {
        dirtyIds.forEach(id => {
          sincronizarComentarioObservacion(id, commentsRef.current[id] ?? '', currentSitioId)
            .catch(err => console.error('Error autoguardando al cerrar página:', err))
        })
        dirtyCommentsRef.current.clear()
      }
      if (dirtyDelayIds.length > 0) {
        dirtyDelayIds.forEach(id => {
          const val = delaysRef.current[id] ?? ''
          sincronizarJustificacionDemora(id, val.trim() !== '' ? val.trim() : null, currentSitioId)
            .catch(err => console.error('Error autoguardando demora al cerrar:', err))
        })
        dirtyDelaysRef.current.clear()
      }
      if (dirtyTimeIds.length > 0) {
        dirtyTimeIds.forEach(id => {
          const tReal = tiemposRealRef.current[id] ? tiemposRealRef.current[id].trim() : null
          const tDemora = tiemposDemoraRef.current[id] ? tiemposDemoraRef.current[id].trim() : null
          sincronizarTiemposEjecucion(id, { tiempoReal: tReal, tiempoDemora: tDemora }, currentSitioId)
            .catch(err => console.error('Error autoguardando tiempos al cerrar:', err))
        })
        dirtyTiemposRef.current.clear()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      const dirtyIds = Array.from(dirtyCommentsRef.current)
      const dirtyDelayIds = Array.from(dirtyDelaysRef.current)
      const dirtyTimeIds = Array.from(dirtyTiemposRef.current)
      if (dirtyIds.length > 0) {
        dirtyIds.forEach(id => {
          sincronizarComentarioObservacion(id, commentsRef.current[id] ?? '', currentSitioId)
            .catch(err => console.error('Error autoguardando al desmontar modal:', err))
        })
        dirtyCommentsRef.current.clear()
      }
      if (dirtyDelayIds.length > 0) {
        dirtyDelayIds.forEach(id => {
          const val = delaysRef.current[id] ?? ''
          sincronizarJustificacionDemora(id, val.trim() !== '' ? val.trim() : null, currentSitioId)
            .catch(err => console.error('Error autoguardando demora al desmontar:', err))
        })
        dirtyDelaysRef.current.clear()
      }
      if (dirtyTimeIds.length > 0) {
        dirtyTimeIds.forEach(id => {
          const tReal = tiemposRealRef.current[id] ? tiemposRealRef.current[id].trim() : null
          const tDemora = tiemposDemoraRef.current[id] ? tiemposDemoraRef.current[id].trim() : null
          sincronizarTiemposEjecucion(id, { tiempoReal: tReal, tiempoDemora: tDemora }, currentSitioId)
            .catch(err => console.error('Error autoguardando tiempos al desmontar:', err))
        })
        dirtyTiemposRef.current.clear()
      }
    }
  }, [user, personalMember, currentSitioId])

  // Cambiar de sitio guardando automáticamente comentarios y demoras pendientes
  const handleSwitchSitio = async (newSitioId) => {
    if (newSitioId === currentSitioId) return
    const dirtyIds = Array.from(dirtyCommentsRef.current)
    const dirtyDelayIds = Array.from(dirtyDelaysRef.current)
    const dirtyTimeIds = Array.from(dirtyTiemposRef.current)
    const promises = []

    if (dirtyIds.length > 0) {
      promises.push(
        ...dirtyIds.map(id =>
          sincronizarComentarioObservacion(id, commentsRef.current[id] ?? '', currentSitioId)
        )
      )
      dirtyCommentsRef.current.clear()
    }

    if (dirtyDelayIds.length > 0) {
      const responsableSesion = resolverNombreAuditor(user, personalMember)
      promises.push(
        ...dirtyDelayIds.map(id => {
          const val = delaysRef.current[id] ?? ''
          return sincronizarJustificacionDemora(id, val.trim() !== '' ? val.trim() : null, currentSitioId, {
            usuarioNombre: responsableSesion,
            usuarioEmail: user?.email,
            usuarioId: user?.id,
            origen: 'programacion'
          })
        })
      )
      dirtyDelaysRef.current.clear()
    }

    if (dirtyTimeIds.length > 0) {
      const responsableSesion = resolverNombreAuditor(user, personalMember)
      promises.push(
        ...dirtyTimeIds.map(id => {
          const tReal = tiemposRealRef.current[id] ? tiemposRealRef.current[id].trim() : null
          const tDemora = tiemposDemoraRef.current[id] ? tiemposDemoraRef.current[id].trim() : null
          return sincronizarTiemposEjecucion(id, { tiempoReal: tReal, tiempoDemora: tDemora }, currentSitioId, {
            usuarioNombre: responsableSesion,
            usuarioEmail: user?.email,
            usuarioId: user?.id,
            origen: 'programacion'
          })
        })
      )
      dirtyTiemposRef.current.clear()
    }

    if (promises.length > 0) {
      try {
        await Promise.all(promises)
        onObservationUpdated()
      } catch (err) {
        console.error('Error guardando antes de cambiar de sitio:', err)
      }
    }
    setCurrentSitioId(newSitioId)
  }

  // Resumen del sitio actual
  const stats = useMemo(() => {
    let tot = observaciones.length
    let validadas = 0
    let descartadas = 0
    let pendientes = 0
    let solicitando = 0
    let enRevision = 0
    let rechazadas = 0

    observaciones.forEach(o => {
      const raw = o.estado_covepa ? o.estado_covepa.trim() : null
      const st = raw || (o.fecha_subsanacion ? 'Validado' : 'Pendiente')
      if (st === 'Validado' || st === 'Enviado') validadas++
      else if (st === 'Descartado') descartadas++
      else if (st === 'Solicitando Revision' || st === 'Solicitando Revisión') solicitando++
      else if (st === 'En Revision' || st === 'En Revisión') enRevision++
      else if (st === 'Rechazado') rechazadas++
      else pendientes++
    })
    return { tot, validadas, descartadas, pendientes, solicitando, enRevision, rechazadas }
  }, [observaciones])

  // Info del sitio actual (enriquecida con localidad, distrito y grupo)
  const siteInfo = useMemo(() => {
    return sitiosMap[currentSitioId] || ASIGNACIONES_BASE.find(s => s.id_site === currentSitioId) || {}
  }, [currentSitioId, sitiosMap])

  const [filtroModal, setFiltroModal] = useState('ALL')
  const [searchObs, setSearchObs] = useState('')

  // Observaciones filtradas según el estado seleccionado y el buscador por código
  const filteredObservaciones = useMemo(() => {
    let list = observaciones
    if (filtroModal !== 'ALL') {
      list = list.filter(o => {
        const raw = o.estado_covepa ? o.estado_covepa.trim() : null
        let st = raw || (o.fecha_subsanacion ? 'Validado' : 'Pendiente')
        if (st === 'En Revision') st = 'En Revisión'
        if (st === 'Solicitando Revision') st = 'Solicitando Revisión'
        if (st === 'Enviado') st = 'Validado'

        let target = filtroModal
        if (target === 'En Revision') target = 'En Revisión'
        if (target === 'Solicitando Revision') target = 'Solicitando Revisión'

        return st === target
      })
    }
    if (searchObs.trim()) {
      const q = searchObs.trim().toLowerCase()
      list = list.filter(o => (o.id_obs || '').toLowerCase().includes(q))
    }
    return list
  }, [observaciones, filtroModal, searchObs])

  const [exportingXlsx, setExportingXlsx] = useState(false)

  // Exportar observaciones del sitio a Excel (.xlsx) con formato de tabla nativa
  const handleExportXLSX = async () => {
    const listToExport = filteredObservaciones.length > 0 ? filteredObservaciones : observaciones
    if (listToExport.length === 0) {
      alert('No hay observaciones para exportar en este sitio.')
      return
    }

    setExportingXlsx(true)
    try {
      // M3: Import din\u00e1mico \u2014 solo descarga exceljs cuando el usuario exporta
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'COVEPA ERP'
      workbook.created = new Date()

      // Sanitizar nombre de hoja y tabla para cumplir con especificación Excel
      const cleanSitio = (currentSitioId || 'Sitio').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 28)
      const cleanTableName = `Obs_${cleanSitio.replace(/[^a-zA-Z0-9_]/g, '_')}`

      const worksheet = workbook.addWorksheet(`Obs_${cleanSitio}`, {
        views: [{ showGridLines: true }]
      })

      // Filas de datos
      const tableRows = listToExport.map((o, idx) => {
        const rawSt = o.estado_covepa || (o.fecha_subsanacion ? 'Validado' : 'Pendiente')
        const isRevision = rawSt === 'En Revision' || rawSt === 'En Revisión' || rawSt === 'Solicitando Revision' || rawSt === 'Solicitando Revisión' || rawSt === 'Pendiente'
        const isGilat = !isRevision && esRevisorGilat(o.revisor, gilatOptions)
        const revisor = isGilat ? o.revisor : '-'
        const fechaRev = isRevision ? '-' : getPeruDateStr(o.fecha_subsanacion)
        const comentario = comments[o.id_obs] || o.comentario_covepa || ''
        const demora = delays[o.id_obs] !== undefined ? delays[o.id_obs] : (o.justificacion_demora || '')
        const tReal = tiemposReal[o.id_obs] !== undefined ? tiemposReal[o.id_obs] : (o.tiempo_ejecucion_real || '')
        const tDemora = tiemposDemora[o.id_obs] !== undefined ? tiemposDemora[o.id_obs] : (o.tiempo_ejecucion_demora || '')
        const sId = o.id_sitio || currentSitioId
        const loc = siteInfo.localidad || sitiosMap[sId]?.localidad || ''
        const zona = siteInfo.zona || sitiosMap[sId]?.zona || ''

        return [
          idx + 1,
          o.id_obs || '',
          sId,
          loc,
          zona,
          rawSt,
          o.detalle || '',
          o.comentario_inicial || '',
          o.acuerdo_subsanacion || '',
          revisor,
          fechaRev,
          comentario,
          demora,
          o.fecha_registro_demora ? getPeruDateStr(o.fecha_registro_demora) : '',
          tReal,
          tDemora
        ]
      })

      // Añadir tabla oficial con formato TableStyleMedium9
      worksheet.addTable({
        name: cleanTableName,
        ref: 'A1',
        headerRow: true,
        totalsRow: false,
        style: {
          theme: 'TableStyleMedium9',
          showRowStripes: true,
          showColumnStripes: false
        },
        columns: [
          { name: '#', filterButton: true },
          { name: 'CÓD. OBSERVACIÓN', filterButton: true },
          { name: 'CÓDIGO DE SITIO', filterButton: true },
          { name: 'LOCALIDAD', filterButton: true },
          { name: 'ZONA', filterButton: true },
          { name: 'ESTADO COVEPA', filterButton: true },
          { name: 'DETALLE DE OBSERVACIÓN', filterButton: true },
          { name: 'COMENTARIO INICIAL', filterButton: true },
          { name: 'ACUERDO DE SUBSANACIÓN', filterButton: true },
          { name: 'REVISADO POR', filterButton: true },
          { name: 'FECHA DE REVISIÓN', filterButton: true },
          { name: 'COMENTARIO COVEPA', filterButton: true },
          { name: 'JUSTIFICACIÓN DE DEMORA', filterButton: true },
          { name: 'FECHA REGISTRO DEMORA', filterButton: true },
          { name: 'TIEMPO EJECUCIÓN REAL (HH:MM)', filterButton: true },
          { name: 'TIEMPO CON DEMORAS (HH:MM)', filterButton: true }
        ],
        rows: tableRows
      })

      // Anchos de columna óptimos
      const colWidths = [6, 20, 18, 26, 14, 16, 44, 44, 44, 24, 18, 35, 38, 22, 22]
      colWidths.forEach((w, i) => {
        worksheet.getColumn(i + 1).width = w
      })

      // Formato de celdas
      worksheet.eachRow((row, rowNumber) => {
        row.height = rowNumber === 1 ? 26 : 22
        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: 'middle',
            horizontal: (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 5 || colNumber === 10) ? 'center' : 'left',
            wrapText: colNumber === 6 || colNumber === 7 || colNumber === 8 || colNumber === 11 || colNumber === 12
          }
        })
      })

      // Generar buffer y descargar
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = prog?.fecha || toLocalDateString(new Date())
      a.download = `Observaciones_${currentSitioId}_${dateStr}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error generando archivo Excel de observaciones:', err)
      alert('Error al generar el archivo Excel: ' + err.message)
    } finally {
      setExportingXlsx(false)
    }
  }

  return (
    <div className="prog-details-modal-overlay">
      <div className="prog-details-modal">
        {/* Cabecera Limpia y Profesional (Sin Fecha, Sin Itinerario y Sin Detalle de Técnico) */}
        <div className="prog-details-modal-header">
          <div className="prog-details-header-main">
            {/* Pestañas para cambiar de sitio si la jornada incluye más de uno */}
            {allSitios.length > 1 && (
              <div className="prog-site-tabs-bar">
                {allSitios.map(s => {
                  const sId = s.id_sitio || s
                  const isActive = sId === currentSitioId
                  const loc = sitiosMap[sId]?.localidad || sitiosMap[sId]?.nombre_nodo
                  return (
                    <button
                      key={sId}
                      type="button"
                      className={`prog-site-tab-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleSwitchSitio(sId)}
                      title={loc ? `${sId} · ${loc}` : sId}
                    >
                      <MapPin size={12} className={isActive ? 'tab-icon-active' : ''} />
                      <span className="tab-site-code">{sId}</span>
                      {loc && <span className="tab-loc-text">· {loc}</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Título Principal: Código de Sitio · Localidad + Metadatos */}
            <div className="prog-details-site-title-row">
              <div className="prog-details-site-badge-icon">
                <MapPin size={22} />
              </div>
              <div className="prog-details-site-texts">
                <div className="prog-details-title-line">
                  <h2 className="prog-details-site-title">{currentSitioId}</h2>
                  {siteInfo.localidad && (
                    <span className="prog-details-site-loc">· {siteInfo.localidad}</span>
                  )}
                </div>
                {(siteInfo.grupo || siteInfo.zona || siteInfo.distrito) && (
                  <div className="prog-details-site-meta-pills">
                    {siteInfo.grupo && <span className="meta-pill">{siteInfo.grupo}</span>}
                    {siteInfo.zona && <span className="meta-pill">{siteInfo.zona}</span>}
                    {siteInfo.distrito && <span className="meta-pill">{siteInfo.distrito}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Acciones de la programación: Siempre iconos compactos (Editar, Eliminar y Cerrar) */}
          <div className="prog-details-modal-actions">
            {onEditProg && canEditProgramacion && (
              <button
                type="button"
                className="prog-details-icon-action-btn edit"
                title="Editar esta programación"
                aria-label="Editar"
                onClick={() => {
                  handleCloseWithAutoSave()
                  onEditProg(prog)
                }}
              >
                <Edit3 size={15} />
              </button>
            )}

            {onDeleteProg && canEditProgramacion && (
              <button
                type="button"
                className="prog-details-icon-action-btn delete"
                title="Eliminar esta programación"
                aria-label="Eliminar"
                onClick={() => onDeleteProg(prog?.id)}
              >
                <Trash2 size={15} />
              </button>
            )}

            <button
              type="button"
              className="prog-modal-close-btn"
              onClick={handleCloseWithAutoSave}
              title="Cerrar ventana y guardar cambios (Esc)"
              aria-label="Cerrar"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Resumen de contadores del sitio convertidos en botones de filtro interactivo */}
        <div className="prog-modal-stats-bar">
          <button
            type="button"
            className={`prog-modal-stat-btn ${filtroModal === 'ALL' ? 'active' : ''}`}
            onClick={() => setFiltroModal('ALL')}
            title="Ver todas las observaciones"
          >
            <span className="stat-btn-label">Total</span>
            <span className="stat-btn-val">{stats.tot}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-solicitando ${filtroModal === 'Solicitando Revisión' ? 'active' : ''}`}
            onClick={() => setFiltroModal(prev => prev === 'Solicitando Revisión' ? 'ALL' : 'Solicitando Revisión')}
            title="Observaciones solicitando revisión"
          >
            <span className="stat-btn-label text-solicitando">⏳ Solicitando</span>
            <span className="stat-btn-val text-solicitando">{stats.solicitando}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-revision ${(filtroModal === 'En Revisión' || filtroModal === 'En Revision') ? 'active' : ''}`}
            onClick={() => setFiltroModal(prev => (prev === 'En Revisión' || prev === 'En Revision') ? 'ALL' : 'En Revisión')}
            title="Observaciones en proceso de revisión"
          >
            <span className="stat-btn-label text-revision">🔍 En Revisión</span>
            <span className="stat-btn-val text-revision">{stats.enRevision}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-validado ${filtroModal === 'Validado' ? 'active' : ''}`}
            onClick={() => setFiltroModal(prev => prev === 'Validado' ? 'ALL' : 'Validado')}
            title="Observaciones validadas listas para subir"
          >
            <span className="stat-btn-label text-validado">✓ Validadas</span>
            <span className="stat-btn-val text-validado">{stats.validadas}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-pendiente ${filtroModal === 'Pendiente' ? 'active' : ''}`}
            onClick={() => setFiltroModal(prev => prev === 'Pendiente' ? 'ALL' : 'Pendiente')}
            title="Observaciones pendientes por subsanar"
          >
            <span className="stat-btn-label text-pendiente">● Pendientes</span>
            <span className="stat-btn-val text-pendiente">{stats.pendientes}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-descartado ${filtroModal === 'Descartado' ? 'active' : ''}`}
            onClick={() => setFiltroModal(prev => prev === 'Descartado' ? 'ALL' : 'Descartado')}
            title="Observaciones descartadas en campo"
          >
            <span className="stat-btn-label text-descartado">🚫 Descartadas</span>
            <span className="stat-btn-val text-descartado">{stats.descartadas}</span>
          </button>

          {stats.rechazadas > 0 && (
            <button
              type="button"
              className={`prog-modal-stat-btn stat-rechazado ${filtroModal === 'Rechazado' ? 'active' : ''}`}
              onClick={() => setFiltroModal(prev => prev === 'Rechazado' ? 'ALL' : 'Rechazado')}
              title="Observaciones rechazadas por calidad"
            >
              <span className="stat-btn-label text-rechazado">✕ Rechazadas</span>
              <span className="stat-btn-val text-rechazado">{stats.rechazadas}</span>
            </button>
          )}
        </div>

        {/* Barra de búsqueda interactiva y botón de exportación */}
        <div className="prog-modal-search-bar">
          <div className="prog-modal-search-box-wrap">
            <div className="search-input-container">
              <Search size={15} className="search-input-icon" />
              <input
                type="text"
                className="prog-modal-search-input"
                value={searchObs}
                onChange={(e) => setSearchObs(e.target.value)}
                placeholder="Buscar por código (ej. OBS-1234 o C-4175)..."
              />
              {searchObs && (
                <button
                  type="button"
                  onClick={() => setSearchObs('')}
                  title="Limpiar búsqueda"
                  className="search-clear-btn"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {searchObs && (
              <span className="search-results-counter">
                {filteredObservaciones.length} resultado(s)
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportXLSX}
            disabled={exportingXlsx || observaciones.length === 0}
            className="prog-export-btn"
            title={`Descargar las ${filteredObservaciones.length} observaciones en Excel (.xlsx)`}
          >
            <FileSpreadsheet size={15} />
            <span>{exportingXlsx ? 'Generando Excel...' : 'Descargar Excel (.xlsx)'}</span>
          </button>
        </div>

        {/* Lista de Observaciones */}
        <div className="prog-details-modal-body">
          {loading ? (
            <div className="modal-state-msg">
              <RefreshCw size={24} className="spin" color="#0284c7" />
              <span>Cargando observaciones del sitio {currentSitioId}...</span>
            </div>
          ) : errorMsg ? (
            <div className="modal-state-msg error">{errorMsg}</div>
          ) : observaciones.length === 0 ? (
            <div className="modal-state-msg">
              <span>El sitio <strong>{currentSitioId}</strong> no tiene observaciones registradas en el sistema.</span>
            </div>
          ) : filteredObservaciones.length === 0 ? (
            <div className="modal-empty-filter-state">
              <p>
                {searchObs ? (
                  <>No se encontraron observaciones con el código <strong>"{searchObs}"</strong>.</>
                ) : (
                  <>No hay observaciones en estado <strong>{filtroModal}</strong> para este sitio.</>
                )}
              </p>
              <div className="empty-filter-actions">
                {searchObs && (
                  <button type="button" onClick={() => setSearchObs('')} className="btn-reset-filter">
                    Borrar búsqueda
                  </button>
                )}
                {filtroModal !== 'ALL' && (
                  <button type="button" onClick={() => setFiltroModal('ALL')} className="btn-reset-filter primary">
                    Ver todas las observaciones ({stats.tot})
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredObservaciones.map(obs => {
              const rawEstado = obs.estado_covepa ? obs.estado_covepa.trim() : null
              let currentEstado = rawEstado || (obs.fecha_subsanacion ? 'Validado' : 'Pendiente')
              if (currentEstado === 'En Revision') currentEstado = 'En Revisión'
              if (currentEstado === 'Solicitando Revision') currentEstado = 'Solicitando Revisión'
              if (currentEstado === 'Enviado') currentEstado = 'Validado'
              const isUpdating = updatingId === obs.id_obs
              const isProtectedCurrent = esEstadoProtegido(currentEstado)
              const isLockedForNonAdmin = !isAdmin && isProtectedCurrent
              const showRevisorYFecha = currentEstado !== 'Pendiente' && currentEstado !== 'Solicitando Revisión' && currentEstado !== 'En Revisión' && currentEstado !== 'En Revision' && currentEstado !== 'Documentación' && currentEstado !== 'Documentacion' && currentEstado !== 'Crítico' && currentEstado !== 'Critico'

              return (
                <div key={obs.id_obs} className="prog-obs-card-item">
                  {/* Fila Superior: Código de Observación, Protocolo, Selector de Estado y Subsistema */}
                  <div className="prog-obs-card-header">
                    <div className="prog-obs-card-header-top">
                      <div className="prog-obs-card-tags">
                        <div className="prog-obs-code-badge">
                          <span className="obs-code-tag">CÓDIGO:</span>
                          <span className="obs-code-val">{obs.id_obs}</span>
                        </div>
                        {obs.protocolo && (
                          <span className="meta-pill" title={`Protocolo: ${obs.protocolo}`}>
                            Protocolo: <strong>{obs.protocolo}</strong>
                          </span>
                        )}
                        {isLockedForNonAdmin && (
                          <span
                            className="meta-pill"
                            style={{
                              fontSize: 'var(--text-meta)',
                              color: '#b91c1c',
                              background: '#fef2f2',
                              borderColor: '#fecaca',
                              fontWeight: 'var(--fw-medium)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Esta observación está en un estado protegido (Pre-validado, Crítico o Descartado). Solo un Administrador puede modificarla."
                          >
                            🔒 Solo Admin
                          </span>
                        )}
                      </div>

                      <div className="prog-obs-status-select-wrap">
                        <select
                          value={currentEstado}
                          disabled={isUpdating || isReadOnly || isLockedForNonAdmin}
                          onChange={(e) => handleRequestEstadoChange(obs, e.target.value)}
                          className={`prog-obs-status-select status-${(currentEstado || '').toLowerCase().replace(/\s+/g, '-')}`}
                          style={(isReadOnly || isLockedForNonAdmin) ? { cursor: 'not-allowed', opacity: 0.85 } : undefined}
                          title={isLockedForNonAdmin ? `Esta observación está en estado "${currentEstado}". Solo un Administrador puede modificarla.` : undefined}
                        >
                          <option value="Pendiente">● Pendiente</option>
                          <option value="Solicitando Revisión">⏳ Solicitando Revisión</option>
                          <option value="En Revisión">🔍 En Revisión</option>
                          <option value="Documentación">📄 Documentación</option>
                          {(isAdmin || currentEstado === 'Pre-validado') && (
                            <option value="Pre-validado">📸 Pre-validado</option>
                          )}
                          <option value="Validado">✓ Validado</option>
                          {(isAdmin || currentEstado === 'Crítico' || currentEstado === 'Critico') && (
                            <option value="Crítico">⚠️ Crítico</option>
                          )}
                          {(isAdmin || currentEstado === 'Descartado') && (
                            <option value="Descartado">🚫 Descartado</option>
                          )}
                          <option value="Rechazado">✕ Rechazado</option>
                        </select>
                      </div>
                    </div>

                    {obs.subsistema && (
                      <div className="prog-obs-card-meta-row">
                        <span className="meta-pill meta-pill-subsistema" title={`Subsistema: ${obs.subsistema}`}>
                          Subsistema: <strong>{obs.subsistema}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Insignia Directa de Último Cambio y Trazabilidad (Exclusivo Administrador) */}
                  {isAdmin && (
                    <div style={{ margin: '0.45rem 0' }}>
                      <UltimoCambioBadge
                        idObs={obs.id_obs}
                        refreshKey={historialRefreshKeys[obs.id_obs] || 0}
                      />
                    </div>
                  )}

                  {/* Fila de Auditoría: Revisor y Fecha de Validación */}
                  {showRevisorYFecha && (
                    <div className="prog-obs-audit-bar">
                      <div className="audit-col">
                        <label className="audit-label">
                          <Users size={12} color="#0284c7" />
                          <span>Revisado por:</span>
                        </label>
                        <select
                          value={esRevisorGilat(obs.revisor || obs.validado_por, gilatOptions) ? (obs.revisor || obs.validado_por) : ''}
                          disabled={isUpdating || isReadOnly}
                          onChange={(e) => handleUpdateRevisor(obs, e.target.value)}
                          className="audit-select"
                          title="Persona de GILAT que revisó esta observación"
                          style={isReadOnly ? { cursor: 'not-allowed' } : undefined}
                        >
                          <option value="">-- Seleccionar Revisor (GILAT) --</option>
                          {gilatOptions.map(p => (
                            <option key={p.id || p.nombre_completo} value={p.nombre_completo}>
                              {p.nombre_completo} {p.cargo && p.cargo !== 'Empresa' ? `(${p.cargo})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="audit-col">
                        <label className="audit-label">
                          <Clock size={12} color="#0284c7" />
                          <span>
                            {currentEstado === 'Validado' ? 'F. Validación:' :
                              currentEstado === 'Pre-validado' ? 'F. Pre-validación:' :
                                currentEstado === 'Descartado' ? 'F. Descarte:' :
                                  currentEstado === 'Rechazado' ? 'F. Rechazo:' :
                                    currentEstado === 'Enviado' ? 'F. Envío:' : 'Fecha:'}
                          </span>
                        </label>
                        <input
                          type="date"
                          value={getPeruDateStr(obs.fecha_subsanacion)}
                          disabled={isUpdating || isReadOnly}
                          onChange={(e) => handleUpdateFecha(obs, e.target.value)}
                          className="audit-date-input"
                          title="Modificar fecha de subsanación/revisión"
                          style={isReadOnly ? { cursor: 'not-allowed' } : undefined}
                        />
                      </div>
                    </div>
                  )}

                  {/* Cajas de Contenido: Detalle, Comentario Inicial y Acuerdo de Subsanación */}
                  <div className="prog-obs-blocks-wrap">
                    {/* Detalle */}
                    {hasMeaningfulText(obs.detalle) && (
                      <div className="obs-content-box box-detalle">
                        <span className="box-label">Detalle de la Observación:</span>
                        <div className="box-body-text">{obs.detalle}</div>
                      </div>
                    )}

                    {/* Comentario Inicial */}
                    {hasMeaningfulText(obs.comentario_inicial) && (
                      <div className="obs-content-box box-inicial">
                        <span className="box-label">Comentario Inicial:</span>
                        <div className="box-body-text">{obs.comentario_inicial}</div>
                      </div>
                    )}

                    {/* Acuerdo de Subsanación */}
                    {hasMeaningfulText(obs.acuerdo_subsanacion) && (
                      <div className="obs-content-box box-acuerdo">
                        <span className="box-label">Acuerdo de Subsanación:</span>
                        <div className="box-body-text">{obs.acuerdo_subsanacion}</div>
                      </div>
                    )}

                    {/* Comentario / Nota COVEPA */}
                    <div className="obs-content-box box-covepa">
                      <div className="box-covepa-top">
                        <span className="box-label">💬 Comentario / Evidencias COVEPA:</span>
                        <div className="covepa-save-cluster">
                          {savingCommentId === obs.id_obs && (
                            <span className="save-tag saving">
                              <RefreshCw size={11} className="spin" /> Guardando...
                            </span>
                          )}
                          {savedCommentId === obs.id_obs && (
                            <span className="save-tag saved">
                              <Check size={12} /> Guardado
                            </span>
                          )}
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        value={comments[obs.id_obs] ?? ''}
                        readOnly={isReadOnly}
                        onChange={isReadOnly ? undefined : (e) => handleCommentChange(obs.id_obs, e.target.value)}
                        onBlur={isReadOnly ? undefined : () => handleBlurComment(obs.id_obs)}
                        placeholder={isReadOnly ? 'Sin comentarios COVEPA registrados (Solo lectura).' : 'Escribe un comentario o nota de subsanación (se guarda automáticamente)...'}
                        className="covepa-comment-textarea"
                        style={isReadOnly ? { background: '#f8fafc', cursor: 'default' } : undefined}
                      />
                    </div>

                    {/* Caja de Justificación de Demora y Tiempos de Ejecución Colapsable */}
                    {(() => {
                      const hasDelayData = Boolean(
                        (delays[obs.id_obs] && String(delays[obs.id_obs]).trim()) ||
                        (tiemposReal[obs.id_obs] && String(tiemposReal[obs.id_obs]).trim()) ||
                        (tiemposDemora[obs.id_obs] && String(tiemposDemora[obs.id_obs]).trim())
                      )
                      const isDemoraExpanded = hasDelayData || Boolean(expandedDemoraIds[obs.id_obs])

                      if (!isDemoraExpanded) {
                        if (!canEditDemoras) return null
                        return (
                          <div style={{ marginTop: '0.65rem' }}>
                            <button
                              type="button"
                              className="btn-add-demora"
                              onClick={() => setExpandedDemoraIds(prev => ({ ...prev, [obs.id_obs]: true }))}
                            >
                              <AlertTriangle size={13} color="#d97706" />
                              <span>+ Agregar Demora / Tiempos</span>
                            </button>
                          </div>
                        )
                      }

                      return (
                        <div className="obs-content-box box-demora" style={{ borderLeft: '4px solid #f59e0b', background: '#fffdf5', border: '1px solid #fde68a', borderLeftWidth: '4px', borderRadius: '8px', padding: '0.75rem' }}>
                          <div className="box-covepa-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <span className="box-label" style={{ color: '#b45309', fontWeight: 'var(--fw-bold)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <AlertTriangle size={13} color="#d97706" /> Tiempos de Ejecución y Control de Demoras:
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="covepa-save-cluster">
                                {(savingDelayId === obs.id_obs || savingTimeId === obs.id_obs) && (
                                  <span className="save-tag saving">
                                    <RefreshCw size={11} className="spin" /> Guardando...
                                  </span>
                                )}
                                {(savedDelayId === obs.id_obs || savedTimeId === obs.id_obs) && (
                                  <span className="save-tag saved">
                                    <Check size={12} /> Guardado
                                  </span>
                                )}
                              </div>
                              {!hasDelayData && canEditDemoras && (
                                <button
                                  type="button"
                                  className="btn-collapse-demora"
                                  onClick={() => setExpandedDemoraIds(prev => ({ ...prev, [obs.id_obs]: false }))}
                                  title="Ocultar sección de demoras"
                                >
                                  <ChevronUp size={13} />
                                  <span>Ocultar</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Selectores con máscara de tiempo (HH:MM) */}
                          <div className="time-cluster-grid">
                            <TimeMaskInput
                              label="⏱️ Tiempo Real de Ejecución:"
                              value={tiemposReal[obs.id_obs] ?? ''}
                              placeholder="00:00"
                              disabled={!canEditDemoras}
                              title="Tiempo neto/real trabajado en la subsanación (HH:MM)"
                              onChange={(val) => {
                                if (!canEditDemoras) return
                                handleTimeRealChange(obs.id_obs, val)
                              }}
                              onBlur={canEditDemoras ? () => handleBlurTime(obs.id_obs) : undefined}
                            />
                            <TimeMaskInput
                              label="⏳ Tiempo de Ejecución con Demoras:"
                              value={tiemposDemora[obs.id_obs] ?? ''}
                              placeholder="00:00"
                              variant="warning"
                              disabled={!canEditDemoras}
                              title="Tiempo total considerando demoras o incidentes (HH:MM)"
                              onChange={(val) => {
                                if (!canEditDemoras) return
                                handleTimeDemoraChange(obs.id_obs, val)
                              }}
                              onBlur={canEditDemoras ? () => handleBlurTime(obs.id_obs) : undefined}
                            />
                          </div>

                          {(() => {
                            const diff = diffTimeHHMM(tiemposReal[obs.id_obs], tiemposDemora[obs.id_obs])
                            if (!diff) return null
                            return (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0.45rem' }}>
                                {diff.hasDelay && (
                                  <span className="time-diff-badge delay">
                                    ⚠️ Retraso neto: +{diff.formatted} ({diff.diffMins} min adicionales)
                                  </span>
                                )}
                                {diff.isEqual && (
                                  <span className="time-diff-badge ontime">
                                    ✓ Ejecutado dentro del plazo regular estimado
                                  </span>
                                )}
                                {diff.isFaster && (
                                  <span className="time-diff-badge faster">
                                    ⚡ Finalizado {diff.formatted} antes del tiempo estimado
                                  </span>
                                )}
                              </div>
                            )
                          })()}

                          <textarea
                            rows={2}
                            value={delays[obs.id_obs] ?? ''}
                            readOnly={!canEditDemoras}
                            onChange={canEditDemoras ? (e) => handleDelayChange(obs.id_obs, e.target.value) : undefined}
                            onBlur={canEditDemoras ? () => handleBlurDelay(obs.id_obs) : undefined}
                            placeholder={!canEditDemoras ? 'Sin justificación de demora registrada.' : 'Si esta observación tomó más tiempo del debido o tuvo incidentes, redacta aquí el sustento técnico (dejar vacío si no hubo problemas de demora)...'}
                            className="covepa-comment-textarea"
                            style={{ borderColor: '#fde68a', background: !canEditDemoras ? '#fafafa' : undefined, cursor: !canEditDemoras ? 'default' : undefined }}
                          />
                          <div style={{ fontSize: 'var(--text-meta)', marginTop: '0.35rem', color: '#78716c' }}>
                            {delays[obs.id_obs] && delays[obs.id_obs].trim() ? (
                              <span style={{ color: '#b45309', fontWeight: 'var(--fw-medium)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={11} color="#b45309" />
                                {obs.fecha_registro_demora ? `Demora registrada: ${getPeruDateStr(obs.fecha_registro_demora)}` : 'Incidente registrado: observación con retraso justificado'}
                              </span>
                            ) : (
                              <span style={{ color: '#059669', fontWeight: 'var(--fw-medium)' }}>
                                ✓ Sin incidentes de demora (subsanación en plazo regular)
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Ventanita Emergente de Confirmación de Estados Protegidos */}
        <ModalConfirmacionEstado
          isOpen={Boolean(confirmModalData)}
          onClose={() => setConfirmModalData(null)}
          onConfirm={async () => {
            const { obs, targetValue } = confirmModalData || {}
            setConfirmModalData(null)
            if (obs && targetValue) {
              await handleSetEstado(obs, targetValue)
            }
          }}
          idObs={confirmModalData?.obs?.id_obs}
          idSitio={confirmModalData?.obs?.id_sitio || currentSitioId}
          localidad={siteInfo?.localidad || sitiosMap[confirmModalData?.obs?.id_sitio || currentSitioId]?.localidad || ''}
          estadoAnterior={confirmModalData?.currentEstado}
          estadoNuevo={confirmModalData?.targetValue}
          loading={Boolean(updatingId)}
        />
      </div>
    </div>
  )
}

