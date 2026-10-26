import { useState, useEffect, useMemo } from 'react'
import {
  MapPin,
  Search,
  Filter,
  Layers,
  Radio,
  Zap,
  Battery,
  ExternalLink,
  RefreshCw,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { fetchSitios } from '../services/sitiosService'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'

export default function Sitios() {
  const [sitios, setSitios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtros
  const [search, setSearch] = useState('')
  const [selectedGrupo, setSelectedGrupo] = useState('TODOS')
  const [selectedZona, setSelectedZona] = useState('TODAS')
  const [soloAsignados, setSoloAsignados] = useState(true)

  // Paginación
  const [page, setPage] = useState(1)
  const pageSize = 12

  // Modal de detalle
  const [selectedSite, setSelectedSite] = useState(null)

  // Cerrar modal con tecla Escape
  useEffect(() => {
    if (!selectedSite) return
    const handleKeyDown = e => {
      if (e.key === 'Escape') setSelectedSite(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSite])

  // Carga de datos
  const loadData = async (asignadosOnly) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSitios({ soloAsignados: asignadosOnly })
      setSitios(data)
    } catch (err) {
      setError(err.message || 'Error al conectar con la base de datos externa')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(soloAsignados)
  }, [soloAsignados])

  // Grupos y Zonas únicos disponibles
  const grupos = useMemo(() => {
    const list = [...new Set(sitios.map(s => s.grupo).filter(Boolean))]
    return list.sort()
  }, [sitios])

  const zonas = useMemo(() => {
    const list = [...new Set(sitios.map(s => s.zona).filter(Boolean))]
    return list.sort()
  }, [sitios])

  // Filtrado reactivo
  const filteredSitios = useMemo(() => {
    return sitios.filter(s => {
      const matchSearch =
        search === '' ||
        s.id_site?.toLowerCase().includes(search.toLowerCase()) ||
        s.nombre_nodo?.toLowerCase().includes(search.toLowerCase()) ||
        s.distrito?.toLowerCase().includes(search.toLowerCase()) ||
        s.provincia?.toLowerCase().includes(search.toLowerCase()) ||
        s.localidad?.toLowerCase().includes(search.toLowerCase())

      const matchGrupo = selectedGrupo === 'TODOS' || s.grupo === selectedGrupo
      const matchZona = selectedZona === 'TODAS' || s.zona === selectedZona

      return matchSearch && matchGrupo && matchZona
    })
  }, [sitios, search, selectedGrupo, selectedZona])

  // Paginación
  const totalPages = Math.ceil(filteredSitios.length / pageSize) || 1
  const paginatedSitios = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredSitios.slice(start, start + pageSize)
  }, [filteredSitios, page, pageSize])

  // Reset page al filtrar
  useEffect(() => {
    setPage(1)
  }, [search, selectedGrupo, selectedZona])

  // Estadísticas rápidas
  const stats = useMemo(() => {
    const total = filteredSitios.length
    const conGps = filteredSitios.filter(s => s.tiene_coordenadas).length
    const zona2 = filteredSitios.filter(s => s.zona === 'ZONA 2').length
    const zona7 = filteredSitios.filter(s => s.zona === 'ZONA 7').length
    return { total, conGps, zona2, zona7 }
  }, [filteredSitios])

  return (
    <div className="sitios-container">
      {/* Medidores / Métricas de Sitios */}
      <MetricGrid columns={4}>
        <MetricCard
          icon={<Database size={22} />}
          label="Total Sitios Filtrados"
          value={stats.total}
          subtitle={soloAsignados ? '156 del proyecto' : 'Catálogo SELNET'}
          variant="navy"
          onClick={() => setSelectedZona('TODAS')}
          active={selectedZona === 'TODAS'}
        />
        <MetricCard
          icon={<MapPin size={22} />}
          label="Con Coordenadas GPS"
          value={stats.conGps}
          subtitle="Listos para KMZ"
          variant="emerald"
        />
        <MetricCard
          icon={<Layers size={22} />}
          label="Sitios en ZONA 2"
          value={stats.zona2}
          subtitle="Grupos 1 y 2"
          variant="sky"
          onClick={() => setSelectedZona(prev => prev === 'ZONA 2' ? 'TODAS' : 'ZONA 2')}
          active={selectedZona === 'ZONA 2'}
        />
        <MetricCard
          icon={<Radio size={22} />}
          label="Sitios en ZONA 7"
          value={stats.zona7}
          subtitle="Grupos 1 al 6"
          variant="amber"
          onClick={() => setSelectedZona(prev => prev === 'ZONA 7' ? 'TODAS' : 'ZONA 7')}
          active={selectedZona === 'ZONA 7'}
        />
      </MetricGrid>

      {/* Barra de Filtros y Búsqueda */}
      <div className="sitios-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por código, nodo, distrito o provincia..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-group">
          {/* Filtro Grupo */}
          <div className="select-wrapper">
            <Filter size={15} className="select-icon" />
            <select
              value={selectedGrupo}
              onChange={e => setSelectedGrupo(e.target.value)}
              className="toolbar-select"
            >
              <option value="TODOS">Todas las Cuadrillas</option>
              {grupos.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Filtro Zona */}
          <div className="select-wrapper">
            <Layers size={15} className="select-icon" />
            <select
              value={selectedZona}
              onChange={e => setSelectedZona(e.target.value)}
              className="toolbar-select"
            >
              <option value="TODAS">Todas las Zonas</option>
              {zonas.map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>

          {/* Toggle Solo Asignados vs Catálogo Completo */}
          <button
            className={`toggle-catalog-btn ${soloAsignados ? 'active' : ''}`}
            onClick={() => setSoloAsignados(!soloAsignados)}
            title="Alternar entre los 156 sitios del proyecto o todo el catálogo"
          >
            <Database size={15} />
            <span>{soloAsignados ? 'Ver 156 Asignados' : 'Ver Todos (1,021)'}</span>
          </button>

          {/* Botón Refrescar */}
          <button
            className="refresh-btn"
            onClick={() => loadData(soloAsignados)}
            disabled={loading}
            title="Refrescar datos desde la base de datos externa"
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Manejo de Error */}
      {error && (
        <div className="sitios-error-banner">
          <AlertCircle size={20} />
          <div>
            <strong>Error al cargar sitios:</strong> {error}
          </div>
        </div>
      )}

      {/* Tabla de Sitios */}
      <div className="sitios-table-wrapper">
        {loading ? (
          <div className="table-loading-state">
            <div className="loader-spinner" />
            <p>Consultando base de datos externa...</p>
          </div>
        ) : filteredSitios.length === 0 ? (
          <div className="table-empty-state">
            <MapPin size={48} opacity={0.3} />
            <h3>No se encontraron sitios</h3>
            <p>Intenta ajustar los términos de búsqueda o los filtros de Grupo y Zona.</p>
          </div>
        ) : (
          <table className="sitios-table">
            <thead>
              <tr>
                <th>Código / ID</th>
                <th>Nombre del Nodo</th>
                <th>Cuadrilla</th>
                <th>Zona</th>
                <th>Ubicación</th>
                <th>Red / Tipo</th>
                <th>Coordenadas GPS</th>
                <th style={{ textAlign: 'center' }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSitios.map(s => (
                <tr key={s.id_site} onClick={() => setSelectedSite(s)} className="sitio-row">
                  <td>
                    <span className="site-code-badge">{s.id_site}</span>
                  </td>
                  <td>
                    <div className="site-name-wrap">
                      <span className="site-name">{s.nombre_nodo || 'Sin nombre'}</span>
                      {s.categoria && <span className="site-category">{s.categoria}</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`grupo-badge grupo-${s.grupo?.replace(/\s+/g, '-').toLowerCase()}`}>
                      {s.grupo}
                    </span>
                  </td>
                  <td>
                    <span className="zona-badge">{s.zona}</span>
                  </td>
                  <td>
                    <div className="location-cell">
                      <span>{s.distrito || s.provincia || 'Amazonas'}</span>
                      <small>{s.localidad || s.region}</small>
                    </div>
                  </td>
                  <td>
                    <div className="tech-cell">
                      <span className="tech-red">{s.red || '—'}</span>
                      <small>{s.tipo || ''}</small>
                    </div>
                  </td>
                  <td>
                    {s.tiene_coordenadas ? (
                      <a
                        href={`https://www.google.com/maps?q=${s.latitud},${s.longitud}&t=k`}
                        target="_blank"
                        rel="noreferrer"
                        className="coords-link"
                        onClick={e => e.stopPropagation()}
                        title="Ver en Google Maps Satelital"
                      >
                        <MapPin size={13} />
                        <span>{Number(s.latitud).toFixed(4)}, {Number(s.longitud).toFixed(4)}</span>
                        <ExternalLink size={12} className="ext-icon" />
                      </a>
                    ) : (
                      <span className="no-coords">Sin GPS</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="view-site-btn"
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedSite(s)
                      }}
                      title="Ver ficha técnica completa"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginación */}
        {!loading && filteredSitios.length > 0 && (
          <div className="table-pagination">
            <span className="pagination-info">
              Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, filteredSitios.length)} de {filteredSitios.length} sitios
            </span>
            <div className="pagination-controls">
              <button
                className="page-btn"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <span className="current-page-tag">
                Pág. {page} / {totalPages}
              </span>
              <button
                className="page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE FICHA TÉCNICA DETALLADA */}
      {selectedSite && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <Radio size={24} />
                </div>
                <div>
                  <h3 className="modal-title">{selectedSite.id_site}</h3>
                  <p className="modal-subtitle">{selectedSite.nombre_nodo}</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedSite(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Asignación en el ERP */}
              <div className="modal-section-title">Asignación Operativa</div>
              <div className="modal-grid-2">
                <div className="detail-item">
                  <span className="detail-key">Cuadrilla / Grupo Asignado:</span>
                  <span className="detail-val highlight-val">{selectedSite.grupo}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Zona de Trabajo:</span>
                  <span className="detail-val highlight-val">{selectedSite.zona}</span>
                </div>
              </div>

              {/* Ubicación Geográfica */}
              <div className="modal-section-title" style={{ marginTop: '1.25rem' }}>
                Ubicación Geográfica & GPS
              </div>
              <div className="modal-grid-3">
                <div className="detail-item">
                  <span className="detail-key">Región:</span>
                  <span className="detail-val">{selectedSite.region || 'AMAZONAS'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Provincia:</span>
                  <span className="detail-val">{selectedSite.provincia || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Distrito:</span>
                  <span className="detail-val">{selectedSite.distrito || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Localidad:</span>
                  <span className="detail-val">{selectedSite.localidad || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Latitud:</span>
                  <span className="detail-val">{selectedSite.latitud ?? '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Longitud:</span>
                  <span className="detail-val">{selectedSite.longitud ?? '—'}</span>
                </div>
              </div>

              {/* Especificaciones Técnicas (De la BD Externa) */}
              <div className="modal-section-title" style={{ marginTop: '1.25rem' }}>
                Especificaciones Técnicas (SELNET)
              </div>
              <div className="modal-grid-3">
                <div className="detail-item">
                  <span className="detail-key">Red:</span>
                  <span className="detail-val">{selectedSite.red || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Categoría:</span>
                  <span className="detail-val">{selectedSite.categoria || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Tipo de Sitio:</span>
                  <span className="detail-val">{selectedSite.tipo || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Altura Torre:</span>
                  <span className="detail-val">{selectedSite.altura_torre ? `${selectedSite.altura_torre} m` : '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Tipo de Enlace:</span>
                  <span className="detail-val">{selectedSite.tipo_enlace || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Grupo SLA:</span>
                  <span className="detail-val">{selectedSite.grupo_sla || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Vel. Internet:</span>
                  <span className="detail-val">{selectedSite.velocidad_internet || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Vel. Intranet:</span>
                  <span className="detail-val">{selectedSite.velocidad_intranet || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Energía:</span>
                  <span className="detail-val">{selectedSite.energia || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">N° Baterías:</span>
                  <span className="detail-val">{selectedSite.n_baterias ?? '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-key">Dependencia:</span>
                  <span className="detail-val">{selectedSite.dependencia || '—'}</span>
                </div>
              </div>

              {/* Acciones del Modal */}
              <div className="modal-actions">
                {selectedSite.tiene_coordenadas && (
                  <a
                    href={`https://www.google.com/maps?q=${selectedSite.latitud},${selectedSite.longitud}&t=k`}
                    target="_blank"
                    rel="noreferrer"
                    className="modal-action-btn primary"
                  >
                    <MapPin size={16} /> Ver en Google Maps Satélite
                  </a>
                )}
                <button
                  className="modal-action-btn secondary"
                  onClick={() => setSelectedSite(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
