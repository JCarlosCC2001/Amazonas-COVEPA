import React from 'react'

/**
 * MetricCard — Componente reutilizable de medidor / tarjeta KPI
 * Diseñado bajo la identidad corporativa COVEPA (blanco, celestes suaves y azul #003060)
 *
 * @param {React.ReactNode} icon - Icono de Lucide o SVG
 * @param {string} label - Título o etiqueta superior del medidor
 * @param {string|number} value - Valor principal destacado
 * @param {string|React.ReactNode} subtitle - Subtítulo descriptivo o contexto
 * @param {string} variant - Variante de color: 'navy' | 'sky' | 'emerald' | 'amber' | 'purple' | 'rose'
 * @param {string|React.ReactNode} badge - Etiqueta o badge opcional en la esquina superior derecha
 * @param {function} onClick - Función al hacer clic (opcional)
 * @param {boolean} active - Si la tarjeta está activa como filtro
 * @param {boolean} loading - Muestra estado de carga si es true
 * @param {string} className - Clases CSS adicionales
 */
export default function MetricCard({
  icon,
  label,
  value,
  subtitle,
  variant = 'navy',
  badge,
  onClick,
  active = false,
  loading = false,
  className = '',
  style = {}
}) {
  const isClickable = typeof onClick === 'function'

  return (
    <div
      className={`covepa-metric-card variant-${variant} ${active ? 'is-active' : ''} ${isClickable ? 'is-clickable' : ''} ${className}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(e) } : undefined}
      style={style}
    >
      {/* Barra de acento superior */}
      <div className="metric-accent-bar" />

      {/* Contenido de la tarjeta */}
      <div className="metric-card-inner">
        {/* Lado izquierdo: Icono con contenedor estilizado */}
        {icon && (
          <div className="metric-icon-box">
            {icon}
          </div>
        )}

        {/* Lado derecho / Centro: Métricas y textos */}
        <div className="metric-info-col">
          <div className="metric-top-row">
            <span className="metric-label">{label}</span>
            {badge && (
              <span className="metric-badge-tag">{badge}</span>
            )}
          </div>

          <div className="metric-value-row">
            <span className="metric-value">
              {loading ? (
                <span className="metric-skeleton-pulse" />
              ) : (
                value ?? '—'
              )}
            </span>

            {subtitle && (
              <span className="metric-sub-pill">
                {subtitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Marca de agua decorativa de fondo para dar profundidad visual */}
      {icon && (
        <div className="metric-watermark" aria-hidden="true">
          {icon}
        </div>
      )}
    </div>
  )
}

/**
 * MetricGrid — Contenedor responsive para tarjetas MetricCard
 */
export function MetricGrid({ children, columns = 4, className = '', style = {} }) {
  return (
    <div
      className={`covepa-metric-grid cols-${columns} ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
