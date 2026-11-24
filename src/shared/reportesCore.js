// ============================================================================
// NÚCLEO COMPARTIDO DE LÓGICA DE NEGOCIO Y REPORTES (WEB + GITHUB ACTIONS)
// Fuente única de verdad para:
// - Normalización canónica de estados COVEPA
// - Clasificación de ámbito (Amazonas Original vs. Amazonas Ampliación)
// - Resolución territorial de Cuadrillas (1 a 7) y Equipos (1 a 4)
// - Cálculo de KPIs de Reportes Diarios y Matrices Ejecutivas
// ============================================================================

import { formatPrimerNombrePrimerApellido } from '../utils/helpers.js'

/**
 * Resuelve la cuadrilla (CUADRILLA 1 a 4) y el técnico oficial
 * a partir de un nombre de usuario, mención o comentario con etiqueta [Técnico: ...].
 */
export function resolveTecnicoAndCuadrilla(str) {
  if (!str) return null
  const s = String(str).trim()
  if (!s || s === '—' || s === '-') return null

  // Si incluye etiqueta de designación tipo "[Técnico: Juan Castro]"
  const tagMatch = s.match(/\[Técnico:\s*([^\]]+)\]/i)
  const target = tagMatch ? tagMatch[1].trim() : s
  const upper = target.toUpperCase()

  // Ignorar nombres de revisores/auditores que no son técnicos de campo
  if (upper.includes('CESAR ARIAS') || upper.includes('ADMINISTRADOR') || upper.includes('APP FOTOS') || upper.includes('SISTEMA') || upper.includes('GILAT')) {
    return null
  }

  // Cuadrilla 1: Jhonatan Flores, Marco Chamba
  if (
    (upper.includes('JHONATAN') && upper.includes('FLORES')) ||
    (upper.includes('MARCO') && upper.includes('CHAMBA')) ||
    upper.includes('CHAMBA') ||
    upper.includes('FLORES ROJAS')
  ) {
    const tec = (upper.includes('CHAMBA')) ? 'Marco Chamba' : 'Jhonatan Flores'
    return { cuadrilla: 'CUADRILLA 1', tecnico: tec }
  }

  // Cuadrilla 2: Juan Castro, Willy Fernández, Cristian Isla
  if (
    (upper.includes('JUAN') && upper.includes('CASTRO')) ||
    upper.includes('CASTRO TORRES') ||
    (upper.includes('CASTRO') && !upper.includes('CONDOR')) ||
    (upper.includes('WILLY') && (upper.includes('FERNANDEZ') || upper.includes('FERNÁNDEZ') || upper.includes('AQUINO'))) ||
    upper.includes('FERNANDEZ AQUINO') ||
    upper.includes('FERNÁNDEZ AQUINO') ||
    upper.includes('CRISTIAN ISLA')
  ) {
    let tec = 'Juan Castro'
    if (upper.includes('WILLY') || upper.includes('FERNANDEZ') || upper.includes('FERNÁNDEZ')) tec = 'Willy Fernández'
    else if (upper.includes('ISLA')) tec = 'Cristian Isla'
    return { cuadrilla: 'CUADRILLA 2', tecnico: tec }
  }

  // Cuadrilla 3: Alfonso Curi, William Avila
  if (
    (upper.includes('ALFONSO') && upper.includes('CURI')) ||
    upper.includes('CURI LOPEZ') ||
    upper.includes('CURI LÓPEZ') ||
    ((upper.includes('WILLIAM') || upper.includes('WILL')) && (upper.includes('AVILA') || upper.includes('ÁVILA') || upper.includes('COTRINA'))) ||
    upper.includes('AVILA COTRINA') ||
    upper.includes('ÁVILA COTRINA')
  ) {
    const tec = (upper.includes('AVILA') || upper.includes('ÁVILA') || upper.includes('COTRINA') || upper.includes('WILLIAM') || upper.includes('WILL'))
      ? 'William Avila'
      : 'Alfonso Curi'
    return { cuadrilla: 'CUADRILLA 3', tecnico: tec }
  }

  // Cuadrilla 4: Hugo Espinoza, Daniel Javier, Roger Valdivia
  if (
    (upper.includes('HUGO') && upper.includes('ESPINOZA')) ||
    upper.includes('ESPINOZA PEZO') ||
    (upper.includes('DANIEL') && upper.includes('JAVIER')) ||
    upper.includes('JAVIER ANTONIO') ||
    (upper.includes('ROGER') && upper.includes('VALDIVIA')) ||
    upper.includes('VALDIVIA RODRIGUEZ') ||
    upper.includes('VALDIVIA RODRÍGUEZ')
  ) {
    let tec = 'Hugo Espinoza'
    if (upper.includes('JAVIER')) tec = 'Daniel Javier'
    else if (upper.includes('VALDIVIA')) tec = 'Roger Valdivia'
    return { cuadrilla: 'CUADRILLA 4', tecnico: tec }
  }

  // Coincidencias por apellido o nombre individual
  if (upper.includes('CHAMBA')) return { cuadrilla: 'CUADRILLA 1', tecnico: 'Marco Chamba' }
  if (upper.includes('CURI')) return { cuadrilla: 'CUADRILLA 3', tecnico: 'Alfonso Curi' }
  if (upper.includes('CASTRO') && !upper.includes('CONDOR')) return { cuadrilla: 'CUADRILLA 2', tecnico: 'Juan Castro' }

  return null
}

/**
 * Normaliza cualquier cadena de estado al estándar oficial de 9 estados de COVEPA.
 */
export function normalizarEstadoObservacion(rawSt, hasFechaSubsanacion = false) {
  const s = String(rawSt || '').trim()
  const lower = s.toLowerCase()

  if (lower === 'documentación' || lower === 'documentacion') return 'Documentación'
  if (lower === 'descartado' || lower === 'descartada') return 'Descartado'
  if (lower === 'crítico' || lower === 'critico' || lower === 'crítica' || lower === 'critica') return 'Crítico'
  if (lower === 'pre-validado' || lower === 'pre-validada' || lower === 'prevalidado' || lower === 'prevalidada') return 'Pre-validado'
  if (lower === 'solicitando revisión' || lower === 'solicitando revision') return 'Solicitando Revisión'
  if (lower === 'en revisión' || lower === 'en revision') return 'En Revisión'
  if (lower === 'rechazado' || lower === 'rechazada' || lower === 'rechazados') return 'Rechazado'
  if (lower === 'pendiente') return 'Pendiente'
  if (lower === 'validado' || lower === 'validada' || lower === 'enviado' || lower === 'enviada') return 'Validado'
  if (hasFechaSubsanacion) return 'Validado'
  return 'Pendiente'
}

/**
 * Determina si una observación o sitio pertenece a Amazonas Ampliación (AMEX).
 * Soporta tanto `esAmpliacionObs(obsObj)` como `esAmpliacionObs(idSitio, idObs)`.
 */
export function esAmpliacionObs(obsOrSiteId, idObs = '') {
  if (obsOrSiteId && typeof obsOrSiteId === 'object') {
    const sId = String(obsOrSiteId.id_sitio || obsOrSiteId.id_site || obsOrSiteId.codigo_lugar || '').trim().toUpperCase()
    const oId = String(obsOrSiteId.id_obs || '').trim().toUpperCase()
    return sId.startsWith('AMEX') || oId.startsWith('AMEX')
  }
  const sId = String(obsOrSiteId || '').trim().toUpperCase()
  const oId = String(idObs || '').trim().toUpperCase()
  return sId.startsWith('AMEX') || oId.startsWith('AMEX')
}

/**
 * Resuelve la cuadrilla oficial (CUADRILLA 1 a CUADRILLA 7) de una observación
 * aplicando la jerarquía de negocio inmutable.
 * Soporta tanto `resolveCuadrillaOficial(obs, sitiosMap)` como
 * `resolveCuadrillaOficial(obs, { asignacionesMap, sitiosMap, cuadrillaStaffMap, defaultCuadrillasConfig })`.
 */
export function resolveCuadrillaOficial(obs, optionsOrSitiosMap = {}) {
  const siteId = String(obs?.id_sitio || obs?.id_site || '').trim().toUpperCase()
  const obsId = String(obs?.id_obs || '').trim().toUpperCase()

  // 0. Sitios o códigos AMEX pertenecen siempre a CUADRILLA 4 (Ampliación)
  if (esAmpliacionObs(siteId, obsId)) {
    return 'CUADRILLA 4'
  }

  // Normalizador auxiliar de cuadrilla a las 4 oficiales
  const normalizeCuad = (raw) => {
    if (!raw) return null
    const cClean = String(raw).toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
    if (cClean.includes('AMEX') || cClean.includes('AMPLIACI')) return 'CUADRILLA 4'
    const match = cClean.match(/CUADRILLA\s*([1-7])/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num === 1) return 'CUADRILLA 1'
      if (num === 2 || num === 6) return 'CUADRILLA 2'
      if (num === 3 || num === 5) return 'CUADRILLA 3'
      if (num === 4 || num === 7) return 'CUADRILLA 4'
      return `CUADRILLA ${num}`
    }
    return null
  }

  // 1. Prioridad: Cuadrilla ejecutora asignada directamente en la observación
  if (obs?.cuadrilla_ejecutora) {
    const norm = normalizeCuad(obs.cuadrilla_ejecutora)
    if (norm) return norm
  }

  const isOptionsObj = Boolean(
    optionsOrSitiosMap &&
    (optionsOrSitiosMap.sitiosMap || optionsOrSitiosMap.asignacionesMap || optionsOrSitiosMap.cuadrillaStaffMap || optionsOrSitiosMap.defaultCuadrillasConfig)
  )

  const asignacionesMap = isOptionsObj ? (optionsOrSitiosMap.asignacionesMap || {}) : {}
  const sitiosMap = isOptionsObj ? (optionsOrSitiosMap.sitiosMap || {}) : (optionsOrSitiosMap || {})
  const cuadrillaStaffMap = isOptionsObj ? (optionsOrSitiosMap.cuadrillaStaffMap || {}) : {}
  const defaultCuadrillasConfig = isOptionsObj ? (optionsOrSitiosMap.defaultCuadrillasConfig || {}) : {}

  // 2. Prioridad: Resolución directa por técnico ejecutor o técnico de la observación
  const tecNombre = obs?.tecnico_ejecutor || obs?.tecnico
  if (tecNombre) {
    const resolved = resolveTecnicoAndCuadrilla(tecNombre)
    if (resolved?.cuadrilla) {
      const norm = normalizeCuad(resolved.cuadrilla)
      if (norm) return norm
    }

    const tClean = String(tecNombre).toUpperCase().trim()
    for (const [cName, tecNom] of Object.entries(cuadrillaStaffMap)) {
      if (tecNom && tClean.includes(String(tecNom).toUpperCase())) return cName
    }
    for (const [cName, cfg] of Object.entries(defaultCuadrillasConfig)) {
      if (cfg?.tecnicoNombre && tClean.includes(String(cfg.tecnicoNombre).toUpperCase())) return cName
      if (cfg?.tecnicoNombre2 && tClean.includes(String(cfg.tecnicoNombre2).toUpperCase())) return cName
      if (Array.isArray(cfg?.tecnicosNombres)) {
        for (const nom of cfg.tecnicosNombres) {
          if (nom && tClean.includes(String(nom).toUpperCase())) return cName
        }
      }
    }
    if (tClean.includes('FLORES') || tClean.includes('JHONATAN') || tClean.includes('CHAMBA') || tClean.includes('MARCO') || tClean.includes('DENIS') || tClean.includes('TORRES')) return 'CUADRILLA 1'
    if (tClean.includes('CASTRO') || tClean.includes('JUAN') || tClean.includes('WILLY') || tClean.includes('FERNANDEZ') || tClean.includes('FERNÁNDEZ')) return 'CUADRILLA 2'
    if (tClean.includes('ALFONSO') || tClean.includes('CURI') || tClean.includes('WILL') || tClean.includes('AVILA') || tClean.includes('ÁVILA')) return 'CUADRILLA 3'
    if (tClean.includes('HUGO') || tClean.includes('ESPINOZA') || tClean.includes('DANIEL') || tClean.includes('JAVIER') || tClean.includes('PERCY') || tClean.includes('ROJAS') || tClean.includes('ROGER') || tClean.includes('VALDIVIA')) return 'CUADRILLA 4'
  }

  // 3. Prioridad: Cuadrilla explícita en el registro de observación
  if (obs?.cuadrilla) {
    const norm = normalizeCuad(obs.cuadrilla)
    if (norm) return norm
  }

  // 4. Prioridad: Catálogo maestro de asignaciones territoriales
  const asig = asignacionesMap[siteId] || sitiosMap[obs?.id_sitio] || sitiosMap[siteId]
  if (asig) {
    const norm = normalizeCuad(asig.cuadrilla || asig.grupo)
    if (norm) return norm
  }

  return 'CUADRILLA 1'
}

/**
 * Resuelve el Equipo Ejecutivo / Grupo a partir de la Cuadrilla (CUADRILLA 1 a CUADRILLA 4).
 */
export function resolveEquipoPorCuadrilla(cuadrilla, isAmex = false) {
  const c = String(cuadrilla || '').trim().toUpperCase()
  if (isAmex || c === 'CUADRILLA 4' || c === 'CUADRILLA 7' || c === 'EQUIPO 4') return 'CUADRILLA 4'
  if (c === 'CUADRILLA 1' || c === 'EQUIPO 1') return 'CUADRILLA 1'
  if (c === 'CUADRILLA 2' || c === 'CUADRILLA 6' || c === 'EQUIPO 2') return 'CUADRILLA 2'
  if (c === 'CUADRILLA 3' || c === 'CUADRILLA 5' || c === 'EQUIPO 3') return 'CUADRILLA 3'
  return c || 'CUADRILLA 1'
}

/**
 * Construye las matrices ejecutivas (Amazonas Original y Amazonas Ampliación)
 * garantizando coincidencia matemática 100% entre ModalAvanceDia, Previsualización Web y Correo Interno.
 * Soporta tanto:
 *   `construirMatricesEjecutivas(rows, { tecnicosPorCuadrilla, resolveCuadrillaFn })`
 * como:
 *   `construirMatricesEjecutivas(rows, sitiosMap, getCuadrillaTecnicoFn)`
 */
export function construirMatricesEjecutivas(rows = [], secondArg = {}, thirdArg = null) {
  let tecnicosPorCuadrilla = {}
  let resolveCuadrillaFn = null

  if (typeof thirdArg === 'function') {
    const sitiosMap = secondArg || {}
    const getTec = thirdArg
    tecnicosPorCuadrilla = {
      'CUADRILLA 1': getTec('CUADRILLA 1') || 'Jhonatan Flores · Marco Chamba',
      'CUADRILLA 2': getTec('CUADRILLA 2') || 'Juan Castro · Willy Fernández',
      'CUADRILLA 3': getTec('CUADRILLA 3') || 'Alfonso Curi · William Avila',
      'CUADRILLA 4': getTec('CUADRILLA 4') || 'Hugo Espinoza · Daniel Javier'
    }
    resolveCuadrillaFn = (r) => resolveCuadrillaOficial(r, sitiosMap)
  } else {
    tecnicosPorCuadrilla = secondArg?.tecnicosPorCuadrilla || {}
    resolveCuadrillaFn = secondArg?.resolveCuadrillaFn || null
  }

  const tecC1 = formatPrimerNombrePrimerApellido(tecnicosPorCuadrilla['CUADRILLA 1'] || 'Jhonatan Flores · Marco Chamba')
  const tecC2 = formatPrimerNombrePrimerApellido(tecnicosPorCuadrilla['CUADRILLA 2'] || 'Juan Castro · Willy Fernández')
  const tecC3 = formatPrimerNombrePrimerApellido(tecnicosPorCuadrilla['CUADRILLA 3'] || 'Alfonso Curi · William Avila')
  const tecC4 = formatPrimerNombrePrimerApellido(tecnicosPorCuadrilla['CUADRILLA 4'] || 'Hugo Espinoza · Daniel Javier')

  const equiposOriginalMap = {
    'CUADRILLA 1': {
      id: 'CUADRILLA 1',
      cuadrilla: 'CUADRILLA 1',
      subtitulo: null,
      tecnico: tecC1,
      values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
      total: 0
    },
    'CUADRILLA 2': {
      id: 'CUADRILLA 2',
      cuadrilla: 'CUADRILLA 2',
      subtitulo: null,
      tecnico: tecC2,
      values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
      total: 0
    },
    'CUADRILLA 3': {
      id: 'CUADRILLA 3',
      cuadrilla: 'CUADRILLA 3',
      subtitulo: null,
      tecnico: tecC3,
      values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
      total: 0
    }
  }

  const equiposAmpliacionMap = {
    'CUADRILLA 4': {
      id: 'CUADRILLA 4',
      cuadrilla: 'CUADRILLA 4',
      subtitulo: null,
      tecnico: tecC4,
      values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
      total: 0
    }
  }

  rows.forEach(r => {
    const isAmex = esAmpliacionObs(r)
    const targetCuadrilla = resolveCuadrillaFn ? resolveCuadrillaFn(r) : resolveCuadrillaOficial(r)
    const targetEquipoKey = resolveEquipoPorCuadrilla(targetCuadrilla, isAmex)
    const targetObj = equiposOriginalMap[targetEquipoKey] || equiposAmpliacionMap[targetEquipoKey]

    if (targetObj) {
      const st = normalizarEstadoObservacion(r.estado || r.estado_covepa, Boolean(r.fecha_subsanacion && r.fecha_subsanacion !== 'Pendiente'))
      if (st === 'Solicitando Revisión' || st === 'En Revisión') targetObj.values.enRevision++
      else if (st === 'Descartado') targetObj.values.descartados++
      else if (st === 'Crítico') targetObj.values.criticos++
      else if (st === 'Documentación') targetObj.values.documentacion++
      else if (st === 'Rechazado') targetObj.values.rechazados++
      else if (st === 'Validado') targetObj.values.validados++
    }
  })

  const buildMatrix = (map) => {
    const rowsList = Object.values(map).map(row => ({
      ...row,
      total: row.values.enRevision + row.values.descartados + row.values.criticos + row.values.documentacion + row.values.rechazados + row.values.validados
    }))

    const totalsObj = {
      enRevision: rowsList.reduce((acc, r) => acc + r.values.enRevision, 0),
      descartados: rowsList.reduce((acc, r) => acc + r.values.descartados, 0),
      criticos: rowsList.reduce((acc, r) => acc + r.values.criticos, 0),
      documentacion: rowsList.reduce((acc, r) => acc + r.values.documentacion, 0),
      rechazados: rowsList.reduce((acc, r) => acc + r.values.rechazados, 0),
      validados: rowsList.reduce((acc, r) => acc + r.values.validados, 0)
    }

    const grandTotalNum = totalsObj.enRevision + totalsObj.descartados + totalsObj.criticos + totalsObj.documentacion + totalsObj.rechazados + totalsObj.validados

    return {
      matrixRows: rowsList,
      matrixTotals: totalsObj,
      matrixGrandTotal: grandTotalNum
    }
  }

  const matrixOriginal = buildMatrix(equiposOriginalMap)
  const matrixAmpliacion = buildMatrix(equiposAmpliacionMap)
  const matrixRows = [...matrixOriginal.matrixRows, ...matrixAmpliacion.matrixRows]
  const matrixTotals = {
    enRevision: matrixOriginal.matrixTotals.enRevision + matrixAmpliacion.matrixTotals.enRevision,
    descartados: matrixOriginal.matrixTotals.descartados + matrixAmpliacion.matrixTotals.descartados,
    criticos: matrixOriginal.matrixTotals.criticos + matrixAmpliacion.matrixTotals.criticos,
    documentacion: matrixOriginal.matrixTotals.documentacion + matrixAmpliacion.matrixTotals.documentacion,
    rechazados: matrixOriginal.matrixTotals.rechazados + matrixAmpliacion.matrixTotals.rechazados,
    validados: matrixOriginal.matrixTotals.validados + matrixAmpliacion.matrixTotals.validados
  }
  const matrixGrandTotal = matrixOriginal.matrixGrandTotal + matrixAmpliacion.matrixGrandTotal

  return {
    matrixOriginal,
    matrixAmpliacion,
    matrixRows,
    matrixTotals,
    matrixGrandTotal,
    matrixData: {
      matrixRows,
      matrixTotals,
      matrixGrandTotal
    }
  }
}
