import React from 'react'
import { formatNombrePersona } from '../../utils/helpers'

/**
 * Componente Reutilizable: CuadrillasMatrixTable
 * Renderiza una tabla matricial ejecutiva de alta densidad para cuadrillas y métricas
 * (usada en Dashboard para producción semanal y en Avance del Día para estados diarios).
 * Cumple con el estándar tipográfico Inter y números tabulares.
 */
export default function CuadrillasMatrixTable({
  icon = null,
  title = 'Matriz de Cuadrillas',
  subtitle = '',
  badgeText = '',
  columns = [],
  rows = [],
  totals = {},
  grandTotal = 0,
  footLabel = 'TOTAL DIARIO',
  presentationMode = false,
  emptyMessage = 'No hay datos registrados para esta selección.',
  extraHeader = null,
  cardClassName = 'dash-weekly-card',
  onCellClick = null,
  onRowClick = null
}) {
  const getBadgeClass = (variant, count) => {
    if (count <= 0) return 'is-zero'
    switch (variant) {
      case 'amber':
        return 'has-val val-amber'
      case 'sky':
        return 'has-val val-sky'
      case 'rose':
        return 'has-val val-rose'
      case 'emerald':
        return 'has-val val-emerald'
      default:
        return 'has-val'
    }
  }

  const getHeaderClass = (col) => {
    const classes = []
    if (col.align === 'left') classes.push('th-left')
    if (col.isToday) classes.push('th-today')
    if (col.badgeVariant === 'amber') classes.push('th-amber')
    if (col.badgeVariant === 'sky') classes.push('th-sky')
    if (col.badgeVariant === 'rose') classes.push('th-rose')
    if (col.badgeVariant === 'emerald') classes.push('th-emerald')
    return classes.join(' ')
  }

  return (
    <div className={cardClassName}>
      {/* Cabecera del Cuadro */}
      <div className="dash-weekly-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {icon}
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
              {title}
            </h3>
            {subtitle && (
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                {subtitle}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {extraHeader}
          {badgeText && (
            <span className="dash-progreso-resueltas-badge" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {badgeText}
            </span>
          )}
        </div>
      </div>

      {/* Contenedor de la Tabla */}
      <div className="dash-weekly-table-wrap">
        <table className="dash-weekly-table">
          <thead>
            <tr>
              <th className="th-left">Cuadrilla</th>
              <th className="th-left">Técnico</th>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={getHeaderClass(col)}
                  title={col.title || col.label}
                >
                  <div>{col.label}</div>
                  {col.subLabel && (
                    <div style={{ fontSize: 'var(--text-2xs)', color: '#0284c7', fontWeight: 'var(--fw-black)' }}>
                      {col.subLabel}
                    </div>
                  )}
                </th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 3} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const cuadrillaName = row.cuadrilla || row.grupo || 'Sin Cuadrilla'
                const techName = !presentationMode ? (formatNombrePersona(row.tecnico) || '—') : '—'
                const rowTotal = row.total ?? row.totalSemana ?? 0

                return (
                  <tr
                    key={row.id || cuadrillaName}
                    onClick={() => onRowClick && onRowClick(row)}
                    style={onRowClick ? { cursor: 'pointer' } : undefined}
                  >
                    <td className="td-left" style={{ fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                      {cuadrillaName}
                    </td>
                    <td className="td-left" style={{ color: 'var(--text-secondary)' }}>
                      {techName}
                    </td>
                    {columns.map(col => {
                      const count = row.values?.[col.key] ?? row.semana?.[col.key] ?? row[col.key] ?? 0
                      const badgeClass = getBadgeClass(col.badgeVariant, count)
                      return (
                        <td
                          key={col.key}
                          className={col.isToday ? 'td-today' : ''}
                          onClick={(e) => {
                            if (onCellClick) {
                              e.stopPropagation()
                              onCellClick(row, col, count)
                            }
                          }}
                          style={onCellClick && count > 0 ? { cursor: 'pointer' } : undefined}
                        >
                          <span className={`dash-weekly-count-badge ${badgeClass}`}>
                            {count > 0 ? count : '—'}
                          </span>
                        </td>
                      )
                    })}
                    <td>
                      <span className="dash-weekly-total-badge">
                        {rowTotal}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2} className="td-left" style={{ fontWeight: 'var(--fw-black)', color: '#003060' }}>
                  {footLabel}
                </td>
                {columns.map(col => {
                  const tot = totals?.[col.key] ?? 0
                  const badgeClass = getBadgeClass(col.badgeVariant, tot)
                  return (
                    <td key={col.key} className={col.isToday ? 'td-today' : ''}>
                      <span className={`dash-weekly-count-badge ${badgeClass}`}>
                        {tot > 0 ? tot : '—'}
                      </span>
                    </td>
                  )
                })}
                <td>
                  <span className="dash-weekly-foot-total">
                    {grandTotal}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
