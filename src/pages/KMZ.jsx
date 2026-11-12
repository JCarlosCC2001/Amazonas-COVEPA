import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileSpreadsheet, CalendarDays, Users, Layers,
  TrendingUp, Download, CheckCircle2, Loader2,
  Calendar, Check, UserCheck, UserX, Shield,
  ArrowRight, Sparkles, RefreshCw, AlertCircle
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  exportProgramacionDiariaExcel,
  buildProgramacionDiariaData,
  exportObservacionesGrupoExcel,
  exportTodasObservacionesExcel
} from '../services/exportService'
import {
  fetchDatosReporteDiario,
  exportarExcelReporteDiario,
  fetchDatosReporteSemanal,
  exportarExcelReporteSemanal
} from '../services/reportesCorreoService'
import { getPeruDateStr } from '../utils/helpers'

// Catálogo de Cuadrillas Operativas
const CUADRILLAS_CATALOGO = [
  { id: 'cuadrilla-1', code: 'CUADRILLA 1', title: 'Cuadrilla 1', baseCM: 'PEDRO RUIZ', sitios: 29, zonas: 'ZONA 2 y ZONA 7' },
  { id: 'cuadrilla-2', code: 'CUADRILLA 2', title: 'Cuadrilla 2', baseCM: 'PEDRO RUIZ', sitios: 29, zonas: 'ZONA 2 y ZONA 7' },
  { id: 'cuadrilla-3', code: 'CUADRILLA 3', title: 'Cuadrilla 3', baseCM: 'BAGUA GRANDE', sitios: 22, zonas: 'ZONA 7' },
  { id: 'cuadrilla-4', code: 'CUADRILLA 4', title: 'Cuadrilla 4', baseCM: 'BAGUA GRANDE', sitios: 22, zonas: 'ZONA 7' },
  { id: 'cuadrilla-5', code: 'CUADRILLA 5', title: 'Cuadrilla 5', baseCM: 'BAGUA GRANDE', sitios: 39, zonas: 'ZONA 7' },
  { id: 'cuadrilla-6', code: 'CUADRILLA 6', title: 'Cuadrilla 6', baseCM: 'BAGUA GRANDE', sitios: 15, zonas: 'ZONA 7' }
]

export default function KMZ() {
  const { isAdmin, isSupervisor } = useAuth()
  const puedeVerTecnico = Boolean(isAdmin || isSupervisor)

  // Reporte activo
  const [activeReport, setActiveReport] = useState('programacion') // 'programacion' | 'general' | 'cuadrillas' | 'avance-diario' | 'semanal'

  // Parámetros de Programación
  const [fechaProg, setFechaProg] = useState(() => getPeruDateStr())
  const [mostrarTecnico, setMostrarTecnico] = useState(true)
  const [progPreviewData, setProgPreviewData] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState(null)

  // Parámetro de Cuadrillas
  const [selectedCuadrilla, setSelectedCuadrilla] = useState(CUADRILLAS_CATALOGO[0])

  // Parámetro de Avance Diario
  const [fechaAvance, setFechaAvance] = useState(() => getPeruDateStr())

  // Estados de exportación
  const [downloadingReport, setDownloadingReport] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const showFeedback = (text, type = 'success') => {
    setFeedbackMsg({ text, type })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  // Si el usuario no es admin/supervisor, forzar mostrarTecnico a false
  useEffect(() => {
    if (!puedeVerTecnico) {
      setMostrarTecnico(false)
    }
  }, [puedeVerTecnico])

  // Cargar vista previa del reporte de programación diaria
  const loadProgPreview = useCallback(async (targetDate, conTec) => {
    if (!targetDate) return
    setLoadingPreview(true)
    setPreviewError(null)
    try {
      const data = await buildProgramacionDiariaData({
        fechaStr: targetDate,
        conTecnico: conTec
      })
      setProgPreviewData(data)
    } catch (err) {
      console.warn('Error cargando preview de programación:', err)
      setPreviewError(err.message || 'No se pudo cargar la vista previa')
      setProgPreviewData(null)
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  // Refrescar preview al cambiar fecha o modo de técnico
  useEffect(() => {
    if (activeReport === 'programacion') {
      loadProgPreview(fechaProg, mostrarTecnico)
    }
  }, [activeReport, fechaProg, mostrarTecnico, loadProgPreview])

  // Manejador de descarga: 1. Programación Diaria
  const handleDownloadProgramacion = async () => {
    setDownloadingReport('programacion')
    try {
      await exportProgramacionDiariaExcel({
        fechaStr: fechaProg,
        conTecnico: mostrarTecnico
      })
      showFeedback(`Informe de Programación (${fechaProg}) descargado exitosamente`)
    } catch (err) {
      alert(`Error al generar el informe de programación: ${err.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  // Manejador de descarga: 2. General Observaciones
  const handleDownloadGeneral = async () => {
    setDownloadingReport('general')
    try {
      await exportTodasObservacionesExcel()
      showFeedback('Consolidado general de 4,116 observaciones descargado')
    } catch (err) {
      alert(`Error al generar el consolidado general: ${err.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  // Manejador de descarga: 3. Cuadrilla Específica
  const handleDownloadCuadrilla = async (cuad) => {
    setDownloadingReport(`cuadrilla-${cuad.code}`)
    try {
      await exportObservacionesGrupoExcel(cuad.code, cuad.title)
      showFeedback(`Excel de observaciones de ${cuad.title} descargado con éxito`)
    } catch (err) {
      alert(`Error al generar el Excel para ${cuad.title}: ${err.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  // Manejador de descarga: 4. Avance Diario
  const handleDownloadAvanceDiario = async () => {
    setDownloadingReport('avance-diario')
    try {
      const datos = await fetchDatosReporteDiario(fechaAvance)
      await exportarExcelReporteDiario(datos)
      showFeedback(`Reporte de Avance Diario (${fechaAvance}) generado con éxito`)
    } catch (err) {
      alert(`Error al generar reporte de avance diario: ${err.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  // Manejador de descarga: 5. Consolidado Semanal
  const handleDownloadSemanal = async () => {
    setDownloadingReport('semanal')
    try {
      const datos = await fetchDatosReporteSemanal()
      await exportarExcelReporteSemanal(datos)
      showFeedback('Reporte Semanal Consolidado descargado con éxito')
    } catch (err) {
      alert(`Error al generar reporte semanal: ${err.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  // Catálogo de informes para el panel lateral izquierdo
  const reportCards = useMemo(() => [
    {
      id: 'programacion',
      title: 'Programación y Rutas Diarias',
      badge: 'Diario / Operativo',
      badgeColor: '#0ea5e9',
      icon: CalendarDays,
      description: 'Asignación de cuadrillas, CM, código de sitio, localidad y notas de ruta en campo.'
    },
    {
      id: 'general',
      title: 'Consolidado General de Observaciones',
      badge: '4,116 Observaciones',
      badgeColor: '#6366f1',
      icon: Layers,
      description: 'Base de datos completa con localidad contigua al sitio, acuerdos y filtros automáticos.'
    },
    {
      id: 'cuadrillas',
      title: 'Reportes por Cuadrilla Operativa',
      badge: '6 Cuadrillas',
      badgeColor: '#10b981',
      icon: Users,
      description: 'Observaciones filtradas individualmente por Cuadrilla (Pedro Ruiz y Bagua Grande).'
    },
    {
      id: 'avance-diario',
      title: 'Matriz de Avance de Jornada',
      badge: 'Estados / Producción',
      badgeColor: '#f59e0b',
      icon: TrendingUp,
      description: 'Matriz ejecutiva por cuadrilla y detalle de observaciones subsanadas en el día.'
    },
    {
      id: 'semanal',
      title: 'Consolidado Semanal de Subsanación',
      badge: 'Semanal',
      badgeColor: '#8b5cf6',
      icon: FileSpreadsheet,
      description: 'Resumen consolidado semanal con métricas de productividad y cumplimiento de Hito 1.'
    }
  ], [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      
      {/* 1. NOTIFICACIÓN FLOTANTE / FEEDBACK */}
      {feedbackMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.75rem 1.1rem',
          borderRadius: '8px',
          background: feedbackMsg.type === 'info' ? '#eff6ff' : '#ecfdf5',
          border: `1px solid ${feedbackMsg.type === 'info' ? '#bfdbfe' : '#a7f3d0'}`,
          color: feedbackMsg.type === 'info' ? '#1d4ed8' : '#065f46',
          boxShadow: 'var(--shadow-sm)',
          animation: 'fadeIn 0.25s ease'
        }}>
          <CheckCircle2 size={16} />
          <span className="t-name">{feedbackMsg.text}</span>
        </div>
      )}

      {/* 2. ENCABEZADO PRINCIPAL DE LA ZONA DE INFORMES */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #d8e5f1',
        borderRadius: '12px',
        padding: '1rem 1.35rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <h2 className="t-title-page" style={{ color: '#003060', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={22} color="#003060" />
            Zona de Informes
          </h2>
          <p className="t-body" style={{ margin: '0.2rem 0 0 0', color: '#64748b' }}>
            Generación y descarga de informes ejecutivos oficiales en Excel (.xlsx) con identidad corporativa COVEPA
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="t-badge" style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1d4ed8',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={13} color="#1d4ed8" />
            Excel Oficial COVEPA
          </span>
        </div>
      </div>

      {/* 3. ARQUITECTURA DE 2 PANELES: CATÁLOGO A LA IZQUIERDA Y CONFIGURACIÓN A LA DERECHA */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 360px) minmax(0, 1fr)',
        gap: '1.25rem',
        alignItems: 'start'
      }}>
        
        {/* ── PANEL LATERAL IZQUIERDO: LISTA DE INFORMES DISPONIBLES ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          background: '#ffffff',
          border: '1px solid #d8e5f1',
          borderRadius: '12px',
          padding: '1rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #edf4fb' }}>
            <h3 className="t-title-section" style={{ color: '#003060', margin: 0 }}>
              Catálogo de Informes
            </h3>
            <p className="t-meta" style={{ margin: '0.15rem 0 0 0', color: '#64748b' }}>
              Selecciona el informe que deseas configurar y descargar
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {reportCards.map(item => {
              const IconComp = item.icon
              const isSelected = activeReport === item.id

              return (
                <div
                  key={item.id}
                  onClick={() => setActiveReport(item.id)}
                  style={{
                    background: isSelected ? '#f0f7ff' : '#ffffff',
                    border: `1.5px solid ${isSelected ? '#0284c7' : '#e2e8f0'}`,
                    borderRadius: '10px',
                    padding: '0.9rem 1rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(2, 132, 199, 0.12)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: isSelected ? '#003060' : '#f1f5f9',
                        color: isSelected ? '#ffffff' : '#003060',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <IconComp size={15} />
                      </div>
                      <span className="t-name" style={{ color: isSelected ? '#003060' : '#334155' }}>
                        {item.title}
                      </span>
                    </div>

                    <span className="t-badge" style={{
                      background: isSelected ? '#e0f2fe' : '#f8fafc',
                      border: `1px solid ${isSelected ? '#bae6fd' : '#e2e8f0'}`,
                      color: item.badgeColor,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '5px',
                      flexShrink: 0
                    }}>
                      {item.badge}
                    </span>
                  </div>

                  <p className="t-meta" style={{ margin: 0, color: '#64748b', lineHeight: 1.35, paddingLeft: '36px' }}>
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── PANEL PRINCIPAL DERECHO: VISTA DETALLADA, PARÁMETROS Y DESCARGA ── */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #d8e5f1',
          borderRadius: '12px',
          padding: '1.4rem 1.6rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: 'var(--shadow-sm)',
          minHeight: '480px'
        }}>

          {/* ═════════ CASO 1: PROGRAMACIÓN Y RUTAS DIARIAS (EL NUEVO INFORME) ═════════ */}
          {activeReport === 'programacion' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Encabezado del Informe */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #edf4fb', paddingBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                    <CalendarDays size={20} color="#003060" />
                    <h3 className="t-title-section" style={{ color: '#003060', margin: 0 }}>
                      Informe de Programación Diaria y Rutas de Campo
                    </h3>
                  </div>
                  <p className="t-body" style={{ margin: 0, color: '#475569' }}>
                    Genera el archivo Excel oficial con la cuadrilla asignada, centro de mantenimiento (CM), código de sitio, localidad y comentarios de visita.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadProgramacion}
                  disabled={downloadingReport === 'programacion' || !progPreviewData || progPreviewData.totalFilas === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    background: (downloadingReport === 'programacion' || !progPreviewData || progPreviewData.totalFilas === 0) ? '#94a3b8' : '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1.3rem',
                    fontWeight: 'var(--fw-bold)',
                    cursor: (downloadingReport === 'programacion' || !progPreviewData || progPreviewData.totalFilas === 0) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 3px 10px rgba(5, 150, 105, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  className="t-name"
                >
                  {downloadingReport === 'programacion' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Generando Excel...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>Descargar Informe Excel (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Parámetros de Selección */}
              <div style={{
                background: '#f8fbfe',
                border: '1px solid #d8e5f1',
                borderRadius: '10px',
                padding: '1rem 1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                {/* Selector de Fecha */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <label className="t-subtitle" style={{ color: '#003060', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} color="#0284c7" />
                    Fecha de Jornada:
                  </label>
                  <input
                    type="date"
                    value={fechaProg}
                    onChange={e => setFechaProg(e.target.value)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '7px',
                      padding: '0.45rem 0.75rem',
                      color: '#003060',
                      outline: 'none',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                    className="t-name"
                  />
                  <button
                    type="button"
                    onClick={() => setFechaProg(getPeruDateStr())}
                    style={{
                      background: '#e0f2fe',
                      border: '1px solid #bae6fd',
                      color: '#0284c7',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                    className="t-meta"
                  >
                    Hoy
                  </button>
                </div>

                {/* Selector de Modo: Con Técnico / Sin Técnico (Exclusivo Administrador) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span className="t-subtitle" style={{ color: '#003060', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    Formato de Visualización:
                  </span>

                  {puedeVerTecnico ? (
                    <div style={{
                      display: 'inline-flex',
                      background: '#e2e8f0',
                      padding: '3px',
                      borderRadius: '8px',
                      gap: '3px'
                    }}>
                      <button
                        type="button"
                        onClick={() => setMostrarTecnico(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: mostrarTecnico ? '#003060' : 'transparent',
                          color: mostrarTecnico ? '#ffffff' : '#475569',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.35rem 0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        className="t-meta"
                      >
                        <UserCheck size={14} />
                        <span>Con Técnico</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMostrarTecnico(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: !mostrarTecnico ? '#003060' : 'transparent',
                          color: !mostrarTecnico ? '#ffffff' : '#475569',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.35rem 0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        className="t-meta"
                      >
                        <UserX size={14} />
                        <span>Sin Técnico</span>
                      </button>
                    </div>
                  ) : (
                    <span className="t-badge" style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <Shield size={12} />
                      Sin Técnico (Público)
                    </span>
                  )}
                </div>
              </div>

              {/* Métricas de Resumen del Informe */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                  <span className="t-meta" style={{ color: '#64748b' }}>Sitios / Tareas Programadas</span>
                  <div className="t-metric-kpi" style={{ color: '#003060', marginTop: '0.2rem' }}>
                    {loadingPreview ? '...' : progPreviewData?.totalFilas || 0}
                  </div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                  <span className="t-meta" style={{ color: '#64748b' }}>Jornadas de Cuadrilla</span>
                  <div className="t-metric-kpi" style={{ color: '#0284c7', marginTop: '0.2rem' }}>
                    {loadingPreview ? '...' : progPreviewData?.progsCount || 0}
                  </div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                  <span className="t-meta" style={{ color: '#64748b' }}>Columna Técnico</span>
                  <div className="t-name" style={{ color: mostrarTecnico ? '#059669' : '#64748b', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {mostrarTecnico ? <Check size={16} /> : null}
                    {mostrarTecnico ? 'Incluida en el Excel' : 'Omitida (Anónimo)'}
                  </div>
                </div>
              </div>

              {/* Vista Previa Interactiva de la Tabla */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 className="t-subtitle" style={{ color: '#003060', margin: 0 }}>
                    Vista Previa del Archivo Excel ({progPreviewData?.totalFilas || 0} filas)
                  </h4>
                  <button
                    type="button"
                    onClick={() => loadProgPreview(fechaProg, mostrarTecnico)}
                    disabled={loadingPreview}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#0284c7',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    className="t-meta"
                  >
                    <RefreshCw size={12} className={loadingPreview ? 'animate-spin' : ''} />
                    <span>Actualizar datos</span>
                  </button>
                </div>

                {loadingPreview ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', background: '#f8fbfe', borderRadius: '8px' }}>
                    <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', color: '#0284c7' }} />
                    <p className="t-body" style={{ margin: 0 }}>Cargando datos de la jornada...</p>
                  </div>
                ) : previewError ? (
                  <div style={{ padding: '1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c' }}>
                    <p className="t-body" style={{ margin: 0 }}>{previewError}</p>
                  </div>
                ) : !progPreviewData || progPreviewData.rows.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fbfe', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
                    <AlertCircle size={28} color="#94a3b8" style={{ margin: '0 auto 0.5rem auto' }} />
                    <p className="t-name" style={{ margin: '0 0 0.2rem 0', color: '#334155' }}>
                      No se encontraron programaciones registradas para el día {fechaProg}.
                    </p>
                    <p className="t-meta" style={{ margin: 0, color: '#64748b' }}>
                      Selecciona otra fecha en el calendario superior para previsualizar y descargar su informe.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    border: '1px solid #d8e5f1',
                    borderRadius: '8px',
                    overflowX: 'auto',
                    background: '#ffffff'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#003060', color: '#ffffff' }}>
                          {progPreviewData.columns.map((col, idx) => (
                            <th
                              key={idx}
                              style={{
                                padding: '0.65rem 0.85rem',
                                borderRight: '1px solid rgba(255,255,255,0.15)',
                                whiteSpace: 'nowrap'
                              }}
                              className="t-name"
                            >
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {progPreviewData.rows.map((r, rIdx) => (
                          <tr
                            key={rIdx}
                            style={{
                              background: rIdx % 2 === 0 ? '#ffffff' : '#f8fbfe',
                              borderBottom: '1px solid #edf4fb'
                            }}
                          >
                            {r.map((cellVal, cIdx) => (
                              <td
                                key={cIdx}
                                style={{
                                  padding: '0.55rem 0.85rem',
                                  color: '#1e293b',
                                  whiteSpace: cIdx === r.length - 1 ? 'normal' : 'nowrap',
                                  fontVariantNumeric: 'tabular-nums'
                                }}
                                className="t-body"
                              >
                                {cellVal}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═════════ CASO 2: CONSOLIDADO GENERAL DE OBSERVACIONES ═════════ */}
          {activeReport === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #edf4fb', paddingBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                    <Layers size={20} color="#003060" />
                    <h3 className="t-title-section" style={{ color: '#003060', margin: 0 }}>
                      Consolidado General de Todas las Observaciones
                    </h3>
                  </div>
                  <p className="t-body" style={{ margin: 0, color: '#475569' }}>
                    Exporta la totalidad de observaciones registradas en la Región Amazonas (ZONA 2 y ZONA 7) con la columna de localidad inmediatamente contigua al código de sitio.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadGeneral}
                  disabled={downloadingReport === 'general'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    background: downloadingReport === 'general' ? '#94a3b8' : '#003060',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1.3rem',
                    fontWeight: 'var(--fw-bold)',
                    cursor: downloadingReport === 'general' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 3px 10px rgba(0, 48, 96, 0.2)',
                    transition: 'all 0.15s ease'
                  }}
                  className="t-name"
                >
                  {downloadingReport === 'general' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Generando Excel General...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>Descargar Todas las Observaciones (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#f8fbfe', border: '1px solid #d8e5f1', borderRadius: '10px', padding: '1rem' }}>
                  <span className="t-meta" style={{ color: '#64748b' }}>Total de Observaciones</span>
                  <div className="t-metric-kpi" style={{ color: '#003060', marginTop: '0.2rem' }}>4,116</div>
                  <span className="t-meta" style={{ color: '#059669', display: 'block', marginTop: '0.2rem' }}>100% de la base activa</span>
                </div>

                <div style={{ background: '#f8fbfe', border: '1px solid #d8e5f1', borderRadius: '10px', padding: '1rem' }}>
                  <span className="t-meta" style={{ color: '#64748b' }}>Sitios Incluidos</span>
                  <div className="t-metric-kpi" style={{ color: '#0284c7', marginTop: '0.2rem' }}>156</div>
                  <span className="t-meta" style={{ color: '#64748b', display: 'block', marginTop: '0.2rem' }}>Zona 2 (53) y Zona 7 (103)</span>
                </div>

                <div style={{ background: '#f8fbfe', border: '1px solid #d8e5f1', borderRadius: '10px', padding: '1rem' }}>
                  <span className="t-meta" style={{ color: '#64748b' }}>Formato Corporativo</span>
                  <div className="t-name" style={{ color: '#003060', marginTop: '0.4rem' }}>TableStyleMedium9</div>
                  <span className="t-meta" style={{ color: '#64748b', display: 'block', marginTop: '0.2rem' }}>Filtros automáticos activados</span>
                </div>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                <h4 className="t-name" style={{ color: '#1d4ed8', margin: '0 0 0.35rem 0' }}>
                  Estructura y Reglas del Reporte
                </h4>
                <ul className="t-body" style={{ margin: 0, paddingLeft: '1.25rem', color: '#334155', lineHeight: 1.5 }}>
                  <li><strong>Localidad Inmutable:</strong> La columna <code>LOCALIDAD</code> se ubica obligatoriamente al lado de <code>CÓDIGO DE SITIO</code>.</li>
                  <li><strong>Metadatos Técnicos:</strong> Incluye número de hito, subsistema, detalle, acuerdo de subsanación, estado COVEPA, fecha y auditor de Gilat.</li>
                  <li><strong>Tiempos y Demoras:</strong> Contiene justificación de retrasos, fecha de registro y tiempos de ejecución.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ═════════ CASO 3: REPORTES POR CUADRILLA ═════════ */}
          {activeReport === 'cuadrillas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #edf4fb', paddingBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                    <Users size={20} color="#003060" />
                    <h3 className="t-title-section" style={{ color: '#003060', margin: 0 }}>
                      Reportes de Observaciones por Cuadrilla Operativa
                    </h3>
                  </div>
                  <p className="t-body" style={{ margin: 0, color: '#475569' }}>
                    Descarga el Excel oficial de observaciones para cada una de las 6 cuadrillas de campo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadCuadrilla(selectedCuadrilla)}
                  disabled={downloadingReport === `cuadrilla-${selectedCuadrilla.code}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    background: downloadingReport === `cuadrilla-${selectedCuadrilla.code}` ? '#94a3b8' : '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1.3rem',
                    fontWeight: 'var(--fw-bold)',
                    cursor: downloadingReport === `cuadrilla-${selectedCuadrilla.code}` ? 'not-allowed' : 'pointer',
                    boxShadow: '0 3px 10px rgba(5, 150, 105, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  className="t-name"
                >
                  {downloadingReport === `cuadrilla-${selectedCuadrilla.code}` ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Generando Excel...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>Descargar {selectedCuadrilla.title} (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Selector de Cuadrilla */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {CUADRILLAS_CATALOGO.map(cuad => {
                  const isCur = selectedCuadrilla.id === cuad.id
                  return (
                    <div
                      key={cuad.id}
                      onClick={() => setSelectedCuadrilla(cuad)}
                      style={{
                        background: isCur ? '#f0f7ff' : '#ffffff',
                        border: `1.5px solid ${isCur ? '#0284c7' : '#cbd5e1'}`,
                        borderRadius: '8px',
                        padding: '0.75rem 0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span className="t-name" style={{ color: '#003060' }}>{cuad.title}</span>
                        <span className="t-badge" style={{ background: '#e0f2fe', color: '#0284c7', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                          {cuad.sitios} Sitios
                        </span>
                      </div>
                      <p className="t-meta" style={{ margin: 0, color: '#64748b' }}>
                        Base CM: <strong>{cuad.baseCM}</strong> · {cuad.zonas}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Ficha de la Cuadrilla Seleccionada */}
              <div style={{ background: '#f8fbfe', border: '1px solid #d8e5f1', borderRadius: '10px', padding: '1.1rem 1.3rem' }}>
                <h4 className="t-subtitle" style={{ color: '#003060', margin: '0 0 0.5rem 0' }}>
                  Detalles de Exportación: {selectedCuadrilla.title}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <span className="t-meta" style={{ color: '#64748b' }}>Centro de Mantenimiento</span>
                    <div className="t-name" style={{ color: '#003060' }}>{selectedCuadrilla.baseCM}</div>
                  </div>
                  <div>
                    <span className="t-meta" style={{ color: '#64748b' }}>Nodos Territoriales</span>
                    <div className="t-name" style={{ color: '#003060' }}>{selectedCuadrilla.sitios} Sitios asignados</div>
                  </div>
                  <div>
                    <span className="t-meta" style={{ color: '#64748b' }}>Zonas Geográficas</span>
                    <div className="t-name" style={{ color: '#003060' }}>{selectedCuadrilla.zonas}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════ CASO 4: MATRIZ DE AVANCE DE JORNADA ═════════ */}
          {activeReport === 'avance-diario' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #edf4fb', paddingBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                    <TrendingUp size={20} color="#003060" />
                    <h3 className="t-title-section" style={{ color: '#003060', margin: 0 }}>
                      Matriz Ejecutiva de Avance Diario de Subsanación
                    </h3>
                  </div>
                  <p className="t-body" style={{ margin: 0, color: '#475569' }}>
                    Genera el archivo Excel oficial con 2 hojas: <strong>Hoja 1 (Matriz de Cuadrillas por Estados)</strong> y <strong>Hoja 2 (Detalle unitario de observaciones)</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadAvanceDiario}
                  disabled={downloadingReport === 'avance-diario'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    background: downloadingReport === 'avance-diario' ? '#94a3b8' : '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1.3rem',
                    fontWeight: 'var(--fw-bold)',
                    cursor: downloadingReport === 'avance-diario' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 3px 10px rgba(5, 150, 105, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  className="t-name"
                >
                  {downloadingReport === 'avance-diario' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Generando Avance Diario...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>Descargar Avance Diario (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>

              <div style={{
                background: '#f8fbfe',
                border: '1px solid #d8e5f1',
                borderRadius: '10px',
                padding: '0.85rem 1.2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap'
              }}>
                <label className="t-subtitle" style={{ color: '#003060', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={16} color="#0284c7" />
                  Fecha de Avance:
                </label>
                <input
                  type="date"
                  value={fechaAvance}
                  onChange={e => setFechaAvance(e.target.value)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '7px',
                    padding: '0.45rem 0.75rem',
                    color: '#003060',
                    outline: 'none',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                  className="t-name"
                />
                <button
                  type="button"
                  onClick={() => setFechaAvance(getPeruDateStr())}
                  style={{
                    background: '#e0f2fe',
                    border: '1px solid #bae6fd',
                    color: '#0284c7',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                  className="t-meta"
                >
                  Hoy
                </button>
              </div>
            </div>
          )}

          {/* ═════════ CASO 5: CONSOLIDADO SEMANAL ═════════ */}
          {activeReport === 'semanal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #edf4fb', paddingBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                    <FileSpreadsheet size={20} color="#003060" />
                    <h3 className="t-title-section" style={{ color: '#003060', margin: 0 }}>
                      Reporte Semanal Consolidado de Observaciones
                    </h3>
                  </div>
                  <p className="t-body" style={{ margin: 0, color: '#475569' }}>
                    Consolidado de subsanación de Lunes a Domingo con hoja de resumen por cuadrillas, desglose diario y detalle de observaciones.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadSemanal}
                  disabled={downloadingReport === 'semanal'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    background: downloadingReport === 'semanal' ? '#94a3b8' : '#8b5cf6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1.3rem',
                    fontWeight: 'var(--fw-bold)',
                    cursor: downloadingReport === 'semanal' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 3px 10px rgba(139, 92, 246, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  className="t-name"
                >
                  {downloadingReport === 'semanal' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Generando Reporte Semanal...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>Descargar Reporte Semanal (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>

              <div style={{ background: '#f8fbfe', border: '1px solid #d8e5f1', borderRadius: '10px', padding: '1.2rem' }}>
                <p className="t-body" style={{ margin: 0, color: '#334155' }}>
                  El reporte semanal incluye el consolidado de producción de las 6 cuadrillas de campo durante la semana en curso, cálculo automático de tasas de validación y la columna de localidad para cada código de sitio.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
