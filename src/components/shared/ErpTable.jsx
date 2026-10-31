import React from 'react'
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'

/**
 * Cabecera ordenable reutilizable con indicadores visuales de dirección
 */
export function TableHeaderSortable({
  label,
  field,
  currentField,
  currentDirection,
  onSort,
  className = '',
  align = 'left',
  title
}) {
  const isSorted = currentField === field
  const isAsc = currentDirection === 'asc'

  return (
    <th
      className={`${className} th-sortable ${isSorted ? 'is-sorted' : ''}`}
      onClick={() => onSort && field && onSort(field)}
      style={{ textAlign: align }}
      title={
        title ||
        (onSort && field
          ? `Ordenar por ${label} (${isSorted ? (isAsc ? 'Mayor a menor (Z-A / 9-1)' : 'Menor a mayor (A-Z / 1-9)') : 'Clic para ordenar A-Z'})`
          : undefined)
      }
    >
      <div className={`sort-header-inner align-${align}`}>
        <span>{label}</span>
        {onSort && field && (
          <span className={`sort-indicator ${isSorted ? 'active' : 'inactive'}`}>
            {isSorted ? (isAsc ? '▲' : '▼') : '↕'}
          </span>
        )}
      </div>
    </th>
  )
}

/**
 * Barra de paginación reutilizable estándar ERP
 */
export function TablePagination({
  page = 1,
  pageSize = 20,
  totalCount = 0,
  onPageChange,
  hasActiveFilters = false,
  entityName = 'registros'
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start = totalCount > 0 ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, totalCount)

  if (totalCount <= 0) return null

  return (
    <div className="table-pagination">
      <span className="pagination-info">
        {start} – {end} de {totalCount.toLocaleString()} {entityName}
        {hasActiveFilters && (
          <span className="pagination-filtered-label"> (filtradas)</span>
        )}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="page-btn"
          disabled={page <= 1}
          onClick={() => onPageChange && onPageChange(Math.max(1, page - 1))}
          title="Página anterior"
        >
          <ChevronLeft size={15} />
          <span>Anterior</span>
        </button>
        <span className="current-page-tag">Pág. {page} / {totalPages}</span>
        <button
          type="button"
          className="page-btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange && onPageChange(Math.min(totalPages, page + 1))}
          title="Página siguiente"
        >
          <span>Siguiente</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

/**
 * Componente Tabla Estándar ERP reutilizable para Observaciones, Personal y Sitios
 */
export default function ErpTable({
  columns = [],
  data = [],
  keyField = 'id',
  loading = false,
  loadingMessage = 'Cargando registros...',
  emptyIcon,
  emptyTitle = 'Sin resultados',
  emptyDescription = 'No se encontraron registros con los filtros aplicados.',
  sortField,
  sortDirection = 'asc',
  onSort,
  onRowClick,
  rowClassName,
  // Paginación
  pagination = true,
  page = 1,
  pageSize = 20,
  totalCount,
  onPageChange,
  hasActiveFilters = false,
  entityName = 'registros',
  // Modificadores visuales
  wrapperClassName = '',
  scrollClassName = '',
  tableClassName = '',
  minWidth = '980px',
  children
}) {
  const actualTotalCount = typeof totalCount === 'number' ? totalCount : data.length

  return (
    <div className={`erp-table-wrapper sitios-table-wrapper ${wrapperClassName}`.trim()}>
      {loading ? (
        <div className="table-loading-state">
          <div className="loader-spinner" />
          <p>{loadingMessage}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="table-empty-state">
          {emptyIcon || <Inbox size={44} style={{ opacity: 0.35 }} />}
          <h3>{emptyTitle}</h3>
          <p>{emptyDescription}</p>
        </div>
      ) : (
        <div className={`erp-table-scroll sitios-table-scroll ${scrollClassName}`.trim()}>
          <table className={`erp-table sitios-table ${tableClassName}`.trim()} style={{ minWidth }}>
            {/* Colgroup para proporción y ancho fijo de columnas */}
            <colgroup>
              {columns.map((col, idx) => (
                <col
                  key={col.key || idx}
                  className={col.className || ''}
                  style={col.width ? { width: col.width } : undefined}
                />
              ))}
            </colgroup>

            {/* Cabecera Adherente (Sticky) */}
            <thead>
              <tr>
                {columns.map((col, idx) => {
                  if (col.sortable !== false && col.key && onSort) {
                    return (
                      <TableHeaderSortable
                        key={col.key}
                        label={col.label}
                        field={col.key}
                        currentField={sortField}
                        currentDirection={sortDirection}
                        onSort={onSort}
                        className={col.headerClassName || col.className || ''}
                        align={col.align || 'left'}
                        title={col.title}
                      />
                    )
                  }
                  return (
                    <th
                      key={col.key || idx}
                      className={col.headerClassName || col.className || ''}
                      style={{ textAlign: col.align || 'left' }}
                    >
                      <div className={`sort-header-inner align-${col.align || 'left'}`}>
                        <span>{col.label}</span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>

            {/* Cuerpo de Filas */}
            <tbody>
              {children ||
                data.map((row, rowIdx) => {
                  const keyVal = row[keyField] ?? rowIdx
                  const customRowClass =
                    typeof rowClassName === 'function'
                      ? rowClassName(row, rowIdx)
                      : rowClassName || ''

                  return (
                    <tr
                      key={keyVal}
                      className={`erp-row sitio-row ${customRowClass}`.trim()}
                      onClick={() => onRowClick && onRowClick(row)}
                      style={onRowClick ? { cursor: 'pointer' } : undefined}
                    >
                      {columns.map((col, colIdx) => (
                        <td
                          key={col.key || colIdx}
                          className={col.cellClassName || ''}
                          style={{ textAlign: col.align || 'left' }}
                        >
                          {col.render ? col.render(row, rowIdx) : row[col.key]}
                        </td>
                      ))}
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Barra de Paginación Adherente */}
      {!loading && pagination && actualTotalCount > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={actualTotalCount}
          onPageChange={onPageChange}
          hasActiveFilters={hasActiveFilters}
          entityName={entityName}
        />
      )}
    </div>
  )
}

