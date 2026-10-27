import { Search, X } from 'lucide-react'

/** Buscador controlado con ícono de lupa y botón de limpiar. */
export default function SearchInput({ value, onChange, placeholder = 'Buscar...', id, className = '', style, iconSize = 15 }) {
  return (
    <div className={`obs-search-box ${className}`.trim()} style={style}>
      <Search size={iconSize} className="obs-search-icon" />
      <input
        id={id}
        type="text"
        className="obs-search-input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className="clear-search-btn" onClick={() => onChange('')} aria-label="Limpiar búsqueda">
          <X size={iconSize - 2} />
        </button>
      )}
    </div>
  )
}
