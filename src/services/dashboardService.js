import { supabase } from '../lib/supabase'
import { supabaseExt } from '../lib/supabase'
import { ASIGNACIONES_BASE } from './sitiosService'
import { fetchPersonal, DEFAULT_CUADRILLAS_CONFIG } from './personalService.js'

// Cache en memoria de catálogo de sitios para no saturar la BD externa
let cachedSitiosCatalog = null

export function getDiasSemanaActual() {
  const now = new Date()
  let peruStr = ''
  try {
    peruStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(now)
  } catch {
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    peruStr = `${y}-${m}-${d}`
  }

  const [y, m, d] = peruStr.split('-').map(Number)
  const todayLima = new Date(y, m - 1, d)
  const dayOfWeek = (todayLima.getDay() + 6) % 7 // Lunes = 0 ... Domingo = 6
  const monday = new Date(todayLima)
  monday.setDate(todayLima.getDate() - dayOfWeek)

  const DIAS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const dias = []

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday)
    cur.setDate(monday.getDate() + i)
    const yyyy = cur.getFullYear()
    const mm = String(cur.getMonth() + 1).padStart(2, '0')
    const dd = String(cur.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`
    dias.push({
      dateStr,
      diaSemana: DIAS_SHORT[i],
      diaNombre: DIAS_FULL[i],
      shortLabel: `${DIAS_SHORT[i]} ${dd}/${mm}`,
      dayNum: dd,
      monthNum: mm,
      isToday: dateStr === peruStr
    })
  }

  return {
    dias,
    todayStr: peruStr,
    rangoSemana: `${dias[0].shortLabel} - ${dias[6].shortLabel}`
  }
}

export function getLimaDateStr(dateVal) {
  if (!dateVal) return null
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return String(dateVal).slice(0, 10)
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d)
  } catch {
    return String(dateVal).slice(0, 10)
  }
}

export async function getSitiosCatalogMap() {
  if (cachedSitiosCatalog) return cachedSitiosCatalog

  const map = {}
  try {
    const { data, error } = await supabaseExt
      .from('sitios')
      .select('id_site, nombre_nodo, localidad, distrito, provincia')

    if (!error && data) {
      data.forEach(s => {
        map[s.id_site] = {
          nombre_nodo: s.nombre_nodo,
          localidad: s.localidad,
          distrito: s.distrito,
          provincia: s.provincia
        }
      })
    }
  } catch (err) {
    console.warn('Advertencia al consultar catálogo de sitios externos:', err.message)
  }

  cachedSitiosCatalog = map
  return map
}

/**
 * Obtiene el resumen global del proyecto (conteos exactos en paralelo)
 */
export async function getGlobalMetrics() {
  try {
    const [totalRes, valRes, solRes, revRes, descRes, rechRes] = await Promise.all([
      supabase.from('observaciones').select('*', { count: 'exact', head: true }),
      supabase
        .from('observaciones')
        .select('*', { count: 'exact', head: true })
        .or('estado_covepa.eq.Validado,estado_covepa.eq.Enviado,and(fecha_subsanacion.not.is.null,estado_covepa.neq.Descartado,estado_covepa.neq.En Revision,estado_covepa.neq.En Revisión,estado_covepa.neq.Solicitando Revision,estado_covepa.neq.Solicitando Revisión,estado_covepa.neq.Rechazado)'),
      supabase
        .from('observaciones')
        .select('*', { count: 'exact', head: true })
        .or('estado_covepa.eq.Solicitando Revision,estado_covepa.eq.Solicitando Revisión'),
      supabase
        .from('observaciones')
        .select('*', { count: 'exact', head: true })
        .or('estado_covepa.eq.En Revision,estado_covepa.eq.En Revisión'),
      supabase
        .from('observaciones')
        .select('*', { count: 'exact', head: true })
        .eq('estado_covepa', 'Descartado'),
      supabase
        .from('observaciones')
        .select('*', { count: 'exact', head: true })
        .eq('estado_covepa', 'Rechazado')
    ])

    const total = totalRes.count || 0
    const validadas = valRes.count || 0
    const solicitando = solRes.count || 0
    const enRevision = revRes.count || 0
    const descartadas = descRes.count || 0
    const rechazadas = rechRes.count || 0
    const resueltas = validadas + descartadas
    const pendientes = Math.max(0, total - (resueltas + solicitando + enRevision + rechazadas))
    const porcentajeGlobal = total > 0 ? ((resueltas / total) * 100).toFixed(1) : '0.0'

    return {
      total,
      validadas,
      solicitando,
      enRevision,
      descartadas,
      rechazadas,
      resueltas,
      pendientes,
      porcentajeGlobal: parseFloat(porcentajeGlobal)
    }
  } catch (err) {
    console.error('Error obteniendo métricas globales:', err)
    return {
      total: 0,
      validadas: 0,
      enRevision: 0,
      descartadas: 0,
      enviadas: 0,
      rechazadas: 0,
      resueltas: 0,
      pendientes: 0,
      porcentajeGlobal: 0
    }
  }
}

function getTodayDateStr() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Obtiene todo lo avanzado en una fecha específica (por defecto hoy)
 * Cruza con técnicos asignados a la jornada, observaciones en revisión y catálogo de sitios
 */
export async function getAvancePorFecha(fechaStr) {
  try {
    const startIso = `${fechaStr}T00:00:00`
    const endIso = `${fechaStr}T23:59:59`
    const isToday = fechaStr === getTodayDateStr()

    // Cargar catálogo de personal desde la BD externa para resolución en memoria
    let staffMap = {}
    try {
      const allStaff = await fetchPersonal()
      ;(allStaff || []).forEach(p => {
        staffMap[p.id] = p
        if (p.id_personal) staffMap[p.id_personal] = p
      })
    } catch (e) {
      console.warn('Aviso cargando personal externo en getAvancePorFecha:', e)
    }

    // 1. Obtener programaciones de la jornada sin joins relacionales a personal local
    const { data: rawProgsData, error: progErr } = await supabase
      .from('programaciones')
      .select(`
        id,
        fecha,
        id_tecnico,
        notas,
        asignaciones_personal:programacion_personal (
          id_personal
        ),
        programacion_sitios (
          id_sitio
        )
      `)
      .eq('fecha', fechaStr)

    const rawProgs = (rawProgsData || []).map(p => ({
      ...p,
      personal: staffMap[p.id_tecnico] || null,
      asignaciones_personal: (p.asignaciones_personal || []).map(ap => ({
        personal: staffMap[ap.id_personal] || null
      }))
    }))

    if (progErr) console.warn('Advertencia cargando programaciones:', progErr.message)

    // Extraer lista de sitios programados en la fecha
    const programmedSiteIds = []
    ;(rawProgs || []).forEach(p => {
      ;(p.programacion_sitios || []).forEach(s => {
        if (s.id_sitio && !programmedSiteIds.includes(s.id_sitio)) {
          programmedSiteIds.push(s.id_sitio)
        }
      })
    })

    // Mapa: id_sitio -> Técnico / Cuadrilla asignada en la fecha
    const siteTechMap = {}
    ;(rawProgs || []).forEach(p => {
      const members = []
      if (p.personal?.nombre_completo) {
        members.push({
          nombre: p.personal.nombre_completo,
          cuadrilla: p.personal.cuadrilla,
          cargo: p.personal.cargo
        })
      }
      if (Array.isArray(p.asignaciones_personal)) {
        p.asignaciones_personal.forEach(ap => {
          if (ap.personal?.nombre_completo && !members.some(m => m.nombre === ap.personal.nombre_completo)) {
            members.push({
              nombre: ap.personal.nombre_completo,
              cuadrilla: ap.personal.cuadrilla,
              cargo: ap.personal.cargo
            })
          }
        })
      }

      const mainTech = members[0] || { nombre: 'Técnico en ruta', cuadrilla: null }
      const allNames = members.map(m => m.nombre).join(', ')

      ;(p.programacion_sitios || []).forEach(s => {
        if (s.id_sitio) {
          siteTechMap[s.id_sitio] = {
            nombre: mainTech.nombre,
            cuadrilla: mainTech.cuadrilla,
            equipoCompleto: allNames
          }
        }
      })
    })

    // 2. Obtener observaciones con fecha de revisión en ese día
    const { data: rawObsFecha, error: obsErr } = await supabase
      .from('observaciones')
      .select('id_obs, id_sitio, estado_covepa, fecha_subsanacion, revisor, detalle, subsistema, protocolo')
      .gte('fecha_subsanacion', startIso)
      .lte('fecha_subsanacion', endIso)
      .order('fecha_subsanacion', { ascending: false })

    if (obsErr) throw obsErr

    // 3. Obtener observaciones en estado 'En Revision' o 'Solicitando Revisión' (que no tienen fecha_subsanacion)
    // Para la fecha de hoy se traen todas las que están en revisión activa en el sistema.
    // Para otras fechas, las que pertenezcan a los sitios programados en esa fecha.
    let revisionQuery = supabase
      .from('observaciones')
      .select('id_obs, id_sitio, estado_covepa, fecha_subsanacion, revisor, detalle, subsistema, protocolo')
      .or('estado_covepa.eq.En Revision,estado_covepa.eq.En Revisión,estado_covepa.eq.Solicitando Revision,estado_covepa.eq.Solicitando Revisión')

    if (!isToday) {
      if (programmedSiteIds.length > 0) {
        revisionQuery = revisionQuery.in('id_sitio', programmedSiteIds)
      } else {
        revisionQuery = null
      }
    }

    const { data: rawObsRevision } = revisionQuery ? await revisionQuery : { data: [] }

    // Consolidar observaciones evitando duplicados
    const obsMap = new Map()
    ;(rawObsFecha || []).forEach(o => obsMap.set(o.id_obs, o))
    ;(rawObsRevision || []).forEach(o => {
      if (!obsMap.has(o.id_obs)) {
        obsMap.set(o.id_obs, o)
      }
    })
    const obsList = Array.from(obsMap.values())

    // 4. Si hay sitios en revisión no mapeados en la programación de hoy, buscar técnico en su última programación
    const missingSites = Array.from(new Set(obsList.map(o => o.id_sitio))).filter(id => !siteTechMap[id])
    if (missingSites.length > 0) {
      try {
        const { data: pastProgs } = await supabase
          .from('programaciones')
          .select(`
            fecha,
            id_tecnico,
            asignaciones_personal:programacion_personal (
              id_personal
            ),
            programacion_sitios!inner ( id_sitio )
          `)
          .in('programacion_sitios.id_sitio', missingSites)
          .order('fecha', { ascending: false })

        ;(pastProgs || []).forEach(p => {
          const pSites = p.programacion_sitios || []
          const mainStaff = staffMap[p.id_tecnico] || staffMap[p.asignaciones_personal?.[0]?.id_personal] || null
          const techName = mainStaff?.nombre_completo || 'Técnico de Cuadrilla'
          const techCuad = mainStaff?.cuadrilla || null
          pSites.forEach(s => {
            if (s.id_sitio && !siteTechMap[s.id_sitio]) {
              siteTechMap[s.id_sitio] = {
                nombre: techName,
                cuadrilla: techCuad,
                equipoCompleto: techName
              }
            }
          })
        })
      } catch (pastErr) {
        console.warn('Advertencia buscando técnicos de programaciones anteriores:', pastErr.message)
      }
    }

    // 5. Catálogo de sitios (para código de lugar y localidad)
    const sitiosMap = await getSitiosCatalogMap()

    // 6. Mapear observaciones con los datos completos
    const rows = obsList.map(o => {
      const siteId = o.id_sitio || ''
      const parts = siteId.split('-')
      const codigoLugar = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : siteId
      const siteInfo = sitiosMap[siteId] || {}
      const localidad = siteInfo.localidad || siteInfo.nombre_nodo || ''

      // Técnico asignado
      const techInfo = siteTechMap[siteId]
      const nombreTecnico = techInfo ? techInfo.nombre : (o.revisor || 'Técnico de Cuadrilla')
      const cuadrillaTecnico = techInfo?.cuadrilla || null

      // Normalizar estado
      const rawSt = (o.estado_covepa || '').trim()
      let estadoNormalizado = 'Validado'
      if (rawSt === 'Descartado') estadoNormalizado = 'Descartado'
      else if (rawSt === 'Solicitando Revision' || rawSt === 'Solicitando Revisión') estadoNormalizado = 'Solicitando Revisión'
      else if (rawSt === 'En Revision' || rawSt === 'En Revisión') estadoNormalizado = 'En Revisión'
      else if (rawSt === 'Rechazado') estadoNormalizado = 'Rechazado'
      else if (rawSt === 'Pendiente') estadoNormalizado = 'Pendiente'
      else if (rawSt === 'Validado' || rawSt === 'Enviado') estadoNormalizado = 'Validado'
      else if (o.fecha_subsanacion) estadoNormalizado = 'Validado'

      const isEnRevision = estadoNormalizado === 'En Revisión'
      const isSolicitando = estadoNormalizado === 'Solicitando Revisión'
      const isPendingReview = isEnRevision || isSolicitando

      return {
        id_obs: o.id_obs,
        id_sitio: siteId,
        codigo_lugar: codigoLugar,
        localidad: localidad,
        tecnico: nombreTecnico,
        cuadrilla: cuadrillaTecnico,
        estado: estadoNormalizado,
        revisor: (o.revisor && o.revisor.trim()) ? o.revisor.trim() : null,
        fecha_subsanacion: isPendingReview ? (o.fecha_subsanacion || 'Pendiente') : o.fecha_subsanacion,
        detalle: o.detalle,
        subsistema: o.subsistema,
        protocolo: o.protocolo
      }
    })

    // Métricas del día
    const revisionRows = rows.filter(r => r.estado === 'En Revisión')
    const solicitandoRows = rows.filter(r => r.estado === 'Solicitando Revisión')
    const sitiosEnRevision = Array.from(new Set(revisionRows.map(r => r.id_sitio)))

    const statsDia = {
      total: rows.length,
      validadas: rows.filter(r => r.estado === 'Validado').length,
      solicitando: solicitandoRows.length,
      enRevision: revisionRows.length,
      sitiosEnRevision: sitiosEnRevision,
      totalSitiosEnRevision: sitiosEnRevision.length,
      descartadas: rows.filter(r => r.estado === 'Descartado').length,
      rechazadas: rows.filter(r => r.estado === 'Rechazado').length,
      sitiosUnicos: new Set(rows.map(r => r.id_sitio)).size,
      tecnicosUnicos: new Set(rows.map(r => r.tecnico).filter(t => t && t !== 'Técnico de Cuadrilla')).size
    }

    return {
      rows,
      stats: statsDia,
      programacionesDelDia: (rawProgs || []).length
    }
  } catch (err) {
    console.error('Error en getAvancePorFecha:', err)
    throw err
  }
}

/**
 * Obtiene el consolidado general de todo el proyecto:
 * 1. Métricas exactas de observaciones (Total, Subsanadas, En Revisión, Descartadas, Rechazadas, Pendientes).
 * 2. Avance por cada uno de los 6 Grupos Territoriales.
 * 3. Consolidado por cada uno de los 156 Sitios asignados.
 */
export async function getDashboardProjectOverview() {
  try {
    // 1. Obtener catálogo externo y asignaciones
    const [sitiosCatalog, { data: dbAsig }] = await Promise.all([
      getSitiosCatalogMap(),
      supabase.from('sitios_asignados').select('id_site, grupo, zona').eq('activo', true)
    ])

    const asignaciones = (dbAsig && dbAsig.length > 0) ? dbAsig : ASIGNACIONES_BASE
    const siteMap = new Map(asignaciones.map(a => [a.id_site, a]))

    // 2. Traer todas las observaciones (ligeras: id_sitio, estado_covepa, fecha_subsanacion)
    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push(
        supabase
          .from('observaciones')
          .select('id_sitio, estado_covepa, fecha_subsanacion')
          .order('id_obs', { ascending: true })
          .range(i * 1000, (i + 1) * 1000 - 1)
      )
    }
    const results = await Promise.all(promises)
    const allRows = results.flatMap(r => r.data || [])

    // 3. Contadores Globales
    const total = allRows.length
    let validadas = 0
    let enviadas = 0
    let subsanadas = 0
    let solicitando = 0
    let enRevision = 0
    let descartadas = 0
    let rechazadas = 0
    let pendientes = 0

    // Diccionario de los 156 sitios
    const perSite = {}
    asignaciones.forEach(a => {
      const ext = sitiosCatalog[a.id_site] || {}
      perSite[a.id_site] = {
        id_sitio: a.id_site,
        nombre_nodo: ext.nombre_nodo || a.id_site,
        localidad: ext.localidad || ext.distrito || a.id_site,
        distrito: ext.distrito || '',
        provincia: ext.provincia || '',
        grupo: a.grupo || 'GRUPO 1',
        zona: a.zona || 'ZONA 2',
        total: 0,
        subsanadas: 0,
        solicitando: 0,
        enRevision: 0,
        descartadas: 0,
        rechazadas: 0,
        pendientes: 0,
        resueltas: 0,
        porcentaje: 0
      }
    })

    // Diccionario de las 6 Cuadrillas Operativas con técnico asignado
    const semanaInfo = getDiasSemanaActual()
    const semanaFechasSet = new Set(semanaInfo.dias.map(d => d.dateStr))

    const perGroup = {}
    for (let g = 1; g <= 6; g++) {
      const gName = `CUADRILLA ${g}`
      const cfg = DEFAULT_CUADRILLAS_CONFIG[gName] || {}
      
      const semanaMap = {}
      semanaInfo.dias.forEach(d => {
        semanaMap[d.dateStr] = 0
      })

      perGroup[gName] = {
        grupo: gName,
        cuadrilla: gName,
        numero: g,
        tecnico: cfg.tecnicoNombre || '',
        zona: g <= 2 ? 'ZONA 2 y ZONA 7' : 'ZONA 7',
        sitiosCount: asignaciones.filter(a => (a.cuadrilla || a.grupo || '').replace(/GRUPO/gi, 'CUADRILLA') === gName).length,
        total: 0,
        subsanadas: 0,
        solicitando: 0,
        enRevision: 0,
        descartadas: 0,
        rechazadas: 0,
        pendientes: 0,
        resueltas: 0,
        porcentaje: 0,
        semana: semanaMap,
        totalSemana: 0
      }
    }

    // Consultar si hay asignaciones dinámicas en la tabla local personal_cuadrillas
    try {
      const { data: dbCuad } = await supabase
        .from('personal_cuadrillas')
        .select('nombre_completo, cuadrilla, cargo') // M8
        .eq('activo', true)
      if (dbCuad && dbCuad.length > 0) {
        dbCuad.forEach(cRow => {
          const cName = (cRow.cuadrilla || '').toUpperCase().trim().replace(/GRUPO/gi, 'CUADRILLA')
          const isLead = (cRow.cargo || '').toUpperCase().includes('TÉCNICO') || (cRow.cargo || '').toUpperCase().includes('SUPERVISOR')
          if (isLead && perGroup[cName]) {
            perGroup[cName].tecnico = cRow.nombre_completo || cRow.nombre || perGroup[cName].tecnico
          }
        })
      }
    } catch {
      // Mantener fallback de DEFAULT_CUADRILLAS_CONFIG
    }

    // Procesar observaciones con normalización consistente
    allRows.forEach(row => {
      const rawSt = (row.estado_covepa || '').trim()
      let st = 'Pendiente'
      if (rawSt === 'Descartado') st = 'Descartado'
      else if (rawSt === 'Solicitando Revision' || rawSt === 'Solicitando Revisión') st = 'Solicitando Revisión'
      else if (rawSt === 'En Revision' || rawSt === 'En Revisión') st = 'En Revisión'
      else if (rawSt === 'Rechazado') st = 'Rechazado'
      else if (rawSt === 'Validado' || rawSt === 'Enviado') st = 'Validado'
      else if (row.fecha_subsanacion) st = 'Validado'
      else st = 'Pendiente'

      if (st === 'Solicitando Revisión') {
        solicitando++
      } else if (st === 'En Revisión') {
        enRevision++
      } else if (st === 'Descartado') {
        descartadas++
      } else if (st === 'Rechazado') {
        rechazadas++
      } else if (st === 'Validado') {
        subsanadas++
        if (rawSt === 'Enviado') enviadas++
        else validadas++
      } else {
        pendientes++
      }

      // Por sitio
      if (perSite[row.id_sitio]) {
        const s = perSite[row.id_sitio]
        s.total++
        if (st === 'Solicitando Revisión') s.solicitando++
        else if (st === 'En Revisión') s.enRevision++
        else if (st === 'Descartado') s.descartadas++
        else if (st === 'Rechazado') s.rechazadas++
        else if (st === 'Validado') s.subsanadas++
        else s.pendientes++
      }

      // Por cuadrilla
      const a = siteMap.get(row.id_sitio)
      const gName = a ? (a.cuadrilla || a.grupo || '').replace(/GRUPO/gi, 'CUADRILLA') : null
      if (gName && perGroup[gName]) {
        const g = perGroup[gName]
        g.total++
        if (st === 'Solicitando Revisión') g.solicitando++
        else if (st === 'En Revisión') g.enRevision++
        else if (st === 'Descartado') g.descartadas++
        else if (st === 'Rechazado') g.rechazadas++
        else if (st === 'Validado') g.subsanadas++
        else g.pendientes++

        // Conteo de observaciones validadas en la semana actual por cuadrilla (coincide con Programación)
        if (row.fecha_subsanacion && st === 'Validado') {
          const fLima = getLimaDateStr(row.fecha_subsanacion)
          if (fLima && semanaFechasSet.has(fLima)) {
            g.semana[fLima] = (g.semana[fLima] || 0) + 1
            g.totalSemana = (g.totalSemana || 0) + 1
          }
        }
      }
    })

    // Porcentaje global
    const resueltas = subsanadas + descartadas
    const porcentajeGlobal = total > 0 ? parseFloat(((resueltas / total) * 100).toFixed(1)) : 0

    // Porcentajes por grupo
    Object.values(perGroup).forEach(g => {
      g.resueltas = g.subsanadas + g.descartadas
      g.porcentaje = g.total > 0 ? parseFloat(((g.resueltas / g.total) * 100).toFixed(1)) : 0
    })

    // Porcentajes por sitio y ordenar por volumen de observaciones
    const sitiosList = Object.values(perSite).map(s => {
      s.resueltas = s.subsanadas + s.descartadas
      s.porcentaje = s.total > 0 ? parseFloat(((s.resueltas / s.total) * 100).toFixed(1)) : 0
      const sCuad = (s.cuadrilla || s.grupo || '').replace(/GRUPO/gi, 'CUADRILLA')
      s.tecnico = perGroup[sCuad]?.tecnico || ''
      return s
    })

    sitiosList.sort((a, b) => b.total - a.total)

    return {
      kpis: {
        total,
        pendientes,
        solicitando,
        subsanadas,
        validadas,
        enviadas,
        enRevision,
        descartadas,
        rechazadas,
        resueltas,
        porcentajeGlobal,
        totalSitios: asignaciones.length
      },
      grupos: Object.values(perGroup).sort((a, b) => a.numero - b.numero),
      sitios: sitiosList,
      semanaActual: semanaInfo
    }
  } catch (err) {
    console.error('Error en getDashboardProjectOverview:', err)
    throw err
  }
}

