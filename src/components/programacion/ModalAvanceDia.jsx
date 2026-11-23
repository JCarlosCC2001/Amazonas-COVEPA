import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  TrendingUp, X, Search, MapPin, User,
  Clock, ShieldCheck, RefreshCw, AlertCircle, Eye, FileText,
  Copy, Image, Check, ChevronDown, ChevronUp
} from 'lucide-react'
import { getAvancePorFecha } from '../../services/dashboardService'
import { ASIGNACIONES_BASE } from '../../services/sitiosService'
import { DEFAULT_CUADRILLAS_CONFIG, fetchPersonal } from '../../services/personalService'
import { resolveCuadrillaOficial, construirMatricesEjecutivas } from '../../shared/reportesCore'
import CuadrillasMatrixTable from '../shared/CuadrillasMatrixTable'
import { formatNombrePersona, formatPrimerNombrePrimerApellido, getPeruDateStr } from '../../utils/helpers'
import { usePresentationMode } from '../../context/PresentationContext'

export default function ModalAvanceDia({ fecha, sitiosMap = {}, onClose }) {
  const { presentationMode } = usePresentationMode()
  const modalCardRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [avanceData, setAvanceData] = useState({ rows: [], stats: {}, programacionesDelDia: 0 })
  const [searchTable, setSearchTable] = useState('')
  const [filterEstado, setFilterEstado] = useState('TODOS')
  const [selectedRowDetail, setSelectedRowDetail] = useState(null)
  const [exportingPng, setExportingPng] = useState(false)
  const [copiedPng, setCopiedPng] = useState(false)
  const [showDetailedList, setShowDetailedList] = useState(false)
  const [selectedCellFilter, setSelectedCellFilter] = useState(null)
  const [cuadrillaStaffMap, setCuadrillaStaffMap] = useState({})

  // Cargar asignaciones oficiales actualizadas desde personalService (duplas de técnicos por cuadrilla)
  useEffect(() => {
    let isMounted = true
    const loadCuadrillaStaff = async () => {
      try {
        const staff = await fetchPersonal()
        if (isMounted) {
          const cuadrillaStaffLists = {
            'CUADRILLA 1': [],
            'CUADRILLA 2': [],
            'CUADRILLA 3': [],
            'CUADRILLA 4': []
          }

          if (Array.isArray(staff) && staff.length > 0) {
            staff.forEach(p => {
              const cClean = String(p.cuadrilla || '').toUpperCase().trim()
              const cargo = (p.cargo || '').toUpperCase()
              const isTec = cargo.includes('TECN') || cargo.includes('TÉCN') || cargo.includes('SUPERV') || !cargo.includes('CONDUCT')
              const nom = (p.nombre_completo || p.nombre || '').trim()
              if (cClean.startsWith('CUADRILLA') && isTec && nom) {
                const formatted = formatPrimerNombrePrimerApellido(nom)
                if (cuadrillaStaffLists[cClean] && !cuadrillaStaffLists[cClean].includes(formatted)) {
                  cuadrillaStaffLists[cClean].push(formatted)
                }
              }
            })
          }

          const map = {}
          for (const [cName, list] of Object.entries(cuadrillaStaffLists)) {
            const defaults = DEFAULT_CUADRILLAS_CONFIG[cName]?.tecnicosNombres || []
            const combined = [...list]
            defaults.forEach(defName => {
              const fDef = formatPrimerNombrePrimerApellido(defName)
              if (!combined.some(item => item.toUpperCase() === fDef.toUpperCase())) {
                combined.push(fDef)
              }
            })
            // Dupla oficial con Primer Nombre y Primer Apellido
            map[cName] = combined.slice(0, 2).join(' · ')
          }
          setCuadrillaStaffMap(map)
        }
      } catch (err) {
        console.warn('Error en loadCuadrillaStaff:', err)
      }
    }
    loadCuadrillaStaff()
    return () => { isMounted = false }
  }, [])

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

  // Helper para resolver la zona de un sitio
  const getZona = (idSitio) => {
    return sitiosMap[idSitio]?.zona ||
      ASIGNACIONES_BASE.find(s => s.id_site === idSitio)?.zona ||
      ''
  }

  const asignacionesMap = useMemo(() => {
    const m = {}
    ASIGNACIONES_BASE.forEach(a => {
      if (a.id_site) m[a.id_site.toUpperCase()] = a
    })
    return m
  }, [])

  // Helper para resolver la cuadrilla oficial asignada a una observación (núcleo compartido)
  const resolveCuadrillaForObs = useCallback((obs) => {
    return resolveCuadrillaOficial(obs, {
      asignacionesMap,
      sitiosMap,
      cuadrillaStaffMap,
      defaultCuadrillasConfig: DEFAULT_CUADRILLAS_CONFIG
    })
  }, [asignacionesMap, sitiosMap, cuadrillaStaffMap])

  const stats = useMemo(() => {
    const rawRows = avanceData.rows || []

    const st = {
      total: rawRows.length,
      solicitando: 0,
      enRevision: 0,
      rechazadas: 0,
      validadas: 0,
      prevalidadas: 0,
      documentacion: 0,
      criticas: 0,
      descartadas: 0
    }
    rawRows.forEach(r => {
      const raw = (r.estado || '').trim().toLowerCase()
      if (raw === 'solicitando revisión' || raw === 'solicitando revision') st.solicitando++
      else if (raw === 'en revisión' || raw === 'en revision') st.enRevision++
      else if (raw === 'rechazado' || raw === 'rechazada' || raw === 'rechazados') st.rechazadas++
      else if (raw === 'validado' || raw === 'validada' || raw === 'enviado' || raw === 'enviada') st.validadas++
      else if (raw === 'pre-validado' || raw === 'pre-validada' || raw === 'prevalidado') st.prevalidadas++
      else if (raw === 'documentación' || raw === 'documentacion') st.documentacion++
      else if (raw === 'crítico' || raw === 'critico') st.criticas++
      else if (raw === 'descartado' || raw === 'descartada') st.descartadas++
    })
    // Total es la suma exacta de los medidores presentes en la pantalla
    st.total = (st.solicitando + st.enRevision) + st.descartadas + st.criticas + st.documentacion + st.rechazadas + st.validadas
    return st
  }, [avanceData.rows])

  // Columnas semánticas para la Matriz de Cuadrillas
  const statusColumns = useMemo(() => [
    {
      key: 'enRevision',
      label: 'En Revisión',
      badgeVariant: 'sky',
      title: 'Observaciones en proceso o esperando revisión técnica'
    },
    {
      key: 'descartados',
      label: 'Descartados',
      badgeVariant: 'slate',
      title: 'Observaciones descartadas en campo'
    },
    {
      key: 'criticos',
      label: 'Críticos',
      badgeVariant: 'rose',
      title: 'Observaciones críticas que no se ejecutarán'
    },
    {
      key: 'documentacion',
      label: 'Documentación',
      badgeVariant: 'purple',
      title: 'Observaciones en recopilación técnica de documentación'
    },
    {
      key: 'rechazados',
      label: 'Rechazados',
      badgeVariant: 'rose',
      title: 'Observaciones rechazadas por calidad'
    },
    {
      key: 'validados',
      label: 'Validados',
      badgeVariant: 'emerald',
      title: 'Observaciones validadas conformes'
    }
  ], [])

  // Consolidación de datos matriciales agrupados por Equipos desde el núcleo único compartido
  const { matrixOriginal, matrixAmpliacion, matrixData } = useMemo(() => {
    const getCuadrillaTecnico = (cName) => {
      if (cuadrillaStaffMap[cName]) return cuadrillaStaffMap[cName]
      const cfg = DEFAULT_CUADRILLAS_CONFIG[cName]
      if (cfg?.tecnicosNombres?.length > 0) {
        return cfg.tecnicosNombres.map(formatPrimerNombrePrimerApellido).join(' · ')
      }
      return cfg?.tecnicoNombre || ''
    }

    const tecnicosPorCuadrilla = {
      'CUADRILLA 1': getCuadrillaTecnico('CUADRILLA 1'),
      'CUADRILLA 2': getCuadrillaTecnico('CUADRILLA 2'),
      'CUADRILLA 3': getCuadrillaTecnico('CUADRILLA 3'),
      'CUADRILLA 4': getCuadrillaTecnico('CUADRILLA 4'),
      'CUADRILLA 5': getCuadrillaTecnico('CUADRILLA 5'),
      'CUADRILLA 6': getCuadrillaTecnico('CUADRILLA 6'),
      'CUADRILLA 7': getCuadrillaTecnico('CUADRILLA 7') || 'Por Asignar'
    }

    return construirMatricesEjecutivas(avanceData.rows || [], {
      tecnicosPorCuadrilla,
      resolveCuadrillaFn: resolveCuadrillaForObs
    })
  }, [avanceData.rows, resolveCuadrillaForObs, cuadrillaStaffMap])

  // Filtrado de filas detalladas
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
      const raw = (r.estado || '').trim().toLowerCase()
      if (filterEstado === 'En Revisión') {
        return raw === 'en revisión' || raw === 'en revision' || raw === 'solicitando revisión' || raw === 'solicitando revision'
      }
      if (filterEstado === 'Validado') {
        return raw === 'validado' || raw === 'validada' || raw === 'enviado' || raw === 'enviada'
      }
      if (filterEstado === 'Pre-validado') {
        return raw === 'pre-validado' || raw === 'pre-validada' || raw === 'prevalidado'
      }
      if (filterEstado === 'Descartado') {
        return raw === 'descartado' || raw === 'descartada'
      }
      if (filterEstado === 'Rechazado') {
        return raw === 'rechazado' || raw === 'rechazada' || raw === 'rechazados'
      }
      if (filterEstado === 'Documentación') {
        return raw === 'documentación' || raw === 'documentacion'
      }
      if (filterEstado === 'Crítico') {
        return raw === 'crítico' || raw === 'critico'
      }
      return r.estado === filterEstado
    })
  }, [avanceData.rows, searchTable, filterEstado, sitiosMap])

  // Filas finales para el desglose (aplicando filtro de celda si está activo)
  const displayRows = useMemo(() => {
    if (!selectedCellFilter) return filteredRows

    return filteredRows.filter(r => {
      const c = resolveCuadrillaForObs(r)
      if (c !== selectedCellFilter.cuadrilla) return false

      const rawSt = (r.estado || '').trim().toLowerCase()
      if (selectedCellFilter.colKey === 'enRevision') {
        return rawSt === 'en revisión' || rawSt === 'en revision' || rawSt === 'solicitando revisión' || rawSt === 'solicitando revision'
      }
      if (selectedCellFilter.colKey === 'descartados') {
        return rawSt === 'descartado' || rawSt === 'descartada'
      }
      if (selectedCellFilter.colKey === 'criticos') {
        return rawSt === 'crítico' || rawSt === 'critico'
      }
      if (selectedCellFilter.colKey === 'documentacion') {
        return rawSt === 'documentación' || rawSt === 'documentacion'
      }
      if (selectedCellFilter.colKey === 'rechazados') {
        return rawSt === 'rechazado' || rawSt === 'rechazada' || rawSt === 'rechazados'
      }
      if (selectedCellFilter.colKey === 'validados') {
        return rawSt === 'validado' || rawSt === 'validada' || rawSt === 'enviado' || rawSt === 'enviada'
      }
      return true
    })
  }, [filteredRows, selectedCellFilter, resolveCuadrillaForObs])

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

  // Captura el contenido visual completo del modal (excluyendo botones de PNG y Cerrar)
  const captureModalCanvas = async () => {
    if (!modalCardRef.current) return null
    const { default: html2canvas } = await import('html2canvas')
    return await html2canvas(modalCardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      ignoreElements: (el) => {
        return (
          el.classList.contains('no-export') ||
          el.classList.contains('prog-details-modal-actions') ||
          el.classList.contains('prog-modal-close-btn')
        )
      }
    })
  }

  // Copiar imagen PNG del cuadro de resumen completo al portapapeles
  const handleCopyPNG = async () => {
    if (exportingPng) return
    setExportingPng(true)
    try {
      const canvas = await captureModalCanvas()
      if (!canvas) throw new Error('No se pudo capturar la vista del modal')

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('No se pudo generar la imagen PNG')

      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
        setCopiedPng(true)
        setTimeout(() => setCopiedPng(false), 3000)
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Avance_COVEPA_${fecha}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        alert('Imagen descargada en tu dispositivo (el portapapeles del navegador requiere HTTPS o permiso para copiar directamente).')
      }
    } catch (err) {
      console.error('Error al copiar imagen PNG:', err)
      alert('Error al generar la imagen: ' + err.message)
    } finally {
      setExportingPng(false)
    }
  }

  // Descargar imagen PNG del cuadro de resumen completo
  const handleDownloadPNG = async () => {
    if (exportingPng) return
    setExportingPng(true)
    try {
      const canvas = await captureModalCanvas()
      if (!canvas) throw new Error('No se pudo capturar la vista del modal')

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('No se pudo generar la imagen PNG')

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Avance_COVEPA_${fecha}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al descargar imagen PNG:', err)
      alert('Error al descargar la imagen: ' + err.message)
    } finally {
      setExportingPng(false)
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

  const modalContent = (
    <div className="prog-details-modal-overlay">
      <div ref={modalCardRef} className="prog-details-modal prog-avance-modal">
        {/* Cabecera del Modal */}
        <div className="prog-details-modal-header prog-avance-modal-header">
          <div className="prog-details-header-main">
            <div className="prog-details-site-title-row">
              <div className="prog-details-site-badge-icon" style={{ background: '#f0f9ff', color: '#0284c7', borderColor: '#bae6fd' }}>
                <TrendingUp size={22} />
              </div>
              <div className="prog-details-site-texts">
                <div className="prog-details-title-line">
                  <h2 className="prog-details-site-title">
                    Avance del Día
                  </h2>
                  <span className="prog-avance-date-pill">
                    {formattedDate}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="prog-details-modal-actions no-export">
            <button
              type="button"
              className={`prog-export-btn prog-export-copy-btn ${copiedPng ? 'copied' : ''}`}
              onClick={handleCopyPNG}
              disabled={exportingPng || (matrixData.matrixGrandTotal === 0 && (!avanceData.rows || avanceData.rows.length === 0))}
              title="Copiar imagen del cuadro de resumen por equipos al portapapeles para WhatsApp o correo (Ctrl+V)"
            >
              {copiedPng ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedPng ? '¡Copiado!' : (exportingPng ? 'Generando...' : 'Copiar PNG')}</span>
            </button>

            <button
              type="button"
              className="prog-export-btn prog-export-png-btn"
              onClick={handleDownloadPNG}
              disabled={exportingPng || (matrixData.matrixGrandTotal === 0 && (!avanceData.rows || avanceData.rows.length === 0))}
              title="Descargar imagen PNG del cuadro de resumen por equipos de alta definición"
            >
              <Image size={13} />
              <span>{exportingPng ? 'Generando...' : 'Descargar PNG'}</span>
            </button>

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
            <span className="stat-btn-val">{stats.total || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-revision ${filterEstado === 'En Revisión' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'En Revisión' ? 'TODOS' : 'En Revisión')}
            title="Observaciones en proceso o esperando revisión técnica"
          >
            <span className="stat-btn-label text-revision">🔍 En Revisión</span>
            <span className="stat-btn-val text-revision">{(stats.solicitando || 0) + (stats.enRevision || 0)}</span>
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

          <button
            type="button"
            className={`prog-modal-stat-btn stat-critico ${filterEstado === 'Crítico' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'Crítico' ? 'TODOS' : 'Crítico')}
            title="Observaciones críticas que no se ejecutarán"
          >
            <span className="stat-btn-label text-critico">⚠️ Críticos</span>
            <span className="stat-btn-val text-critico">{stats.criticas || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-documentacion ${filterEstado === 'Documentación' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'Documentación' ? 'TODOS' : 'Documentación')}
            title="Observaciones en recopilación técnica de documentación"
          >
            <span className="stat-btn-label text-documentacion">📁 Documentación</span>
            <span className="stat-btn-val text-documentacion">{stats.documentacion || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-rechazado ${filterEstado === 'Rechazado' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'Rechazado' ? 'TODOS' : 'Rechazado')}
            title="Observaciones rechazadas por calidad"
          >
            <span className="stat-btn-label text-rechazado">✕ Rechazadas</span>
            <span className="stat-btn-val text-rechazado">{stats.rechazadas || 0}</span>
          </button>

          <button
            type="button"
            className={`prog-modal-stat-btn stat-validado ${filterEstado === 'Validado' ? 'active' : ''}`}
            onClick={() => setFilterEstado(prev => prev === 'Validado' ? 'TODOS' : 'Validado')}
            title="Observaciones validadas conformes"
          >
            <span className="stat-btn-label text-validado">✓ Validadas</span>
            <span className="stat-btn-val text-validado">{stats.validadas || 0}</span>
          </button>
        </div>

        {/* Cuerpo de la Ventana: Cuadro de Avance Operativo por Equipos */}
        <div className="prog-details-modal-body prog-avance-modal-body">
          {loading ? (
            <div className="modal-state-msg">
              <RefreshCw size={24} className="spin" color="#0284c7" />
              <span>Cargando avance y observaciones del {fecha}...</span>
            </div>
          ) : errorMsg ? (
            <div className="modal-state-msg error">{errorMsg}</div>
          ) : matrixData.matrixGrandTotal === 0 && (!avanceData.rows || avanceData.rows.length === 0) ? (
            <div className="modal-empty-filter-state">
              <p>No hay observaciones registradas para el <strong>{fecha}</strong>.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {/* Indicador visual de desplazamiento horizontal en móvil */}
              <div className="prog-avance-scroll-hint no-export">
                <span>↔ Desliza la tabla para ver todos los estados</span>
              </div>

              {/* Matriz 1: Amazonas Original (Cuadrillas 1, 2 y 3) */}
              <CuadrillasMatrixTable
                icon={<TrendingUp size={18} color="#003060" />}
                title="Amazonas Original"
                subtitle="Cuadrillas 1, 2 y 3"
                groupColumnLabel="Cuadrilla"
                techColumnLabel="Técnicos"
                columns={statusColumns}
                rows={matrixOriginal.matrixRows}
                totals={matrixOriginal.matrixTotals}
                grandTotal={matrixOriginal.matrixGrandTotal}
                footLabel="TOTAL DIARIO"
                presentationMode={presentationMode}
              />

              {/* Matriz 2: Amazonas Ampliación (Cuadrilla 4) */}
              <CuadrillasMatrixTable
                icon={<TrendingUp size={18} color="#0284c7" />}
                title="Amazonas Ampliación"
                subtitle="Cuadrilla 4"
                groupColumnLabel="Cuadrilla"
                techColumnLabel="Técnicos"
                columns={statusColumns}
                rows={matrixAmpliacion.matrixRows}
                totals={matrixAmpliacion.matrixTotals}
                grandTotal={matrixAmpliacion.matrixGrandTotal}
                footLabel="TOTAL DIARIO"
                presentationMode={presentationMode}
              />
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
                  <h3 style={{ margin: 0, fontSize: 'var(--text-md)', color: '#003060' }}>
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
                <div className="prog-avance-detail-grid">
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">Código de Sitio y Localidad:</span>
                    <strong style={{ color: '#003060', fontSize: 'var(--text-sm)' }}>
                      {selectedRowDetail.id_sitio} {getLocalidad(selectedRowDetail.id_sitio) ? `· ${getLocalidad(selectedRowDetail.id_sitio)}` : ''}{getZona(selectedRowDetail.id_sitio) ? ` · ${getZona(selectedRowDetail.id_sitio)}` : ''}
                    </strong>
                  </div>
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">{presentationMode ? 'Cuadrilla Asignada:' : 'Técnico Asignado:'}</span>
                    <span style={{ color: '#1e293b', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}>
                      {presentationMode
                        ? (selectedRowDetail.cuadrilla || 'Sin Cuadrilla')
                        : `${selectedRowDetail.tecnico} ${selectedRowDetail.cuadrilla ? `(${selectedRowDetail.cuadrilla})` : ''}`}
                    </span>
                  </div>
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">Estado:</span>
                    <div>{renderEstadoBadge(selectedRowDetail.estado)}</div>
                  </div>
                  <div className="audit-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="stat-btn-label">Revisado Por:</span>
                    <span style={{ color: '#003060', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}>
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
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: 'var(--text-xs)', color: '#64748b', marginTop: '0.2rem' }}>
                    {selectedRowDetail.protocolo && (
                      <span className="meta-pill">Protocolo: <strong>{selectedRowDetail.protocolo}</strong></span>
                    )}
                    {selectedRowDetail.subsistema && (
                      <span className="meta-pill">Subsistema: <strong>{selectedRowDetail.subsistema}</strong></span>
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

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }
  return modalContent
}
