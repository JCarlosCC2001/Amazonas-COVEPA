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

