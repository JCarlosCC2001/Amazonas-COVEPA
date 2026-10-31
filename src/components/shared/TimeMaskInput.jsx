import { useState, useEffect, useRef } from 'react'
import { Clock, X } from 'lucide-react'

/**
 * Normaliza y formatea un valor a HH:MM al perder el foco (onBlur)
 * Soporta entradas como:
 * - '1' -> '01:00'
 * - '1:30' -> '01:30'
 * - ':45' -> '00:45'
 * - '12:5' -> '12:05'
 * - '02:40' -> '02:40'
 */
export function normalizeTimeHHMM(val) {
  if (!val || typeof val !== 'string') return ''
  const trimmed = val.trim()
  if (!trimmed) return ''

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
 * Calcula la diferencia en minutos y en formato HH:MM entre dos tiempos
 */
export function diffTimeHHMM(realHHMM, demoraHHMM) {
  if (!realHHMM || !demoraHHMM) return null
  const [rh, rm] = realHHMM.split(':').map(Number)
  const [dh, dm] = demoraHHMM.split(':').map(Number)
  if (isNaN(rh) || isNaN(rm) || isNaN(dh) || isNaN(dm)) return null

  const minReal = rh * 60 + rm
  const minDemora = dh * 60 + dm
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

