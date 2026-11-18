// ============================================================================
// NÚCLEO COMPARTIDO DE LÓGICA DE NEGOCIO Y REPORTES (WEB + GITHUB ACTIONS)
// Fuente única de verdad para:
// - Normalización canónica de estados COVEPA
// - Clasificación de ámbito (Amazonas Original vs. Amazonas Ampliación)
// - Resolución territorial de Cuadrillas (1 a 7) y Equipos (1 a 4)
// - Cálculo de KPIs de Reportes Diarios y Matrices Ejecutivas
// ============================================================================

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

  // 0. Sitios o códigos AMEX pertenecen siempre a CUADRILLA 7
  if (esAmpliacionObs(siteId, obsId)) {
    return 'CUADRILLA 7'
  }

  const isOptionsObj = Boolean(
    optionsOrSitiosMap &&
    (optionsOrSitiosMap.sitiosMap || optionsOrSitiosMap.asignacionesMap || optionsOrSitiosMap.cuadrillaStaffMap || optionsOrSitiosMap.defaultCuadrillasConfig)
  )

  const asignacionesMap = isOptionsObj ? (optionsOrSitiosMap.asignacionesMap || {}) : {}
  const sitiosMap = isOptionsObj ? (optionsOrSitiosMap.sitiosMap || {}) : (optionsOrSitiosMap || {})
  const cuadrillaStaffMap = isOptionsObj ? (optionsOrSitiosMap.cuadrillaStaffMap || {}) : {}
  const defaultCuadrillasConfig = isOptionsObj ? (optionsOrSitiosMap.defaultCuadrillasConfig || {}) : {}

  // 1. Prioridad por catálogo maestro de asignaciones territoriales
  const asig = asignacionesMap[siteId] || sitiosMap[obs?.id_sitio] || sitiosMap[siteId]
  if (asig) {
    const rawGrupo = String(asig.cuadrilla || asig.grupo || '').toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
    const match = rawGrupo.match(/CUADRILLA\s*([1-7])/)
    if (match) return `CUADRILLA ${match[1]}`
  }

  // 2. Prioridad por cuadrilla explícita en el registro
  if (obs?.cuadrilla) {
    const cClean = String(obs.cuadrilla).toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
    const match = cClean.match(/CUADRILLA\s*([1-7])/)
    if (match) return `CUADRILLA ${match[1]}`
  }

  // 3. Prioridad por nombre del técnico asignado
  if (obs?.tecnico) {
    const tClean = String(obs.tecnico).toUpperCase().trim()
    for (const [cName, tecNom] of Object.entries(cuadrillaStaffMap)) {
      if (tecNom && tClean.includes(String(tecNom).toUpperCase())) return cName
    }
    for (const [cName, cfg] of Object.entries(defaultCuadrillasConfig)) {
      if (cfg?.tecnicoNombre && tClean.includes(String(cfg.tecnicoNombre).toUpperCase())) return cName
    }
    if (tClean.includes('FLORES') || tClean.includes('JHONATAN')) return 'CUADRILLA 1'
    if (tClean.includes('CHAMBA') || tClean.includes('MARCO')) return 'CUADRILLA 2'
    if (tClean.includes('DANIEL') || tClean.includes('JAVIER') || tClean.includes('PERCY') || tClean.includes('ROJAS')) return 'CUADRILLA 3'
    if (tClean.includes('ALFONSO') || tClean.includes('CURI')) return 'CUADRILLA 4'
    if (tClean.includes('WILL') || tClean.includes('AVILA')) return 'CUADRILLA 5'
    if (tClean.includes('CASTRO') || tClean.includes('JUAN')) return 'CUADRILLA 6'
  }

  return 'CUADRILLA 1'
}

/**
 * Resuelve el Equipo Ejecutivo (EQUIPO 1 a EQUIPO 4) a partir de la Cuadrilla.
 */
export function resolveEquipoPorCuadrilla(cuadrilla, isAmex = false) {
  const c = String(cuadrilla || '').trim().toUpperCase()
  if (isAmex || c === 'CUADRILLA 7') return 'EQUIPO 4'
  if (c === 'CUADRILLA 1' || c === 'CUADRILLA 2') return 'EQUIPO 1'
  if (c === 'CUADRILLA 3' || c === 'CUADRILLA 6') return 'EQUIPO 2'
  if (c === 'CUADRILLA 4' || c === 'CUADRILLA 5') return 'EQUIPO 3'
  return 'EQUIPO 1'
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
      'CUADRILLA 1': getTec('CUADRILLA 1'),
      'CUADRILLA 2': getTec('CUADRILLA 2'),
      'CUADRILLA 3': getTec('CUADRILLA 3'),
      'CUADRILLA 4': getTec('CUADRILLA 4'),
      'CUADRILLA 5': getTec('CUADRILLA 5'),
      'CUADRILLA 6': getTec('CUADRILLA 6'),
      'CUADRILLA 7': getTec('CUADRILLA 7')
    }
    resolveCuadrillaFn = (r) => resolveCuadrillaOficial(r, sitiosMap)
  } else {
    tecnicosPorCuadrilla = secondArg?.tecnicosPorCuadrilla || {}
    resolveCuadrillaFn = secondArg?.resolveCuadrillaFn || null
  }

  const tecC1 = tecnicosPorCuadrilla['CUADRILLA 1'] || 'Jhonatan Flores'
  const tecC2 = tecnicosPorCuadrilla['CUADRILLA 2'] || 'Marco Chamba'
  const tecC3 = tecnicosPorCuadrilla['CUADRILLA 3'] || 'Daniel Javier'
  const tecC4 = tecnicosPorCuadrilla['CUADRILLA 4'] || 'Alfonso Curi'
  const tecC5 = tecnicosPorCuadrilla['CUADRILLA 5'] || 'William Avila'
  const tecC6 = tecnicosPorCuadrilla['CUADRILLA 6'] || 'Juan Castro'
  const tecC7 = tecnicosPorCuadrilla['CUADRILLA 7'] || 'Por Asignar'

  const equiposOriginalMap = {
    'EQUIPO 1': {
      id: 'EQUIPO 1',
      cuadrilla: 'EQUIPO 1',
      subtitulo: 'Cuadrilla 1 y 2',
      tecnico: [tecC1, tecC2].filter(Boolean).join(' · ') || 'Técnicos Equipo 1',
      values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
      total: 0
    },
    'EQUIPO 2': {
      id: 'EQUIPO 2',
      cuadrilla: 'EQUIPO 2',
      subtitulo: 'Cuadrilla 3 y 6',
      tecnico: [tecC3, tecC6].filter(Boolean).join(' · ') || 'Técnicos Equipo 2',
      values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
      total: 0
    },
    'EQUIPO 3': {
      id: 'EQUIPO 3',
      cuadrilla: 'EQUIPO 3',
      subtitulo: 'Cuadrilla 4 y 5',
      tecnico: [tecC4, tecC5].filter(Boolean).join(' · ') || 'Técnicos Equipo 3',
      values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
      total: 0
    }
  }

  const equiposAmpliacionMap = {
    'EQUIPO 4': {
      id: 'EQUIPO 4',
      cuadrilla: 'EQUIPO 4',
      subtitulo: 'Cuadrilla 7',
      tecnico: tecC7 || 'Por Asignar',
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
