// Servicio para gestionar sitios combinando la BD propia (asignaciones) y la BD externa (georreferenciación y catálogo)
import { supabase } from '../lib/supabase.js'
import { supabaseExt } from '../lib/supabase.js'
import baseSitiosJson from '../../scripts/base_sitios_asignados.json' with { type: 'json' }

// Fuente única de verdad para los 183 sitios asignados (156 Original + 27 Ampliación)
export const ASIGNACIONES_BASE = Object.entries(baseSitiosJson).map(([id_site, info]) => {
  const cName = String(info.cuadrilla || info.grupo || 'CUADRILLA 1').replace(/GRUPO/gi, 'CUADRILLA').toUpperCase().trim()
  return {
    id_site,
    grupo: cName,
    cuadrilla: cName,
    zona: info.zona || 'ZONA 7',
    ...(info.localidad ? { localidad: info.localidad } : {})
  }
})

/**
 * Resuelve la localidad contigua al ID de un sitio.
 */
export function getLocalidadBySiteId(siteId) {
  if (!siteId) return ''
  const clean = String(siteId).trim().toUpperCase()
  const found = ASIGNACIONES_BASE.find(s => s.id_site.toUpperCase() === clean)
  if (found?.localidad) return found.localidad
  const parts = clean.split('-')
  if (parts.length >= 2) {
    const prefix = `${parts[0]}-${parts[1]}`
    const byPrefix = ASIGNACIONES_BASE.find(s => s.id_site.toUpperCase().startsWith(prefix))
    if (byPrefix?.localidad) return byPrefix.localidad
  }
  return ''
}


// Cache en memoria para catálogo de sitios
let cachedSitiosAsignados = null
const _cachedFetchSitios = new Map()
const SITIOS_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutos de caché

export function invalidateSitiosCache() {
  cachedSitiosAsignados = null
  _cachedFetchSitios.clear()
}

/**
 * Obtiene los sitios completos cruzando la asignación local con los datos geográficos de la BD externa
 * Optimizado con caché inteligente de 10 minutos
 * @param {boolean} soloAsignados - Si es true, solo trae los 183 sitios asignados (156 Original + 27 Ampliación). Si es false, trae todo el catálogo.
 * @param {boolean} forceRefresh - Forzar recarga ignorando el caché
 */
export async function fetchSitios({ soloAsignados = true, forceRefresh = false } = {}) {
  const cacheKey = Boolean(soloAsignados)
  const cached = _cachedFetchSitios.get(cacheKey)
  const now = Date.now()
  if (!forceRefresh && cached && (now - cached.timestamp < SITIOS_CACHE_TTL_MS)) {
    return cached.data
  }

  try {
    // 1. Inicializar mapa base con los 183 sitios oficiales y superponer cambios desde sitios_cuadrillas en Supabase
    const mapaAsignaciones = new Map()
    ASIGNACIONES_BASE.forEach(a => {
      mapaAsignaciones.set(a.id_site, {
        ...a,
        cuadrilla: (a.cuadrilla || a.grupo || 'CUADRILLA 1').replace(/GRUPO/gi, 'CUADRILLA'),
        grupo: (a.cuadrilla || a.grupo || 'CUADRILLA 1').replace(/GRUPO/gi, 'CUADRILLA')
      })
    })

    try {
      const { data: dbAsig, error: errSc } = await supabase
        .from('sitios_cuadrillas')
        .select('id_site, cuadrilla, zona, activo')

      if (!errSc && Array.isArray(dbAsig) && dbAsig.length > 0) {
        dbAsig.forEach(row => {
          if (!row.id_site) return
          if (row.activo === false) {
            mapaAsignaciones.delete(row.id_site)
            return
          }
          const cClean = String(row.cuadrilla || 'Sin Cuadrilla').replace(/GRUPO/gi, 'CUADRILLA').toUpperCase().trim()
          const zClean = String(row.zona || 'Sin Zona').toUpperCase().trim()
          const prev = mapaAsignaciones.get(row.id_site) || {}
          mapaAsignaciones.set(row.id_site, {
            ...prev,
            id_site: row.id_site,
            cuadrilla: cClean,
            grupo: cClean,
            zona: zClean
          })
        })
      }
    } catch {
      // Mantiene ASIGNACIONES_BASE si hay error de red
    }

    const assignedIds = Array.from(mapaAsignaciones.keys())

    // 2. Consultar la base de datos externa
    let query = supabaseExt.from('sitios').select(`
      id_site,
      nombre_nodo,
      red,
      categoria,
      latitud,
      longitud,
      grupo_sla,
      region,
      provincia,
      distrito,
      localidad,
      altura_torre,
      tipo_enlace,
      velocidad_internet,
      velocidad_intranet,
      tipo,
      energia,
      n_baterias,
      dependencia
    `)

    if (soloAsignados) {
      // Filtrar solo los sitios del proyecto
      query = query.in('id_site', assignedIds)
    }

    const { data: sitiosExt, error: errExt } = await query

    if (errExt) {
      console.error('Error al consultar sitios en BD externa:', errExt)
      throw new Error(`Error en base de datos externa: ${errExt.message}`)
    }

    // 3. Cruzar la información en memoria
    const combinados = (sitiosExt || []).map(sitio => {
      const asig = mapaAsignaciones.get(sitio.id_site)
      const cName = (asig?.cuadrilla || asig?.grupo || 'Sin Cuadrilla').replace(/GRUPO/gi, 'CUADRILLA')
      return {
        ...sitio,
        grupo: cName,
        cuadrilla: cName,
        zona: asig?.zona || 'Sin Zona',
        es_asignado: !!asig,
        tiene_coordenadas: sitio.latitud !== null && sitio.longitud !== null
      }
    })

    // Ordenar por Cuadrilla y luego por id_site
    const result = combinados.sort((a, b) => {
      const cA = a.cuadrilla || a.grupo || ''
      const cB = b.cuadrilla || b.grupo || ''
      if (cA !== cB) return cA.localeCompare(cB, undefined, { numeric: true })
      return a.id_site.localeCompare(b.id_site)
    })

    _cachedFetchSitios.set(cacheKey, { data: result, timestamp: now })
    return result
  } catch (error) {
    console.error('Error general en fetchSitios:', error)
    throw error
  }
}

/**
 * Actualiza la asignación de Cuadrilla y Zona de un sitio en `sitios_cuadrillas`
 * y sincroniza el catálogo en memoria (`ASIGNACIONES_BASE` y `cachedSitiosAsignados`).
 */
export async function updateSitioAsignacion(idSite, { cuadrilla, zona }) {
  if (!idSite) throw new Error('Se requiere el código de sitio (id_site).')
  const siteKey = String(idSite).trim().toUpperCase()
  const cuadrillaFinal = String(cuadrilla || 'Sin Cuadrilla').replace(/GRUPO/gi, 'CUADRILLA').trim()
  const zonaFinal = String(zona || 'Sin Zona').trim()

  const esAsignado = cuadrillaFinal !== 'Sin Cuadrilla' && cuadrillaFinal !== ''

  // 1. Intentar UPDATE sobre fila existente en sitios_cuadrillas
  const { data: updatedRows, error: updErr } = await supabase
    .from('sitios_cuadrillas')
    .update({
      cuadrilla: cuadrillaFinal,
      zona: zonaFinal,
      activo: esAsignado,
      updated_at: new Date().toISOString()
    })
    .eq('id_site', siteKey)
    .select()

  if (updErr) {
    throw new Error(`Error al actualizar asignación del sitio: ${updErr.message}`)
  }

  // 2. Si el sitio aún no tenía fila en sitios_cuadrillas, hacer upsert desde la acción del usuario
  if (!updatedRows || updatedRows.length === 0) {
    const { error: upsErr } = await supabase
      .from('sitios_cuadrillas')
      .upsert({
        id_site: siteKey,
        cuadrilla: cuadrillaFinal,
        zona: zonaFinal,
        activo: esAsignado,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id_site' })

    if (upsErr) {
      throw new Error(`Error al registrar asignación del sitio: ${upsErr.message}`)
    }
  }

  // 3. Actualizar ASIGNACIONES_BASE en memoria e invalidar caché para propagación inmediata en toda la app
  const existingIdx = ASIGNACIONES_BASE.findIndex(s => s.id_site.toUpperCase() === siteKey)
  if (existingIdx >= 0) {
    ASIGNACIONES_BASE[existingIdx] = {
      ...ASIGNACIONES_BASE[existingIdx],
      grupo: cuadrillaFinal,
      cuadrilla: cuadrillaFinal,
      zona: zonaFinal
    }
  } else if (esAsignado) {
    ASIGNACIONES_BASE.push({
      id_site: siteKey,
      grupo: cuadrillaFinal,
      cuadrilla: cuadrillaFinal,
      zona: zonaFinal
    })
  }

  invalidateSitiosCache()

  return {
    id_site: siteKey,
    grupo: cuadrillaFinal,
    cuadrilla: cuadrillaFinal,
    zona: zonaFinal,
    es_asignado: esAsignado
  }
}

/**
 * Obtiene los 156 sitios asignados enriquecidos con código de lugar, localidad, nombre_nodo, zona y grupo.
 * Cacheado en memoria para responder de forma instantánea en modales y selectores.
 */
export async function getCachedSitiosAsignados() {
  if (cachedSitiosAsignados && cachedSitiosAsignados.length > 0) {
    return cachedSitiosAsignados
  }
  try {
    const data = await fetchSitios({ soloAsignados: true })
    if (data && data.length > 0) {
      cachedSitiosAsignados = data.map(s => {
        const parts = (s.id_site || '').split('-')
        const codigoLugar = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : s.id_site
        return {
          ...s,
          codigo_lugar: codigoLugar
        }
      })
      return cachedSitiosAsignados
    }
  } catch (err) {
    console.warn('Error al cargar catálogo de sitios para programación:', err)
  }

  // Fallback con ASIGNACIONES_BASE
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
}

/**
 * Resuelve la zona territorial oficial (ZONA 2 o ZONA 7) de un sitio de forma determinista.
 * Admite coincidencia exacta por ID de sitio o por prefijo de lugar (AM-XXXX).
 */
export function getZonaBySiteId(siteId) {
  if (!siteId) return 'ZONA 7'
  const clean = String(siteId).trim().toUpperCase()
  const exact = ASIGNACIONES_BASE.find(s => s.id_site.toUpperCase() === clean)
  if (exact?.zona) return exact.zona
  const parts = clean.split('-')
  if (parts.length >= 2) {
    const prefix = `${parts[0]}-${parts[1]}`
    const byPrefix = ASIGNACIONES_BASE.find(s => s.id_site.toUpperCase().startsWith(prefix))
    if (byPrefix?.zona) return byPrefix.zona
  }
  return 'ZONA 7'
}
