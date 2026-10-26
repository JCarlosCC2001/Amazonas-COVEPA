// Servicio para gestionar sitios combinando la BD propia (asignaciones) y la BD externa (georreferenciación y catálogo)
import { supabase } from '../lib/supabase'
import { supabaseExt } from '../lib/supabaseExt'

// Fallback de asignaciones iniciales mapeadas a Cuadrillas
const _RAW_ASIGNACIONES = [
  { id_site: 'AM-0038-A01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0038-CS01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0038-CO01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0038-CO02', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0041-A01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0041-CS01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0041-IE01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0041-HS01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0034-A01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0034-CS01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0123-A01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0042-A01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0042-CS01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0042-CO01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0124-CS01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0125-A01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0235-A01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0240-A01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0237-A01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0238-A01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0234-A01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0234-HS01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0232-A01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0232-HS01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0220-A01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0219-A01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0231-A01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0231-HS01', grupo: 'GRUPO 1', zona: 'ZONA 7' },
  { id_site: 'AM-0233-A01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0233-IE01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0239-A01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0078-A01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0078-CS01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0078-CO01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0078-HS01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0286-A01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0230-A01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0275-IE01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0217-A01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0271-A01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0271-IE01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0271-CS01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0215-A01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0214-A01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0214-CS01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0214-HS01', grupo: 'GRUPO 2', zona: 'ZONA 7' },
  { id_site: 'AM-0186-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0186-IE01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0189-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0189-CS01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0190-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0192-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0192-CS01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0192-HS01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0192-IE01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0193-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0241-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0241-HS01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0241-IE01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0242-IE02', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0243-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0245-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0246-IE01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0248-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0249-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0253-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0270-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0315-A01', grupo: 'GRUPO 3', zona: 'ZONA 7' },
  { id_site: 'AM-0076-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0076-HS01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0079-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0079-CO01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0079-HS01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0080-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0080-HS01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0221-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0222-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0222-HS01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0223-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0224-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0228-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0250-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0250-HS01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0251-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0252-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0252-HS01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0254-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0268-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0284-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0304-A01', grupo: 'GRUPO 4', zona: 'ZONA 7' },
  { id_site: 'AM-0180-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0183-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0183-CS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0185-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0185-IE02', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0191-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0177-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0177-HS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0178-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0178-HS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0179-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0229-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0229-HS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0227-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0227-HS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0225-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0226-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0226-CS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0225-HS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0077-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0077-HS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0075-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0075-HS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0201-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0200-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0256-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0256-HS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0256-IE01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0195-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0181-A01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0194-A01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0194-IE01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0272-A01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0272-HS01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0213-A01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0207-A01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0205-A01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0197-A01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0196-A01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0204-A01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0199-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0203-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0209-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0208-A01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0212-IE01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0216-A01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0216-HS01', grupo: 'GRUPO 6', zona: 'ZONA 7' },
  { id_site: 'AM-0188-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0274-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0274-CS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0274-IE01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0273-A01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0273-IE01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0273-CS01', grupo: 'GRUPO 5', zona: 'ZONA 7' },
  { id_site: 'AM-0040-A01', grupo: 'GRUPO 1', zona: 'ZONA 2' },
  { id_site: 'AM-0036-A01', grupo: 'GRUPO 2', zona: 'ZONA 2' },
  { id_site: 'AM-0121-A01', grupo: 'GRUPO 2', zona: 'ZONA 2' },
  { id_site: 'AM-0121-IE01', grupo: 'GRUPO 2', zona: 'ZONA 2' },
  { id_site: 'AM-0122-A01', grupo: 'GRUPO 2', zona: 'ZONA 2' },
  { id_site: 'AM-0037-A01', grupo: 'GRUPO 2', zona: 'ZONA 2' },
  { id_site: 'AM-0037-CS01', grupo: 'GRUPO 2', zona: 'ZONA 2' },
  { id_site: 'AM-0037-CO01', grupo: 'GRUPO 2', zona: 'ZONA 2' },
  { id_site: 'AM-0037-CO02', grupo: 'GRUPO 2', zona: 'ZONA 2' },
  { id_site: 'AM-0043-A01', grupo: 'GRUPO 2', zona: 'ZONA 2' },
  { id_site: 'AM-0126-A01', grupo: 'GRUPO 2', zona: 'ZONA 2' },
]

export const ASIGNACIONES_BASE = _RAW_ASIGNACIONES.map(s => {
  const cName = (s.grupo || 'CUADRILLA 1').replace(/GRUPO/gi, 'CUADRILLA')
  return { ...s, grupo: cName, cuadrilla: cName }
})


/**
 * Obtiene los sitios completos cruzando la asignación local con los datos geográficos de la BD externa
 * @param {boolean} soloAsignados - Si es true, solo trae los 156 sitios asignados. Si es false, trae los 1021 sitios.
 */
export async function fetchSitios({ soloAsignados = true } = {}) {
  try {
    // 1. Obtener asignaciones locales (o usar el fallback)
    let asignaciones = []
    try {
      const { data: dbAsig } = await supabase
        .from('sitios_asignados')
        .select('id_site, grupo, zona')
        .eq('activo', true)

      if (dbAsig && dbAsig.length > 0) {
        asignaciones = dbAsig
      } else {
        asignaciones = ASIGNACIONES_BASE
      }
    } catch {
      asignaciones = ASIGNACIONES_BASE
    }

    const mapaAsignaciones = new Map(asignaciones.map(a => [a.id_site, a]))
    const assignedIds = asignaciones.map(a => a.id_site)

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
    return combinados.sort((a, b) => {
      const cA = a.cuadrilla || a.grupo || ''
      const cB = b.cuadrilla || b.grupo || ''
      if (cA !== cB) return cA.localeCompare(cB, undefined, { numeric: true })
      return a.id_site.localeCompare(b.id_site)
    })
  } catch (error) {
    console.error('Error general en fetchSitios:', error)
    throw error
  }
}

// Cache en memoria para catálogo de sitios de programación
let cachedSitiosAsignados = null

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
