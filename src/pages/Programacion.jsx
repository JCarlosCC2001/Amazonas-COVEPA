import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Trash2,
  MapPin, CheckCircle2, Clock, AlertCircle, List,
  CalendarDays, X, Search, RefreshCw, Eye, ShieldCheck,
  Check, AlertTriangle, Users, Edit3, User, FileSpreadsheet, Download, Send,
  TrendingUp, History, ChevronUp, ChevronDown, FileText, CheckCheck, Globe
} from 'lucide-react'
// M3: ExcelJS se importa dinámicamente en handleExportXLSX para no inflar el bundle inicial
import ModalAvanceDia from '../components/programacion/ModalAvanceDia'
import ModalTimelineTecnico from '../components/programacion/ModalTimelineTecnico'
import ModalProgramacionForm from '../components/programacion/ModalProgramacionForm'
import ModalDetallesProgramacion from '../components/programacion/ModalDetallesProgramacion'
import HistorialEstadosTimeline from '../components/shared/HistorialEstadosTimeline'
import UltimoCambioBadge from '../components/shared/UltimoCambioBadge'
import TimeMaskInput, { diffTimeHHMM } from '../components/shared/TimeMaskInput'
import { getAvancePorFecha } from '../services/dashboardService'
import { fetchUltimosReportesDelDia } from '../services/actividadService'
import {
  getPersonalActivo,
  getPersonalTecnico,
  getProgramaciones,
  createProgramacion,
  updateProgramacion,
  deleteProgramacion,
  getSitiosObservacionesResumen,
  getObservacionesSitioDetalle
} from '../services/programacionService'
import { updateObservacionCovepa, sincronizarEstadoConControlFotos, esRevisorGilat, pasarTodasSolicitudesAEnRevision } from '../services/observacionesService'
import {
  sincronizarAuditoriaObservacion,
  sincronizarComentarioObservacion,
  sincronizarJustificacionDemora,
  sincronizarTiemposEjecucion,
  resolverNombreAuditor
} from '../services/auditoriaSyncService'
import { ASIGNACIONES_BASE, getCachedSitiosAsignados, getZonaBySiteId } from '../services/sitiosService'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../context/NotificationContext'
import { usePresentationMode } from '../context/PresentationContext'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'
import { hasMeaningfulText, toLocalDateString, getPeruDateStr, getPeruISOString, getInitials, getCargoClass } from '../utils/helpers'
import { supabase } from '../lib/supabase'

// Helper para obtener el lunes de la semana actual
function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Si es domingo (0), resta 6
  return new Date(date.setDate(diff))
}

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function Programacion() {
  const { presentationMode } = usePresentationMode()
  const { user, personalMember, canEditProgramacion, isReadOnly } = useAuth()
  const { notificarPaseEnRevision } = useNotifications()
  const [batchRevisionLoading, setBatchRevisionLoading] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('today') // 'today' | 'week'
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'SOLICITANDO' | 'EN_REVISION' | 'VALIDADO' | 'RECHAZADO'
  const [proyectoFilter, setProyectoFilter] = useState('ALL') // 'ALL' | 'ORIGINAL' | 'AMPLIACION'
  const [loading, setLoading] = useState(true)
  const [programaciones, setProgramaciones] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [sitiosStats, setSitiosStats] = useState({})

  // Avance específico y métricas del día que se está revisando (currentDate)
  const [dayAvance, setDayAvance] = useState({ rows: [], stats: {}, loading: false })

  // Registro de últimos reportes de campo por sitio y cuadrilla para la fecha activa
  const [ultimosReportes, setUltimosReportes] = useState({ bySite: {}, byCuadrilla: {} })

  const loadDayAvance = useCallback(async (targetDate) => {
    if (!targetDate) return
    const dStr = typeof targetDate === 'string' ? targetDate : toLocalDateString(targetDate)
    setDayAvance(prev => ({ ...prev, loading: true }))
    try {
      const res = await getAvancePorFecha(dStr)
      setDayAvance({
        rows: res?.rows || [],
        stats: res?.stats || {},
        loading: false
      })
    } catch (err) {
      console.warn('Error cargando avance del día en Programacion:', err)
      setDayAvance(prev => ({ ...prev, loading: false }))
    }
  }, [])

  const loadUltimosReportes = useCallback(async (targetDate) => {
    if (!targetDate) return
    const dStr = typeof targetDate === 'string' ? targetDate : toLocalDateString(targetDate)
    try {
      const res = await fetchUltimosReportesDelDia(dStr)
      setUltimosReportes(res || {
        bySite: {},
        byCuadrilla: {},
        byUser: {},
        bySiteSolicitud: {},
        byCuadrillaSolicitud: {},
        byUserSolicitud: {}
      })
    } catch (err) {
      console.warn('Error cargando últimos reportes en Programación:', err)
    }
  }, [])

  useEffect(() => {
    Promise.all([
      loadDayAvance(currentDate),
      loadUltimosReportes(currentDate)
    ])
  }, [currentDate, loadDayAvance, loadUltimosReportes])

  // Catálogo enriquecido con localidades y nombres de nodos para visualización al lado de los códigos
  const [sitiosCatalogo, setSitiosCatalogo] = useState(() => {
    return ASIGNACIONES_BASE.map(s => {
      const parts = (s.id_site || '').split('-')
      const codigoLugar = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : s.id_site
      return {
        ...s,
        codigo_lugar: codigoLugar,
        nombre_nodo: s.id_site,
        localidad: ''
      }
    })
  })

  useEffect(() => {
    let active = true
    getCachedSitiosAsignados()
      .then(data => {
        if (active && data && data.length > 0) {
          setSitiosCatalogo(data)
        }
      })
      .catch(err => console.warn('Error cargando catálogo de sitios en Programacion:', err))
    return () => { active = false }
  }, [])

  const sitiosMap = useMemo(() => {
    const map = {}
    sitiosCatalogo.forEach(s => {
      map[s.id_site] = s
    })
    return map
  }, [sitiosCatalogo])

  // Modales y edición
  const [modalNewOpen, setModalNewOpen] = useState(false)
  const [modalNewDate, setModalNewDate] = useState('')
  const [modalNewInitialSite, setModalNewInitialSite] = useState(null)
  const [editingProg, setEditingProg] = useState(null)
  const [selectedProgModal, setSelectedProgModal] = useState(null) // { id_sitio, programacion, allSitios }
  const [modalAvanceOpen, setModalAvanceOpen] = useState(false)
  const [selectedTimelineTecnico, setSelectedTimelineTecnico] = useState(null) // { tecnico, cuadrilla, fecha, siteIds }

  // Abrir la línea de actividad horizontal del técnico
  const handleOpenTimelineTecnico = useCallback((tec, groupOrDay, customFecha = null) => {
    const fechaVal = customFecha || toLocalDateString(currentDate)
    const siteIds = (groupOrDay?.sitios || []).map(s => s.id_sitio).filter(Boolean)
    setSelectedTimelineTecnico({
      tecnico: tec,
      cuadrilla: groupOrDay?.cuadrilla || tec?.cuadrilla,
      fecha: fechaVal,
      siteIds
    })
  }, [currentDate])

  // Resolver la última solicitud de revisión o último reporte de un grupo de técnico para la jornada activa
  const getUltimoReporteTecnico = useCallback((tGroup) => {
    let latestSolicitud = null
    
    const tecName = (tGroup?.tecnico?.nombre_completo || '').trim().toUpperCase()

    // 1. Prioridad: Buscar solicitudes de revisión
    // 1.1 Por sitios asignados
    ;(tGroup?.sitios || []).forEach(s => {
      const sol = ultimosReportes.bySiteSolicitud?.[s.id_sitio]
      if (sol && (!latestSolicitud || new Date(sol.ts) > new Date(latestSolicitud.ts))) {
        latestSolicitud = { ...sol, isSolicitud: true }
      }
    })

    // 1.2 Por técnico responsable
    if (tecName && ultimosReportes.byUserSolicitud) {
      const solUser = ultimosReportes.byUserSolicitud[tecName] ||
        Object.entries(ultimosReportes.byUserSolicitud).find(([name]) => name.includes(tecName) || tecName.includes(name))?.[1]
      if (solUser && (!latestSolicitud || new Date(solUser.ts) > new Date(latestSolicitud.ts))) {
        latestSolicitud = { ...solUser, isSolicitud: true }
      }
    }

    // 1.3 Por cuadrilla
    if (!latestSolicitud && tGroup?.cuadrilla && ultimosReportes.byCuadrillaSolicitud) {
      const cClean = String(tGroup.cuadrilla).trim().toUpperCase().replace(/GRUPO/gi, 'CUADRILLA')
      const solCuad = ultimosReportes.byCuadrillaSolicitud[cClean] || ultimosReportes.byCuadrillaSolicitud[tGroup.cuadrilla]
      if (solCuad) latestSolicitud = { ...solCuad, isSolicitud: true }
    }

    // 2. Si no hubo solicitud explícita de revisión, buscar última actividad registrada de sus sitios/cuadrilla
    if (!latestSolicitud) {
      let latestActividad = null
      ;(tGroup?.sitios || []).forEach(s => {
        const act = ultimosReportes.bySite?.[s.id_sitio]
        if (act && (!latestActividad || new Date(act.ts) > new Date(latestActividad.ts))) {
          latestActividad = act
        }
      })
      if (!latestActividad && tGroup?.cuadrilla && ultimosReportes.byCuadrilla) {
        const cClean = String(tGroup.cuadrilla).trim().toUpperCase().replace(/GRUPO/gi, 'CUADRILLA')
        latestActividad = ultimosReportes.byCuadrilla[cClean] || ultimosReportes.byCuadrilla[tGroup.cuadrilla]
      }
      if (latestActividad) {
        return latestActividad
      }
    }

    return latestSolicitud
  }, [ultimosReportes])

  // Buscador de Observación e Intersección Operativa
  const [searchObsQuery, setSearchObsQuery] = useState('')
  const [searchObsResult, setSearchObsResult] = useState(null) // { status: 'SCHEDULED' | 'NOT_SCHEDULED' | 'NOT_FOUND', obs, allMatches, siteId, siteObj, prog, assignedLead, leadTecnico, cuadrillaName }
  const [isSearchingObs, setIsSearchingObs] = useState(false)
  const searchObsTimeoutRef = useRef(null)

  // Calcular rango de la semana (Lunes a Domingo)
  const weekDays = useMemo(() => {
    const monday = getMonday(currentDate)
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      days.push({
        date: d,
        dateStr: toLocalDateString(d),
        dayName: DIAS_SEMANA[i],
        dayNum: d.getDate(),
        isToday: toLocalDateString(d) === toLocalDateString(new Date())
      })
    }
    return days
  }, [currentDate])

  const startDateStr = weekDays[0].dateStr
  const endDateStr = weekDays[6].dateStr

  // Cargar personal activo (técnicos, conductores, supervisores)
  useEffect(() => {
    async function loadTechs() {
      try {
        const staff = await getPersonalActivo()
        setTecnicos(staff)
      } catch (err) {
        console.error('Error cargando personal activo:', err)
      }
    }
    loadTechs()
  }, [])

  // Cargar programaciones de la semana seleccionada
  const fetchWeekData = useCallback(async () => {
    setLoading(true)
    try {
      const progs = await getProgramaciones(startDateStr, endDateStr)
      setProgramaciones(progs)

      // Extraer todos los sitios de las programaciones para consultar su progreso
      const allSites = [...new Set(progs.flatMap(p => (p.sitios || []).map(s => s.id_sitio).filter(Boolean)))]

      // Consultar resumen de observaciones, avance del día y tiempos de espera en paralelo (a solicitud del usuario)
      await Promise.all([
        allSites.length > 0
          ? getSitiosObservacionesResumen(allSites).then(setSitiosStats)
          : Promise.resolve(setSitiosStats({})),
        loadDayAvance(currentDate),
        loadUltimosReportes(currentDate)
      ])
    } catch (err) {
      console.error('Error cargando programaciones:', err)
    } finally {
      setLoading(false)
    }
  }, [startDateStr, endDateStr, currentDate, loadDayAvance, loadUltimosReportes])

  useEffect(() => {
    fetchWeekData()
  }, [fetchWeekData])

  // Recargar datos automáticamente si el sistema auto-genera o actualiza una programación
  useEffect(() => {
    const handleAutoProgUpdated = (e) => {
      console.log('[PROGRAMACION] Evento de auto-programación detectado:', e.detail)
      fetchWeekData()
    }
    window.addEventListener('covepa-programacion-actualizada', handleAutoProgUpdated)
    return () => window.removeEventListener('covepa-programacion-actualizada', handleAutoProgUpdated)
  }, [fetchWeekData])

  // Pasar todas las observaciones que solicitan revisión a En Revisión con 1 clic
  const handlePasarTodasAEnRevision = async () => {
    if (batchRevisionLoading) return
    setBatchRevisionLoading(true)
    try {
      const nombreResponsable = resolverNombreAuditor(user, personalMember, 'Coordinador COVEPA')
      const res = await pasarTodasSolicitudesAEnRevision({
        nombre: nombreResponsable,
        email: user?.email,
        id: personalMember?.id_personal || user?.id
      })

      if (res.count > 0) {
        if (notificarPaseEnRevision) {
          await notificarPaseEnRevision(res)
        }
        await fetchWeekData()
      } else {
        if (notificarPaseEnRevision) {
          await notificarPaseEnRevision({ count: 0, items: [], codes: [] })
        }
        await fetchWeekData()
      }
    } catch (err) {
      console.error('[PROG-BATCH-REVISION] Error al pasar observaciones a En Revisión:', err)
      alert('No se pudo completar el pase a En Revisión: ' + (err.message || 'Error desconocido'))
    } finally {
      setBatchRevisionLoading(false)
    }
  }

  // Navegación de período (día en 'today', semana en 'week' / 'list')
  const prevPeriod = () => {
    const d = new Date(currentDate)
    if (viewMode === 'today') {
      d.setDate(d.getDate() - 1)
    } else {
      d.setDate(d.getDate() - 7)
    }
    setCurrentDate(d)
  }

  const nextPeriod = () => {
    const d = new Date(currentDate)
    if (viewMode === 'today') {
      d.setDate(d.getDate() + 1)
    } else {
      d.setDate(d.getDate() + 7)
    }
    setCurrentDate(d)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Eliminar programación
  const handleDeleteProg = async (idProg, e) => {
    e.stopPropagation()
    if (!window.confirm('¿Deseas eliminar esta programación de la jornada?')) return
    try {
      await deleteProgramacion(idProg)
      setProgramaciones(prev => prev.filter(p => p.id !== idProg))
    } catch (err) {
      alert('Error al eliminar programación: ' + err.message)
    }
  }

  // Medidores / Estadísticas de la semana (por estados operativos de observaciones en sitios de la semana)
  const weekStats = useMemo(() => {
    let totalObs = 0
    let validadas = 0
    let solicitando = 0
    let enRevision = 0
    let enviadas = 0
    let descartadas = 0
    let rechazadas = 0
    let pendientes = 0
    let documentacion = 0
    const weekSitesSet = new Set()

    programaciones.forEach(p => {
      ;(p.sitios || []).forEach(s => {
        if (!s.id_sitio) return
        const isAmex = String(s.id_sitio).toUpperCase().startsWith('AMEX')
        if (proyectoFilter === 'ORIGINAL' && isAmex) return
        if (proyectoFilter === 'AMPLIACION' && !isAmex) return

        if (!weekSitesSet.has(s.id_sitio)) {
          weekSitesSet.add(s.id_sitio)
          const stat = sitiosStats[s.id_sitio]
          if (stat) {
            totalObs += (stat.total || 0)
            validadas += (stat.validadas || 0)
            solicitando += (stat.solicitando || 0)
            enRevision += (stat.enRevision || 0)
            enviadas += (stat.enviadas || 0)
            descartadas += (stat.descartadas || 0)
            rechazadas += (stat.rechazadas || 0)
            pendientes += (stat.pendientes || 0)
            documentacion += (stat.documentacion || 0)
          }
        }
      })
    })

    return {
      totalObs,
      validadas,
      solicitando,
      enRevision,
      enviadas,
      descartadas,
      rechazadas,
      pendientes,
      documentacion,
      totalSitios: weekSitesSet.size
    }
  }, [programaciones, sitiosStats, proyectoFilter])

  // Estadísticas y datos específicos para la vista 'Hoy'
  const todayStats = useMemo(() => {
    const dateStr = toLocalDateString(currentDate)
    const progsRaw = programaciones.filter(p => p.fecha === dateStr)
    const progs = progsRaw
      .map(p => {
        let sitios = p.sitios || []
        if (proyectoFilter === 'ORIGINAL') {
          sitios = sitios.filter(s => !String(s.id_sitio || '').toUpperCase().startsWith('AMEX'))
        } else if (proyectoFilter === 'AMPLIACION') {
          sitios = sitios.filter(s => String(s.id_sitio || '').toUpperCase().startsWith('AMEX'))
        }
        return { ...p, sitios }
      })
      .filter(p => (p.sitios || []).length > 0)

    let totalObs = 0
    let resueltas = 0
    let validadas = 0
    let solicitando = 0
    let enRevision = 0
    let descartadas = 0
    let rechazadas = 0
    let pendientes = 0
    let documentacion = 0
    let totalPersonal = 0
    const sitiosSet = new Set()

    progs.forEach(p => {
      const team = p.equipo && p.equipo.length > 0 ? p.equipo : [p.personal || {}]
      team.forEach(m => {
        if (m.id || m.nombre_completo) totalPersonal++
      })
      ;(p.sitios || []).forEach(s => {
        if (s.id_sitio && !sitiosSet.has(s.id_sitio)) {
          sitiosSet.add(s.id_sitio)
          const stat = sitiosStats[s.id_sitio]
          if (stat) {
            totalObs += (stat.total || 0)
            validadas += (stat.validadas || 0)
            solicitando += (stat.solicitando || 0)
            enRevision += (stat.enRevision || 0)
            descartadas += (stat.descartadas || 0)
            rechazadas += (stat.rechazadas || 0)
            pendientes += (stat.pendientes || 0)
            documentacion += (stat.documentacion || 0)
            resueltas += (stat.validadas || stat.subsanadas || 0) + (stat.descartadas || 0) + (stat.rechazadas || 0)
          }
        }
      })
    })

    return {
      dateStr,
      totalProgs: progs.length,
      totalPersonal,
      totalSitios: sitiosSet.size,
      totalObs,
      resueltas,
      validadas,
      solicitando,
      enRevision,
      descartadas,
      rechazadas,
      pendientes,
      documentacion,
      progs
    }
  }, [programaciones, sitiosStats, currentDate, proyectoFilter])

  // Métricas del día filtradas por ámbito de proyecto ('ALL' | 'ORIGINAL' | 'AMPLIACION')
  const filteredDayAvanceStats = useMemo(() => {
    if (!dayAvance.rows || dayAvance.rows.length === 0) return dayAvance.stats || {}
    if (proyectoFilter === 'ALL') return dayAvance.stats || {}

    const isTarget = (siteId) => {
      const isAmex = String(siteId || '').toUpperCase().startsWith('AMEX')
      return proyectoFilter === 'AMPLIACION' ? isAmex : !isAmex
    }

    const filteredRows = dayAvance.rows.filter(r => isTarget(r.id_sitio))
    return {
      total: filteredRows.length,
      validadas: filteredRows.filter(r => r.estado === 'Validado' || r.estado === 'Enviado').length,
      rechazadas: filteredRows.filter(r => r.estado === 'Rechazado').length,
      enRevision: filteredRows.filter(r => r.estado === 'En Revisión' || r.estado === 'En Revision').length,
      solicitando: filteredRows.filter(r => r.estado === 'Solicitando Revisión' || r.estado === 'Solicitando Revision').length,
      documentacion: filteredRows.filter(r => r.estado === 'Documentación').length,
      prevalidadas: filteredRows.filter(r => r.estado === 'Pre-validado').length,
      criticas: filteredRows.filter(r => r.estado === 'Crítico').length,
      descartadas: filteredRows.filter(r => r.estado === 'Descartado').length,
    }
  }, [dayAvance.rows, dayAvance.stats, proyectoFilter])

  const solicitandoCount = viewMode === 'today' ? (filteredDayAvanceStats?.solicitando ?? 0) : (weekStats.solicitando ?? 0)

  // Helper para filtrar cualquier lista de programaciones por estado de observación y proyecto
  const filterProgsByStatus = useCallback((progsList) => {
    if (!progsList) return []

    // 1. Filtrar sitios según el proyecto seleccionado ('ALL' | 'ORIGINAL' | 'AMPLIACION')
    const mappedList = progsList
      .map(prog => {
        let sitios = prog.sitios || []
        if (proyectoFilter === 'ORIGINAL') {
          sitios = sitios.filter(s => !String(s.id_sitio || '').toUpperCase().startsWith('AMEX'))
        } else if (proyectoFilter === 'AMPLIACION') {
          sitios = sitios.filter(s => String(s.id_sitio || '').toUpperCase().startsWith('AMEX'))
        }
        return { ...prog, sitios }
      })
      .filter(prog => (prog.sitios || []).length > 0)

    if (statusFilter === 'ALL') return mappedList

    // 2. Sitios que tienen observaciones en el estado seleccionado para la fecha en revisión
    const matchingSites = new Set(
      (dayAvance.rows || [])
        .filter(r => {
          if (statusFilter === 'SOLICITANDO') return r.estado === 'Solicitando Revisión'
          if (statusFilter === 'EN_REVISION') return r.estado === 'En Revisión'
          if (statusFilter === 'VALIDADO') return r.estado === 'Validado' || r.estado === 'Enviado'
          if (statusFilter === 'RECHAZADO') return r.estado === 'Rechazado'
          if (statusFilter === 'DOCUMENTACION') return r.estado === 'Documentación'
          return false
        })
        .map(r => r.id_sitio)
    )

    return mappedList.filter(prog => {
      const sitios = prog.sitios || []
      return sitios.some(s => {
        if (matchingSites.has(s.id_sitio)) return true
        const stat = sitiosStats[s.id_sitio]
        if (!stat) return false
        if (statusFilter === 'SOLICITANDO') return (stat.solicitando || 0) > 0
        if (statusFilter === 'EN_REVISION') return (stat.enRevision || 0) > 0
        if (statusFilter === 'VALIDADO') return (stat.validadas || 0) > 0
        if (statusFilter === 'RECHAZADO') return (stat.rechazadas || 0) > 0
        if (statusFilter === 'DOCUMENTACION') return (stat.documentacion || 0) > 0
        return true
      })
    })
  }, [statusFilter, proyectoFilter, dayAvance.rows, sitiosStats])

  // Filtrado de cuadrillas de hoy según el estado seleccionado
  const filteredTodayProgs = useMemo(() => {
    return filterProgsByStatus(todayStats.progs)
  }, [todayStats.progs, filterProgsByStatus])

  // Función para agrupar cualquier lista de programaciones por técnico
  const groupProgsByTecnico = useCallback((list, statsMap = {}) => {
    const map = new Map()

    list.forEach(prog => {
      const team = prog.equipo && prog.equipo.length > 0 ? prog.equipo : [prog.personal || {}]

      // Encontrar el técnico responsable (o supervisor)
      const tec = team.find(m => {
        const c = (m.cargo || '').toUpperCase()
        return c.includes('TÉCN') || c.includes('TECN') || c.includes('SUPERVISOR')
      }) || (prog.personal?.nombre_completo ? prog.personal : team[0]) || {
        id: 'sin-asignar',
        nombre_completo: 'Técnico sin asignar',
        cargo: 'TÉCNICO',
        cuadrilla: null
      }

      const tecKey = tec.id || tec.nombre_completo || 'sin-id'

      if (!map.has(tecKey)) {
        const companions = team.filter(m => (m.id ? m.id !== tec.id : m.nombre_completo !== tec.nombre_completo))
        map.set(tecKey, {
          tecnico: tec,
          companions,
          cuadrilla: tec.cuadrilla || prog.personal?.cuadrilla || null,
          progs: [],
          sitios: [],
          sitiosSet: new Set(),
          totalObs: 0,
          solicitando: 0,
          validadas: 0,
          enRevision: 0,
          enviadas: 0,
          descartadas: 0,
          rechazadas: 0,
          pendientes: 0,
          resueltas: 0
        })
      }

      const group = map.get(tecKey)
      group.progs.push(prog)

      // Agregar acompañantes no duplicados
      const currentCompanions = team.filter(m => (m.id ? m.id !== tec.id : m.nombre_completo !== tec.nombre_completo))
      currentCompanions.forEach(comp => {
        if (!group.companions.some(c => (c.id ? c.id === comp.id : c.nombre_completo === comp.nombre_completo))) {
          group.companions.push(comp)
        }
      })

      // Agregar sitios y computar estadísticas
      ;(prog.sitios || []).forEach(s => {
        if (s.id_sitio && !group.sitiosSet.has(s.id_sitio)) {
          group.sitiosSet.add(s.id_sitio)
          const stat = statsMap[s.id_sitio] || {
            total: 0,
            solicitando: 0,
            validadas: 0,
            enRevision: 0,
            enviadas: 0,
            descartadas: 0,
            pendientes: 0,
            subsanadas: 0
          }

          group.sitios.push({
            ...s,
            programacion: prog,
            allSitios: prog.sitios,
            stat
          })

          group.totalObs += stat.total || 0
          group.solicitando += stat.solicitando || 0
          group.validadas += stat.validadas || 0
          group.enRevision += stat.enRevision || 0
          group.enviadas += stat.enviadas || 0
          group.descartadas += stat.descartadas || 0
          group.rechazadas = (group.rechazadas || 0) + (stat.rechazadas || 0)
          group.pendientes += stat.pendientes || 0
          group.resueltas += (stat.validadas || stat.subsanadas || 0) + (stat.descartadas || 0) + (stat.enviadas || 0)
        }
      })
    })

    return Array.from(map.values()).sort((a, b) => {
      if (a.cuadrilla && b.cuadrilla) return a.cuadrilla.localeCompare(b.cuadrilla)
      return (a.tecnico.nombre_completo || '').localeCompare(b.tecnico.nombre_completo || '')
    })
  }, [])

  // Búsqueda de observación en Supabase y verificación de intersección con la jornada activa
  const handleSearchObservation = useCallback(async (queryText, selectedObsItem = null) => {
    const q = (queryText || '').trim()
    if (!q || q.length < 2) {
      setSearchObsResult(null)
      setIsSearchingObs(false)
      return
    }

    setIsSearchingObs(true)
    try {
      let obsRecord = selectedObsItem
      let matches = []

      if (!obsRecord) {
        // Consultar Supabase en la tabla observaciones
        const { data, error } = await supabase
          .from('observaciones')
          .select('id_obs, id_sitio, protocolo, subsistema, detalle, estado_covepa, revisor, fecha_subsanacion')
          .ilike('id_obs', `%${q}%`)
          .limit(10)

        if (error) {
          console.error('Error buscando observación en Supabase:', error)
          setIsSearchingObs(false)
          return
        }

        matches = data || []
        if (matches.length === 0) {
          setSearchObsResult({
            status: 'NOT_FOUND',
            query: q,
            allMatches: []
          })
          setIsSearchingObs(false)
          return
        }

        // Si hay coincidencia exacta de código, priorizarla; de lo contrario tomar la primera
        obsRecord = matches.find(m => (m.id_obs || '').toUpperCase() === q.toUpperCase()) || matches[0]
      } else {
        matches = [obsRecord]
      }

      const siteId = obsRecord.id_sitio
      const siteObj = sitiosMap[siteId] || sitiosCatalogo.find(s => s.id_site === siteId) || {
        id_site: siteId,
        localidad: '',
        cuadrilla: '',
        grupo: ''
      }

      // Verificar si el sitio está programado para la fecha activa (currentDate)
      const activeDateStr = toLocalDateString(currentDate)
      const progToday = programaciones.find(p =>
        p.fecha === activeDateStr && (p.sitios || []).some(s => s.id_sitio === siteId)
      )

      // Identificar cuadrilla y técnico sugerido de base para el sitio
      let cuadrillaName = (siteObj.cuadrilla || siteObj.grupo || '').trim().toUpperCase().replace(/GRUPO/gi, 'CUADRILLA')
      let leadTecnico = null

      if (cuadrillaName && !cuadrillaName.includes('SIN CUADRILLA')) {
        const teamForCuad = tecnicos.filter(t => {
          const tCuad = (t.cuadrilla || '').trim().toUpperCase().replace(/GRUPO/gi, 'CUADRILLA')
          return tCuad === cuadrillaName
        })
        const leads = teamForCuad.filter(t => {
          const cargo = (t.cargo || '').toUpperCase()
          return (cargo.includes('TÉCN') || cargo.includes('TECN') || cargo.includes('SUPERVISOR')) && !cargo.includes('CONDUCTOR')
        })
        leadTecnico = leads[0] || teamForCuad.find(t => !(t.cargo || '').toUpperCase().includes('CONDUCTOR')) || teamForCuad[0] || null
      }

      if (progToday) {
        // Encontrado y programado hoy
        const progTeam = progToday.equipo && progToday.equipo.length > 0 ? progToday.equipo : [progToday.personal || {}]
        const assignedLead = progTeam.find(m => {
          const c = (m.cargo || '').toUpperCase()
          return c.includes('TÉCN') || c.includes('TECN') || c.includes('SUPERVISOR')
        }) || progToday.personal || progTeam[0]

        setSearchObsResult({
          status: 'SCHEDULED',
          obs: obsRecord,
          allMatches: matches,
          siteId,
          siteObj,
          prog: progToday,
          assignedLead,
          leadTecnico: assignedLead || leadTecnico,
          cuadrillaName: assignedLead?.cuadrilla || cuadrillaName
        })
      } else {
        // Encontrado pero NO programado hoy
        setSearchObsResult({
          status: 'NOT_SCHEDULED',
          obs: obsRecord,
          allMatches: matches,
          siteId,
          siteObj,
          leadTecnico,
          cuadrillaName
        })
      }
    } catch (err) {
      console.error('Error en búsqueda de observación:', err)
    } finally {
      setIsSearchingObs(false)
    }
  }, [sitiosMap, sitiosCatalogo, currentDate, programaciones, tecnicos])

  // Re-evaluar automáticamente si cambia la jornada activa o se actualizan las programaciones
  useEffect(() => {
    if (searchObsResult?.obs) {
      handleSearchObservation(searchObsQuery, searchObsResult.obs)
    }
  }, [currentDate, programaciones])

  const handleQueryChange = e => {
    const val = e.target.value
    setSearchObsQuery(val)
    if (searchObsTimeoutRef.current) {
      clearTimeout(searchObsTimeoutRef.current)
    }
    if (!val.trim()) {
      setSearchObsResult(null)
      return
    }
    searchObsTimeoutRef.current = setTimeout(() => {
      handleSearchObservation(val)
    }, 350)
  }

  const handleClearSearch = () => {
    setSearchObsQuery('')
    setSearchObsResult(null)
    if (searchObsTimeoutRef.current) {
      clearTimeout(searchObsTimeoutRef.current)
    }
  }

  // Agrupación de programaciones de hoy por técnico
  const todayByTecnicos = useMemo(() => {
    return groupProgsByTecnico(filteredTodayProgs, sitiosStats)
  }, [filteredTodayProgs, sitiosStats, groupProgsByTecnico])

  // Cuadrillas mostradas en Hoy: si hay una observación buscada y programada hoy, filtrar exclusivamente a esa cuadrilla/técnico
  const displayedTodayByTecnicos = useMemo(() => {
    if (searchObsResult?.status === 'SCHEDULED' && searchObsResult.siteId) {
      const match = todayByTecnicos.filter(item =>
        item.sitios.some(s => s.id_sitio === searchObsResult.siteId)
      )
      return match.length > 0 ? match : todayByTecnicos
    }
    return todayByTecnicos
  }, [todayByTecnicos, searchObsResult])

  return (
    <div className="prog-container">
      {/* ── MEDIDORES / KPIs Y FILTROS INTERACTIVOS SUPERIORES ── */}
      {(() => {
        const docCount = viewMode === 'today' ? (filteredDayAvanceStats?.documentacion ?? 0) : (weekStats.documentacion ?? 0)
        const showDoc = docCount > 0 || statusFilter === 'DOCUMENTACION'
        return (
          <MetricGrid columns={showDoc ? 5 : 4}>
            <MetricCard
              icon={<Clock size={20} />}
              label="Solicitando Revisión"
              value={solicitandoCount}
              subtitle={viewMode === 'today' ? 'esperando validación' : 'en la semana'}
              variant="orange"
              onClick={() => setStatusFilter(prev => prev === 'SOLICITANDO' ? 'ALL' : 'SOLICITANDO')}
              active={statusFilter === 'SOLICITANDO'}
              badge={statusFilter === 'SOLICITANDO' ? 'Filtrando' : null}
              loading={viewMode === 'today' && dayAvance.loading}
            />
            <MetricCard
              icon={<Search size={20} />}
              label="En Revisión"
              value={viewMode === 'today' ? (filteredDayAvanceStats?.enRevision ?? 0) : (weekStats.enRevision ?? 0)}
              subtitle={viewMode === 'today' ? 'en auditoría técnica' : 'en la semana'}
              variant="sky"
              onClick={() => setStatusFilter(prev => prev === 'EN_REVISION' ? 'ALL' : 'EN_REVISION')}
              active={statusFilter === 'EN_REVISION'}
              badge={statusFilter === 'EN_REVISION' ? 'Filtrando' : null}
              loading={viewMode === 'today' && dayAvance.loading}
            />
            <MetricCard
              icon={<CheckCircle2 size={20} />}
              label="Validados (Por Subir)"
              value={viewMode === 'today' ? (filteredDayAvanceStats?.validadas ?? 0) : (weekStats.validadas ?? 0)}
              subtitle={viewMode === 'today' ? 'listos para cargar' : 'en la semana'}
              variant="emerald"
              onClick={() => setStatusFilter(prev => prev === 'VALIDADO' ? 'ALL' : 'VALIDADO')}
              active={statusFilter === 'VALIDADO'}
              badge={statusFilter === 'VALIDADO' ? 'Filtrando' : null}
              loading={viewMode === 'today' && dayAvance.loading}
            />
            <MetricCard
              icon={<AlertTriangle size={20} />}
              label="Rechazadas"
              value={viewMode === 'today' ? (filteredDayAvanceStats?.rechazadas ?? 0) : (weekStats.rechazadas ?? 0)}
              subtitle={viewMode === 'today' ? 'observaciones rechazadas' : 'en la semana'}
              variant="rose"
              onClick={() => setStatusFilter(prev => prev === 'RECHAZADO' ? 'ALL' : 'RECHAZADO')}
              active={statusFilter === 'RECHAZADO'}
              badge={statusFilter === 'RECHAZADO' ? 'Filtrando' : null}
              loading={viewMode === 'today' && dayAvance.loading}
            />
            {showDoc && (
              <MetricCard
                icon={<FileText size={20} />}
                label="Documentación"
                value={docCount}
                subtitle={viewMode === 'today' ? 'en recopilación técnica' : 'en la semana'}
                variant="purple"
                onClick={() => setStatusFilter(prev => prev === 'DOCUMENTACION' ? 'ALL' : 'DOCUMENTACION')}
                active={statusFilter === 'DOCUMENTACION'}
                badge={statusFilter === 'DOCUMENTACION' ? 'Filtrando' : null}
                loading={viewMode === 'today' && dayAvance.loading}
              />
            )}
          </MetricGrid>
        )
      })()}

      {/* ── BARRA SUPERIOR INTEGRADA (Navegación de Fecha + Distribución + Selector de Vista + Acción) ── */}
      <div className="prog-toolbar">
        {/* Izquierda: Selector de Día / Semana */}
        <div className="prog-nav-group">
          <div className="prog-nav-btns-cluster">
            <button className="prog-btn-nav" onClick={prevPeriod} title={viewMode === 'today' ? 'Día anterior' : 'Semana anterior'}>
              <ChevronLeft size={16} />
            </button>
            <button className="prog-btn-nav" onClick={goToToday} title="Ir a hoy">
              Hoy
            </button>
            <button className="prog-btn-nav" onClick={nextPeriod} title={viewMode === 'today' ? 'Día siguiente' : 'Semana siguiente'}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="prog-nav-title">
            {viewMode === 'today' ? (
              <>
                <Clock size={16} style={{ color: '#0284c7', display: 'inline', marginRight: '6px', flexShrink: 0 }} />
                <span style={{ textTransform: 'capitalize' }}>
                  {currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {toLocalDateString(currentDate) === toLocalDateString(new Date()) && (
                  <span className="prog-badge-today">
                    HOY
                  </span>
                )}
              </>
            ) : (
              <>
                <CalendarDays size={16} style={{ color: '#003060', display: 'inline', marginRight: '6px', flexShrink: 0 }} />
                <span>
                  {weekDays[0].date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} –{' '}
                  {weekDays[6].date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </>
            )}
          </div>
          <button className="prog-btn-nav prog-btn-refresh" onClick={fetchWeekData} title="Refrescar datos">
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Derecha: Selector de Ámbito de Proyecto + Toggle Hoy / Semana + Botón Nueva Programación */}
        <div className="prog-toolbar-actions">
          {/* Selector de Ámbito de Proyecto: Todos / Original / Ampliación */}
          <div className="prog-proyecto-toggle" role="group" aria-label="Filtro de proyecto">
            <button
              type="button"
              className={`prog-proj-btn ${proyectoFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setProyectoFilter('ALL')}
              title="Ver todo el proyecto consolidado (Original + Ampliación)"
            >
              <Globe size={13} />
              <span>Todos</span>
            </button>
            <button
              type="button"
              className={`prog-proj-btn ${proyectoFilter === 'ORIGINAL' ? 'active' : ''}`}
              onClick={() => setProyectoFilter('ORIGINAL')}
              title="Filtrar solo Amazonas Original (sitios AM-...)"
            >
              <span>Original</span>
            </button>
            <button
              type="button"
              className={`prog-proj-btn ${proyectoFilter === 'AMPLIACION' ? 'active' : ''}`}
              onClick={() => setProyectoFilter('AMPLIACION')}
              title="Filtrar solo Amazonas Ampliación (sitios AMEX-...)"
            >
              <span>Ampliación</span>
            </button>
          </div>

          <div className="prog-views-toggle">
            <button
              className={`prog-view-btn ${viewMode === 'today' ? 'active' : ''}`}
              onClick={() => {
                goToToday()
                setViewMode('today')
              }}
            >
              <Clock size={13} />
              Hoy
            </button>
            <button
              className={`prog-view-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              <CalendarDays size={13} />
              Semana
            </button>
          </div>

          <button
            type="button"
            className="prog-btn-avance"
            onClick={() => setModalAvanceOpen(true)}
            title="Ver el avance diario de observaciones y revisiones técnicas del día seleccionado"
          >
            <TrendingUp size={15} />
            <span>Avance del Día</span>
          </button>

          {/* Botón Pasar a En Revisión con 1 Clic */}
          {!isReadOnly && (
            <button
              type="button"
              className={`prog-btn-revision ${solicitandoCount === 0 ? 'is-empty' : ''}`}
              onClick={handlePasarTodasAEnRevision}
              disabled={batchRevisionLoading}
              title={
                solicitandoCount > 0
                  ? `Pasar las ${solicitandoCount} observaciones en espera a 'En Revisión'`
                  : 'Pasar observaciones solicitando revisión a En Revisión'
              }
            >
              {batchRevisionLoading ? (
                <RefreshCw size={14} className="spinning" />
              ) : (
                <CheckCheck size={14} />
              )}
              <span>{batchRevisionLoading ? 'Procesando...' : 'Pasar a En Revisión'}</span>
              <span className="prog-btn-revision-badge">{solicitandoCount}</span>
            </button>
          )}

          {canEditProgramacion && (
            <button
              className="prog-btn-create"
              onClick={() => {
                setModalNewDate(toLocalDateString(currentDate))
                setModalNewOpen(true)
              }}
            >
              <Plus size={15} />
              Nueva Programación
            </button>
          )}
        </div>
      </div>

      {/* ── BUSCADOR DE OBSERVACIÓN E INTERSECCIÓN OPERATIVA ── */}
      <div className="prog-obs-search-section">
        <div className="prog-obs-search-bar">
          <Search size={17} className="prog-obs-search-icon" />
          <input
            type="text"
            className="prog-obs-search-input"
            placeholder="Buscar por código de observación (ej: H1-OC-100-242, C-4175) para ubicar cuadrilla y sitio..."
            value={searchObsQuery}
            onChange={handleQueryChange}
          />
          {isSearchingObs && (
            <RefreshCw size={15} className="spin" style={{ color: '#0284c7', marginRight: '8px' }} />
          )}
          {searchObsQuery && (
            <button
              type="button"
              className="prog-obs-search-clear-btn"
              onClick={handleClearSearch}
              title="Limpiar búsqueda"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Coincidencias múltiples encontradas (Chips rápidos) */}
        {searchObsResult?.allMatches && searchObsResult.allMatches.length > 1 && (
          <div className="prog-obs-matches-chips">
            <span className="prog-obs-matches-label">
              Coincidencias ({searchObsResult.allMatches.length}):
            </span>
            {searchObsResult.allMatches.map(m => {
              const isSelected = searchObsResult.obs?.id_obs === m.id_obs
              return (
                <button
                  key={m.id_obs}
                  type="button"
                  className={`prog-obs-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSearchObservation(m.id_obs, m)}
                >
                  <span>{m.id_obs}</span>
                  <span className="prog-obs-chip-site">({m.id_sitio})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* BANNER 1: Observación programada para hoy */}
        {searchObsResult?.status === 'SCHEDULED' && (
          <div className="prog-obs-result-banner scheduled">
            <div className="prog-obs-result-left">
              <div className="prog-obs-result-icon">
                <CheckCircle2 size={20} />
              </div>
              <div className="prog-obs-result-info">
                <div className="prog-obs-result-title">
                  <strong>Observación {searchObsResult.obs.id_obs}</strong> programada hoy en{' '}
                  <span className="prog-obs-code-highlight">
                    {searchObsResult.siteId}
                  </span>
                  {searchObsResult.siteObj?.localidad ? ` · ${searchObsResult.siteObj.localidad}` : ''}
                </div>
                <div className="prog-obs-result-sub">
                  Asignada a: <strong>{searchObsResult.assignedLead?.nombre_completo || 'Técnico asignado'}</strong>
                  {searchObsResult.cuadrillaName ? ` (${searchObsResult.cuadrillaName})` : ''} ·
                  Estado COVEPA: <strong>{searchObsResult.obs.estado_covepa || 'Pendiente'}</strong>
                  {searchObsResult.obs.detalle ? ` · ${searchObsResult.obs.detalle.slice(0, 75)}...` : ''}
                </div>
              </div>
            </div>
            <div className="prog-obs-result-actions">
              <button
                type="button"
                className="prog-obs-action-btn-primary"
                onClick={() => setSelectedProgModal({
                  id_sitio: searchObsResult.siteId,
                  programacion: searchObsResult.prog,
                  allSitios: searchObsResult.prog?.sitios || []
                })}
              >
                <Eye size={14} />
                <span>Ver Detalles del Sitio</span>
              </button>
              <button
                type="button"
                className="prog-obs-action-btn-secondary"
                onClick={handleClearSearch}
              >
                <X size={14} />
                <span>Quitar Filtro</span>
              </button>
            </div>
          </div>
        )}

        {/* BANNER 2: Observación NO programada para hoy */}
        {searchObsResult?.status === 'NOT_SCHEDULED' && (
          <div className="prog-obs-result-banner not-scheduled">
            <div className="prog-obs-result-left">
              <div className="prog-obs-result-icon">
                <AlertCircle size={20} />
              </div>
              <div className="prog-obs-result-info">
                <div className="prog-obs-result-title">
                  <strong>Observación {searchObsResult.obs.id_obs}</strong> pertenece al sitio{' '}
                  <span className="prog-obs-code-highlight">
                    {searchObsResult.siteId}
                  </span>
                  {searchObsResult.siteObj?.localidad ? ` · ${searchObsResult.siteObj.localidad}` : ''}
                </div>
                <div className="prog-obs-result-sub">
                  Este sitio <strong>NO está programado para hoy</strong> ({currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}).
                  {searchObsResult.cuadrillaName ? ` Cuadrilla base: ${searchObsResult.cuadrillaName}` : ''}
                  {searchObsResult.leadTecnico ? ` · Técnico sugerido: ${searchObsResult.leadTecnico.nombre_completo}` : ''}
                </div>
              </div>
            </div>
            <div className="prog-obs-result-actions">
              <button
                type="button"
                className="prog-obs-action-btn-create"
                onClick={() => {
                  setModalNewInitialSite(searchObsResult.siteId)
                  setModalNewDate(toLocalDateString(currentDate))
                  setModalNewOpen(true)
                }}
              >
                <Plus size={14} />
                <span>Programar Sitio para Hoy</span>
              </button>
              <button
                type="button"
                className="prog-obs-action-btn-secondary"
                onClick={handleClearSearch}
              >
                <X size={14} />
                <span>Cerrar</span>
              </button>
            </div>
          </div>
        )}

        {/* BANNER 3: Observación NO encontrada en la base de datos */}
        {searchObsResult?.status === 'NOT_FOUND' && (
          <div className="prog-obs-result-banner not-found">
            <div className="prog-obs-result-left">
              <div className="prog-obs-result-icon">
                <Search size={18} />
              </div>
              <div className="prog-obs-result-info">
                <div className="prog-obs-result-title">
                  No se encontró ninguna observación con el código "<strong>{searchObsResult.query}</strong>"
                </div>
                <div className="prog-obs-result-sub">
                  Verifica que el código esté bien escrito o prueba con los últimos dígitos (ej: 100-242).
                </div>
              </div>
            </div>
            <div className="prog-obs-result-actions">
              <button
                type="button"
                className="prog-obs-action-btn-secondary"
                onClick={handleClearSearch}
              >
                <X size={14} />
                <span>Limpiar</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── CONTENIDO PRINCIPAL: VISTA HOY ── */}
      {viewMode === 'today' && (
        <div className="prog-today-container">
          {/* Indicador de filtro activo si se seleccionó un medidor específico o ámbito de proyecto */}
          {(statusFilter !== 'ALL' || proyectoFilter !== 'ALL') && (
            <div className="prog-filter-notice-banner">
              <span>
                {proyectoFilter !== 'ALL' && (
                  <strong style={{ marginRight: '6px' }}>
                    Ámbito: {proyectoFilter === 'AMPLIACION' ? '🚀 Amazonas Ampliación (AMEX)' : '🏛️ Amazonas Original (AM)'}
                    {statusFilter !== 'ALL' ? ' · ' : ''}
                  </strong>
                )}
                {statusFilter !== 'ALL' && (
                  <>
                    Filtrando cuadrillas con observaciones en estado: <strong>{
                      statusFilter === 'SOLICITANDO' ? 'Solicitando Revisión' :
                      statusFilter === 'EN_REVISION' ? 'En Revisión' :
                      statusFilter === 'VALIDADO' ? 'Validados (Por subir)' :
                      statusFilter === 'RECHAZADO' ? 'Rechazadas' :
                      statusFilter
                    }</strong>
                  </>
                )}
              </span>
              <button
                type="button"
                className="prog-filter-notice-btn"
                onClick={() => {
                  setStatusFilter('ALL')
                  setProyectoFilter('ALL')
                }}
              >
                ✕ Limpiar Filtros
              </button>
            </div>
          )}

          {/* Tarjetas de cuadrillas programadas hoy */}
          {filteredTodayProgs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.8rem'
              }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={24} color="#003060" />
              </div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                {statusFilter !== 'ALL'
                  ? 'No hay cuadrillas con ese estado específico para esta fecha'
                  : 'No hay cuadrillas programadas para esta fecha'}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: '#64748b', maxWidth: '440px', lineHeight: 1.5 }}>
                {statusFilter !== 'ALL'
                  ? 'Prueba seleccionando "Todas" para ver el total de las rutas y cuadrillas del día.'
                  : 'Organiza las salidas del personal y asigna los sitios a visitar para mantener el avance de observaciones al día.'}
              </div>
              {statusFilter !== 'ALL' ? (
                <button
                  className="prog-btn-create"
                  onClick={() => setStatusFilter('ALL')}
                  style={{ marginTop: '0.5rem' }}
                >
                  Ver Todas las Cuadrillas
                </button>
              ) : (
                <button
                  className="prog-btn-create"
                  onClick={() => {
                    setModalNewDate(toLocalDateString(currentDate))
                    setModalNewOpen(true)
                  }}
                  style={{ marginTop: '0.5rem' }}
                >
                  <Plus size={15} />
                  Programar Cuadrilla Ahora
                </button>
              )}
            </div>
          ) : (
            /* ── DISEÑO POR TÉCNICOS (COMPACTO Y SCROLL INDEPENDIENTE) ── */
            <div className="prog-tech-list-wrap">
              {displayedTodayByTecnicos.map(tGroup => {
                const tec = tGroup.tecnico
                const pDonePct = tGroup.totalObs > 0 ? (tGroup.resueltas / tGroup.totalObs) * 100 : 0

                return (
                  <div key={tec.id || tec.nombre_completo} className="prog-tech-compact-row">
                    {/* Fila superior: Perfil esencial del Técnico y Resumen */}
                    <div className="prog-tech-main-bar">
                      <div className="prog-tech-person-info">
                        <div className="prog-tech-avatar-sm">
                          {presentationMode
                            ? (tGroup.cuadrilla ? tGroup.cuadrilla.replace(/CUADRILLA\s*/i, 'C') : 'CP')
                            : getInitials(tec.nombre_completo)}
                        </div>
                        <div className="prog-tech-details">
                          <div className="prog-tech-title-line">
                            {!presentationMode && (
                              <span className="prog-tech-name-text">{tec.nombre_completo || 'Técnico sin asignar'}</span>
                            )}
                            {tGroup.cuadrilla ? (
                              <span className="prog-card-cuadrilla-badge">
                                {tGroup.cuadrilla}
                              </span>
                            ) : (
                              <span className="prog-cuadrilla-badge-rotativo">
                                Apoyo
                              </span>
                            )}
                            {!presentationMode && tGroup.companions.length > 0 && (
                              <span
                                className="prog-tech-comp-pill"
                                title={tGroup.companions.map(c => `${c.cargo ? `${c.cargo}: ` : ''}${c.nombre_completo}`).join(' · ')}
                              >
                                👥 {tGroup.companions.map(c => c.nombre_completo).join(' · ')}
                              </span>
                            )}
                            {/* Píldora de Última Solicitud de Revisión / Reporte al lado de Actividad */}
                            {(() => {
                              const ultRep = getUltimoReporteTecnico(tGroup)
                              const isRecent = ultRep?.ts ? (new Date() - new Date(ultRep.ts)) < 45 * 60 * 1000 : false

                              if (ultRep && ultRep.isSolicitud) {
                                return (
                                  <span
                                    className={`prog-tech-last-report-pill is-solicitud ${isRecent ? 'is-recent' : ''}`}
                                    title={`Última solicitud de revisión registrada a las ${ultRep.hora}${ultRep.obs ? ` (Obs: ${ultRep.obs})` : ''}${ultRep.user ? ` · ${ultRep.user}` : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenTimelineTecnico(tec, tGroup)
                                    }}
                                  >
                                    <span className="last-report-dot is-solicitud" />
                                    <span className="last-report-label">Últ. solicitud de revisión:</span>
                                    <strong className="last-report-time">{ultRep.timeAgo}</strong>
                                    <span className="last-report-hour">· {ultRep.hora}</span>
                                  </span>
                                )
                              }

                              if (ultRep) {
                                return (
                                  <span
                                    className={`prog-tech-last-report-pill ${isRecent ? 'is-recent' : ''}`}
                                    title={`Última actividad registrada a las ${ultRep.hora}${ultRep.obs ? ` (Obs: ${ultRep.obs})` : ''}${ultRep.user ? ` · ${ultRep.user}` : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenTimelineTecnico(tec, tGroup)
                                    }}
                                  >
                                    <span className="last-report-dot" />
                                    <span className="last-report-label">Últ. actividad:</span>
                                    <strong className="last-report-time">{ultRep.timeAgo}</strong>
                                    <span className="last-report-hour">· {ultRep.hora}</span>
                                  </span>
                                )
                              }

                              return (
                                <span
                                  className="prog-tech-last-report-pill empty"
                                  title="Sin solicitudes de revisión registradas para la fecha seleccionada"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenTimelineTecnico(tec, tGroup)
                                  }}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <span className="last-report-dot empty" />
                                  <span className="last-report-label">Sin solicitudes de revisión hoy</span>
                                </span>
                              )
                            })()}

                            {/* Botón para ver Línea de Actividad Horizontal */}
                            <button
                              type="button"
                              className="prog-tech-timeline-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenTimelineTecnico(tec, tGroup)
                              }}
                              title="Ver línea de actividad horizontal y solicitudes de validación de este técnico"
                            >
                              <Clock size={11} />
                              <span>Actividad</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Resumen numérico esencial del técnico */}
                      <div className="prog-tech-summary-pill">
                        <span className="prog-tech-sum-sites">
                          <strong>{tGroup.sitios.length}</strong> {tGroup.sitios.length === 1 ? 'sitio' : 'sitios'}
                        </span>
                        <span className="prog-tech-sum-sep">•</span>
                        <span
                          className="prog-tech-sum-obs"
                          style={{
                            color: tGroup.resueltas === tGroup.totalObs && tGroup.totalObs > 0 ? '#059669' : '#003060'
                          }}
                        >
                          <strong>{tGroup.resueltas}/{tGroup.totalObs}</strong> resueltas
                          {tGroup.totalObs > 0 && (
                            <span className="prog-tech-sum-pct">
                              ({Math.round((tGroup.resueltas / tGroup.totalObs) * 100)}%)
                            </span>
                          )}
                        </span>

                        {tGroup.solicitando > 0 && (
                          <span
                            className="site-pill-badge badge-sol"
                            title={`${tGroup.solicitando} observación(es) solicitando revisión de este técnico`}
                          >
                            ⏳ {tGroup.solicitando} sol.
                          </span>
                        )}
                        {tGroup.enRevision > 0 && (
                          <span
                            className="site-pill-badge badge-rev"
                            title={`${tGroup.enRevision} observación(es) en revisión de este técnico`}
                          >
                            🔍 {tGroup.enRevision} rev.
                          </span>
                        )}
                        {tGroup.validadas > 0 && (
                          <span
                            className="site-pill-badge badge-subir"
                            title={`${tGroup.validadas} observación(es) validadas (listas por subir)`}
                          >
                            ✓ {tGroup.validadas} por subir
                          </span>
                        )}

                        <div className="prog-tech-mini-prog-track" title={`Avance: ${pDonePct.toFixed(0)}%`}>
                          <div
                            className="prog-tech-mini-prog-fill"
                            style={{
                              width: `${pDonePct}%`,
                              background: tGroup.resueltas === tGroup.totalObs && tGroup.totalObs > 0 ? '#10b981' : '#0284c7'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Fila inferior: Sitios asignados como tarjetas de 2 filas interactivas */}
                    <div className="prog-tech-sites-strip">
                      {tGroup.sitios.map(siteItem => {
                        const sStat = siteItem.stat
                        const sDone = (sStat.validadas || 0) + (sStat.descartadas || 0) + (sStat.enviadas || 0)
                        const isComplete = sDone === sStat.total && sStat.total > 0
                        const localidad = sitiosMap[siteItem.id_sitio]?.localidad

                        const isMatchObs = searchObsResult?.siteId === siteItem.id_sitio
                        return (
                          <div
                            key={siteItem.id_sitio}
                            className={`prog-site-2row-card ${isComplete ? 'is-complete' : ''} ${isMatchObs ? 'is-searched-match' : ''}`}
                            onClick={() => setSelectedProgModal({ id_sitio: siteItem.id_sitio, programacion: siteItem.programacion, allSitios: siteItem.allSitios })}
                            title="Clic para ver detalle y observaciones en el modal"
                          >
                            {/* Fila 1: Código de Sitio y Localidad */}
                            <div className="site-2row-top">
                              <MapPin size={13} className="site-2row-pin" />
                              <span className="site-2row-code">{siteItem.id_sitio}</span>
                              {localidad && (
                                <span className="site-2row-loc">· {localidad}</span>
                              )}
                            </div>

                            {/* Fila 2: Cantidades de observaciones y estados */}
                            <div className="site-2row-bottom">
                              <span className={`site-2row-count ${isComplete ? 'complete' : ''}`} title="Total resueltas del sitio">
                                {sDone}/{sStat.total} resueltas
                              </span>

                              {sStat.solicitando > 0 && (
                                <span
                                  className="site-pill-badge badge-sol"
                                  title={`${sStat.solicitando} observación(es) solicitando revisión`}
                                >
                                  ⏳ {sStat.solicitando} sol.
                                </span>
                              )}
                              {sStat.enRevision > 0 && (
                                <span
                                  className="site-pill-badge badge-rev"
                                  title={`${sStat.enRevision} observación(es) en revisión`}
                                >
                                  🔍 {sStat.enRevision} rev.
                                </span>
                              )}
                              {sStat.validadas > 0 && (
                                <span
                                  className="site-pill-badge badge-subir"
                                  title={`${sStat.validadas} observación(es) listas por subir`}
                                >
                                  ✓ {sStat.validadas} por subir
                                </span>
                              )}
                              {sStat.rechazadas > 0 && (
                                <span
                                  className="site-pill-badge badge-rech"
                                  title={`${sStat.rechazadas} observación(es) rechazadas`}
                                >
                                  ✕ {sStat.rechazadas} rech.
                                </span>
                              )}
                              {sStat.enviadas > 0 && (
                                <span
                                  className="site-pill-badge badge-env"
                                  title={`${sStat.enviadas} observación(es) enviadas a Covepa`}
                                >
                                  ✉ {sStat.enviadas} env.
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CONTENIDO PRINCIPAL: VISTA SEMANA ── */}
      {viewMode === 'week' && (
        <div className="prog-week-wrap">
          {/* Indicador de filtro activo si se seleccionó un medidor específico o ámbito de proyecto en la semana */}
          {(statusFilter !== 'ALL' || proyectoFilter !== 'ALL') && (
            <div className="prog-filter-notice-banner" style={{ marginBottom: '0.85rem' }}>
              <span>
                {proyectoFilter !== 'ALL' && (
                  <strong style={{ marginRight: '6px' }}>
                    Ámbito: {proyectoFilter === 'AMPLIACION' ? '🚀 Amazonas Ampliación (AMEX)' : '🏛️ Amazonas Original (AM)'}
                    {statusFilter !== 'ALL' ? ' · ' : ''}
                  </strong>
                )}
                {statusFilter !== 'ALL' && (
                  <>
                    Filtrando cuadrillas con observaciones en estado: <strong>{
                      statusFilter === 'SOLICITANDO' ? 'Solicitando Revisión' :
                      statusFilter === 'EN_REVISION' ? 'En Revisión' :
                      statusFilter === 'VALIDADO' ? 'Validados (Por subir)' :
                      statusFilter === 'ENVIADO' ? 'Enviados por COVEPA' :
                      statusFilter === 'RECHAZADO' ? 'Rechazadas' :
                      statusFilter
                    }</strong>
                  </>
                )}
              </span>
              <button
                type="button"
                className="prog-filter-notice-btn"
                onClick={() => {
                  setStatusFilter('ALL')
                  setProyectoFilter('ALL')
                }}
              >
                ✕ Limpiar Filtros
              </button>
            </div>
          )}

          <div className="prog-week-grid">
            {weekDays.map(day => {
              const dayProgs = programaciones.filter(p => p.fecha === day.dateStr)
              const filteredDayProgs = filterProgsByStatus(dayProgs)
              const dayTecnicos = groupProgsByTecnico(filteredDayProgs, sitiosStats)

              return (
                <div key={day.dateStr} className={`prog-day-col ${day.isToday ? 'is-today' : ''}`}>
                  <div className="prog-day-header">
                    <span className="prog-day-name">{day.dayName}</span>
                    <span className="prog-day-number">{day.dayNum}</span>
                  </div>

                  <div className="prog-day-body">
                    {dayTecnicos.map(tDay => {
                      const tec = tDay.tecnico

                      return (
                        <div key={tec.id || tec.nombre_completo} className="prog-week-tech-card">
                          {/* Cabecera del Técnico: Solo Nombre y Cuadrilla */}
                          <div className="week-tech-header">
                            <div className="week-tech-avatar">
                              {presentationMode
                                ? (tDay.cuadrilla ? tDay.cuadrilla.replace(/CUADRILLA\s*/i, 'C') : 'CP')
                                : getInitials(tec.nombre_completo)}
                            </div>
                            <div className="week-tech-info">
                              {!presentationMode && (
                                <span className="week-tech-name" title={tec.nombre_completo}>
                                  {tec.nombre_completo || 'Sin asignar'}
                                </span>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                {tDay.cuadrilla && (
                                  <span className="week-tech-badge">{tDay.cuadrilla}</span>
                                )}
                                {(() => {
                                  const ultRep = getUltimoReporteTecnico(tDay)
                                  if (!ultRep) return null
                                  const isSol = ultRep.isSolicitud
                                  return (
                                    <span
                                      className={`week-tech-last-report-mini ${isSol ? 'is-solicitud' : ''}`}
                                      title={`${isSol ? 'Última solicitud de revisión' : 'Última actividad'}: ${ultRep.timeAgo} (${ultRep.hora})`}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenTimelineTecnico(tec, tDay, day.dateStr)
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      {isSol ? `Sol: ${ultRep.timeAgo}` : ultRep.timeAgo}
                                    </span>
                                  )
                                })()}
                                <button
                                  type="button"
                                  className="week-tech-timeline-mini-btn"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenTimelineTecnico(tec, tDay, day.dateStr)
                                  }}
                                  title={`Ver actividad y validaciones de ${tec.nombre_completo || 'este técnico'} el ${day.dateStr}`}
                                >
                                  <Clock size={11} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Sitios asignados: Solo Código de Sitio y Nombre/Localidad */}
                          <div className="week-tech-sites">
                            {tDay.sitios.map(sItem => {
                              const localidad = sitiosMap[sItem.id_sitio]?.localidad

                              const isMatchObs = searchObsResult?.siteId === sItem.id_sitio
                              return (
                                <div
                                  key={sItem.id_sitio}
                                  className={`week-site-pill ${isMatchObs ? 'is-searched-match' : ''}`}
                                  onClick={() => setSelectedProgModal({ id_sitio: sItem.id_sitio, programacion: sItem.programacion, allSitios: sItem.allSitios })}
                                  title="Clic para ver detalle y observaciones"
                                >
                                  <MapPin size={11} className="week-site-pin" />
                                  <span className="week-site-code">{sItem.id_sitio}</span>
                                  {localidad && (
                                    <span className="week-site-loc">· {localidad}</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}

                    {/* Botón para programar directamente en este día */}
                    {canEditProgramacion && (
                      <div
                        className="prog-empty-slot"
                        onClick={() => {
                          setModalNewDate(day.dateStr)
                          setModalNewOpen(true)
                        }}
                        title="Programar una nueva cuadrilla en este día"
                      >
                        <Plus size={13} />
                        <span>Programar</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MODAL: PROGRAMACIÓN (CREAR O EDITAR) ── */}
      {(modalNewOpen || editingProg) && (
        <ModalProgramacionForm
          initialDate={modalNewDate}
          editingProg={editingProg}
          initialSiteId={modalNewInitialSite}
          tecnicos={tecnicos}
          programacionesExistentes={programaciones}
          onClose={() => {
            setModalNewOpen(false)
            setEditingProg(null)
            setModalNewInitialSite(null)
          }}
          onSaved={() => {
            setModalNewOpen(false)
            setEditingProg(null)
            setModalNewInitialSite(null)
            fetchWeekData()
          }}
        />
      )}

      {/* ── VENTANA EMERGENTE CENTRADA: DETALLES, OBSERVACIONES Y AUTOGUARDADO ── */}
      {selectedProgModal && (
        <ModalDetallesProgramacion
          sitioId={selectedProgModal.id_sitio}
          prog={selectedProgModal.programacion}
          allSitios={selectedProgModal.allSitios || selectedProgModal.programacion?.sitios || []}
          tecnicos={tecnicos}
          sitiosMap={sitiosMap}
          onClose={() => setSelectedProgModal(null)}
          onEditProg={progToEdit => {
            setSelectedProgModal(null)
            setEditingProg(progToEdit)
          }}
          onDeleteProg={async progId => {
            setSelectedProgModal(null)
            await handleDeleteProg(progId)
          }}
          onObservationUpdated={() => {
            // Refrescar conteos de observaciones y avances
            fetchWeekData()
            loadDayAvance(currentDate)
          }}
        />
      )}

      {/* Modal de Avance del Día (Dashboard integrado en Programación) */}
      {modalAvanceOpen && (
        <ModalAvanceDia
          fecha={toLocalDateString(currentDate)}
          sitiosMap={sitiosMap}
          initialProyecto={proyectoFilter}
          onClose={() => setModalAvanceOpen(false)}
        />
      )}

      {/* Modal de Línea de Actividad y Solicitudes de Validación (Horizontal) */}
      {selectedTimelineTecnico && (
        <ModalTimelineTecnico
          tecnico={selectedTimelineTecnico.tecnico}
          cuadrilla={selectedTimelineTecnico.cuadrilla}
          fecha={selectedTimelineTecnico.fecha}
          siteIds={selectedTimelineTecnico.siteIds}
          onClose={() => setSelectedTimelineTecnico(null)}
          onOpenObservationDetail={(event) => {
            setSelectedProgModal({
              id_sitio: event.id_sitio,
              programacion: null,
              allSitios: null,
              initialObsId: event.id_obs
            })
          }}
        />
      )}
    </div>
  )
}
