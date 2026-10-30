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
    // Si viene como medianoche UTC pura (ej: '2026-10-26T00:00:00+00:00'), no retroceder de día
    if (s.includes('T00:00:00')) return s.split('T')[0]
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
  if (estado === 'Descartado') return 'badge-dark'
  if (estado === 'Pendiente') return 'badge-yellow'
  if (estado === 'Rechazado') return 'badge-red'
  if (estado === 'En Revision' || estado === 'En Revisión') return 'badge-blue'
  if (estado === 'Solicitando Revision' || estado === 'Solicitando Revisión') return 'badge-orange'
  if (estado === 'Enviado') return 'badge-green'
  return 'badge-muted'
}

/** Formatea nombres de personas a Title Case si vienen completamente en MAYÚSCULAS */
export function formatNombrePersona(str) {
  if (!str) return ''
  const trimmed = String(str).trim()
  if (!trimmed) return ''
  // Si está 100% en mayúsculas (ej: "CRISTIAN ISLA"), convertir a Title Case ("Cristian Isla")
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }
  return trimmed
}
