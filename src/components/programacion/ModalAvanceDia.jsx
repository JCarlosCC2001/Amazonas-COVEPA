import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  TrendingUp, X, Search, MapPin, User,
  Clock, ShieldCheck, RefreshCw, AlertCircle, Eye, FileText,
  Copy, Image, Check, ChevronDown, ChevronUp
} from 'lucide-react'
import { getAvancePorFecha } from '../../services/dashboardService'
import { ASIGNACIONES_BASE } from '../../services/sitiosService'
import { DEFAULT_CUADRILLAS_CONFIG } from '../../services/personalService'
import { supabase } from '../../lib/supabase'
import CuadrillasMatrixTable from '../shared/CuadrillasMatrixTable'
import { formatNombrePersona, getPeruDateStr } from '../../utils/helpers'
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

  // Cargar asignaciones oficiales actualizadas de personal_cuadrillas desde la base de datos
  useEffect(() => {
    let isMounted = true
    const loadCuadrillaStaff = async () => {
      try {
        const { data, error } = await supabase
          .from('personal_cuadrillas')
          .select('cuadrilla, nombre_completo, cargo')
          .eq('activo', true)

        if (error) {
          console.warn('Error cargando personal_cuadrillas en ModalAvanceDia:', error.message)
          return
        }

        if (isMounted && data && data.length > 0) {
          const map = {}
          data.forEach(row => {
            const cClean = String(row.cuadrilla || '').toUpperCase().trim()
            const cargo = (row.cargo || '').toUpperCase()
            const isTec = cargo.includes('TECN') || cargo.includes('SUPERV') || !cargo.includes('CONDUCT')
            if (isTec && row.nombre_completo) {
              map[cClean] = formatNombrePersona(row.nombre_completo)
            }
          })
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

  // Helper para resolver la cuadrilla oficial asignada a una observación
  const resolveCuadrillaForObs = useCallback((obs) => {
    // 0. Si el sitio o código es de Ampliación (AMEX), pertenece a CUADRILLA 7
    const siteId = (obs.id_sitio || '').trim().toUpperCase()
    const obsId = (obs.id_obs || '').trim().toUpperCase()
    if (siteId.startsWith('AMEX') || obsId.startsWith('AMEX')) {
      return 'CUADRILLA 7'
    }

    // 1. Prioridad por sitio oficial en el catálogo maestro
    const asig = ASIGNACIONES_BASE.find(s => s.id_site === siteId) || sitiosMap[siteId]
    if (asig?.grupo) {
      const gClean = String(asig.grupo).toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
      const match = gClean.match(/CUADRILLA\s*([1-7])/)
      if (match) return `CUADRILLA ${match[1]}`
    }

    // 2. Prioridad por cuadrilla explícita en la observación
    if (obs.cuadrilla) {
      const cClean = String(obs.cuadrilla).toUpperCase().replace(/GRUPO/gi, 'CUADRILLA').trim()
      const match = cClean.match(/CUADRILLA\s*([1-7])/)
      if (match) return `CUADRILLA ${match[1]}`
    }

    // 3. Prioridad por nombre del técnico
    if (obs.tecnico) {
      const tClean = String(obs.tecnico).toUpperCase().trim()
      for (const [cName, tecNom] of Object.entries(cuadrillaStaffMap)) {
        if (tecNom && tClean.includes(tecNom.toUpperCase())) {
          return cName
        }
      }
      for (const [cName, cfg] of Object.entries(DEFAULT_CUADRILLAS_CONFIG)) {
        if (cfg.tecnicoNombre && tClean.includes(cfg.tecnicoNombre.toUpperCase())) {
          return cName
        }
      }
    }

    return 'CUADRILLA 1'
  }, [sitiosMap, cuadrillaStaffMap])

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

  // Consolidación de datos matriciales agrupados por Equipos (Original: Equipos 1, 2, 3; Ampliación: Equipo 4)
  const { matrixOriginal, matrixAmpliacion, matrixData } = useMemo(() => {
    const rows = avanceData.rows || []

    const getCuadrillaTecnico = (cName) => {
      return cuadrillaStaffMap[cName] ||
        DEFAULT_CUADRILLAS_CONFIG[cName]?.tecnicoNombre ||
        ''
    }

    const tecC1 = getCuadrillaTecnico('CUADRILLA 1')
    const tecC2 = getCuadrillaTecnico('CUADRILLA 2')
    const tecC3 = getCuadrillaTecnico('CUADRILLA 3')
    const tecC4 = getCuadrillaTecnico('CUADRILLA 4')
    const tecC5 = getCuadrillaTecnico('CUADRILLA 5')
    const tecC6 = getCuadrillaTecnico('CUADRILLA 6')
    const tecC7 = getCuadrillaTecnico('CUADRILLA 7')

    // Equipos de Amazonas Original
    const equiposOriginalMap = {
      'EQUIPO 1': {
        id: 'EQUIPO 1',
        cuadrilla: 'EQUIPO 1',
        subtitulo: 'Cuadrilla 1 y 2',
        tecnico: [tecC1, tecC2].filter(Boolean).join(' · ') || 'Técnicos Equipo 1',
        values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
        total: 0
      },
      'EQUIPO 2': {
        id: 'EQUIPO 2',
        cuadrilla: 'EQUIPO 2',
        subtitulo: 'Cuadrilla 3 y 6',
        tecnico: [tecC3, tecC6].filter(Boolean).join(' · ') || 'Técnicos Equipo 2',
        values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
        total: 0
      },
      'EQUIPO 3': {
        id: 'EQUIPO 3',
        cuadrilla: 'EQUIPO 3',
        subtitulo: 'Cuadrilla 4 y 5',
        tecnico: [tecC4, tecC5].filter(Boolean).join(' · ') || 'Técnicos Equipo 3',
        values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
        total: 0
      }
    }

    // Equipos de Amazonas Ampliación
    const equiposAmpliacionMap = {
      'EQUIPO 4': {
        id: 'EQUIPO 4',
        cuadrilla: 'EQUIPO 4',
        subtitulo: 'Cuadrilla 7',
        tecnico: tecC7 || 'Por Asignar',
        values: { enRevision: 0, descartados: 0, criticos: 0, documentacion: 0, rechazados: 0, validados: 0 },
        total: 0
      }
    }

    rows.forEach(r => {
      const siteId = String(r.id_sitio || '').toUpperCase().trim()
      const obsId = String(r.id_obs || '').toUpperCase().trim()
      const isAmex = siteId.startsWith('AMEX') || obsId.startsWith('AMEX')

      const targetCuadrilla = resolveCuadrillaForObs(r)
      let targetEquipoKey = 'EQUIPO 1'
      if (isAmex || targetCuadrilla === 'CUADRILLA 7') {
        targetEquipoKey = 'EQUIPO 4'
      } else if (targetCuadrilla === 'CUADRILLA 1' || targetCuadrilla === 'CUADRILLA 2') {
        targetEquipoKey = 'EQUIPO 1'
      } else if (targetCuadrilla === 'CUADRILLA 3' || targetCuadrilla === 'CUADRILLA 6') {
        targetEquipoKey = 'EQUIPO 2'
      } else if (targetCuadrilla === 'CUADRILLA 4' || targetCuadrilla === 'CUADRILLA 5') {
        targetEquipoKey = 'EQUIPO 3'
      }

      const targetObj = equiposOriginalMap[targetEquipoKey] || equiposAmpliacionMap[targetEquipoKey]
      if (targetObj) {
        const rawSt = (r.estado || '').trim().toLowerCase()
        if (rawSt === 'solicitando revisión' || rawSt === 'solicitando revision' || rawSt === 'en revisión' || rawSt === 'en revision') {
          targetObj.values.enRevision++
        } else if (rawSt === 'descartado' || rawSt === 'descartada') {
          targetObj.values.descartados++
        } else if (rawSt === 'crítico' || rawSt === 'critico') {
          targetObj.values.criticos++
        } else if (rawSt === 'documentación' || rawSt === 'documentacion') {
          targetObj.values.documentacion++
        } else if (rawSt === 'rechazado' || rawSt === 'rechazada' || rawSt === 'rechazados') {
          targetObj.values.rechazados++
        } else if (rawSt === 'validado' || rawSt === 'validada' || rawSt === 'enviado' || rawSt === 'enviada') {
          targetObj.values.validados++
        }
      }
    })

    const buildMatrixResult = (map) => {
      const rowsList = Object.values(map).map(row => ({
        ...row,
        total: row.values.enRevision + row.values.descartados + row.values.criticos + row.values.documentacion + row.values.rechazados + row.values.validados
      }))

      const totalsObj = {
        enRevision: rowsList.reduce((acc, r) => acc + r.values.enRevision, 0),
        descartados: rowsList.reduce((acc, r) => acc + r.values.descartados, 0),
        criticos: rowsList.reduce((acc, r) => acc + r.values.criticos, 0),
        documentacion: rowsList.reduce((acc, r) => acc + r.values.documentacion, 0),
        rechazados: rowsList.reduce((acc, r) => acc + r.values.rechazados, 0),
        validados: rowsList.reduce((acc, r) => acc + r.values.validados, 0)
      }

      const grandTotalNum = totalsObj.enRevision + totalsObj.descartados + totalsObj.criticos + totalsObj.documentacion + totalsObj.rechazados + totalsObj.validados

      return {
        matrixRows: rowsList,
        matrixTotals: totalsObj,
        matrixGrandTotal: grandTotalNum
      }
    }

    const orig = buildMatrixResult(equiposOriginalMap)
    const ampl = buildMatrixResult(equiposAmpliacionMap)

    const combRows = [...orig.matrixRows, ...ampl.matrixRows]
    const combTotals = {
      enRevision: orig.matrixTotals.enRevision + ampl.matrixTotals.enRevision,
      descartados: orig.matrixTotals.descartados + ampl.matrixTotals.descartados,
      criticos: orig.matrixTotals.criticos + ampl.matrixTotals.criticos,
      documentacion: orig.matrixTotals.documentacion + ampl.matrixTotals.documentacion,
      rechazados: orig.matrixTotals.rechazados + ampl.matrixTotals.rechazados,
      validados: orig.matrixTotals.validados + ampl.matrixTotals.validados
    }
    const combGrandTotal = orig.matrixGrandTotal + ampl.matrixGrandTotal

    return {
      matrixOriginal: orig,
      matrixAmpliacion: ampl,
      matrixData: {
        matrixRows: combRows,
        matrixTotals: combTotals,
        matrixGrandTotal: combGrandTotal
      }
    }
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

  return (
    <div className="prog-details-modal-overlay">
      <div ref={modalCardRef} className="prog-details-modal prog-avance-modal">
        {/* Cabecera del Modal */}
        <div className="prog-details-modal-header">
          <div className="prog-details-header-main">
            <div className="prog-details-site-title-row">
              <div className="prog-details-site-badge-icon" style={{ background: '#f0f9ff', color: '#0284c7', borderColor: '#bae6fd' }}>
                <TrendingUp size={22} />
              </div>
              <div className="prog-details-site-texts">
                <div className="prog-details-title-line">
                  <h2 className="prog-details-site-title" style={{ fontFamily: 'var(--font-sans)', letterSpacing: 'normal' }}>
                    Avance del Día
                  </h2>
                  <span className="prog-details-site-loc" style={{ textTransform: 'capitalize', color: '#475569', fontSize: 'var(--text-base)' }}>
                    · {formattedDate}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="prog-details-modal-actions no-export" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <button
              type="button"
              className={`prog-export-btn prog-export-copy-btn ${copiedPng ? 'copied' : ''}`}
              onClick={handleCopyPNG}
              disabled={exportingPng || (matrixData.matrixGrandTotal === 0 && (!avanceData.rows || avanceData.rows.length === 0))}
              title="Copiar imagen del cuadro de resumen por equipos al portapapeles para WhatsApp o correo (Ctrl+V)"
              style={{ height: '32px', padding: '0 0.65rem', fontSize: 'var(--text-2xs)' }}
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
              style={{ height: '32px', padding: '0 0.65rem', fontSize: 'var(--text-2xs)' }}
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
              {/* Matriz 1: Amazonas Original (Equipo 1, Equipo 2 y Equipo 3) */}
              <CuadrillasMatrixTable
                icon={<TrendingUp size={18} color="#003060" />}
                title="Amazonas Original"
                groupColumnLabel="Equipo"
                techColumnLabel="Técnicos"
                columns={statusColumns}
                rows={matrixOriginal.matrixRows}
                totals={matrixOriginal.matrixTotals}
                grandTotal={matrixOriginal.matrixGrandTotal}
                footLabel="TOTAL DIARIO"
                presentationMode={presentationMode}
              />

              {/* Matriz 2: Amazonas Ampliación (Equipo 4) */}
              <CuadrillasMatrixTable
                icon={<TrendingUp size={18} color="#0284c7" />}
                title="Amazonas Ampliación"
                groupColumnLabel="Equipo"
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
}
