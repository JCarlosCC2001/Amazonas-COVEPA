import React, { useState, useMemo } from 'react'
import { FileSpreadsheet, Download, Search, Layers, Loader2 } from 'lucide-react'

export default function TablaExcelDetalle({
  columns = [],
  data = [],
  fileName = 'Reporte.xlsx',
  onDownload,
  downloading = false,
  subtabs = null, // [{ id: 'hoja1', label: 'Hoja 1' }]
  activeSubtab = null,
  onSubtabChange = null,
  sheetNotice = 'Estructura oficial del archivo Excel (.xlsx)'
}) {
  const [search, setSearch] = useState('')

  const filteredData = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase().trim()
    return (data || []).filter(row => {
      return Object.values(row).some(val => {
        if (val === null || val === undefined) return false
        return String(val).toLowerCase().includes(q)
      })
    })
  }, [data, search])

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #d8e5f1',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}
    >
      {/* Barra superior con Aviso, Pestañas de Hojas (si aplica) y Botón Descargar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid #edf4fb', paddingBottom: '0.85rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={18} color="#003060" />
            <h4 className="t-name" style={{ margin: 0, color: '#003060' }}>
              Estructura de Datos Excel
            </h4>
          </div>
          <p className="t-meta" style={{ margin: '0.15rem 0 0 0', color: '#64748b' }}>
            {sheetNotice}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {subtabs && subtabs.length > 1 && (
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {subtabs.map(tab => {
                const active = activeSubtab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onSubtabChange && onSubtabChange(tab.id)}
                    className="t-badge"
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: active ? '#ffffff' : 'transparent',
                      color: active ? '#003060' : '#64748b',
                      fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-normal)',
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.45rem 1rem' }}
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span>{downloading ? 'Generando Excel...' : 'Descargar Archivo Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Buscador de registros y contador */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Filtrar registros en vivo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="t-body"
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2.1rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <span className="t-meta" style={{ color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
          Mostrando <strong>{filteredData.length}</strong> de {data.length} fila(s)
        </span>
      </div>

      {/* Tabla Interactiva de Datos */}
      <div
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          overflowX: 'auto',
          maxHeight: '460px',
          overflowY: 'auto'
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr style={{ background: '#003060', color: '#ffffff' }}>
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className="t-badge"
                  style={{
                    padding: '0.65rem 0.85rem',
                    color: '#ffffff',
                    fontWeight: 'var(--fw-semibold)',
                    whiteSpace: 'nowrap',
                    borderRight: '1px solid rgba(255,255,255,0.15)',
                    textAlign: col.align || 'left'
                  }}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                  <span className="t-meta">No hay datos que coincidan con la búsqueda.</span>
                </td>
              </tr>
            ) : (
              filteredData.map((row, rIdx) => (
                <tr
                  key={row.id || rIdx}
                  style={{
                    backgroundColor: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  {columns.map((col, cIdx) => {
                    const val = row[col.key]
                    return (
                      <td
                        key={col.key || cIdx}
                        className="t-meta"
                        style={{
                          padding: '0.55rem 0.85rem',
                          color: '#334155',
                          borderRight: '1px solid #e2e8f0',
                          textAlign: col.align || 'left',
                          whiteSpace: col.wrap ? 'normal' : 'nowrap',
                          maxWidth: col.maxWidth || 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                        title={val !== null && val !== undefined ? String(val) : ''}
                      >
                        {col.render ? col.render(val, row) : (val !== null && val !== undefined ? String(val) : '-')}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

