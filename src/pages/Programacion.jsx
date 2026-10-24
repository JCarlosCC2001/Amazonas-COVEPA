import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Trash2,
  MapPin, CheckCircle2, Clock, AlertCircle, List,
  CalendarDays, X, Search, Save, RefreshCw, Eye, ShieldCheck,
  Check, AlertTriangle, Users, Edit3, User, FileSpreadsheet, Download, Send
} from 'lucide-react'
import ExcelJS from 'exceljs'
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
import { updateObservacionCovepa } from '../services/observacionesService'
import { ASIGNACIONES_BASE, getCachedSitiosAsignados } from '../services/sitiosService'
import { useAuth } from '../hooks/useAuth'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'

// Helper para validar si un texto tiene contenido significativo
function hasMeaningfulText(val) {
  if (val === null || val === undefined) return false
  const s = String(val).trim()
  return s !== '' && s !== '0' && s !== '-' && s !== '—' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined'
}

// Helper para formato de fecha YYYY-MM-DD local
function toLocalDateString(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper para obtener el lunes de la semana actual
function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Si es domingo (0), resta 6
  return new Date(date.setDate(diff))
}

// Helper para iniciales
function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`
  return parts[0].slice(0, 2).toUpperCase()
}

// Helper para clase de cargo
function getCargoClass(cargo) {
  const c = (cargo || '').toUpperCase()
  if (c.includes('TÉCNICO') || c.includes('TECNICO')) return 'tecnico'
  if (c.includes('CONDUCTOR')) return 'conductor'
  if (c.includes('SUPERVISOR')) return 'supervisor'
  return 'tecnico'
}

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function Programacion() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('today') // 'today' | 'week'
  const [todayFilter, setTodayFilter] = useState('ALL') // 'ALL' | 'EN_REVISION' | 'VALIDADO' | 'ENVIADO' | 'DESCARTADA'
  const [loading, setLoading] = useState(true)
  const [programaciones, setProgramaciones] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [sitiosStats, setSitiosStats] = useState({})

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
  const [editingProg, setEditingProg] = useState(null)
  const [selectedProgModal, setSelectedProgModal] = useState(null) // { id_sitio, programacion, allSitios }

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
    } catch (err) {
      console.error('Error cargando programaciones:', err)
    } finally {
      setLoading(false)
    }
  }, [startDateStr, endDateStr])

  useEffect(() => {
    fetchWeekData()
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

  // Medidores / KPIs de la semana
  const kpis = useMemo(() => {
    let totalJornadas = programaciones.length
    let totalSitiosProgramados = 0
    let totalObs = 0
    let subsanadas = 0
    let descartadas = 0
    let enviadas = 0
    let pendientes = 0

    programaciones.forEach(p => {
      ;(p.sitios || []).forEach(s => {
        totalSitiosProgramados++
        const stat = sitiosStats[s.id_sitio]
        if (stat) {
          totalObs += stat.total
          subsanadas += stat.subsanadas
          descartadas += stat.descartadas
          enviadas += (stat.enviadas || 0)
          pendientes += stat.pendientes
        }
      })
    })

    const levantadas = subsanadas + descartadas + enviadas
    const avancePct = totalObs > 0 ? Math.round((levantadas / totalObs) * 100) : 0

    return {
      totalJornadas,
      totalSitiosProgramados,
      totalObs,
      subsanadas,
      descartadas,
      enviadas,
      pendientes,
      avancePct
    }
  }, [programaciones, sitiosStats])

  // Estadísticas y datos específicos para la vista 'Hoy'
  const todayStats = useMemo(() => {
    const dateStr = toLocalDateString(currentDate)
    const progs = programaciones.filter(p => p.fecha === dateStr)

    let totalObs = 0
    let resueltas = 0
    let validadas = 0
    let enRevision = 0
    let enviadas = 0
    let descartadas = 0
    let pendientes = 0
    let totalPersonal = 0
    const sitiosSet = new Set()

    progs.forEach(p => {
      const team = p.equipo && p.equipo.length > 0 ? p.equipo : [p.personal || {}]
      team.forEach(m => {
        if (m.id || m.nombre_completo) totalPersonal++
      })
      ;(p.sitios || []).forEach(s => {
        if (s.id_sitio) sitiosSet.add(s.id_sitio)
        const stat = sitiosStats[s.id_sitio]
        if (stat) {
          totalObs += stat.total
          validadas += (stat.validadas || 0)
          enRevision += (stat.enRevision || 0)
          enviadas += (stat.enviadas || 0)
          descartadas += (stat.descartadas || 0)
          pendientes += (stat.pendientes || 0)
          resueltas += (stat.validadas || stat.subsanadas || 0) + (stat.descartadas || 0) + (stat.enviadas || 0)
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
      enRevision,
      enviadas,
      descartadas,
      pendientes,
      progs
    }
  }, [programaciones, sitiosStats, currentDate])

  // Filtrado de cuadrillas de hoy según el estado seleccionado
  const filteredTodayProgs = useMemo(() => {
    if (todayFilter === 'ALL') return todayStats.progs
    return todayStats.progs.filter(prog => {
      const sitios = prog.sitios || []
      return sitios.some(s => {
        const stat = sitiosStats[s.id_sitio]
        if (!stat) return false
        if (todayFilter === 'VALIDADO') return (stat.validadas || 0) > 0
        if (todayFilter === 'EN_REVISION') return (stat.enRevision || 0) > 0
        if (todayFilter === 'ENVIADO') return (stat.enviadas || 0) > 0
        if (todayFilter === 'DESCARTADA') return (stat.descartadas || 0) > 0
        return true
      })
    })
  }, [todayStats.progs, todayFilter, sitiosStats])

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

  // Agrupación de programaciones de hoy por técnico
  const todayByTecnicos = useMemo(() => {
    return groupProgsByTecnico(filteredTodayProgs, sitiosStats)
  }, [filteredTodayProgs, sitiosStats, groupProgsByTecnico])

  return (
    <div className="prog-container">
      {/* ── MEDIDORES / KPIs Y FILTROS INTERACTIVOS SUPERIORES ── */}
      <MetricGrid columns={viewMode === 'today' ? 5 : 4}>
        {viewMode === 'today' ? (
          <>
            <MetricCard
              icon={<Users size={20} />}
              label="Cuadrillas en Campo"
              value={todayStats.totalProgs}
              subtitle={`${todayStats.totalPersonal} personal · ${todayStats.totalSitios} sitios`}
              variant="navy"
              onClick={() => setTodayFilter('ALL')}
              active={todayFilter === 'ALL'}
              badge={todayFilter === 'ALL' ? 'Todas' : null}
            />
            <MetricCard
              icon={<Clock size={20} />}
              label="En Revisión"
              value={todayStats.enRevision}
              subtitle="pendientes por validar"
              variant="sky"
              onClick={() => setTodayFilter(prev => prev === 'EN_REVISION' ? 'ALL' : 'EN_REVISION')}
              active={todayFilter === 'EN_REVISION'}
              badge={todayFilter === 'EN_REVISION' ? 'Filtrando' : null}
            />
            <MetricCard
              icon={<CheckCircle2 size={20} />}
              label="Validados (Por Subir)"
              value={todayStats.validadas}
              subtitle="listos para cargar"
              variant="emerald"
              onClick={() => setTodayFilter(prev => prev === 'VALIDADO' ? 'ALL' : 'VALIDADO')}
              active={todayFilter === 'VALIDADO'}
              badge={todayFilter === 'VALIDADO' ? 'Filtrando' : null}
            />
            <MetricCard
              icon={<Send size={20} />}
              label="Enviados a Covepa"
              value={todayStats.enviadas}
              subtitle="cargados con éxito"
              variant="purple"
              onClick={() => setTodayFilter(prev => prev === 'ENVIADO' ? 'ALL' : 'ENVIADO')}
              active={todayFilter === 'ENVIADO'}
              badge={todayFilter === 'ENVIADO' ? 'Filtrando' : null}
            />
            <MetricCard
              icon={<AlertTriangle size={20} />}
              label="Descartadas / Rech."
              value={todayStats.descartadas}
              subtitle="desestimadas en campo"
              variant="rose"
              onClick={() => setTodayFilter(prev => prev === 'DESCARTADA' ? 'ALL' : 'DESCARTADA')}
              active={todayFilter === 'DESCARTADA'}
              badge={todayFilter === 'DESCARTADA' ? 'Filtrando' : null}
            />
          </>
        ) : (
          <>
            <MetricCard
              icon={<CalendarDays size={20} />}
              label="Jornadas Semana"
              value={kpis.totalJornadas}
              subtitle={`${kpis.totalSitiosProgramados} sitios`}
              variant="navy"
            />
            <MetricCard
              icon={<AlertCircle size={20} />}
              label="Total Observaciones"
              value={kpis.totalObs}
              subtitle="en ruta semanal"
              variant="sky"
            />
            <MetricCard
              icon={<CheckCircle2 size={20} />}
              label="Subsanadas / Descartadas"
              value={kpis.subsanadas + kpis.descartadas}
              subtitle={`${kpis.subsanadas} sub · ${kpis.descartadas} desc`}
              variant="emerald"
            />
            <MetricCard
              icon={<ShieldCheck size={20} />}
              label="Avance Semanal"
              value={`${kpis.avancePct}%`}
              subtitle={`${kpis.pendientes} pendientes`}
              variant="amber"
            />
          </>
        )}
      </MetricGrid>

      {/* ── BARRA SUPERIOR INTEGRADA (Navegación de Fecha + Distribución + Selector de Vista + Acción) ── */}
      <div className="prog-toolbar">
        {/* Izquierda: Selector de Día / Semana */}
        <div className="prog-nav-group">
          <button className="prog-btn-nav" onClick={prevPeriod} title={viewMode === 'today' ? 'Día anterior' : 'Semana anterior'}>
            <ChevronLeft size={16} />
          </button>
          <button className="prog-btn-nav" onClick={goToToday} title="Ir a hoy">
            Hoy
          </button>
          <button className="prog-btn-nav" onClick={nextPeriod} title={viewMode === 'today' ? 'Día siguiente' : 'Semana siguiente'}>
            <ChevronRight size={16} />
          </button>
          <div className="prog-nav-title">
            {viewMode === 'today' ? (
              <>
                <Clock size={16} style={{ color: '#0284c7', display: 'inline', marginRight: '6px' }} />
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
                <CalendarDays size={16} style={{ color: '#003060', display: 'inline', marginRight: '6px' }} />
                <span>
                  {weekDays[0].date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} –{' '}
                  {weekDays[6].date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </>
            )}
          </div>
          <button className="prog-btn-nav" onClick={fetchWeekData} title="Refrescar datos">
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Derecha: Toggle Hoy / Semana + Botón Nueva Programación */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
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

      {/* ── CONTENIDO PRINCIPAL: VISTA HOY ── */}
      {viewMode === 'today' && (
        <div className="prog-today-container">
          {/* Indicador de filtro activo si se seleccionó un medidor específico */}
          {todayFilter !== 'ALL' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.6rem',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '8px',
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              color: '#0369a1'
            }}>
              <span>
                Filtrando cuadrillas con observaciones en estado: <strong>{
                  todayFilter === 'EN_REVISION' ? 'En Revisión' :
                  todayFilter === 'VALIDADO' ? 'Validados (Por subir)' :
                  todayFilter === 'ENVIADO' ? 'Enviados a Covepa' :
                  'Descartadas / Rechazadas'
                }</strong>
              </span>
              <button
                type="button"
                onClick={() => setTodayFilter('ALL')}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
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
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#003060' }}>
                {todayFilter !== 'ALL'
                  ? 'No hay cuadrillas con ese estado específico para esta fecha'
                  : 'No hay cuadrillas programadas para esta fecha'}
              </div>
              <div style={{ fontSize: '0.84rem', color: '#64748b', maxWidth: '440px', lineHeight: 1.5 }}>
                {todayFilter !== 'ALL'
                  ? 'Prueba seleccionando "Todas" para ver el total de las rutas y cuadrillas del día.'
                  : 'Organiza las salidas del personal y asigna los sitios a visitar para mantener el avance de observaciones al día.'}
              </div>
              {todayFilter !== 'ALL' ? (
                <button
                  className="prog-btn-create"
                  onClick={() => setTodayFilter('ALL')}
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
              {todayByTecnicos.map(tGroup => {
                const tec = tGroup.tecnico
                const pDonePct = tGroup.totalObs > 0 ? (tGroup.resueltas / tGroup.totalObs) * 100 : 0

                return (
                  <div key={tec.id || tec.nombre_completo} className="prog-tech-compact-row">
                    {/* Fila superior: Perfil esencial del Técnico y Resumen */}
                    <div className="prog-tech-main-bar">
                      <div className="prog-tech-person-info">
                        <div className="prog-tech-avatar-sm">
                          {getInitials(tec.nombre_completo)}
                        </div>
                        <div className="prog-tech-details">
                          <div className="prog-tech-title-line">
                            <span className="prog-tech-name-text">{tec.nombre_completo || 'Técnico sin asignar'}</span>
                            {tGroup.cuadrilla ? (
                              <span className="prog-card-cuadrilla-badge">
                                {tGroup.cuadrilla}
                              </span>
                            ) : (
                              <span className="prog-cuadrilla-badge-rotativo">
                                Apoyo
                              </span>
                            )}
                            {tGroup.companions.length > 0 && (
                              <span
                                className="prog-tech-comp-pill"
                                title={tGroup.companions.map(c => `${c.cargo ? `${c.cargo}: ` : ''}${c.nombre_completo}`).join(' · ')}
                              >
                                👥 {tGroup.companions.map(c => c.nombre_completo).join(' · ')}
                              </span>
                            )}
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

                        return (
                          <div
                            key={siteItem.id_sitio}
                            className={`prog-site-2row-card ${isComplete ? 'is-complete' : ''}`}
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
                              {sStat.descartadas > 0 && (
                                <span
                                  className="site-pill-badge badge-rech"
                                  title={`${sStat.descartadas} observación(es) descartadas / rechazadas`}
                                >
                                  ✕ {sStat.descartadas} rech.
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
        <div className="prog-week-grid">
          {weekDays.map(day => {
            const dayProgs = programaciones.filter(p => p.fecha === day.dateStr)
            const dayTecnicos = groupProgsByTecnico(dayProgs, sitiosStats)

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
                        {/* Cabecera del Técnico */}
                        <div className="week-tech-header">
                          <div className="week-tech-avatar">
                            {getInitials(tec.nombre_completo)}
                          </div>
                          <div className="week-tech-info">
                            <span className="week-tech-name" title={tec.nombre_completo}>
                              {tec.nombre_completo || 'Sin asignar'}
                            </span>
                            {tDay.cuadrilla && (
                              <span className="week-tech-badge">{tDay.cuadrilla}</span>
                            )}
                          </div>
                          <span className="week-tech-count" title="Sitios programados">
                            {tDay.sitios.length} {tDay.sitios.length === 1 ? 'sitio' : 'sitios'}
                          </span>
                        </div>

                        {/* Sitios asignados al técnico en este día */}
                        <div className="week-tech-sites">
                          {tDay.sitios.map(sItem => {
                            const sStat = sItem.stat
                            const sDone = (sStat.validadas || 0) + (sStat.descartadas || 0) + (sStat.enviadas || 0)
                            const isComplete = sDone === sStat.total && sStat.total > 0
                            const localidad = sitiosMap[sItem.id_sitio]?.localidad

                            return (
                              <div
                                key={sItem.id_sitio}
                                className={`week-site-pill ${isComplete ? 'is-complete' : ''}`}
                                onClick={() => setSelectedProgModal({ id_sitio: sItem.id_sitio, programacion: sItem.programacion, allSitios: sItem.allSitios })}
                                title="Clic para ver observaciones"
                              >
                                <div className="week-site-top">
                                  <MapPin size={11} className="week-site-pin" />
                                  <span className="week-site-code">{sItem.id_sitio}</span>
                                  {localidad && (
                                    <span className="week-site-loc">· {localidad}</span>
                                  )}
                                </div>

                                <div className="week-site-bottom">
                                  <span className={`week-site-count-num ${isComplete ? 'complete' : ''}`}>
                                    {sDone}/{sStat.total}
                                  </span>
                                  {sStat.enRevision > 0 && (
                                    <span className="site-pill-badge badge-rev" title={`${sStat.enRevision} en revisión`}>
                                      🔍 {sStat.enRevision}
                                    </span>
                                  )}
                                  {sStat.validadas > 0 && (
                                    <span className="site-pill-badge badge-subir" title={`${sStat.validadas} por subir`}>
                                      ✓ {sStat.validadas}
                                    </span>
                                  )}
                                  {sStat.descartadas > 0 && (
                                    <span className="site-pill-badge badge-rech" title={`${sStat.descartadas} rechazadas`}>
                                      ✕ {sStat.descartadas}
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
      )}

      {/* ── MODAL: PROGRAMACIÓN (CREAR O EDITAR) ── */}
      {(modalNewOpen || editingProg) && (
        <ModalProgramacionForm
          initialDate={modalNewDate}
          editingProg={editingProg}
          tecnicos={tecnicos}
          programacionesExistentes={programaciones}
          onClose={() => {
            setModalNewOpen(false)
            setEditingProg(null)
          }}
          onSaved={() => {
            setModalNewOpen(false)
            setEditingProg(null)
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
          }}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// SUBCOMPONENTE: Modal Formulario de Programación (Crear / Editar)
// ────────────────────────────────────────────────────────────
function ModalProgramacionForm({ initialDate, editingProg, tecnicos, programacionesExistentes, onClose, onSaved }) {
  const isEditing = Boolean(editingProg)

  const [fecha, setFecha] = useState(() => {
    if (editingProg?.fecha) return editingProg.fecha
    return initialDate || toLocalDateString(new Date())
  })

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
  const [selectedSites, setSelectedSites] = useState(() => {
    if (editingProg?.sitios && editingProg.sitios.length > 0) {
      return editingProg.sitios.map(s => s.id_sitio).filter(Boolean)
    }
    return []
  })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Lista de personal filtrada por búsqueda (solo personal operativo COVEPA para cuadrillas en ruta)
  const staffFiltrado = useMemo(() => {
    const covepaOnly = tecnicos.filter(p => !p.empresa || p.empresa === 'COVEPA')
    const q = searchStaff.toLowerCase().trim()
    if (!q) return covepaOnly
    return covepaOnly.filter(p =>
      (p.nombre_completo && p.nombre_completo.toLowerCase().includes(q)) ||
      (p.cargo && p.cargo.toLowerCase().includes(q)) ||
      (p.cuadrilla && p.cuadrilla.toLowerCase().includes(q))
    )
  }, [tecnicos, searchStaff])

  // Cuadrillas predefinidas para asignación rápida con 1 clic
  const cuadrillasPresets = useMemo(() => {
    const map = {}
    tecnicos.forEach(p => {
      if (p.cuadrilla && (!p.empresa || p.empresa === 'COVEPA')) {
        const c = p.cuadrilla.trim().toUpperCase()
        if (!map[c]) map[c] = []
        map[c].push(p)
      }
    })
    return Object.entries(map).map(([name, members]) => ({
      name,
      members,
      memberIds: members.map(m => m.id),
      memberNames: members.map(m => `${m.nombre_completo} (${m.cargo})`)
    })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  }, [tecnicos])

  const toggleSelectCuadrilla = (preset) => {
    const allSelected = preset.memberIds.length > 0 && preset.memberIds.every(id => selectedPersonalIds.includes(id))
    if (allSelected) {
      // Si ya estaban todos seleccionados, quitarlos
      setSelectedPersonalIds(prev => prev.filter(id => !preset.memberIds.includes(id)))
    } else {
      // Agregar todos los integrantes de la cuadrilla (sin duplicar)
      setSelectedPersonalIds(prev => Array.from(new Set([...prev, ...preset.memberIds])))
    }
  }

  const toggleSelectStaff = id => {
    if (selectedPersonalIds.includes(id)) {
      setSelectedPersonalIds(prev => prev.filter(p => p !== id))
    } else {
      setSelectedPersonalIds(prev => [...prev, id])
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

  // Mapa rápido para chips y detalles de sitios seleccionados
  const sitiosMap = useMemo(() => {
    const map = {}
    sitiosCatalogo.forEach(s => {
      map[s.id_site] = s
    })
    return map
  }, [sitiosCatalogo])

  // Filtrado reactivo de sitios (por código de lugar, ID, nombre, localidad, zona o grupo)
  const sitiosFiltrados = useMemo(() => {
    const q = searchSite.toLowerCase().trim()
    if (!q) return sitiosCatalogo
    return sitiosCatalogo.filter(s =>
      (s.id_site && s.id_site.toLowerCase().includes(q)) ||
      (s.codigo_lugar && s.codigo_lugar.toLowerCase().includes(q)) ||
      (s.nombre_nodo && s.nombre_nodo.toLowerCase().includes(q)) ||
      (s.localidad && s.localidad.toLowerCase().includes(q)) ||
      (s.zona && s.zona.toLowerCase().includes(q)) ||
      (s.grupo && s.grupo.toLowerCase().includes(q))
    )
  }, [sitiosCatalogo, searchSite])

  const toggleSelectSite = siteId => {
    if (selectedSites.includes(siteId)) {
      setSelectedSites(prev => prev.filter(s => s !== siteId))
    } else {
      setSelectedSites(prev => [...prev, siteId])
    }
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setErrorMsg('')

    if (!fecha) {
      setErrorMsg('Debes seleccionar una fecha.')
      return
    }
    if (selectedPersonalIds.length === 0) {
      setErrorMsg('Debes seleccionar al menos un integrante de personal para la programación.')
      return
    }
    if (selectedSites.length === 0) {
      setErrorMsg('Debes seleccionar al menos un sitio para la jornada.')
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        await updateProgramacion(editingProg.id, {
          personal_ids: selectedPersonalIds,
          fecha,
          notas,
          sitios: selectedSites
        })
      } else {
        await createProgramacion({
          personal_ids: selectedPersonalIds,
          fecha,
          notas,
          sitios: selectedSites
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
        <div className="prog-modal-header">
          <h3>
            {isEditing ? <Edit3 size={18} color="#818cf8" /> : <Calendar size={18} color="#818cf8" />}
            {isEditing ? 'Editar Programación de Cuadrilla' : 'Nueva Programación de Cuadrilla'}
          </h3>
          <button type="button" className="btn-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '0.65rem 1.4rem',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              {errorMsg}
            </div>
          )}

          <div className="prog-modal-body prog-modal-2col">
            {/* ── COLUMNA IZQUIERDA: PERSONAL Y CUADRILLA ── */}
            <div className="prog-modal-col-left">
              <div className="prog-modal-col-title">
                <Users size={16} color="#818cf8" />
                <span>1. Personal y Cuadrilla</span>
              </div>

              {/* Fecha de la Jornada */}
              <div className="prog-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={13} color="#818cf8" />
                  Fecha de la Jornada *
                </label>
                <input
                  type="date"
                  className="prog-form-control"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  required
                />
              </div>

              {/* Botones de Asignación Rápida por Cuadrilla Predefinida */}
              {cuadrillasPresets.length > 0 && (
                <div className="prog-cuadrillas-quick-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#c7d2fe', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={12} color="#818cf8" />
                      Cuadrillas Rápidas (1 Clic):
                    </span>
                    <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                      Técnico + Conductor
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {cuadrillasPresets.map(preset => {
                      const isSelected = preset.memberIds.length > 0 && preset.memberIds.every(id => selectedPersonalIds.includes(id))
                      const hasSome = preset.memberIds.some(id => selectedPersonalIds.includes(id))

                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => toggleSelectCuadrilla(preset)}
                          className={`prog-cuad-quick-btn ${isSelected ? 'active' : hasSome ? 'partial' : ''}`}
                          title={`Integrantes: ${preset.memberNames.join(' · ')}`}
                        >
                          <span>{preset.name}</span>
                          <span className="prog-cuad-quick-count">
                            {preset.members.length}
                          </span>
                          {isSelected && <Check size={11} color="#34d399" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Selector Múltiple de Personal Asignado */}
              <div className="prog-form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <User size={13} color="#818cf8" />
                    Personal Asignado ({selectedPersonalIds.length} seleccionados) *
                  </label>
                  {selectedPersonalIds.length > 0 && (
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => setSelectedPersonalIds([])}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Chips de personal seleccionado */}
                {selectedPersonalIds.length > 0 && (
                  <div className="prog-selected-chips" style={{ marginBottom: '0.4rem', maxHeight: '72px', overflowY: 'auto' }}>
                    {selectedPersonalIds.map(id => {
                      const person = tecnicos.find(t => t.id === id)
                      if (!person) return null
                      const cClass = getCargoClass(person.cargo)
                      return (
                        <span key={id} className="prog-selected-chip">
                          <span>{person.nombre_completo}</span>
                          <span className={`role-badge ${cClass}`}>{person.cargo}</span>
                          {person.cuadrilla ? (
                            <span className="prog-card-cuadrilla-badge" style={{ fontSize: '0.62rem' }}>
                              {person.cuadrilla}
                            </span>
                          ) : (
                            <span className="prog-cuadrilla-badge-rotativo" style={{ fontSize: '0.62rem' }}>
                              Rotativo
                            </span>
                          )}
                          <X
                            size={12}
                            style={{ cursor: 'pointer', marginLeft: '2px' }}
                            onClick={() => toggleSelectStaff(id)}
                          />
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Lista de candidatos con checkbox, nombre, cargo y cuadrilla */}
                <div className="prog-personnel-picker" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="prog-personnel-picker-search">
                    <Search size={13} color="var(--text-muted)" />
                    <input
                      type="text"
                      placeholder="Buscar personal por nombre o cargo..."
                      value={searchStaff}
                      onChange={e => setSearchStaff(e.target.value)}
                    />
                    {searchStaff && (
                      <button
                        type="button"
                        onClick={() => setSearchStaff('')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="prog-personnel-picker-list" style={{ flex: 1, overflowY: 'auto', maxHeight: '180px' }}>
                    {staffFiltrado.map(p => {
                      const isSelected = selectedPersonalIds.includes(p.id)
                      const cClass = getCargoClass(p.cargo)
                      const isTecnico = cClass === 'tecnico' || (p.cargo || '').includes('SUPERVISOR')

                      return (
                        <div
                          key={p.id}
                          className={`prog-personnel-picker-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleSelectStaff(p.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ cursor: 'pointer', accentColor: '#818cf8' }}
                            />
                            <div className={`person-avatar ${cClass}`} style={{ width: '22px', height: '22px', fontSize: '0.62rem', flexShrink: 0 }}>
                              {getInitials(p.nombre_completo)}
                            </div>
                            <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.8rem' }}>{p.nombre_completo}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                            <span className={`role-badge ${cClass}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>{p.cargo}</span>
                            {isTecnico && p.cuadrilla ? (
                              <span className="prog-card-cuadrilla-badge" style={{ fontSize: '0.65rem' }}>{p.cuadrilla}</span>
                            ) : (
                              <span className="prog-cuadrilla-badge-rotativo" style={{ fontSize: '0.65rem' }}>Rotativo</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {staffFiltrado.length === 0 && (
                      <div style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        No se encontró personal con ese criterio de búsqueda.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notas o Itinerario */}
              <div className="prog-form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem' }}>Notas o Itinerario (opcional)</label>
                <textarea
                  className="prog-form-control"
                  rows={2}
                  placeholder="Instrucciones para la cuadrilla, prioridades o puntos de encuentro..."
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  style={{ resize: 'none' }}
                />
              </div>
            </div>

            {/* ── COLUMNA DERECHA: SITIOS ASIGNADOS ── */}
            <div className="prog-modal-col-right">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="prog-modal-col-title">
                  <MapPin size={16} color="#818cf8" />
                  <span>2. Sitios Asignados ({selectedSites.length} seleccionados) *</span>
                </div>
                {selectedSites.length > 0 && (
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => setSelectedSites([])}
                  >
                    Limpiar selección
                  </button>
                )}
              </div>

              {/* Chips de sitios seleccionados */}
              {selectedSites.length > 0 && (
                <div className="prog-sites-selected-chips-box">
                  {selectedSites.map(siteId => {
                    const siteInfo = sitiosMap[siteId]
                    const codLugar = siteInfo?.codigo_lugar || (siteId.split('-').length >= 2 ? `${siteId.split('-')[0]}-${siteId.split('-')[1]}` : siteId)
                    const loc = siteInfo?.localidad || siteInfo?.nombre_nodo || ''
                    return (
                      <span key={siteId} className="prog-site-selected-chip" title={`${siteId} - ${siteInfo?.nombre_nodo || ''} - ${siteInfo?.localidad || ''}`}>
                        <strong style={{ color: '#c7d2fe' }}>{codLugar}</strong>
                        <span style={{ opacity: 0.85 }}>({siteId})</span>
                        {loc && <span style={{ opacity: 0.75, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {loc}</span>}
                        <X
                          size={12}
                          style={{ cursor: 'pointer', marginLeft: '2px' }}
                          onClick={() => toggleSelectSite(siteId)}
                        />
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Buscador de sitios */}
              <div className="prog-sites-picker-search-bar">
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Buscar por código de lugar (ej: AM-0038), localidad, nombre, zona..."
                  value={searchSite}
                  onChange={e => setSearchSite(e.target.value)}
                />
                {searchSite && (
                  <button
                    type="button"
                    onClick={() => setSearchSite('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={13} />
                  </button>
                )}
                <span className="prog-sites-picker-count-badge">
                  {sitiosFiltrados.length} sitios
                </span>
              </div>

              {/* Lista rica de sitios disponibles con Código de Lugar, Localidad, Nombre y Zona */}
              <div className="prog-sites-rich-list">
                {sitiosFiltrados.map(s => {
                  const isSelected = selectedSites.includes(s.id_site)
                  const codLugar = s.codigo_lugar || (s.id_site.split('-').length >= 2 ? `${s.id_site.split('-')[0]}-${s.id_site.split('-')[1]}` : s.id_site)

                  return (
                    <div
                      key={s.id_site}
                      className={`prog-site-card-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSelectSite(s.id_site)}
                    >
                      <div className="prog-site-card-top">
                        <div className="prog-site-card-left">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ cursor: 'pointer', accentColor: '#818cf8', width: '15px', height: '15px' }}
                          />
                          <span className="prog-site-lugar-tag" title="Código de Lugar">
                            {codLugar}
                          </span>
                          <span className="prog-site-id-tag">
                            {s.id_site}
                          </span>
                        </div>

                        <div className="prog-site-card-badges">
                          {s.zona && <span className="prog-site-zona-tag">{s.zona}</span>}
                          {s.grupo && <span className="prog-site-grupo-tag">{s.grupo}</span>}
                        </div>
                      </div>

                      <div className="prog-site-card-grid">
                        <div className="prog-site-card-prop">
                          <span className="prop-label">Localidad:</span>
                          <span className="prop-val" title={s.localidad || 'Sin localidad'}>
                            <MapPin size={11} style={{ marginRight: 3, verticalAlign: 'middle', opacity: 0.7 }} />
                            {s.localidad || '—'}
                          </span>
                        </div>

                        <div className="prog-site-card-prop">
                          <span className="prop-label">Nombre:</span>
                          <span className="prop-val" title={s.nombre_nodo || s.id_site}>
                            {s.nombre_nodo || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {sitiosFiltrados.length === 0 && (
                  <div style={{ padding: '1.8rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No se encontraron sitios con ese criterio de búsqueda.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="prog-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Programación')}
            </button>
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
  const { user } = useAuth()
  const [currentSitioId, setCurrentSitioId] = useState(sitioId || '')
  const [observaciones, setObservaciones] = useState([])
  const [comments, setComments] = useState({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [savingCommentId, setSavingCommentId] = useState(null)
  const [savedCommentId, setSavedCommentId] = useState(null)

  // Ref con los comentarios modificados (dirty) para autoguardarlos al cerrar
  const dirtyCommentsRef = useRef(new Set())
  const commentsRef = useRef({})
  commentsRef.current = comments

  const team = (prog?.equipo && prog.equipo.length > 0) ? prog.equipo : [prog?.personal || {}]

  // Candidatos para persona que valida/descarta/rechaza
  const teamOptions = useMemo(() => {
    return (team || []).filter(m => m && m.nombre_completo)
  }, [team])

  // Personal de GILAT (Supervisores / Auditores / Validadores)
  const gilatOptions = useMemo(() => {
    return (tecnicos || []).filter(t => t && t.nombre_completo && (t.empresa || '').toUpperCase() === 'GILAT')
  }, [tecnicos])

  // Personal de COVEPA fuera de ruta
  const covepaOptions = useMemo(() => {
    const teamNames = new Set(teamOptions.map(t => t.nombre_completo))
    return (tecnicos || []).filter(t => t && t.nombre_completo && (!t.empresa || t.empresa.toUpperCase() === 'COVEPA') && !teamNames.has(t.nombre_completo))
  }, [tecnicos, teamOptions])

  const currentUserOption = useMemo(() => {
    const name = user?.user_metadata?.full_name || user?.email?.split('@')[0]
    return name || ''
  }, [user])

  const allKnownNames = useMemo(() => {
    const s = new Set()
    teamOptions.forEach(t => s.add(t.nombre_completo))
    gilatOptions.forEach(t => s.add(t.nombre_completo))
    covepaOptions.forEach(t => s.add(t.nombre_completo))
    if (currentUserOption) s.add(currentUserOption)
    return s
  }, [teamOptions, gilatOptions, covepaOptions, currentUserOption])

  const defaultRevisorName = useMemo(() => {
    if (teamOptions.length > 0) {
      const tec = teamOptions.find(m => {
        const c = (m.cargo || '').toUpperCase()
        return c.includes('TECN') || c.includes('TÉCN')
      })
      return tec?.nombre_completo || teamOptions[0]?.nombre_completo || ''
    }
    return currentUserOption || ''
  }, [teamOptions, currentUserOption])

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
      data.forEach(o => {
        initialComments[o.id_obs] = o.comentario_covepa || ''
      })
      setComments(initialComments)
      dirtyCommentsRef.current.clear()
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }, [currentSitioId])

  useEffect(() => {
    loadObs()
  }, [loadObs])

  // Acción rápida: Marcar observación
  const handleSetEstado = async (obs, nuevoEstado) => {
    setUpdatingId(obs.id_obs)
    try {
      const isSinRevision = nuevoEstado === 'Pendiente' || nuevoEstado === 'En Revision' || nuevoEstado === 'En Revisión'
      const payload = {
        estado_covepa: nuevoEstado,
        fecha_subsanacion: isSinRevision ? null : (obs.fecha_subsanacion || toLocalDateString(new Date())),
        revisor: isSinRevision ? null : (obs.revisor || obs.validado_por || defaultRevisorName || null)
      }
      await updateObservacionCovepa(obs.id_obs, payload)

      // Actualizar localmente
      setObservaciones(prev => prev.map(o => {
        if (o.id_obs === obs.id_obs) {
          return {
            ...o,
            estado_covepa: payload.estado_covepa,
            fecha_subsanacion: payload.fecha_subsanacion,
            revisor: payload.revisor
          }
        }
        return o
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
      const val = newRevisor || null
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
      await updateObservacionCovepa(obsId, { comentario_covepa: val })
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

  // Guardado automático global de comentarios pendientes al cerrar la ventana
  const handleCloseWithAutoSave = useCallback(async () => {
    const dirtyIds = Array.from(dirtyCommentsRef.current)
    if (dirtyIds.length > 0) {
      try {
        await Promise.all(
          dirtyIds.map(id =>
            updateObservacionCovepa(id, { comentario_covepa: commentsRef.current[id] ?? '' })
          )
        )
        dirtyCommentsRef.current.clear()
        onObservationUpdated()
      } catch (err) {
        console.error('Error al autoguardar comentarios al cerrar:', err)
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

  // Resumen del sitio actual
  const stats = useMemo(() => {
    let tot = observaciones.length
    let validadas = 0
    let descartadas = 0
    let pendientes = 0
    let enRevision = 0
    let rechazadas = 0
    let enviadas = 0

    observaciones.forEach(o => {
      const st = o.estado_covepa || (o.fecha_subsanacion ? 'Validado' : 'Pendiente')
      if (st === 'Validado') validadas++
      else if (st === 'Descartado') descartadas++
      else if (st === 'En Revision') enRevision++
      else if (st === 'Rechazado') rechazadas++
      else if (st === 'Enviado') enviadas++
      else pendientes++
    })
    return { tot, validadas, descartadas, pendientes, enRevision, rechazadas, enviadas }
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
        const st = o.estado_covepa || (o.fecha_subsanacion ? 'Validado' : 'Pendiente')
        return st === filtroModal
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
          comentario
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
          { name: 'COMENTARIO COVEPA', filterButton: true }
        ],
        rows: tableRows
      })

      // Anchos de columna óptimos
      const colWidths = [6, 20, 18, 26, 16, 44, 44, 44, 24, 18, 35]
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
            wrapText: colNumber === 6 || colNumber === 7 || colNumber === 8 || colNumber === 11
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
    <div className="prog-details-modal-overlay" onClick={handleCloseWithAutoSave}>
      <div className="prog-details-modal" onClick={e => e.stopPropagation()}>
        {/* Cabecera de la ventana centrada */}
        <div className="prog-details-modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                📅 {prog?.fecha}
              </span>
              {prog?.notas && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#e2e8f0',
                    background: 'rgba(255,255,255,0.06)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={prog.notas}
                >
                  Itinerario: {prog.notas}
                </span>
              )}
            </div>

            {/* Pestañas para cambiar de sitio si la programación tiene más de un sitio */}
            {allSitios.length > 1 && (
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                {allSitios.map(s => {
                  const sId = s.id_sitio || s
                  const isActive = sId === currentSitioId
                  const loc = sitiosMap[sId]?.localidad || sitiosMap[sId]?.nombre_nodo
                  return (
                    <button
                      key={sId}
                      type="button"
                      onClick={() => setCurrentSitioId(sId)}
                      style={{
                        background: isActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${isActive ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                        color: isActive ? '#a5b4fc' : '#94a3b8',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                      title={loc ? `${sId} - ${loc}` : sId}
                    >
                      <MapPin size={11} color={isActive ? '#818cf8' : '#94a3b8'} />
                      <span>{sId}</span>
                      {loc && (
                        <span style={{ opacity: 0.85, fontWeight: 500, fontSize: '0.72rem' }}>
                          · {loc}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.3rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <MapPin size={20} color="#818cf8" />
                <span>{currentSitioId}</span>
                {siteInfo.localidad && (
                  <span style={{ fontSize: '1.05rem', color: '#60a5fa', fontWeight: 600 }}>
                    - {siteInfo.localidad}
                  </span>
                )}
              </h2>
              {siteInfo.grupo && (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  ({siteInfo.grupo} · {siteInfo.zona}{siteInfo.distrito ? ` · ${siteInfo.distrito}` : ''})
                </span>
              )}
            </div>

            {/* Personal en ruta */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#818cf8', fontWeight: 700, marginBottom: '0.25rem' }}>
                Personal en ruta:
              </div>
              <div className="prog-team-list">
                {team.map((member, mIdx) => {
                  const cClass = getCargoClass(member.cargo)
                  const isTecnico = cClass === 'tecnico' || (member.cargo || '').includes('SUPERVISOR')
                  return (
                    <div key={member.id || mIdx} className="prog-team-member">
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.82rem' }}>
                        {member.nombre_completo || 'Sin nombre'}
                      </strong>
                      <span className={`role-badge ${cClass}`}>{member.cargo || 'PERSONAL'}</span>
                      {isTecnico && member.cuadrilla ? (
                        <span className="prog-card-cuadrilla-badge">{member.cuadrilla}</span>
                      ) : (
                        <span className="prog-cuadrilla-badge-rotativo">Apoyo rotativo</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Acciones de la programación: Editar, Eliminar y Cerrar */}
          <div className="prog-details-modal-actions">
            <button
              type="button"
              className="prog-details-action-btn edit"
              title="Editar detalles de esta programación"
              onClick={() => {
                handleCloseWithAutoSave()
                onEditProg(prog)
              }}
            >
              <Edit3 size={13} />
              <span>Editar</span>
            </button>

            <button
              type="button"
              className="prog-details-action-btn delete"
              title="Eliminar esta programación"
              onClick={() => onDeleteProg(prog.id)}
            >
              <Trash2 size={13} />
              <span>Eliminar</span>
            </button>

            <button
              type="button"
              className="btn-close"
              onClick={handleCloseWithAutoSave}
              title="Cerrar y guardar cambios"
              style={{ marginLeft: '0.25rem' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Resumen de contadores del sitio convertidos en botones de filtro interactivo */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '0.5rem',
          padding: '0.65rem 1.4rem',
          background: 'rgba(0,0,0,0.25)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          {/* Todas */}
          <button
            type="button"
            onClick={() => setFiltroModal('ALL')}
            style={{
              background: filtroModal === 'ALL' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${filtroModal === 'ALL' ? '#818cf8' : 'rgba(255, 255, 255, 0.06)'}`,
              borderRadius: '8px',
              padding: '0.45rem',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ fontSize: '0.68rem', color: filtroModal === 'ALL' ? '#a5b4fc' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: filtroModal === 'ALL' ? '#fff' : 'var(--text-main)' }}>
              {stats.tot}
            </div>
          </button>

          {/* Validadas (Por subir) */}
          <button
            type="button"
            onClick={() => setFiltroModal(filtroModal === 'Validado' ? 'ALL' : 'Validado')}
            title="Ver únicamente observaciones validadas en campo esperando ser subidas"
            style={{
              background: filtroModal === 'Validado' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.05)',
              border: `1px solid ${filtroModal === 'Validado' ? '#10b981' : 'rgba(16, 185, 129, 0.2)'}`,
              borderRadius: '8px',
              padding: '0.45rem',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ fontSize: '0.66rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              ✓ Por Subir
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981' }}>
              {stats.validadas}
            </div>
          </button>

          {/* En Revisión */}
          <button
            type="button"
            onClick={() => setFiltroModal(filtroModal === 'En Revision' ? 'ALL' : 'En Revision')}
            title="Ver observaciones que están actualmente en proceso de revisión"
            style={{
              background: filtroModal === 'En Revision' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.05)',
              border: `1px solid ${filtroModal === 'En Revision' ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)'}`,
              borderRadius: '8px',
              padding: '0.45rem',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ fontSize: '0.66rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              🔍 En Revisión
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>
              {stats.enRevision}
            </div>
          </button>

          {/* Pendientes */}
          <button
            type="button"
            onClick={() => setFiltroModal(filtroModal === 'Pendiente' ? 'ALL' : 'Pendiente')}
            style={{
              background: filtroModal === 'Pendiente' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.05)',
              border: `1px solid ${filtroModal === 'Pendiente' ? '#f59e0b' : 'rgba(245, 158, 11, 0.2)'}`,
              borderRadius: '8px',
              padding: '0.45rem',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ fontSize: '0.66rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700 }}>
              Pendientes
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f59e0b' }}>
              {stats.pendientes}
            </div>
          </button>

          {/* Descartadas */}
          <button
            type="button"
            onClick={() => setFiltroModal(filtroModal === 'Descartado' ? 'ALL' : 'Descartado')}
            style={{
              background: filtroModal === 'Descartado' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.05)',
              border: `1px solid ${filtroModal === 'Descartado' ? '#94a3b8' : 'rgba(148, 163, 184, 0.2)'}`,
              borderRadius: '8px',
              padding: '0.45rem',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ fontSize: '0.66rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
              Descartadas
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#94a3b8' }}>
              {stats.descartadas}
            </div>
          </button>

          {/* Enviadas (Si hay o si se quiere ver) */}
          <button
            type="button"
            onClick={() => setFiltroModal(filtroModal === 'Enviado' ? 'ALL' : 'Enviado')}
            style={{
              background: filtroModal === 'Enviado' ? 'rgba(192, 132, 252, 0.25)' : 'rgba(192, 132, 252, 0.05)',
              border: `1px solid ${filtroModal === 'Enviado' ? '#c084fc' : 'rgba(192, 132, 252, 0.2)'}`,
              borderRadius: '8px',
              padding: '0.45rem',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ fontSize: '0.66rem', color: '#c084fc', textTransform: 'uppercase', fontWeight: 700 }}>
              ✉ Enviadas
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#c084fc' }}>
              {stats.enviadas}
            </div>
          </button>

          {/* Rechazadas (sólo si existen) */}
          {stats.rechazadas > 0 && (
            <button
              type="button"
              onClick={() => setFiltroModal(filtroModal === 'Rechazado' ? 'ALL' : 'Rechazado')}
              style={{
                background: filtroModal === 'Rechazado' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.05)',
                border: `1px solid ${filtroModal === 'Rechazado' ? '#ef4444' : 'rgba(239, 68, 68, 0.2)'}`,
                borderRadius: '8px',
                padding: '0.45rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ fontSize: '0.66rem', color: '#ef4444', textTransform: 'uppercase', fontWeight: 700 }}>
                Rechazadas
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ef4444' }}>
                {stats.rechazadas}
              </div>
            </button>
          )}
        </div>

        {/* Barra de herramientas: Buscador interactivo y Botón de Descarga Excel (.xlsx) */}
        <div style={{
          padding: '0.65rem 1.4rem',
          background: 'rgba(0, 0, 0, 0.18)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: '240px', maxWidth: '480px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="text"
                value={searchObs}
                onChange={(e) => setSearchObs(e.target.value)}
                placeholder="Buscar por código de observación (ej. OBS-1234)..."
                style={{
                  width: '100%',
                  padding: '0.45rem 2rem 0.45rem 2.2rem',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  fontSize: '0.82rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#818cf8'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
              />
              {searchObs && (
                <button
                  type="button"
                  onClick={() => setSearchObs('')}
                  title="Limpiar búsqueda"
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {searchObs && (
              <span style={{ fontSize: '0.74rem', color: '#818cf8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {filteredObservaciones.length} resultado(s)
              </span>
            )}
          </div>

          {/* Botón de Exportación a Excel (.xlsx) */}
          <button
            type="button"
            onClick={handleExportXLSX}
            disabled={exportingXlsx || observaciones.length === 0}
            className="prog-export-btn"
            title={`Descargar las ${filteredObservaciones.length} observaciones en formato Excel (.xlsx)`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#6ee7b7',
              borderRadius: '6px',
              padding: '0.42rem 0.85rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: (exportingXlsx || observaciones.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (exportingXlsx || observaciones.length === 0) ? 0.6 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            <FileSpreadsheet size={15} color="#34d399" />
            <span>{exportingXlsx ? 'Generando Excel...' : 'Descargar Excel (.xlsx)'}</span>
          </button>
        </div>

        {/* Lista de observaciones: Código, Detalle, Acuerdo de Subsanación y Estado */}
        <div className="prog-details-modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Cargando observaciones del sitio {currentSitioId}...
            </div>
          ) : errorMsg ? (
            <div style={{ color: '#ef4444', padding: '1rem' }}>{errorMsg}</div>
          ) : observaciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              El sitio {currentSitioId} no tiene observaciones registradas en el sistema.
            </div>
          ) : filteredObservaciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
              {searchObs ? (
                <div>No se encontraron observaciones con el código <strong>"{searchObs}"</strong>.</div>
              ) : (
                <div>No hay observaciones en estado <strong>{filtroModal}</strong> para este sitio.</div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
                {searchObs && (
                  <button
                    type="button"
                    onClick={() => setSearchObs('')}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#f1f5f9',
                      borderRadius: '6px',
                      padding: '0.35rem 0.85rem',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}
                  >
                    Borrar búsqueda
                  </button>
                )}
                {filtroModal !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setFiltroModal('ALL')}
                    style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid #818cf8',
                      color: '#fff',
                      borderRadius: '6px',
                      padding: '0.35rem 0.85rem',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}
                  >
                    Ver todas las observaciones ({stats.tot})
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredObservaciones.map(obs => {
              const currentEstado = obs.estado_covepa || (obs.fecha_subsanacion ? 'Validado' : 'Pendiente')
              const isUpdating = updatingId === obs.id_obs
              const showRevisorYFecha = currentEstado !== 'Pendiente' && currentEstado !== 'En Revision' && currentEstado !== 'En Revisión'

              return (
                <div
                  key={obs.id_obs}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '8px',
                    padding: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                    transition: 'border-color 0.2s'
                  }}
                >
                  {/* 1. Código y Selector de Estado en la parte superior derecha */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                        Código:
                      </span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9', fontSize: '0.88rem', letterSpacing: '0.02em' }}>
                        {obs.id_obs}
                      </span>
                    </div>

                    {/* Selector de estado y apartado de fecha en la parte superior derecha */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {/* Apartado de persona que valida: aparece en todos los estados excepto Pendiente y En Revisión */}
                      {showRevisorYFecha && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            padding: '0.2rem 0.5rem'
                          }}
                        >
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Users size={11} color="#38bdf8" />
                            Revisado por:
                          </span>
                          <select
                            value={obs.revisor || obs.validado_por || ''}
                            disabled={isUpdating}
                            onChange={(e) => handleUpdateRevisor(obs, e.target.value)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#38bdf8',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              outline: 'none',
                              maxWidth: '180px'
                            }}
                            title="Persona que revisó esta observación"
                          >
                            <option value="" style={{ background: '#1e293b', color: '#94a3b8' }}>
                              -- Seleccionar --
                            </option>
                            {teamOptions.length > 0 && (
                              <optgroup label="Personal en ruta (COVEPA)" style={{ background: '#0f172a', color: '#a5b4fc' }}>
                                {teamOptions.map(p => (
                                  <option key={p.id || p.nombre_completo} value={p.nombre_completo} style={{ background: '#1e293b', color: '#f1f5f9' }}>
                                    {p.nombre_completo} {p.cargo ? `(${p.cargo})` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {gilatOptions.length > 0 && (
                              <optgroup label="Personal GILAT (Auditor / Revisor)" style={{ background: '#0f172a', color: '#38bdf8' }}>
                                {gilatOptions.map(p => (
                                  <option key={p.id || p.nombre_completo} value={p.nombre_completo} style={{ background: '#1e293b', color: '#38bdf8' }}>
                                    {p.nombre_completo} {p.cargo ? `(${p.cargo})` : '(GILAT)'}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {covepaOptions.length > 0 && (
                              <optgroup label="Equipo COVEPA" style={{ background: '#0f172a', color: '#a5b4fc' }}>
                                {covepaOptions.map(p => (
                                  <option key={p.id || p.nombre_completo} value={p.nombre_completo} style={{ background: '#1e293b', color: '#f1f5f9' }}>
                                    {p.nombre_completo} {p.cargo ? `(${p.cargo})` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {currentUserOption && (
                              <optgroup label="Usuario en sesión" style={{ background: '#0f172a', color: '#a5b4fc' }}>
                                <option value={currentUserOption} style={{ background: '#1e293b', color: '#f1f5f9' }}>
                                  {currentUserOption}
                                </option>
                              </optgroup>
                            )}
                            {(obs.revisor || obs.validado_por) && !allKnownNames.has(obs.revisor || obs.validado_por) && (
                              <option value={obs.revisor || obs.validado_por} style={{ background: '#1e293b', color: '#f1f5f9' }}>
                                {obs.revisor || obs.validado_por}
                              </option>
                            )}
                          </select>
                        </div>
                      )}

                      {/* Apartado de fecha: aparece en todos los estados excepto Pendiente y En Revisión */}
                      {showRevisorYFecha && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            padding: '0.2rem 0.5rem'
                          }}
                        >
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                            {currentEstado === 'Validado' ? 'F. Validación:' :
                             currentEstado === 'Descartado' ? 'F. Descarte:' :
                             currentEstado === 'Rechazado' ? 'F. Rechazo:' :
                             currentEstado === 'En Revision' ? 'F. Revisión:' :
                             currentEstado === 'Enviado' ? 'F. Envío:' : 'Fecha:'}
                          </span>
                          <input
                            type="date"
                            value={obs.fecha_subsanacion ? String(obs.fecha_subsanacion).split('T')[0].split(' ')[0] : ''}
                            disabled={isUpdating}
                            onChange={(e) => handleUpdateFecha(obs, e.target.value)}
                            title="Haz clic para modificar la fecha si es necesario"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color:
                                currentEstado === 'Validado' ? '#34d399' :
                                currentEstado === 'Descartado' ? '#cbd5e1' :
                                currentEstado === 'Rechazado' ? '#f87171' :
                                currentEstado === 'En Revision' ? '#38bdf8' :
                                currentEstado === 'Enviado' ? '#e9d5ff' : '#f1f5f9',
                              fontSize: '0.74rem',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              cursor: 'pointer',
                              outline: 'none',
                              colorScheme: 'dark',
                              padding: 0
                            }}
                          />
                        </div>
                      )}
                      <select
                        value={currentEstado}
                        disabled={isUpdating}
                        onChange={(e) => handleSetEstado(obs, e.target.value)}
                        style={{
                          background:
                            currentEstado === 'Validado' ? 'rgba(16, 185, 129, 0.15)' :
                            currentEstado === 'Descartado' ? 'rgba(100, 116, 139, 0.22)' :
                            currentEstado === 'Rechazado' ? 'rgba(239, 68, 68, 0.18)' :
                            currentEstado === 'En Revision' ? 'rgba(56, 189, 248, 0.18)' :
                            currentEstado === 'Enviado' ? 'rgba(192, 132, 252, 0.18)' :
                            'rgba(245, 158, 11, 0.18)',
                          border: `1px solid ${
                            currentEstado === 'Validado' ? 'rgba(16, 185, 129, 0.5)' :
                            currentEstado === 'Descartado' ? 'rgba(100, 116, 139, 0.5)' :
                            currentEstado === 'Rechazado' ? 'rgba(239, 68, 68, 0.5)' :
                            currentEstado === 'En Revision' ? 'rgba(56, 189, 248, 0.5)' :
                            currentEstado === 'Enviado' ? 'rgba(192, 132, 252, 0.5)' :
                            'rgba(245, 158, 11, 0.5)'
                          }`,
                          color:
                            currentEstado === 'Validado' ? '#34d399' :
                            currentEstado === 'Descartado' ? '#cbd5e1' :
                            currentEstado === 'Rechazado' ? '#f87171' :
                            currentEstado === 'En Revision' ? '#38bdf8' :
                            currentEstado === 'Enviado' ? '#e9d5ff' :
                            '#fbbf24',
                          borderRadius: '6px',
                          padding: '0.24rem 0.6rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: isUpdating ? 'wait' : 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="Pendiente" style={{ background: '#1e293b', color: '#fbbf24' }}>● Pendiente</option>
                        <option value="En Revision" style={{ background: '#1e293b', color: '#38bdf8' }}>🔍 En Revisión</option>
                        <option value="Validado" style={{ background: '#1e293b', color: '#34d399' }}>✓ Validado (Esperando subida)</option>
                        <option value="Rechazado" style={{ background: '#1e293b', color: '#f87171' }}>✕ Rechazado</option>
                        <option value="Descartado" style={{ background: '#1e293b', color: '#cbd5e1' }}>🚫 Descartado</option>
                        <option value="Enviado" style={{ background: '#1e293b', color: '#e9d5ff' }}>✉ Enviado (Subido)</option>
                      </select>
                    </div>
                  </div>

                  {/* 2. Detalle de la observación (solo si no está vacío) */}
                  {hasMeaningfulText(obs.detalle) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                        Detalle:
                      </span>
                      <div style={{ fontSize: '0.84rem', color: '#e2e8f0', lineHeight: 1.45, background: 'rgba(0, 0, 0, 0.15)', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        {obs.detalle}
                      </div>
                    </div>
                  )}

                  {/* 3. Comentario Inicial (solo si no está vacío) */}
                  {hasMeaningfulText(obs.comentario_inicial) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>
                        Comentario Inicial:
                      </span>
                      <div style={{ fontSize: '0.84rem', color: '#fef3c7', lineHeight: 1.45, background: 'rgba(245, 158, 11, 0.06)', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.18)' }}>
                        {obs.comentario_inicial}
                      </div>
                    </div>
                  )}

                  {/* 4. Acuerdo de Subsanación (solo si no está vacío) */}
                  {hasMeaningfulText(obs.acuerdo_subsanacion) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 600 }}>
                        Acuerdo de Subsanación:
                      </span>
                      <div style={{
                        fontSize: '0.84rem',
                        color: '#c7d2fe',
                        lineHeight: 1.45,
                        background: 'rgba(99, 102, 241, 0.08)',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(99, 102, 241, 0.2)'
                      }}>
                        {obs.acuerdo_subsanacion}
                      </div>
                    </div>
                  )}

                  {/* 4. Apartado Comentario COVEPA */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.15rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        💬 Comentario COVEPA:
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {savingCommentId === obs.id_obs && (
                          <span style={{ fontSize: '0.7rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <RefreshCw size={11} className="spin" /> Guardando...
                          </span>
                        )}
                        {savedCommentId === obs.id_obs && (
                          <span style={{ fontSize: '0.7rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Check size={12} /> Guardado
                          </span>
                        )}
                        {dirtyCommentsRef.current.has(obs.id_obs) && savingCommentId !== obs.id_obs && (
                          <button
                            type="button"
                            onClick={() => handleBlurComment(obs.id_obs)}
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid #38bdf8',
                              color: '#38bdf8',
                              borderRadius: '4px',
                              padding: '0.15rem 0.5rem',
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <Save size={11} /> Guardar comentario
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={comments[obs.id_obs] ?? ''}
                      onChange={(e) => handleCommentChange(obs.id_obs, e.target.value)}
                      onBlur={() => handleBlurComment(obs.id_obs)}
                      placeholder="Escribe un comentario o nota para esta observación (se guarda automáticamente)..."
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        color: '#f1f5f9',
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.82rem',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        minHeight: '44px',
                        outline: 'none',
                        lineHeight: 1.4,
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'rgba(56, 189, 248, 0.5)'
                      }}
                    />
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
