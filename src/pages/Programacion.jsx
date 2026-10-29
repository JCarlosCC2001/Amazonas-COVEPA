import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Trash2,
  MapPin, CheckCircle2, Clock, AlertCircle, List,
  CalendarDays, X, Search, RefreshCw, Eye, ShieldCheck,
  Check, AlertTriangle, Users, Edit3, User, FileSpreadsheet, Download, Send,
  TrendingUp, History
} from 'lucide-react'
// M3: ExcelJS se importa dinámicamente en handleExportXLSX para no inflar el bundle inicial
import ModalAvanceDia from '../components/programacion/ModalAvanceDia'
import ModalTimelineTecnico from '../components/programacion/ModalTimelineTecnico'
import HistorialEstadosTimeline from '../components/shared/HistorialEstadosTimeline'
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
import { updateObservacionCovepa, sincronizarEstadoConControlFotos, esRevisorGilat } from '../services/observacionesService'
import {
  sincronizarAuditoriaObservacion,
  sincronizarComentarioObservacion,
  sincronizarJustificacionDemora,
  resolverNombreAuditor
} from '../services/auditoriaSyncService'
import { ASIGNACIONES_BASE, getCachedSitiosAsignados } from '../services/sitiosService'
import { useAuth } from '../hooks/useAuth'
import { usePresentationMode } from '../context/PresentationContext'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'
import { hasMeaningfulText, toLocalDateString, getInitials, getCargoClass } from '../utils/helpers'
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
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('today') // 'today' | 'week'
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'SOLICITANDO' | 'EN_REVISION' | 'VALIDADO' | 'RECHAZADO'
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
    loadDayAvance(currentDate)
    loadUltimosReportes(currentDate)
  }, [currentDate, loadDayAvance, loadUltimosReportes])

  // Refrescar automáticamente los minutos relativos cada 60 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      loadUltimosReportes(currentDate)
    }, 60000)
    return () => clearInterval(timer)
  }, [currentDate, loadUltimosReportes])

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
    let latestGeneral = null

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
      const solCuad = ultimosReportes.byCuadrillaSolicitud[tGroup.cuadrilla]
      if (solCuad) latestSolicitud = { ...solCuad, isSolicitud: true }
    }

    if (latestSolicitud) return latestSolicitud

    // 2. Si no hay solicitudes hoy, buscar cualquier reporte general
    ;(tGroup?.sitios || []).forEach(s => {
      const rep = ultimosReportes.bySite?.[s.id_sitio]
      if (rep && (!latestGeneral || new Date(rep.ts) > new Date(latestGeneral.ts))) {
        latestGeneral = { ...rep, isSolicitud: false }
      }
    })

    if (tecName && ultimosReportes.byUser) {
      const repUser = ultimosReportes.byUser[tecName] ||
        Object.entries(ultimosReportes.byUser).find(([name]) => name.includes(tecName) || tecName.includes(name))?.[1]
      if (repUser && (!latestGeneral || new Date(repUser.ts) > new Date(latestGeneral.ts))) {
        latestGeneral = { ...repUser, isSolicitud: false }
      }
    }

    if (!latestGeneral && tGroup?.cuadrilla && ultimosReportes.byCuadrilla) {
      const repCuad = ultimosReportes.byCuadrilla[tGroup.cuadrilla]
      if (repCuad) latestGeneral = { ...repCuad, isSolicitud: false }
    }

    return latestGeneral
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
      const allSites = []
      progs.forEach(p => {
        ;(p.sitios || []).forEach(s => {
          if (s.id_sitio) allSites.push(s.id_sitio)
        })
      })

      if (allSites.length > 0) {
        const stats = await getSitiosObservacionesResumen(allSites)
        setSitiosStats(stats)
      } else {
        setSitiosStats({})
      }
      loadDayAvance(currentDate)
    } catch (err) {
      console.error('Error cargando programaciones:', err)
    } finally {
      setLoading(false)
    }
  }, [startDateStr, endDateStr, currentDate, loadDayAvance])

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
    const weekSitesSet = new Set()

    programaciones.forEach(p => {
      ;(p.sitios || []).forEach(s => {
        if (s.id_sitio && !weekSitesSet.has(s.id_sitio)) {
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
      totalSitios: weekSitesSet.size
    }
  }, [programaciones, sitiosStats])

  // Estadísticas y datos específicos para la vista 'Hoy'
  const todayStats = useMemo(() => {
    const dateStr = toLocalDateString(currentDate)
    const progs = programaciones.filter(p => p.fecha === dateStr)

    let totalObs = 0
    let resueltas = 0
    let validadas = 0
    let solicitando = 0
    let enRevision = 0
    let descartadas = 0
    let rechazadas = 0
    let pendientes = 0
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
      progs
    }
  }, [programaciones, sitiosStats, currentDate])

  // Helper para filtrar cualquier lista de programaciones por estado de observación
  const filterProgsByStatus = useCallback((progsList) => {
    if (!progsList) return []
    if (statusFilter === 'ALL') return progsList

    // Sitios que tienen observaciones en el estado seleccionado para la fecha en revisión
    const matchingSites = new Set(
      (dayAvance.rows || [])
        .filter(r => {
          if (statusFilter === 'SOLICITANDO') return r.estado === 'Solicitando Revisión'
          if (statusFilter === 'EN_REVISION') return r.estado === 'En Revisión'
          if (statusFilter === 'VALIDADO') return r.estado === 'Validado' || r.estado === 'Enviado'
          if (statusFilter === 'RECHAZADO') return r.estado === 'Rechazado'
          return false
        })
        .map(r => r.id_sitio)
    )

    return progsList.filter(prog => {
      const sitios = prog.sitios || []
      return sitios.some(s => {
        if (matchingSites.has(s.id_sitio)) return true
        const stat = sitiosStats[s.id_sitio]
        if (!stat) return false
        if (statusFilter === 'SOLICITANDO') return (stat.solicitando || 0) > 0
        if (statusFilter === 'EN_REVISION') return (stat.enRevision || 0) > 0
        if (statusFilter === 'VALIDADO') return (stat.validadas || 0) > 0
        if (statusFilter === 'RECHAZADO') return (stat.rechazadas || 0) > 0
        return true
      })
    })
  }, [statusFilter, dayAvance.rows, sitiosStats])

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
      <MetricGrid columns={4}>
        <MetricCard
          icon={<Clock size={20} />}
          label="Solicitando Revisión"
          value={viewMode === 'today' ? (dayAvance.stats?.solicitando ?? 0) : (weekStats.solicitando ?? 0)}
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
          value={viewMode === 'today' ? (dayAvance.stats?.enRevision ?? 0) : (weekStats.enRevision ?? 0)}
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
          value={viewMode === 'today' ? (dayAvance.stats?.validadas ?? 0) : (weekStats.validadas ?? 0)}
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
          value={viewMode === 'today' ? (dayAvance.stats?.rechazadas ?? 0) : (weekStats.rechazadas ?? 0)}
          subtitle={viewMode === 'today' ? 'observaciones rechazadas' : 'en la semana'}
          variant="rose"
          onClick={() => setStatusFilter(prev => prev === 'RECHAZADO' ? 'ALL' : 'RECHAZADO')}
          active={statusFilter === 'RECHAZADO'}
          badge={statusFilter === 'RECHAZADO' ? 'Filtrando' : null}
          loading={viewMode === 'today' && dayAvance.loading}
        />
      </MetricGrid>

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

        {/* Derecha: Toggle Hoy / Semana + Botón Nueva Programación */}
        <div className="prog-toolbar-actions">
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
          {/* Indicador de filtro activo si se seleccionó un medidor específico */}
          {statusFilter !== 'ALL' && (
            <div className="prog-filter-notice-banner">
              <span>
                Filtrando cuadrillas con observaciones en estado: <strong>{
                  statusFilter === 'SOLICITANDO' ? 'Solicitando Revisión' :
                  statusFilter === 'EN_REVISION' ? 'En Revisión' :
                  statusFilter === 'VALIDADO' ? 'Validados (Por subir)' :
                  statusFilter === 'RECHAZADO' ? 'Rechazadas' :
                  statusFilter
                }</strong>
              </span>
              <button
                type="button"
                className="prog-filter-notice-btn"
                onClick={() => setStatusFilter('ALL')}
              >
                ✕ Mostrar Todas
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
          {/* Indicador de filtro activo si se seleccionó un medidor específico en la semana */}
          {statusFilter !== 'ALL' && (
            <div className="prog-filter-notice-banner" style={{ marginBottom: '0.85rem' }}>
              <span>
                Filtrando cuadrillas con observaciones en estado: <strong>{
                  statusFilter === 'SOLICITANDO' ? 'Solicitando Revisión' :
                  statusFilter === 'EN_REVISION' ? 'En Revisión' :
                  statusFilter === 'VALIDADO' ? 'Validados (Por subir)' :
                  statusFilter === 'ENVIADO' ? 'Enviados por COVEPA' :
                  statusFilter === 'RECHAZADO' ? 'Rechazadas' :
                  statusFilter
                }</strong>
              </span>
              <button
                type="button"
                className="prog-filter-notice-btn"
                onClick={() => setStatusFilter('ALL')}
              >
                ✕ Mostrar Todas
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

// ────────────────────────────────────────────────────────────
// SUBCOMPONENTE: Modal Formulario de Programación (Crear / Editar)
// ────────────────────────────────────────────────────────────
function ModalProgramacionForm({ initialDate, editingProg, initialSiteId = null, tecnicos, programacionesExistentes, onClose, onSaved }) {
  const isEditing = Boolean(editingProg)

  const fecha = useMemo(() => {
    if (editingProg?.fecha) return editingProg.fecha
    return initialDate || toLocalDateString(new Date())
  }, [editingProg, initialDate])

  const dateFormatted = useMemo(() => {
    if (!fecha) return ''
    try {
      const [y, m, d] = fecha.split('-').map(Number)
      const dt = new Date(y, m - 1, d)
      const str = dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      return str.charAt(0).toUpperCase() + str.slice(1)
    } catch {
      return fecha
    }
  }, [fecha])

  const [selectedPersonalIds, setSelectedPersonalIds] = useState(() => {
    if (editingProg) {
      if (editingProg.equipo && editingProg.equipo.length > 0) {
        return editingProg.equipo.map(m => m.id).filter(Boolean)
      }
      if (editingProg.id_tecnico) return [editingProg.id_tecnico]
    }
    return []
  })

  const [searchStaff, setSearchStaff] = useState('')
  const [notas, setNotas] = useState(() => editingProg?.notas || '')
  const [searchSite, setSearchSite] = useState('')
  const [selectedSite, setSelectedSite] = useState(() => {
    if (editingProg?.sitios && editingProg.sitios.length > 0) {
      const first = editingProg.sitios[0]
      return first?.id_sitio || first || ''
    }
    return initialSiteId || ''
  })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Listener para cerrar modal con tecla ESC
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Lista de TODO el personal activo de la base de datos (con o sin cuadrilla, de cualquier empresa)
  const staffFiltrado = useMemo(() => {
    const activos = tecnicos.filter(p => p.activo !== false && (p.estado || '').toUpperCase() !== 'INACTIVO')

    // Ordenar: primero quienes tienen cuadrilla asignada (CUADRILLA 1 a 6), luego por nombre
    const sorted = [...activos].sort((a, b) => {
      const cA = a.cuadrilla || ''
      const cB = b.cuadrilla || ''
      if (cA && !cB) return -1
      if (!cA && cB) return 1
      if (cA && cB && cA !== cB) return cA.localeCompare(cB, undefined, { numeric: true })
      return (a.nombre_completo || '').localeCompare(b.nombre_completo || '')
    })

    const q = searchStaff.toLowerCase().trim()
    if (!q) return sorted
    return sorted.filter(p =>
      (p.nombre_completo && p.nombre_completo.toLowerCase().includes(q)) ||
      (p.cargo && p.cargo.toLowerCase().includes(q)) ||
      (p.cuadrilla && p.cuadrilla.toLowerCase().includes(q)) ||
      (p.empresa && p.empresa.toLowerCase().includes(q))
    )
  }, [tecnicos, searchStaff])

  // Cuadrilla del personal o técnico actualmente seleccionado (solo si tiene cuadrilla designada)
  const selectedTechCuadrilla = useMemo(() => {
    if (selectedPersonalIds.length === 0) return null
    const selectedMembers = tecnicos.filter(t => selectedPersonalIds.includes(t.id))
    // Buscar si algún integrante seleccionado tiene cuadrilla designada
    const memberWithCuadrilla = selectedMembers.find(m => m.cuadrilla && m.cuadrilla.trim())
    if (!memberWithCuadrilla) return null

    return memberWithCuadrilla.cuadrilla.trim().toUpperCase()
  }, [selectedPersonalIds, tecnicos])

  const toggleSelectStaff = id => {
    const person = tecnicos.find(p => p.id === id)
    const isLead = person && ((person.cargo || '').toUpperCase().includes('TÉCNICO') || (person.cargo || '').toUpperCase().includes('SUPERVISOR'))

    if (selectedPersonalIds.includes(id)) {
      setSelectedPersonalIds(prev => prev.filter(p => p !== id))
    } else {
      // Si se selecciona un nuevo técnico principal, reemplazar al técnico anterior
      if (isLead) {
        setSelectedPersonalIds(prev => {
          const others = prev.filter(prevId => {
            const op = tecnicos.find(t => t.id === prevId)
            return op && !(op.cargo || '').toUpperCase().includes('TÉCNICO') && !(op.cargo || '').toUpperCase().includes('SUPERVISOR')
          })
          return [id, ...others]
        })
      } else {
        setSelectedPersonalIds(prev => [...prev, id])
      }
    }
  }

  // Catálogo de sitios enriquecidos con código de lugar, nombre_nodo, localidad, zona y grupo
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

  // Cargar metadata completa de sitios en segundo plano (asíncrono y cacheado)
  useEffect(() => {
    let active = true
    getCachedSitiosAsignados()
      .then(data => {
        if (active && data && data.length > 0) {
          setSitiosCatalogo(data)
        }
      })
      .catch(err => console.warn('Error cargando sitios en modal:', err))
    return () => { active = false }
  }, [])

  // Filtrado reactivo de sitios según el técnico seleccionado y término de búsqueda
  const sitiosFiltrados = useMemo(() => {
    let list = sitiosCatalogo

    // Si hay un técnico con cuadrilla seleccionada, SOLO mostrar los sitios designados a esa cuadrilla
    if (selectedTechCuadrilla) {
      list = list.filter(s => {
        const c = (s.cuadrilla || s.grupo || '').trim().toUpperCase()
        return c === selectedTechCuadrilla
      })
    }

    const q = searchSite.toLowerCase().trim()
    if (!q) return list
    return list.filter(s =>
      (s.id_site && s.id_site.toLowerCase().includes(q)) ||
      (s.codigo_lugar && s.codigo_lugar.toLowerCase().includes(q)) ||
      (s.nombre_nodo && s.nombre_nodo.toLowerCase().includes(q)) ||
      (s.localidad && s.localidad.toLowerCase().includes(q)) ||
      (s.zona && s.zona.toLowerCase().includes(q)) ||
      (s.cuadrilla && s.cuadrilla.toLowerCase().includes(q)) ||
      (s.grupo && s.grupo.toLowerCase().includes(q))
    )
  }, [sitiosCatalogo, selectedTechCuadrilla, searchSite])

  // Si cambia la cuadrilla del técnico y el sitio actual no coincide, limpiar selección de sitio
  useEffect(() => {
    if (selectedTechCuadrilla && selectedSite) {
      const currentSite = sitiosCatalogo.find(s => s.id_site === selectedSite)
      const siteCuad = (currentSite?.cuadrilla || currentSite?.grupo || '').trim().toUpperCase()
      if (siteCuad && siteCuad !== selectedTechCuadrilla) {
        setSelectedSite('')
      }
    }
  }, [selectedTechCuadrilla, selectedSite, sitiosCatalogo])

  const applySiteSelection = useCallback(siteId => {
    if (!siteId) {
      setSelectedSite('')
      return
    }
    setSelectedSite(siteId)

    // Si el sitio tiene una cuadrilla designada, auto-seleccionar ÚNICAMENTE al técnico o supervisor (NO al conductor)
    const siteObj = sitiosCatalogo.find(s => s.id_site === siteId)
    if (siteObj) {
      let siteCuad = (siteObj.cuadrilla || siteObj.grupo || '').trim().toUpperCase()
      siteCuad = siteCuad.replace(/GRUPO/gi, 'CUADRILLA')

      if (siteCuad && !siteCuad.includes('SIN CUADRILLA')) {
        const cuadrillaMembers = tecnicos.filter(t => {
          const tCuad = (t.cuadrilla || '').trim().toUpperCase().replace(/GRUPO/gi, 'CUADRILLA')
          return tCuad === siteCuad
        })

        // Filtrar exclusivamente técnicos o supervisores (excluyendo terminantemente conductores)
        const leads = cuadrillaMembers.filter(t => {
          const cargo = (t.cargo || '').toUpperCase()
          const isLead = cargo.includes('TÉCNICO') || cargo.includes('TECNICO') || cargo.includes('SUPERVISOR')
          const isConductor = cargo.includes('CONDUCTOR')
          return isLead && !isConductor
        })

        if (leads.length > 0) {
          // Auto-asignar únicamente al técnico o supervisor designado
          setSelectedPersonalIds([leads[0].id])
        } else {
          // Si no tiene cargo explícito pero tampoco es conductor
          const nonConductors = cuadrillaMembers.filter(t => !(t.cargo || '').toUpperCase().includes('CONDUCTOR'))
          if (nonConductors.length > 0) {
            setSelectedPersonalIds([nonConductors[0].id])
          }
        }
      }
    }
  }, [sitiosCatalogo, tecnicos])

  const handleSelectSite = siteId => {
    if (selectedSite === siteId) {
      setSelectedSite('')
      return
    }
    applySiteSelection(siteId)
  }

  // Preselección automática cuando se abre para un sitio específico desde el buscador de observaciones
  const autoAppliedRef = useRef(false)
  useEffect(() => {
    if (initialSiteId && !editingProg && !autoAppliedRef.current && sitiosCatalogo.length > 0 && tecnicos.length > 0) {
      applySiteSelection(initialSiteId)
      autoAppliedRef.current = true
    }
  }, [initialSiteId, editingProg, sitiosCatalogo, tecnicos, applySiteSelection])

  const handleSubmit = async e => {
    e.preventDefault()
    setErrorMsg('')

    if (!fecha) {
      setErrorMsg('No se especificó la fecha de la jornada.')
      return
    }
    if (selectedPersonalIds.length === 0) {
      setErrorMsg('Debes seleccionar al menos un integrante de personal para la programación.')
      return
    }
    if (!selectedSite) {
      setErrorMsg('Debes seleccionar un sitio para la jornada.')
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        await updateProgramacion(editingProg.id, {
          personal_ids: selectedPersonalIds,
          fecha,
          notas,
          sitios: [selectedSite]
        })
      } else {
        await createProgramacion({
          personal_ids: selectedPersonalIds,
          fecha,
          notas,
          sitios: [selectedSite]
        })
      }
      onSaved()
    } catch (err) {
      setErrorMsg(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="prog-modal-overlay">
      <div className="prog-modal prog-modal-wide">
        {/* Cabecera del Modal con Fecha Debajo del Título */}
        <div className="prog-modal-header">
          <div className="prog-modal-header-main">
            <div className="prog-modal-title-icon">
              {isEditing ? <Edit3 size={18} color="#003060" /> : <Calendar size={18} color="#003060" />}
            </div>
            <div className="prog-modal-title-group">
              <h3 className="prog-modal-heading">
                {isEditing ? 'Editar Programación' : 'Nueva Programación'}
              </h3>
              <span className="prog-modal-header-date">
                <Calendar size={12} color="#0284c7" />
                <span>{dateFormatted}</span>
              </span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} title="Cerrar ventana">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
          {errorMsg && (
            <div className="prog-modal-error-banner">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="prog-modal-body prog-modal-2col">
            {/* ── COLUMNA IZQUIERDA: PERSONAL OPERATIVO ── */}
            <div className="prog-modal-col-left">

              {/* Cabecera de Sección: Personal Asignado */}
              <div className="prog-pane-header">
                <div className="prog-pane-title">
                  <Users size={15} color="#003060" />
                  <span>Personal Asignado</span>
                  {selectedPersonalIds.length > 0 && (
                    <span className="prog-badge-count">{selectedPersonalIds.length}</span>
                  )}
                </div>
                {selectedPersonalIds.length > 0 && (
                  <button
                    type="button"
                    className="prog-clean-link-btn"
                    onClick={() => setSelectedPersonalIds([])}
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Chips de personal seleccionado */}
              {selectedPersonalIds.length > 0 && (
                <div className="prog-selected-chips-box">
                  {selectedPersonalIds.map(id => {
                    const person = tecnicos.find(t => t.id === id)
                    if (!person) return null
                    const cClass = getCargoClass(person.cargo)
                    return (
                      <span key={id} className="prog-selected-staff-pill">
                        <span className="staff-pill-name">{person.nombre_completo}</span>
                        <span className={`role-badge ${cClass}`}>{person.cargo}</span>
                        {person.cuadrilla ? (
                          <span
                            style={{
                              fontSize: 'var(--text-2xs)',
                              fontWeight: 'var(--fw-bold)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'rgba(0,48,96,0.12)',
                              color: '#003060',
                              border: '1px solid rgba(0,48,96,0.2)'
                            }}
                          >
                            {person.cuadrilla}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 'var(--text-2xs)',
                              fontWeight: 'var(--fw-semibold)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(100,116,139,0.1)',
                              color: '#64748b'
                            }}
                          >
                            Sin Cuadrilla
                          </span>
                        )}
                        <button
                          type="button"
                          className="staff-pill-remove"
                          onClick={() => toggleSelectStaff(id)}
                          title="Quitar"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Buscador de personal */}
              <div className="prog-clean-search-wrap">
                <Search size={13} color="#64748b" />
                <input
                  type="text"
                  placeholder="Buscar personal por nombre, cargo, cuadrilla o empresa..."
                  value={searchStaff}
                  onChange={e => setSearchStaff(e.target.value)}
                />
                {searchStaff && (
                  <button type="button" onClick={() => setSearchStaff('')} className="btn-input-clear">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Lista de personal con ALTO CONTRASTE y diseño corporativo */}
              <div className="prog-staff-list-container">
                {staffFiltrado.map(p => {
                  const isSelected = selectedPersonalIds.includes(p.id)
                  const cClass = getCargoClass(p.cargo)

                  return (
                    <div
                      key={p.id}
                      className={`prog-staff-row-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSelectStaff(p.id)}
                    >
                      <div className="prog-staff-row-left">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="prog-staff-checkbox"
                        />
                        <div className={`person-avatar ${cClass}`}>
                          {getInitials(p.nombre_completo)}
                        </div>
                        <div className="prog-staff-info-col">
                          <span className="prog-staff-row-name">
                            {p.nombre_completo}
                          </span>
                          <div className="prog-staff-row-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className={`role-badge ${cClass}`}>{p.cargo}</span>
                            {p.empresa && (
                              <span
                                style={{
                                  fontSize: 'var(--text-2xs)',
                                  fontWeight: 'var(--fw-semibold)',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: '#f1f5f9',
                                  color: '#475569'
                                }}
                              >
                                {p.empresa}
                              </span>
                            )}
                            {p.cuadrilla ? (
                              <span
                                className="prog-card-cuadrilla-badge"
                                style={{
                                  fontWeight: 'var(--fw-bold)',
                                  background: 'rgba(0,48,96,0.08)',
                                  color: '#003060',
                                  border: '1px solid rgba(0,48,96,0.2)'
                                }}
                              >
                                {p.cuadrilla}
                              </span>
                            ) : (
                              <span
                                className="prog-cuadrilla-badge-rotativo"
                                style={{
                                  background: 'rgba(100,116,139,0.08)',
                                  color: '#64748b',
                                  border: '1px solid rgba(100,116,139,0.15)'
                                }}
                              >
                                Sin Cuadrilla
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {staffFiltrado.length === 0 && (
                  <div className="prog-empty-hint">
                    No se encontró personal con ese criterio.
                  </div>
                )}
              </div>
            </div>

            {/* ── COLUMNA DERECHA: SITIO ASIGNADO (SELECCIÓN ÚNICA) ── */}
            <div className="prog-modal-col-right">
              {/* Cabecera de Selección de Sitio */}
              <div className="prog-pane-header">
                <div className="prog-pane-title">
                  <MapPin size={15} color="#003060" />
                  <span>Seleccionar Sitio</span>
                  {selectedTechCuadrilla ? (
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--fw-bold)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(0,48,96,0.08)',
                        color: '#003060',
                        border: '1px solid rgba(0,48,96,0.18)'
                      }}
                    >
                      {selectedTechCuadrilla} ({sitiosFiltrados.length})
                    </span>
                  ) : (
                    <span className="prog-badge-count">{sitiosFiltrados.length}</span>
                  )}
                </div>
                {selectedSite && (
                  <button
                    type="button"
                    className="prog-clean-link-btn"
                    onClick={() => setSelectedSite('')}
                  >
                    Desmarcar selección
                  </button>
                )}
              </div>

              {/* Barra de Búsqueda */}
              <div className="prog-clean-search-wrap">
                <Search size={13} color="#64748b" />
                <input
                  type="text"
                  placeholder="Buscar por código (ej: AM-0038), localidad o nodo..."
                  value={searchSite}
                  onChange={e => setSearchSite(e.target.value)}
                />
                {searchSite && (
                  <button type="button" onClick={() => setSearchSite('')} className="btn-input-clear">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Lista Enriquecida de Sitios — Solo Código, Lugar y Zona */}
              <div className="prog-sites-clean-list">
                {sitiosFiltrados.map(s => {
                  const isSelected = selectedSite === s.id_site
                  const loc = s.localidad || 'Sin localidad'

                  return (
                    <div
                      key={s.id_site}
                      className={`prog-site-item-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectSite(s.id_site)}
                    >
                      <div className="prog-site-item-main">
                        <input
                          type="radio"
                          name="selected_programacion_site"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ cursor: 'pointer', accentColor: '#003060', width: '15px', height: '15px', flexShrink: 0 }}
                        />
                        <div className="site-2row-top">
                          <MapPin size={13} className="site-2row-pin" />
                          <span className="site-2row-code">{s.id_site}</span>
                          <span className="site-2row-loc">· {loc}</span>
                        </div>
                      </div>

                      <div className="prog-site-item-badges">
                        {s.cuadrilla && (
                          <span
                            style={{
                              fontSize: 'var(--text-2xs)',
                              fontWeight: 'var(--fw-bold)',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              background: 'rgba(0,48,96,0.08)',
                              color: '#003060',
                              border: '1px solid rgba(0,48,96,0.18)'
                            }}
                          >
                            {s.cuadrilla}
                          </span>
                        )}
                        {s.zona && <span className="meta-pill">{s.zona}</span>}
                      </div>
                    </div>
                  )
                })}

                {sitiosFiltrados.length === 0 && (
                  <div className="prog-empty-hint">
                    No se encontraron sitios con ese criterio de búsqueda.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pie del Modal */}
          <div className="prog-modal-footer">
            <div className="prog-modal-footer-actions" style={{ marginLeft: 'auto' }}>
              <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>{isEditing ? 'Guardar Cambios' : 'Crear Programación'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}



// ────────────────────────────────────────────────────────────
// SUBCOMPONENTE: Modal Detalle de Programación y Observaciones
// Ventana emergente centrada con edición, eliminación, gestión de observaciones
// y guardado automático de comentarios al cerrar.
// ────────────────────────────────────────────────────────────
function ModalDetallesProgramacion({
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
  const { user, personalMember } = useAuth()
  const [currentSitioId, setCurrentSitioId] = useState(sitioId || '')
  const [observaciones, setObservaciones] = useState([])
  const [comments, setComments] = useState({})
  const [delays, setDelays] = useState({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [savingCommentId, setSavingCommentId] = useState(null)
  const [savedCommentId, setSavedCommentId] = useState(null)
  const [savingDelayId, setSavingDelayId] = useState(null)
  const [savedDelayId, setSavedDelayId] = useState(null)
  const [expandedHistorialId, setExpandedHistorialId] = useState(null)
  const [historialRefreshKeys, setHistorialRefreshKeys] = useState({})

  // Ref con los comentarios y justificaciones modificados (dirty) para autoguardarlos al cerrar
  const dirtyCommentsRef = useRef(new Set())
  const commentsRef = useRef({})
  commentsRef.current = comments
  const dirtyDelaysRef = useRef(new Set())
  const delaysRef = useRef({})
  delaysRef.current = delays

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
      data.forEach(o => {
        initialComments[o.id_obs] = o.comentario_covepa || ''
        initialDelays[o.id_obs] = o.justificacion_demora || ''
      })
      setComments(initialComments)
      setDelays(initialDelays)
      dirtyCommentsRef.current.clear()
      dirtyDelaysRef.current.clear()
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }, [currentSitioId])

  useEffect(() => {
    loadObs()
  }, [loadObs])

  // Acción rápida: Marcar observación (Puente con App de fotos de campo)
  const handleSetEstado = async (obs, nuevoEstado) => {
    setUpdatingId(obs.id_obs)
    try {
      // 1. Responsable del cambio: SIEMPRE obtenido de la sesión activa
      const responsableSesion = resolverNombreAuditor(user, personalMember)

      // 2. Revisor asignado: Solo conservar si es estrictamente de GILAT, NUNCA autocompletar con la sesión
      const revisorGilatActual = esRevisorGilat(obs.revisor, gilatOptions) ? obs.revisor : null

      const comentarioActual = comments[obs.id_obs] ?? obs.comentario_covepa ?? null
      const fechaIso = new Date().toISOString()

      // Sincronización oficial con Control Fotos + Historial de Estados
      await sincronizarEstadoConControlFotos(
        obs.id_obs,
        nuevoEstado,
        revisorGilatActual,
        comentarioActual,
        {
          idSitio: obs.id_sitio || currentSitioId,
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
      // Regla: En revisores solo va personal de Gilat
      const val = (newRevisor && esRevisorGilat(newRevisor, gilatOptions)) ? newRevisor : null
      await updateObservacionCovepa(obs.id_obs, { revisor: val })
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
      const valFecha = newFecha || null
      await updateObservacionCovepa(obs.id_obs, { fecha_subsanacion: valFecha })
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
      await sincronizarComentarioObservacion(obsId, val)
      dirtyCommentsRef.current.delete(obsId)
      setSavedCommentId(obsId)
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
      await sincronizarJustificacionDemora(obsId, justificacionLimpia)
      dirtyDelaysRef.current.delete(obsId)
      setSavedDelayId(obsId)
      setTimeout(() => {
        setSavedDelayId(prev => (prev === obsId ? null : prev))
      }, 2000)
      setObservaciones(prev => prev.map(o => o.id_obs === obsId ? { ...o, justificacion_demora: justificacionLimpia } : o))
      onObservationUpdated()
    } catch (err) {
      console.error('Error al guardar justificación de demora:', err)
    } finally {
      setSavingDelayId(null)
    }
  }

  // Guardado automático global de comentarios y demoras pendientes al cerrar la ventana
  const handleCloseWithAutoSave = useCallback(async () => {
    const dirtyIds = Array.from(dirtyCommentsRef.current)
    const dirtyDelayIds = Array.from(dirtyDelaysRef.current)
    const promises = []

    if (dirtyIds.length > 0) {
      promises.push(
        ...dirtyIds.map(id =>
          sincronizarComentarioObservacion(id, commentsRef.current[id] ?? '')
        )
      )
      dirtyCommentsRef.current.clear()
    }

    if (dirtyDelayIds.length > 0) {
      promises.push(
        ...dirtyDelayIds.map(id => {
          const val = delaysRef.current[id] ?? ''
          return sincronizarJustificacionDemora(id, val.trim() !== '' ? val.trim() : null)
        })
      )
      dirtyDelaysRef.current.clear()
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
  }, [onClose, onObservationUpdated])

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
      if (dirtyIds.length > 0) {
        const auditorActual = resolverNombreAuditor(user, personalMember)
        dirtyIds.forEach(id => {
          sincronizarComentarioObservacion(id, commentsRef.current[id] ?? '', auditorActual)
            .catch(err => console.error('Error autoguardando al cerrar página:', err))
        })
        dirtyCommentsRef.current.clear()
      }
      if (dirtyDelayIds.length > 0) {
        dirtyDelayIds.forEach(id => {
          const val = delaysRef.current[id] ?? ''
          sincronizarJustificacionDemora(id, val.trim() !== '' ? val.trim() : null)
            .catch(err => console.error('Error autoguardando demora al cerrar:', err))
        })
        dirtyDelaysRef.current.clear()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      const dirtyIds = Array.from(dirtyCommentsRef.current)
      const dirtyDelayIds = Array.from(dirtyDelaysRef.current)
      if (dirtyIds.length > 0) {
        const auditorActual = resolverNombreAuditor(user, personalMember)
        dirtyIds.forEach(id => {
          sincronizarComentarioObservacion(id, commentsRef.current[id] ?? '', auditorActual)
            .catch(err => console.error('Error autoguardando al desmontar modal:', err))
        })
        dirtyCommentsRef.current.clear()
      }
      if (dirtyDelayIds.length > 0) {
        dirtyDelayIds.forEach(id => {
          const val = delaysRef.current[id] ?? ''
          sincronizarJustificacionDemora(id, val.trim() !== '' ? val.trim() : null)
            .catch(err => console.error('Error autoguardando demora al desmontar:', err))
        })
        dirtyDelaysRef.current.clear()
      }
    }
  }, [user, personalMember])

  // Cambiar de sitio guardando automáticamente comentarios y demoras pendientes
  const handleSwitchSitio = async (newSitioId) => {
    if (newSitioId === currentSitioId) return
    const dirtyIds = Array.from(dirtyCommentsRef.current)
    const dirtyDelayIds = Array.from(dirtyDelaysRef.current)
    const promises = []

    if (dirtyIds.length > 0) {
      const auditorActual = resolverNombreAuditor(user, personalMember)
      promises.push(
        ...dirtyIds.map(id =>
          sincronizarComentarioObservacion(id, commentsRef.current[id] ?? '', auditorActual)
        )
      )
      dirtyCommentsRef.current.clear()
    }

    if (dirtyDelayIds.length > 0) {
      promises.push(
        ...dirtyDelayIds.map(id => {
          const val = delaysRef.current[id] ?? ''
          return sincronizarJustificacionDemora(id, val.trim() !== '' ? val.trim() : null)
        })
      )
      dirtyDelaysRef.current.clear()
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
        const isRevision = rawSt === 'En Revision' || rawSt === 'En Revisión'
        const revisor = isRevision ? '' : (o.revisor || 'Sin revisor')
        const fechaRev = isRevision ? '' : (o.fecha_subsanacion ? String(o.fecha_subsanacion).slice(0, 10) : '')
        const comentario = comments[o.id_obs] || o.comentario_covepa || ''
        const demora = delays[o.id_obs] !== undefined ? delays[o.id_obs] : (o.justificacion_demora || '')
        const sId = o.id_sitio || currentSitioId
        const loc = siteInfo.localidad || sitiosMap[sId]?.localidad || ''

        return [
          idx + 1,
          o.id_obs || '',
          sId,
          loc,
          rawSt,
          o.detalle || '',
          o.comentario_inicial || '',
          o.acuerdo_subsanacion || '',
          revisor,
          fechaRev,
          comentario,
          demora
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
          { name: 'ESTADO COVEPA', filterButton: true },
          { name: 'DETALLE DE OBSERVACIÓN', filterButton: true },
          { name: 'COMENTARIO INICIAL', filterButton: true },
          { name: 'ACUERDO DE SUBSANACIÓN', filterButton: true },
          { name: 'REVISADO POR', filterButton: true },
          { name: 'FECHA DE REVISIÓN', filterButton: true },
          { name: 'COMENTARIO COVEPA', filterButton: true },
          { name: 'JUSTIFICACIÓN DE DEMORA', filterButton: true }
        ],
        rows: tableRows
      })

      // Anchos de columna óptimos
      const colWidths = [6, 20, 18, 26, 16, 44, 44, 44, 24, 18, 35, 38]
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
            {onEditProg && (
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

            {onDeleteProg && (
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
              const showRevisorYFecha = currentEstado !== 'Pendiente' && currentEstado !== 'Solicitando Revisión' && currentEstado !== 'En Revisión' && currentEstado !== 'En Revision'

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
                      </div>

                      <div className="prog-obs-status-select-wrap">
                        <select
                          value={currentEstado}
                          disabled={isUpdating}
                          onChange={(e) => handleSetEstado(obs, e.target.value)}
                          className={`prog-obs-status-select status-${(currentEstado || '').toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <option value="Pendiente">● Pendiente</option>
                          <option value="Solicitando Revisión">⏳ Solicitando Revisión</option>
                          <option value="En Revisión">🔍 En Revisión</option>
                          <option value="Validado">✓ Validado</option>
                          <option value="Descartado">🚫 Descartado</option>
                          <option value="Rechazado">✕ Rechazado</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => setExpandedHistorialId(prev => prev === obs.id_obs ? null : obs.id_obs)}
                          className={`obs-history-toggle-btn ${expandedHistorialId === obs.id_obs ? 'is-active' : ''}`}
                          title="Ver u ocultar trazabilidad de cambios de estado"
                        >
                          <History size={12} />
                          <span>Historial</span>
                        </button>
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

                  {/* Trazabilidad Cronológica de Estados */}
                  {expandedHistorialId === obs.id_obs && (
                    <HistorialEstadosTimeline
                      idObs={obs.id_obs}
                      refreshKey={historialRefreshKeys[obs.id_obs] || 0}
                    />
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
                          disabled={isUpdating}
                          onChange={(e) => handleUpdateRevisor(obs, e.target.value)}
                          className="audit-select"
                          title="Persona de GILAT que revisó esta observación"
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
                             currentEstado === 'Descartado' ? 'F. Descarte:' :
                             currentEstado === 'Rechazado' ? 'F. Rechazo:' :
                             currentEstado === 'Enviado' ? 'F. Envío:' : 'Fecha:'}
                          </span>
                        </label>
                        <input
                          type="date"
                          value={obs.fecha_subsanacion ? String(obs.fecha_subsanacion).split('T')[0].split(' ')[0] : ''}
                          disabled={isUpdating}
                          onChange={(e) => handleUpdateFecha(obs, e.target.value)}
                          className="audit-date-input"
                          title="Modificar fecha de subsanación/revisión"
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
                        onChange={(e) => handleCommentChange(obs.id_obs, e.target.value)}
                        onBlur={() => handleBlurComment(obs.id_obs)}
                        placeholder="Escribe un comentario o nota de subsanación (se guarda automáticamente)..."
                        className="covepa-comment-textarea"
                      />
                    </div>

                    {/* Caja de Justificación de Demora / Control de Incidentes con autoguardado */}
                    <div className="obs-content-box box-demora" style={{ borderLeft: '4px solid #f59e0b', background: '#fffdf5', border: '1px solid #fde68a', borderLeftWidth: '4px', borderRadius: '8px', padding: '0.75rem' }}>
                      <div className="box-covepa-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span className="box-label" style={{ color: '#b45309', fontWeight: 'var(--fw-bold)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <AlertTriangle size={13} color="#d97706" /> Control de Incidentes / Justificación de Demora:
                        </span>
                        <div className="covepa-save-cluster">
                          {savingDelayId === obs.id_obs && (
                            <span className="save-tag saving">
                              <RefreshCw size={11} className="spin" /> Guardando...
                            </span>
                          )}
                          {savedDelayId === obs.id_obs && (
                            <span className="save-tag saved">
                              <Check size={12} /> Guardado
                            </span>
                          )}
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        value={delays[obs.id_obs] ?? ''}
                        onChange={(e) => handleDelayChange(obs.id_obs, e.target.value)}
                        onBlur={() => handleBlurDelay(obs.id_obs)}
                        placeholder="Si esta observación tomó más tiempo del debido o tuvo incidentes, redacta aquí el sustento técnico (dejar vacío si no hubo problemas de demora)..."
                        className="covepa-comment-textarea"
                        style={{ borderColor: '#fde68a' }}
                      />
                      <div style={{ fontSize: 'var(--text-meta)', marginTop: '0.35rem', color: '#78716c' }}>
                        {delays[obs.id_obs] && delays[obs.id_obs].trim() ? (
                          <span style={{ color: '#b45309', fontWeight: 'var(--fw-medium)' }}>
                            ⚠️ Incidente registrado: observación con retraso justificado
                          </span>
                        ) : (
                          <span style={{ color: '#059669', fontWeight: 'var(--fw-medium)' }}>
                            ✓ Sin incidentes de demora (subsanación en plazo regular)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
