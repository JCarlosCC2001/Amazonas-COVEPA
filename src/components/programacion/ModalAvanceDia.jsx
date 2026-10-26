import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, X, Search, Download, MapPin, User,
  Clock, ShieldCheck, RefreshCw, AlertCircle, Eye, FileText
} from 'lucide-react'
import ExcelJS from 'exceljs'
import { getAvancePorFecha } from '../../services/dashboardService'
import { ASIGNACIONES_BASE } from '../../services/sitiosService'

export default function ModalAvanceDia({ fecha, sitiosMap = {}, onClose }) {
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [avanceData, setAvanceData] = useState({ rows: [], stats: {}, programacionesDelDia: 0 })
  const [searchTable, setSearchTable] = useState('')
  const [filterEstado, setFilterEstado] = useState('TODOS')
  const [selectedRowDetail, setSelectedRowDetail] = useState(null)
  const [exportingXlsx, setExportingXlsx] = useState(false)

  // Cargar datos de avance para la fecha seleccionada
  useEffect(() => {
    let isMounted = true
    const loadAvance = async () => {
      setLoading(true)
      setErrorMsg('')
      try {
        const res = await getAvancePorFecha(fecha)
        if (isMounted) {
          setAvanceData(res || { rows: [], stats: {}, programacionesDelDia: 0 })
        }
      } catch (err) {
        if (isMounted) setErrorMsg(err.message || 'Error cargando avance del día')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadAvance()
    return () => { isMounted = false }
  }, [fecha])

  // Cerrar únicamente con tecla Escape (o botón X)
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        if (selectedRowDetail) {
          setSelectedRowDetail(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, selectedRowDetail])

  // Helper para resolver localidad de un sitio
  const getLocalidad = (idSitio) => {
    return sitiosMap[idSitio]?.localidad ||
      sitiosMap[idSitio]?.nombre_nodo ||
      ASIGNACIONES_BASE.find(s => s.id_site === idSitio)?.localidad ||
      ''
  }

  const stats = avanceData.stats || {}

  // Filtrado de filas
  const filteredRows = useMemo(() => {
    return (avanceData.rows || []).filter(r => {
      const loc = getLocalidad(r.id_sitio)
      const q = searchTable.toLowerCase().trim()
      const matchSearch = !q ||
        (r.id_obs && r.id_obs.toLowerCase().includes(q)) ||
        (r.tecnico && r.tecnico.toLowerCase().includes(q)) ||
        (r.cuadrilla && r.cuadrilla.toLowerCase().includes(q)) ||
        (r.id_sitio && r.id_sitio.toLowerCase().includes(q)) ||
        (loc && loc.toLowerCase().includes(q)) ||
        (r.revisor && r.revisor.toLowerCase().includes(q))

      if (!matchSearch) return false

      if (filterEstado === 'TODOS') return true
      if (filterEstado === 'ENVIADAS_VALIDADAS') {
        return r.estado === 'Validado' || r.estado === 'Enviado'
      }
      if (filterEstado === 'En Revisión') {
        return r.estado === 'En Revision' || r.estado === 'En Revisión'
      }
      return r.estado === filterEstado
    })
  }, [avanceData.rows, filterEstado, searchTable, sitiosMap])

  // Formato legible de fecha
  const formattedDate = useMemo(() => {
    if (!fecha) return ''
    const parts = fecha.split('-')
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      return d.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }
    return fecha
  }, [fecha])

  // Exportar reporte a Excel (.xlsx) con estricto apego a Regla 1 (LOCALIDAD al lado de CÓDIGO DE SITIO)
  const handleExportXLSX = async () => {
    if (filteredRows.length === 0) return
    setExportingXlsx(true)
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'COVEPA ERP'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet('Avance_Dia', {
        views: [{ showGridLines: true }]
      })

      const tableRows = filteredRows.map((r, idx) => [
        idx + 1,
        r.id_obs || '',
        r.tecnico || 'No asignado',
        r.cuadrilla || 'Sin cuadrilla',
        r.id_sitio || '',
        getLocalidad(r.id_sitio) || '',
        r.estado || '',
        r.revisor || 'Sin revisor',
        r.fecha_subsanacion ? String(r.fecha_subsanacion).slice(0, 10) : '',
        r.detalle || ''
      ])

      worksheet.addTable({
        name: `Avance_${fecha.replace(/-/g, '_')}`,
        ref: 'A1',
        headerRow: true,
        totalsRow: false,
        style: {
          theme: 'TableStyleMedium9',
          showRowStripes: true,
          showColumnStripes: false
        },
        columns: [
          { name: '#', filterButton: true },
          { name: 'CÓD. OBSERVACIÓN', filterButton: true },
          { name: 'NOMBRE DE TÉCNICO', filterButton: true },
          { name: 'CUADRILLA', filterButton: true },
          { name: 'CÓDIGO DE SITIO', filterButton: true },
          { name: 'LOCALIDAD', filterButton: true },
          { name: 'ESTADO COVEPA', filterButton: true },
          { name: 'REVISADO POR', filterButton: true },
          { name: 'FECHA DE REVISIÓN', filterButton: true },
          { name: 'DETALLE DE OBSERVACIÓN', filterButton: true }
        ],
        rows: tableRows
      })

      const colWidths = [6, 20, 26, 16, 18, 24, 18, 22, 16, 40]
      colWidths.forEach((w, i) => {
        worksheet.getColumn(i + 1).width = w
      })

      worksheet.eachRow((row, rowNumber) => {
        row.height = rowNumber === 1 ? 24 : 20
        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 || colNumber === 5 || colNumber === 7 || colNumber === 9 ? 'center' : 'left'
          }
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Avance_COVEPA_${fecha}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al exportar Excel de avance:', err)
      alert('Error generando Excel: ' + err.message)
    } finally {
      setExportingXlsx(false)
    }
  }

  // Renderizador de badge semántico de estado
  const renderEstadoBadge = (st) => {
    switch (st) {
      case 'Validado':
        return <span className="prog-avance-badge validado">✓ Por Subir</span>
      case 'Enviado':
        return <span className="prog-avance-badge enviado">✉ Enviada</span>
      case 'En Revision':
      case 'En Revisión':
        return <span className="prog-avance-badge revision">🔍 En Revisión</span>
      case 'Descartado':
        return <span className="prog-avance-badge descartado">🚫 Descartada</span>
      case 'Rechazado':
        return <span className="prog-avance-badge rechazado">✕ Rechazada</span>
      default:
        return <span className="prog-avance-badge pendiente">● {st || 'Pendiente'}</span>
    }
  }

  return (
    <div className="prog-details-modal-overlay">
      <div className="prog-details-modal prog-avance-modal">
        {/* Cabecera del Modal */}
        <div className="prog-details-modal-header">
          <div className="prog-details-header-main">
            <div className="prog-details-site-title-row">
              <div className="prog-details-site-badge-icon" style={{ background: '#f0f9ff', color: '#0284c7', borderColor: '#bae6fd' }}>
                <TrendingUp size={22} />
              </div>
              <div className="prog-details-site-texts">
                <div className="prog-details-title-line">
                  <h2 className="prog-details-site-title" style={{ fontFamily: 'inherit', letterSpacing: 'normal' }}>
                    Avance del Día
                  </h2>
                  <span className="prog-details-site-loc" style={{ textTransform: 'capitalize', color: '#475569', fontSize: '0.95rem' }}>
                    · {formattedDate}
                  </span>
                </div>
                <div className="prog-details-site-meta-pills">
                  <span className="meta-pill" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd', fontWeight: 700 }}>
                    {avanceData.rows?.length || 0} observaciones registradas
                  </span>
                  {avanceData.programacionesDelDia > 0 && (
                    <span className="meta-pill">
                      {avanceData.programacionesDelDia} {avanceData.programacionesDelDia === 1 ? 'jornada programada' : 'jornadas programadas'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="prog-details-modal-actions">
            <button
              type="button"
              className="prog-modal-close-btn"
              onClick={onClose}
              title="Cerrar ventana (Esc)"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Filtros por Estado */}
        <div className="prog-modal-stats-bar">
          <button
            type="button"
            className={`prog-modal-stat-btn ${filterEstado === 'TODOS' ? 'active' : ''}`}
            onClick={() => setFilterEstado('TODOS')}
            title="Ver todas las observaciones del día"
          >
            <span className="stat-btn-label">Total</span>
            <span className="stat-btn-val">{avanceData.rows?.length || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-validado ${filterEstado === 'Validado' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'Validado' ? 'TODOS' : 'Validado')}
            title="Observaciones validadas listas para subir"
          >
            <span className="stat-btn-label text-validado">✓ Por Subir</span>
            <span className="stat-btn-val text-validado">{stats.validadas || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-revision ${filterEstado === 'En Revisión' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'En Revisión' ? 'TODOS' : 'En Revisión')}
            title="Observaciones en proceso de revisión"
          >
            <span className="stat-btn-label text-revision">🔍 En Revisión</span>
            <span className="stat-btn-val text-revision">{stats.enRevision || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-enviado ${filterEstado === 'Enviado' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'Enviado' ? 'TODOS' : 'Enviado')}
            title="Observaciones enviadas a COVEPA"
          >
            <span className="stat-btn-label text-enviado">✉ Enviadas</span>
            <span className="stat-btn-val text-enviado">{stats.enviadas || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-descartado ${filterEstado === 'Descartado' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'Descartado' ? 'TODOS' : 'Descartado')}
            title="Observaciones descartadas en campo"
          >
            <span className="stat-btn-label text-descartado">🚫 Descartadas</span>
            <span className="stat-btn-val text-descartado">{stats.descartadas || 0}</span>
          </button>

          {(stats.rechazadas || 0) > 0 && (
            <button
              type="button"
              className={`prog-modal-stat-btn stat-rechazado ${filterEstado === 'Rechazado' ? 'active' : ''}`}
              onClick={() => setFilterEstado(prev => prev === 'Rechazado' ? 'TODOS' : 'Rechazado')}
              title="Observaciones rechazadas por calidad"
            >
              <span className="stat-btn-label text-rechazado">✕ Rechazadas</span>
              <span className="stat-btn-val text-rechazado">{stats.rechazadas || 0}</span>
            </button>
          )}
        </div>

        {/* Barra de Búsqueda y Exportación */}
        <div className="prog-modal-search-bar">
          <div className="prog-modal-search-box-wrap">
            <div className="search-input-container">
              <Search size={15} className="search-input-icon" />
              <input
                type="text"
                className="prog-modal-search-input"
                placeholder="Buscar por código, técnico, sitio o revisor..."
                value={searchTable}
                onChange={e => setSearchTable(e.target.value)}
              />
              {searchTable && (
                <button
                  type="button"
                  onClick={() => setSearchTable('')}
                  title="Limpiar búsqueda"
                  className="search-clear-btn"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {searchTable && (
              <span className="search-results-counter">
                {filteredRows.length} resultado(s)
              </span>
            )}
          </div>

          <button
            type="button"
            className="prog-export-btn"
            onClick={handleExportXLSX}
            disabled={exportingXlsx || filteredRows.length === 0}
            title="Descargar reporte oficial en Excel (.xlsx)"
          >
            <Download size={14} />
            <span>{exportingXlsx ? 'Generando Excel...' : 'Descargar Excel (.xlsx)'}</span>
          </button>
        </div>

        {/* Cuerpo de la Ventana: Tabla de Avance */}
        <div className="prog-details-modal-body prog-avance-modal-body">
          {loading ? (
            <div className="modal-state-msg">
              <RefreshCw size={24} className="spin" color="#0284c7" />
              <span>Cargando avance y observaciones del {fecha}...</span>
            </div>
          ) : errorMsg ? (
            <div className="modal-state-msg error">{errorMsg}</div>
          ) : filteredRows.length === 0 ? (
            <div className="modal-empty-filter-state">
              <p>
                {searchTable ? (
                  <>No se encontraron registros para <strong>"{searchTable}"</strong>.</>
                ) : (
                  <>No hay observaciones registradas en este estado para el <strong>{fecha}</strong>.</>
                )}
              </p>
              {(searchTable || filterEstado !== 'TODOS') && (
                <div className="empty-filter-actions">
                  {searchTable && (
                    <button type="button" onClick={() => setSearchTable('')} className="btn-reset-filter">
                      Borrar búsqueda
                    </button>
                  )}
                  {filterEstado !== 'TODOS' && (
                    <button type="button" onClick={() => setFilterEstado('TODOS')} className="btn-reset-filter primary">
                      Ver todos ({avanceData.rows?.length || 0})
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="prog-avance-table-wrap">
              <table className="prog-avance-table">
                <thead>
                  <tr>
                    <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '110px' }}>CÓD. OBS</th>
                    <th>TÉCNICO / CUADRILLA</th>
                    <th>CÓDIGO DE SITIO · LOCALIDAD</th>
                    <th style={{ width: '130px' }}>ESTADO</th>
                    <th>REVISADO POR</th>
                    <th style={{ width: '48px', textAlign: 'center' }}>VER</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => {
                    const localidad = getLocalidad(row.id_sitio)
                    return (
                      <tr key={row.id_obs || idx} className="prog-avance-tr">
                        <td style={{ textAlign: 'center', color: '#64748b', fontSize: '0.76rem', fontWeight: 600 }}>
                          {idx + 1}
                        </td>
                        <td>
                          <span className="prog-avance-obs-code">{row.id_obs}</span>
                        </td>
                        <td>
                          <div className="prog-avance-tech-cell">
                            <User size={13} color="#0284c7" style={{ flexShrink: 0 }} />
                            <div className="prog-avance-tech-texts">
                              <span className="prog-avance-tech-name">{row.tecnico || 'No asignado'}</span>
                              {row.cuadrilla && (
                                <span className="prog-avance-tech-cuadrilla">{row.cuadrilla}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="prog-avance-site-cell">
                            <MapPin size={12} color="#0284c7" style={{ flexShrink: 0 }} />
                            <span className="prog-avance-site-code">{row.id_sitio}</span>
                            {localidad && (
                              <span className="prog-avance-site-loc">· {localidad}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {renderEstadoBadge(row.estado)}
                        </td>
                        <td>
                          <div className="prog-avance-revisor-cell">
                            {row.estado === 'En Revision' || row.estado === 'En Revisión' ? (
                              <>
                                <Clock size={12} color="#0284c7" />
                                <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.78rem' }}>
                                  {row.revisor || 'En proceso'}
                                </span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck size={13} color="#059669" />
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#003060' }}>
                                  {row.revisor || 'Sin revisor'}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="prog-avance-row-btn"
                            title="Ver detalle completo de esta observación"
                            onClick={() => setSelectedRowDetail(row)}
                          >
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Emergente Interno de Detalle Rápido de Observación */}
        {selectedRowDetail && (
          <div className="prog-modal-overlay">
            <div className="prog-modal" style={{ maxWidth: '580px', borderRadius: '12px' }}>
              <div className="prog-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} color="#0284c7" />
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#003060' }}>
                    Detalle de Observación · {selectedRowDetail.id_obs}
                  </h3>
                </div>
                <button
                  type="button"
                  className="prog-modal-close-btn"
                  onClick={() => setSelectedRowDetail(null)}
                  title="Cerrar detalle (Esc)"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="prog-modal-body" style={{ padding: '1rem 1.25rem', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">Código de Sitio y Localidad:</span>
                    <strong style={{ color: '#003060', fontSize: '0.84rem' }}>
                      {selectedRowDetail.id_sitio} {getLocalidad(selectedRowDetail.id_sitio) ? `· ${getLocalidad(selectedRowDetail.id_sitio)}` : ''}
                    </strong>
                  </div>
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">Técnico Asignado:</span>
                    <span style={{ color: '#1e293b', fontSize: '0.84rem', fontWeight: 600 }}>
                      {selectedRowDetail.tecnico} {selectedRowDetail.cuadrilla ? `(${selectedRowDetail.cuadrilla})` : ''}
                    </span>
                  </div>
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">Estado:</span>
                    <div>{renderEstadoBadge(selectedRowDetail.estado)}</div>
                  </div>
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">Revisado Por:</span>
                    <span style={{ color: '#003060', fontSize: '0.84rem', fontWeight: 600 }}>
                      {selectedRowDetail.revisor || 'Sin revisor'}
                    </span>
                  </div>
                </div>

                {selectedRowDetail.detalle && (
                  <div className="obs-content-box box-detalle" style={{ marginTop: '0.4rem' }}>
                    <span className="box-label">Detalle de la Observación:</span>
                    <div className="box-body-text">{selectedRowDetail.detalle}</div>
                  </div>
                )}

                {(selectedRowDetail.subsistema || selectedRowDetail.protocolo) && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.74rem', color: '#64748b', marginTop: '0.2rem' }}>
                    {selectedRowDetail.subsistema && (
                      <span className="meta-pill">Subsistema: <strong>{selectedRowDetail.subsistema}</strong></span>
                    )}
                    {selectedRowDetail.protocolo && (
                      <span className="meta-pill">Protocolo: <strong>{selectedRowDetail.protocolo}</strong></span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
