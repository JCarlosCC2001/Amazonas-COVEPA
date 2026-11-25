// Helpers compartidos entre páginas (única implementación).

/** Texto con contenido significativo (no vacío, ni '0', '-', '—', 'null', 'undefined'). */
export function hasMeaningfulText(val) {
  if (val === null || val === undefined) return false
  const s = String(val).trim()
  return s !== '' && s !== '0' && s !== '-' && s !== '—' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined'
}

/** Fecha local en formato YYYY-MM-DD. */
export function toLocalDateString(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Obtiene la fecha en zona horaria Perú (America/Lima) en formato YYYY-MM-DD sin desviaciones de huso horario */
export function getPeruDateStr(dateInput = new Date()) {
  if (!dateInput) return ''
  const s = String(dateInput).trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  try {
    const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput)
    if (isNaN(d.getTime())) return s.slice(0, 10)
    // Si viene como medianoche pura sin zona horaria ni sufijo UTC (ej: '2026-10-26T00:00:00' o '2026-10-26 00:00:00')
    if (/^\d{4}-\d{2}-\d{2}[T ]00:00:00(?:\.000)?$/.test(s)) return s.slice(0, 10)
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d)
  } catch {
    return s.slice(0, 10)
  }
}

/** Obtiene la fecha de ayer en zona horaria Perú (America/Lima) en formato YYYY-MM-DD */
export function getAyerPeruStr(dateInput = new Date()) {
  const hoyPeru = getPeruDateStr(dateInput)
  const [y, m, d] = hoyPeru.split('-').map(Number)
  const fecha = new Date(y, m - 1, d, 12, 0, 0)
  fecha.setDate(fecha.getDate() - 1)
  const ayY = fecha.getFullYear()
  const ayM = String(fecha.getMonth() + 1).padStart(2, '0')
  const ayD = String(fecha.getDate()).padStart(2, '0')
  return `${ayY}-${ayM}-${ayD}`
}

/** Genera timestamp ISO seguro para la fecha Perú (hora real exacta si no se especifica dateYmd, o mediodía UTC 12:00:00Z si se pasa YYYY-MM-DD) */
export function getPeruISOString(dateYmd = null) {
  if (dateYmd) {
    return new Date(dateYmd + "T12:00:00.000Z").toISOString()
  }
  return new Date().toISOString()
}

/** Iniciales de un nombre (2 letras). */
export function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`
  return parts[0].slice(0, 2).toUpperCase()
}

/** Clase CSS según cargo del personal. */
export function getCargoClass(cargo) {
  const c = (cargo || '').toUpperCase()
  if (c.includes('TÉCNICO') || c.includes('TECNICO')) return 'tecnico'
  if (c.includes('CONDUCTOR')) return 'conductor'
  if (c.includes('SUPERVISOR')) return 'supervisor'
  if (c.includes('COORDINADOR')) return 'coordinador'
  if (c.includes('CALIDAD')) return 'calidad'
  if (c.includes('EMPRESA')) return 'empresa'
  return 'tecnico'
}

/** Clase de badge para un estado COVEPA. */
export function estadoCovepaBadge(estado) {
  if (!estado) return 'badge-muted'
  if (estado === 'Validado') return 'badge-green'
  if (estado === 'Pre-validado' || estado === 'Prevalidado') return 'badge-teal'
  if (estado === 'Descartado') return 'badge-dark'
  if (estado === 'Crítico' || estado === 'Critico') return 'badge-critico'
  if (estado === 'Pendiente') return 'badge-yellow'
  if (estado === 'Rechazado') return 'badge-red'
  if (estado === 'En Revision' || estado === 'En Revisión') return 'badge-blue'
  if (estado === 'Solicitando Revision' || estado === 'Solicitando Revisión') return 'badge-orange'
  if (estado === 'Documentacion' || estado === 'Documentación') return 'badge-indigo'
  if (estado === 'Enviado') return 'badge-green'
  return 'badge-muted'
}

/** Formatea nombres de personas a Title Case si vienen completamente o parcialmente en MAYÚSCULAS */
export function formatNombrePersona(str) {
  if (!str) return ''
  const trimmed = String(str).trim()
  if (!trimmed) return ''
  return trimmed
    .split(/\s+/)
    .map(w => {
      // Normalizar palabras que vengan 100% en mayúsculas sostenidas
      if (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      }
      return w
    })
    .join(' ')
}

/**
 * Formatea una fecha/hora ISO en hora peruana amigable para auditoría.
 */
export function formatPeruDateTime(isoString) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    const dia = d.toLocaleDateString('es-PE', {
      timeZone: 'America/Lima',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    const hora = d.toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    return `${dia} · ${hora} hrs`
  } catch (_) {
    return isoString
  }
}

/**
 * Determina si una fecha ISO corresponde al día de hoy en hora Perú (America/Lima).
 */
export function isHoyPeru(isoString) {
  if (!isoString) return false
  try {
    const d = new Date(isoString)
    const fRun = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
    return fRun === hoy
  } catch (_) {
    return false
  }
}

export const MAPA_CODIGO_PERSONAL_A_NOMBRE = {
  '4b56f618-981f-4f2a-a901-4a4de4543899': 'Alfonso Curi',
  '554a3a58-bf04-480a-8795-d85e055ee4c6': 'Jhonatan Flores',
  '4f9d2cc7-3a88-42f9-b9ac-e97eec0277fe': 'Marco Chamba',
  '84444118-163f-4568-8040-e60e1824fd73': 'Juan Castro',
  '61d6e0fc-81ae-4e84-9841-1436795d27fd': 'Willy Fernández',
  '19ff0cdf-7afc-4e50-94b2-f1a9998de148': 'William Avila',
  '98a85d5b-9514-43f6-ae29-6a8c2ef6d06c': 'Hugo Espinoza',
  '05db4c32-3c7a-42e4-a0aa-8ac33dd5c75f': 'Daniel Javier',
  '58bf102a-514f-4829-806b-1037856cadb1': 'Gabriel Farro',
  'eebf3b9e-4923-47ce-9eee-8e9af86c9fea': 'Cristian Isla',
  'a4295a11-646e-44ca-a855-abeac12cfaaa': 'Rolan Rojas',
  'f3b135e9-0446-4f88-8bbd-bdae257c1f15': 'Milton Alamo',
  '45cc3a1b-75f9-447f-af68-efec878d0abf': 'Jhon Miler',
  'dbaa3159-e4fc-4e85-8295-8bdff568ab1e': 'Roger Valdivia',
  '06aef94f-cf84-438f-b6c5-f60658e70ba3': 'Ronal Ninamaque',
  '243a62bf-1424-4aad-ac99-4ceae9db421c': 'Denis Torres',
  'ef2433d5-67e5-4c81-80a6-ae0c808e3224': 'Jhonatan Rios',
  '0469c1c5-8900-462e-9712-2ca4c0a0ad0b': 'Elio Chavez',
  '9ba60440-e8bf-45a4-b936-b4adb6b67632': 'Ciro Fernandez'
};

/**
 * Extrae y formatea solo el primer nombre y primer apellido de una persona.
 * Si recibe una dupla unida por "·" o "/", formatea ambas personas:
 * Ej: "Marco Antonio Chamba Contreras" -> "Marco Chamba"
 * Ej: "Jhonatan Flores Rojas · Marco Antonio Chamba Contreras" -> "Jhonatan Flores · Marco Chamba"
 * Ej: "Juan Castro Torres" -> "Juan Castro"
 * Ej: "Willy Fernández Aquino" -> "Willy Fernández"
 */
export function formatPrimerNombrePrimerApellido(str) {
  if (!str) return ''
  const trimmed = String(str).trim()
  if (!trimmed || trimmed === '—' || trimmed === '-') return ''

  if (MAPA_CODIGO_PERSONAL_A_NOMBRE[trimmed.toLowerCase()]) {
    return MAPA_CODIGO_PERSONAL_A_NOMBRE[trimmed.toLowerCase()];
  }

  if (trimmed.includes('·')) {
    return trimmed.split('·').map(part => formatPrimerNombrePrimerApellido(part.trim())).filter(Boolean).join(' · ')
  }
  if (trimmed.includes('/')) {
    return trimmed.split('/').map(part => formatPrimerNombrePrimerApellido(part.trim())).filter(Boolean).join(' · ')
  }

  const cleaned = formatNombrePersona(trimmed)
  const upper = cleaned.toUpperCase()

  // Mapeos oficiales exactos de los técnicos y supervisores del proyecto
  if (upper.includes('JHONATAN') && upper.includes('FLORES')) return 'Jhonatan Flores'
  if (upper.includes('MARCO') && upper.includes('CHAMBA')) return 'Marco Chamba'
  if (upper.includes('JUAN') && upper.includes('CASTRO')) return 'Juan Castro'
  if (upper.includes('WILLY') && (upper.includes('FERNANDEZ') || upper.includes('FERNÁNDEZ'))) return 'Willy Fernández'
  if (upper.includes('ALFONSO') && upper.includes('CURI')) return 'Alfonso Curi'
  if ((upper.includes('WILLIAM') || upper.includes('WILL')) && (upper.includes('AVILA') || upper.includes('ÁVILA'))) return 'William Avila'
  if (upper.includes('HUGO') && upper.includes('ESPINOZA')) return 'Hugo Espinoza'
  if (upper.includes('DANIEL') && upper.includes('JAVIER')) return 'Daniel Javier'
  if (upper.includes('ROGER') && upper.includes('VALDIVIA')) return 'Roger Valdivia'
  if (upper.includes('PERCY') && upper.includes('ROJAS')) return 'Percy Rojas'
  if (upper.includes('CARLOS') && upper.includes('CONDOR')) return 'Carlos Condor'

  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length <= 2) return cleaned

  // Si tiene 3 palabras: [Nombre, ApellidoPaterno, ApellidoMaterno] -> parts[0] + parts[1]
  if (parts.length === 3) {
    return `${parts[0]} ${parts[1]}`
  }
  // Si tiene 4 palabras o más: [Nombre1, Nombre2, ApellidoPaterno, ApellidoMaterno] -> parts[0] + parts[2]
  return `${parts[0]} ${parts[2]}`
}

/**
 * Resuelve la localidad contigua al ID de un sitio (stub de compatibilidad; usar sitiosService para la versión con catálogo).
 */
export function getLocalidadBySiteId(siteId) {
  return ''
}

