// ============================================================================
// NÚCLEO COMPARTIDO DE LÓGICA DE NEGOCIO Y REPORTES (WEB + GITHUB ACTIONS)
// Fuente única de verdad para:
// - Normalización canónica de estados COVEPA
// - Clasificación de ámbito (Amazonas Original vs. Amazonas Ampliación)
// - Resolución territorial de Cuadrillas (1 a 7) y Equipos (1 a 4)
// - Cálculo de KPIs de Reportes Diarios y Matrices Ejecutivas
// ============================================================================

import { formatPrimerNombrePrimerApellido } from '../utils/helpers.js'
import baseSitiosJson from '../../scripts/base_sitios_asignados.json'

export const MAPA_SITIO_A_CUADRILLA = {}
for (const [sId, info] of Object.entries(baseSitiosJson)) {
  const cName = String(info.cuadrilla || info.grupo || 'CUADRILLA 1').replace(/GRUPO/gi, 'CUADRILLA').toUpperCase().trim()
  MAPA_SITIO_A_CUADRILLA[sId.toUpperCase().trim()] = cName
}

/**
 * Resuelve la cuadrilla oficial asignada a un sitio.
 * Regla de Negocio: La cuadrilla ejecutora SIEMPRE es la cuadrilla asignada al sitio.
 */
export function resolveCuadrillaDeSitio(idSitio, idObs = '', sitiosMap = null) {
  const siteClean = String(idSitio || '').trim().toUpperCase()
  const obsClean = String(idObs || '').trim().toUpperCase()

  // 1. Ampliación siempre pertenece a CUADRILLA 4
  if (siteClean.startsWith('AMEX') || obsClean.startsWith('AMEX')) {
    return 'CUADRILLA 4'
  }

  // 2. Si viene provisto en sitiosMap
  if (sitiosMap && (sitiosMap[siteClean]?.cuadrilla || sitiosMap[siteClean]?.grupo)) {
    const raw = sitiosMap[siteClean].cuadrilla || sitiosMap[siteClean].grupo
    const c = String(raw).replace(/GRUPO/gi, 'CUADRILLA').toUpperCase().trim()
    if (c.startsWith('CUADRILLA')) return c
  }

  // 3. Catálogo base oficial de asignación
  if (MAPA_SITIO_A_CUADRILLA[siteClean]) {
    return MAPA_SITIO_A_CUADRILLA[siteClean]
  }

  // 4. Búsqueda por prefijo (ej: AM-0038)
  const parts = siteClean.split('-')
  if (parts.length >= 2) {
    const prefix = `${parts[0]}-${parts[1]}`
    for (const [k, v] of Object.entries(MAPA_SITIO_A_CUADRILLA)) {
      if (k.startsWith(prefix)) return v
    }
  }

  return 'CUADRILLA 1'
}

export const ID_PERSONAL_POR_TECNICO = {
  'Jhonatan Flores': '554a3a58-bf04-480a-8795-d85e055ee4c6',
  'Jhonatan Flores Rojas': '554a3a58-bf04-480a-8795-d85e055ee4c6',
  'Marco Chamba': '4f9d2cc7-3a88-42f9-b9ac-e97eec0277fe',
  'Marco Antonio Chamba Contreras': '4f9d2cc7-3a88-42f9-b9ac-e97eec0277fe',
  'Juan Castro': '84444118-163f-4568-8040-e60e1824fd73',
  'Willy Fernández': '61d6e0fc-81ae-4e84-9841-1436795d27fd',
  'Willy Fernandez': '61d6e0fc-81ae-4e84-9841-1436795d27fd',
  'Willy Fernández Aquino': '61d6e0fc-81ae-4e84-9841-1436795d27fd',
  'Alfonso Curi': '4b56f618-981f-4f2a-a901-4a4de4543899',
  'Alfonso Curi Lopez': '4b56f618-981f-4f2a-a901-4a4de4543899',
  'William Avila': '19ff0cdf-7afc-4e50-94b2-f1a9998de148',
  'William Avila Cotrina': '19ff0cdf-7afc-4e50-94b2-f1a9998de148',
  'Hugo Espinoza': '98a85d5b-9514-43f6-ae29-6a8c2ef6d06c',
  'Hugo Espinoza Pezo': '98a85d5b-9514-43f6-ae29-6a8c2ef6d06c',
  'Daniel Javier': '05db4c32-3c7a-42e4-a0aa-8ac33dd5c75f',
  'Denis Torres': '243a62bf-1424-4aad-ac99-4ceae9db421c',
  'Dennis Torres': '243a62bf-1424-4aad-ac99-4ceae9db421c',
  'Dennis Eduardo Torres Paz': '243a62bf-1424-4aad-ac99-4ceae9db421c',
  'Roger Valdivia': 'dbaa3159-e4fc-4e85-8295-8bdff568ab1e',
  'Roger Valdivia Rodriguez': 'dbaa3159-e4fc-4e85-8295-8bdff568ab1e',
  'Percy Rojas': 'aab1e7bf-6ed7-4d23-8871-b86b7eb3095a',
  'Gabriel Farro': '58bf102a-514f-4829-806b-1037856cadb1',
  'Cristian Isla': 'eebf3b9e-4923-47ce-9eee-8e9af86c9fea',
  'Carlos Condor': '8359c281-33ce-423e-9823-0e9e09663889',
  'Jhon Miler Herrera': '45cc3a1b-75f9-447f-af68-efec878d0abf',
  'Milton Alamo': 'f3b135e9-0446-4f88-8bbd-bdae257c1f15'
}

export const TECNICO_POR_ID_PERSONAL = {
  '554a3a58-bf04-480a-8795-d85e055ee4c6': 'Jhonatan Flores',
  '4f9d2cc7-3a88-42f9-b9ac-e97eec0277fe': 'Marco Chamba',
  '84444118-163f-4568-8040-e60e1824fd73': 'Juan Castro',
  '61d6e0fc-81ae-4e84-9841-1436795d27fd': 'Willy Fernández',
  '4b56f618-981f-4f2a-a901-4a4de4543899': 'Alfonso Curi',
  '19ff0cdf-7afc-4e50-94b2-f1a9998de148': 'William Avila',
  '98a85d5b-9514-43f6-ae29-6a8c2ef6d06c': 'Hugo Espinoza',
  '05db4c32-3c7a-42e4-a0aa-8ac33dd5c75f': 'Daniel Javier',
  '243a62bf-1424-4aad-ac99-4ceae9db421c': 'Denis Torres',
  'dbaa3159-e4fc-4e85-8295-8bdff568ab1e': 'Roger Valdivia',
  'aab1e7bf-6ed7-4d23-8871-b86b7eb3095a': 'Percy Rojas',
  '58bf102a-514f-4829-806b-1037856cadb1': 'Gabriel Farro',
  'eebf3b9e-4923-47ce-9eee-8e9af86c9fea': 'Cristian Isla',
  '8359c281-33ce-423e-9823-0e9e09663889': 'Carlos Condor',
  '45cc3a1b-75f9-447f-af68-efec878d0abf': 'Jhon Miler Herrera',
  'f3b135e9-0446-4f88-8bbd-bdae257c1f15': 'Milton Alamo'
}

export function resolverIdPersonalTecnico(valor) {
  if (!valor) return null
  const s = String(valor).trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return s.toLowerCase()
  }
  return ID_PERSONAL_POR_TECNICO[s] || null
}

export function resolverNombreTecnico(valor) {
  if (!valor) return null
  const s = String(valor).trim().toLowerCase()
  return TECNICO_POR_ID_PERSONAL[s] || valor
}

/**
 * Resuelve la cuadrilla (CUADRILLA 1 a 4) y el técnico oficial
 * a partir de un nombre de usuario, mención o comentario con etiqueta [Técnico: ...].
 */
export function resolveTecnicoAndCuadrilla(str) {
  if (!str) return null
  const s = String(str).trim()
  if (!s || s === '—' || s === '-') return null

  // Si ya es un UUID / id_personal
  const sLower = s.toLowerCase()
  if (TECNICO_POR_ID_PERSONAL[sLower]) {
    const tecName = TECNICO_POR_ID_PERSONAL[sLower]
    let cuad = 'CUADRILLA 1'
    if (['Juan Castro', 'Willy Fernández', 'Cristian Isla'].includes(tecName)) cuad = 'CUADRILLA 2'
    else if (['Alfonso Curi', 'William Avila'].includes(tecName)) cuad = 'CUADRILLA 3'
    else if (['Hugo Espinoza', 'Daniel Javier', 'Roger Valdivia'].includes(tecName)) cuad = 'CUADRILLA 4'
    return { cuadrilla: cuad, tecnico: tecName, id_personal: sLower }
  }

  // Si incluye etiqueta de designación tipo "[Técnico: Juan Castro]"
  const tagMatch = s.match(/\[Técnico:\s*([^\]]+)\]/i)
  const target = tagMatch ? tagMatch[1].trim() : s
  const upper = target.toUpperCase()

  // Ignorar nombres de revisores/auditores que no son técnicos de campo
  if (upper.includes('CESAR ARIAS') || upper.includes('ADMINISTRADOR') || upper.includes('APP FOTOS') || upper.includes('SISTEMA') || upper.includes('GILAT')) {
    return null
  }

  let res = null

  // Cuadrilla 1: Jhonatan Flores, Marco Chamba
  if (
    (upper.includes('JHONATAN') && upper.includes('FLORES')) ||
    (upper.includes('MARCO') && upper.includes('CHAMBA')) ||
    upper.includes('CHAMBA') ||
    upper.includes('FLORES ROJAS')
  ) {
    const tec = (upper.includes('CHAMBA')) ? 'Marco Chamba' : 'Jhonatan Flores'
    res = { cuadrilla: 'CUADRILLA 1', tecnico: tec }
  } else if (
    (upper.includes('JUAN') && upper.includes('CASTRO')) ||
    upper.includes('CASTRO TORRES') ||
    (upper.includes('CASTRO') && !upper.includes('CONDOR')) ||
    (upper.includes('WILLY') && (upper.includes('FERNANDEZ') || upper.includes('FERNÁNDEZ') || upper.includes('AQUINO'))) ||
    upper.includes('FERNANDEZ AQUINO') ||
    upper.includes('FERNÁNDEZ AQUINO') ||
    upper.includes('CRISTIAN ISLA')
  ) {
    // Cuadrilla 2: Juan Castro, Willy Fernández, Cristian Isla
    let tec = 'Juan Castro'
    if (upper.includes('WILLY') || upper.includes('FERNANDEZ') || upper.includes('FERNÁNDEZ')) tec = 'Willy Fernández'
    else if (upper.includes('ISLA')) tec = 'Cristian Isla'
    res = { cuadrilla: 'CUADRILLA 2', tecnico: tec }
  } else if (
    (upper.includes('ALFONSO') && upper.includes('CURI')) ||
    upper.includes('CURI LOPEZ') ||
    upper.includes('CURI LÓPEZ') ||
    ((upper.includes('WILLIAM') || upper.includes('WILL')) && (upper.includes('AVILA') || upper.includes('ÁVILA') || upper.includes('COTRINA'))) ||
    upper.includes('AVILA COTRINA') ||
    upper.includes('ÁVILA COTRINA')
  ) {
    // Cuadrilla 3: Alfonso Curi, William Avila
    const tec = (upper.includes('AVILA') || upper.includes('ÁVILA') || upper.includes('COTRINA') || upper.includes('WILLIAM') || upper.includes('WILL'))
      ? 'William Avila'
      : 'Alfonso Curi'
    res = { cuadrilla: 'CUADRILLA 3', tecnico: tec }
  } else if (
    (upper.includes('HUGO') && upper.includes('ESPINOZA')) ||
    upper.includes('ESPINOZA PEZO') ||
    (upper.includes('DANIEL') && upper.includes('JAVIER')) ||
    upper.includes('JAVIER ANTONIO') ||
    (upper.includes('ROGER') && upper.includes('VALDIVIA')) ||
    upper.includes('VALDIVIA RODRIGUEZ') ||
    upper.includes('VALDIVIA RODRÍGUEZ')
  ) {
    // Cuadrilla 4: Hugo Espinoza, Daniel Javier, Roger Valdivia
    let tec = 'Hugo Espinoza'
    if (upper.includes('JAVIER')) tec = 'Daniel Javier'
    else if (upper.includes('VALDIVIA')) tec = 'Roger Valdivia'
    res = { cuadrilla: 'CUADRILLA 4', tecnico: tec }
  } else if (upper.includes('CHAMBA')) {
    res = { cuadrilla: 'CUADRILLA 1', tecnico: 'Marco Chamba' }
  } else if (upper.includes('CURI')) {
    res = { cuadrilla: 'CUADRILLA 3', tecnico: 'Alfonso Curi' }
  } else if (upper.includes('CASTRO') && !upper.includes('CONDOR')) {
    res = { cuadrilla: 'CUADRILLA 2', tecnico: 'Juan Castro' }
  }

  if (res) {
    const idPersonal = ID_PERSONAL_POR_TECNICO[res.tecnico] || null
    return { ...res, id_personal: idPersonal }
  }

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

  const isOptionsObj = Boolean(
    optionsOrSitiosMap &&
    (optionsOrSitiosMap.sitiosMap || optionsOrSitiosMap.asignacionesMap || optionsOrSitiosMap.cuadrillaStaffMap || optionsOrSitiosMap.defaultCuadrillasConfig)
  )

  const asignacionesMap = isOptionsObj ? (optionsOrSitiosMap.asignacionesMap || {}) : {}
  const sitiosMap = isOptionsObj ? (optionsOrSitiosMap.sitiosMap || {}) : (optionsOrSitiosMap || {})

  // Regla Fundamental: La cuadrilla ejecutora SIEMPRE es la cuadrilla asignada al sitio
  const cuadSitio = resolveCuadrillaDeSitio(siteId, obsId, { ...asignacionesMap, ...sitiosMap })
  if (cuadSitio) return cuadSitio

  if (obs?.cuadrilla_ejecutora) {
    const cClean = String(obs.cuadrilla_ejecutora).toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
    if (cClean.startsWith('CUADRILLA')) return cClean
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
