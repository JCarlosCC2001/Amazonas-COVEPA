import { useState, useEffect, useRef } from 'react'
import { Clock, X } from 'lucide-react'

/**
 * Extrae y convierte cualquier representación de tiempo a minutos totales.
 * Soporta:
 * - HH:MM o H:MM (ej: '01:30', '1:30', '00:45', ':45')
 * - Lenguaje natural del otro sistema (ej: '1h 30m', '1h', '45 min', '2 días')
 * - Números simples (ej: '90' -> 90 mins)
 */
export function parseTimeToMinutes(val) {
  if (!val || typeof val !== 'string') return null
  const s = val.trim().toLowerCase()
  if (!s) return null

  // Formato estándar con dos puntos (HH:MM o H:MM)
  if (s.includes(':')) {
    const parts = s.split(':')
    const h = parts[0] === '' ? 0 : parseInt(parts[0], 10)
    const m = parts[1] === '' ? 0 : parseInt(parts[1], 10)
    if (!isNaN(h) && !isNaN(m)) return (h * 60) + m
  }

  // Lenguaje natural o mixto (ej: '1h 30m', '45 min', '2 dias', etc.)
  let totalMinutes = 0
  let matched = false

  const daysMatch = s.match(/(\d+)\s*d(?:[ií]a|ias|ías)?/i)
  if (daysMatch) {
    totalMinutes += parseInt(daysMatch[1], 10) * 24 * 60
    matched = true
  }

  const hoursMatch = s.match(/(\d+)\s*h(?:ora|oras|r|rs)?/i)
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60
    matched = true
  }

  const minsMatch = s.match(/(\d+)\s*(?:m|min|minuto|minutos)(?!\w)/i)
  if (minsMatch) {
    totalMinutes += parseInt(minsMatch[1], 10)
    matched = true
  }

  if (matched) return totalMinutes

  // Si solo son dígitos (ej: "45")
  if (/^\d+$/.test(s)) {
    return parseInt(s, 10)
  }

  return null
}

/**
 * Normaliza y formatea un valor a HH:MM al perder el foco (onBlur)
 * Soporta entradas como:
 * - '1' -> '01:00'
 * - '1:30' -> '01:30'
 * - ':45' -> '00:45'
 * - '12:5' -> '12:05'
 * - '02:40' -> '02:40'
 * - '1h 30m' -> '01:30'
 */
export function normalizeTimeHHMM(val) {
  if (!val || typeof val !== 'string') return ''
  const trimmed = val.trim()
  if (!trimmed) return ''

  // Si ya es HH:MM exacto
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const parsedMins = parseTimeToMinutes(trimmed)
  if (parsedMins !== null) {
    const hours = Math.floor(parsedMins / 60)
    const mins = parsedMins % 60
    const clampedH = Math.min(Math.max(hours, 0), 99)
    const clampedM = Math.min(Math.max(mins, 0), 59)
    const hh = String(clampedH).padStart(2, '0')
    const mm = String(clampedM).padStart(2, '0')
    return `${hh}:${mm}`
  }

  const parts = trimmed.split(':')
  let hours = 0
  let mins = 0

  if (parts.length >= 2) {
    hours = parseInt(parts[0], 10) || 0
    mins = parseInt(parts[1], 10) || 0
  } else {
    hours = parseInt(trimmed, 10) || 0
    mins = 0
  }

  if (mins > 59) mins = 59
  if (hours > 99) hours = 99
  if (hours < 0) hours = 0
  if (mins < 0) mins = 0

  const hh = String(hours).padStart(2, '0')
  const mm = String(mins).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Aplica máscara interactiva de tiempo mientras el usuario escribe
 */
function applyTimeMask(inputVal) {
  if (!inputVal) return ''
  // Si contiene dos puntos
  if (inputVal.includes(':')) {
    const [h, m] = inputVal.split(':')
    const cleanH = (h || '').replace(/\D/g, '').slice(0, 2)
    const cleanM = (m || '').replace(/\D/g, '').slice(0, 2)
    if (cleanM.length > 0) return `${cleanH}:${cleanM}`
    return `${cleanH}:`
  }
  const digits = inputVal.replace(/\D/g, '').slice(0, 4)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

/**
 * Calcula la diferencia en minutos y en formato HH:MM entre dos tiempos.
 * Acepta tanto formato HH:MM como texto libre de la otra aplicación ('1h 30m', '45 min', etc.)
 */
export function diffTimeHHMM(realTime, demoraTime) {
  if (!realTime || !demoraTime) return null

  const minReal = parseTimeToMinutes(realTime)
  const minDemora = parseTimeToMinutes(demoraTime)
  if (minReal === null || minDemora === null) return null

  const diffMins = minDemora - minReal

  const absMins = Math.abs(diffMins)
  const h = Math.floor(absMins / 60)
  const m = absMins % 60
  const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  return {
    diffMins,
    formatted,
    hasDelay: diffMins > 0,
    isEqual: diffMins === 0,
    isFaster: diffMins < 0
  }
}

/**
 * Componente TimeMaskInput con selector rápido y máscara HH:MM
 */
export default function TimeMaskInput({
  value = '',
  onChange,
  onBlur,
  disabled = false,
  label = 'Tiempo:',
  placeholder = '00:00',
  title = '',
  presets = ['00:15', '00:30', '01:00', '02:00'],
  showPresets = true,
  variant = 'default'
}) {
  const [localVal, setLocalVal] = useState(value || '')
  const inputRef = useRef(null)

  useEffect(() => {
    setLocalVal(value || '')
  }, [value])

  const handleChange = (e) => {
    const masked = applyTimeMask(e.target.value)
    setLocalVal(masked)
    if (onChange) onChange(masked)
  }

  const handleBlur = () => {
    const normalized = normalizeTimeHHMM(localVal)
    setLocalVal(normalized)
    if (onChange && normalized !== localVal) {
      onChange(normalized)
    }
    if (onBlur) onBlur(normalized)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    setLocalVal('')
    if (onChange) onChange('')
    if (onBlur) onBlur('')
    if (inputRef.current) inputRef.current.focus()
  }

  const handleApplyPreset = (preset) => {
    setLocalVal(preset)
    if (onChange) onChange(preset)
    if (onBlur) onBlur(preset)
  }

  const isWarning = variant === 'warning'

  return (
    <div className={`time-mask-container ${isWarning ? 'time-mask-warning' : ''}`}>
      {label && (
        <label className="time-mask-label">
          <Clock size={12} className="time-mask-icon" />
          <span>{label}</span>
        </label>
      )}

      <div className="time-mask-input-wrap">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={localVal}
          placeholder={placeholder}
          disabled={disabled}
          title={title || 'Ingresa horas y minutos en formato HH:MM (ej: 01:30)'}
          onChange={handleChange}
          onBlur={handleBlur}
          className="time-mask-input"
        />

        {localVal && !disabled && (
          <button
            type="button"
            className="time-mask-clear-btn"
            onClick={handleClear}
            title="Limpiar tiempo"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {showPresets && !disabled && (
        <div className="time-mask-presets">
          {presets.map(p => (
            <button
              key={p}
              type="button"
              className={`time-preset-chip ${localVal === p ? 'active' : ''}`}
              onClick={() => handleApplyPreset(p)}
              title={`Fijar ${p} (${p.startsWith('00:') ? parseInt(p.split(':')[1]) + ' min' : p.replace(':00', ' h')})`}
            >
              {p.startsWith('00:') ? `${parseInt(p.split(':')[1])}m` : `${parseInt(p.split(':')[0])}h`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

