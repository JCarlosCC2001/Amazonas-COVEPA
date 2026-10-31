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
  Database,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { fetchSitios } from '../services/sitiosService'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'
import ErpTable from '../components/shared/ErpTable'

export default function Sitios() {
  const [sitios, setSitios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtros
  const [search, setSearch] = useState('')
  const [selectedGrupo, setSelectedGrupo] = useState('TODOS')
  const [selectedZona, setSelectedZona] = useState('TODAS')
  const [soloAsignados, setSoloAsignados] = useState(true)

  // Paginación y Ordenamiento
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [sortField, setSortField] = useState('id_site')
  const [sortDirection, setSortDirection] = useState('asc')

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

  // Manejo de ordenamiento de columnas
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setPage(1)
  }

  // Sitios ordenados
  const sortedSitios = useMemo(() => {
    if (!sortField) return filteredSitios
    return [...filteredSitios].sort((a, b) => {
      let aVal = a[sortField] ?? ''
      let bVal = b[sortField] ?? ''
      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      return sortDirection === 'asc'
        ? (Number(aVal) > Number(bVal) ? 1 : -1)
        : (Number(aVal) < Number(bVal) ? 1 : -1)
    })
  }, [filteredSitios, sortField, sortDirection])

  // Paginación reactiva
  const paginatedSitios = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedSitios.slice(start, start + pageSize)
  }, [sortedSitios, page, pageSize])

  // Reset page al filtrar
  useEffect(() => {
    setPage(1)
  }, [search, selectedGrupo, selectedZona])

  // Columnas para ErpTable reutilizable
  const sitiosColumns = useMemo(() => [
    {
      key: 'id_site',
      label: 'CÓDIGO / ID',
      width: '145px',
      sortable: true,
      render: s => (
        <span className="site-code-badge" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {s.id_site}
        </span>
      )
    },
    {
      key: 'nombre_nodo',
      label: 'NOMBRE DEL NODO',
      sortable: true,
      render: s => (
        <div className="site-name-wrap">
          <span className="site-name">{s.nombre_nodo || 'Sin nombre'}</span>
          {s.categoria && <span className="site-category">{s.categoria}</span>}
        </div>
      )
    },
    {
      key: 'grupo',
      label: 'CUADRILLA',
      width: '140px',
      sortable: true,
      render: s => (
        <span className={`grupo-badge grupo-${s.grupo?.replace(/\s+/g, '-').toLowerCase()}`}>
          {s.grupo}
        </span>
      )
    },
    {
      key: 'zona',
      label: 'ZONA',
      width: '110px',
      sortable: true,
      render: s => (
        <span className="zona-badge">{s.zona}</span>
      )
    },
    {
      key: 'distrito',
      label: 'UBICACIÓN',
      sortable: true,
      render: s => (
        <div className="location-cell">
          <span>{s.distrito || s.provincia || 'Amazonas'}</span>
          <small>{s.localidad || s.region}</small>
        </div>
      )
    },
    {
      key: 'red',
      label: 'RED / TIPO',
      width: '130px',
      sortable: true,
      render: s => (
        <div className="tech-cell">
          <span className="tech-red">{s.red || '—'}</span>
          <small>{s.tipo || ''}</small>
        </div>
      )
    },
    {
      key: 'tiene_coordenadas',
      label: 'COORDENADAS GPS',
      width: '180px',
      sortable: true,
      render: s => (
        s.tiene_coordenadas ? (
          <a
            href={`https://www.google.com/maps?q=${s.latitud},${s.longitud}&t=k`}
            target="_blank"
            rel="noreferrer"
            className="coords-link"
            onClick={e => e.stopPropagation()}
            title="Ver en Google Maps Satelital"
          >
            <MapPin size={13} />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {Number(s.latitud).toFixed(4)}, {Number(s.longitud).toFixed(4)}
            </span>
            <ExternalLink size={12} className="ext-icon" />
          </a>
        ) : (
          <span className="no-coords">Sin GPS</span>
        )
      )
    },
    {
      key: 'actions',
      label: 'DETALLE',
      width: '70px',
      align: 'center',
      sortable: false,
      render: s => (
        <button
          type="button"
          className="view-site-btn"
          onClick={e => {
            e.stopPropagation()
            setSelectedSite(s)
          }}
          title="Ver ficha técnica completa"
        >
          <Eye size={16} />
        </button>
      )
    }
  ], [])

  // Estadísticas rápidas globales (no afectadas por filtros de búsqueda o zona)
  const stats = useMemo(() => {
    const list = sitios
    const total = list.length
    const conGps = list.filter(s => s.tiene_coordenadas).length
    const zona2 = list.filter(s => s.zona === 'ZONA 2').length
    const zona7 = list.filter(s => s.zona === 'ZONA 7').length
    return { total, conGps, zona2, zona7 }
  }, [sitios])

  return (
    <div className="sitios-container">
      {/* Medidores / Métricas de Sitios */}
      <MetricGrid columns={4}>
        <MetricCard
          icon={<Database size={22} />}
          label="Total Sitios"
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

      {/* Tabla de Sitios con ErpTable reutilizable */}
      <ErpTable
        columns={sitiosColumns}
        data={paginatedSitios}
        keyField="id_site"
        loading={loading}
        loadingMessage="Consultando base de datos externa..."
        emptyIcon={<MapPin size={48} opacity={0.3} />}
        emptyTitle="No se encontraron sitios"
        emptyDescription="Intenta ajustar los términos de búsqueda o los filtros de Grupo y Zona."
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRowClick={s => setSelectedSite(s)}
        rowClassName="sitio-row"
        page={page}
        pageSize={pageSize}
        totalCount={filteredSitios.length}
        onPageChange={setPage}
        hasActiveFilters={Boolean(search || selectedGrupo !== 'TODOS' || selectedZona !== 'TODAS')}
        entityName="sitios"
        minWidth="980px"
      />

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
