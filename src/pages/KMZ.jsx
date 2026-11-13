import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileSpreadsheet, CalendarDays, Users, Layers,
  TrendingUp, Download, CheckCircle2, Loader2,
  Calendar, Check, UserCheck, Shield, Sparkles,
  RefreshCw, AlertCircle, Clock, Mail, ChevronRight,
  Layers3, Eye, Send, History, Building2
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  exportProgramacionDiariaExcel,
  buildProgramacionDiariaData,
  exportObservacionesGrupoExcel,
  exportTodasObservacionesExcel
} from '../services/exportService'
import {
  fetchConfiguracionReporte,
  saveConfiguracionReporte,
  fetchDatosReporteDiario,
  exportarExcelReporteDiario,
  generarHTMLReporte,
  despacharReporteInmediato,
  fetchDatosReporteDiarioInterno,
  exportarExcelReporteDiarioInterno,
  generarHTMLReporteInterno,
  despacharReporteInternoInmediato,
  fetchDatosReporteSemanal,
  exportarExcelReporteSemanal,
  generarHTMLReporteSemanal,
  despacharReporteSemanalInmediato,
  fetchHistorialEnvios,
  limpiarHistorialEnviosHoy,
  DEFAULT_CONFIG_DIARIO,
  DEFAULT_CONFIG_DIARIO_INTERNO,
  DEFAULT_CONFIG_SEMANAL
} from '../services/reportesCorreoService'
import { fetchPersonal } from '../services/personalService'
import { getPeruDateStr, getAyerPeruStr, toLocalDateString, getLocalidadBySiteId } from '../utils/helpers'

// Componentes modulares de informes
import CardAutomatizacionCorreo from '../components/informes/CardAutomatizacionCorreo'
import TablaExcelDetalle from '../components/informes/TablaExcelDetalle'
import ModalVistaPreviaCorreo from '../components/informes/ModalVistaPreviaCorreo'
import ModalSelectorPersonal from '../components/informes/ModalSelectorPersonal'
import ModalHistorialEnvios from '../components/informes/ModalHistorialEnvios'

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
  const { user, isAdmin, isSupervisor } = useAuth()
  const puedeVerTecnico = Boolean(isAdmin || isSupervisor)

  // Reporte activo en catálogo
  // 'diario-gilat' | 'diario-interno' | 'semanal' | 'programacion' | 'general' | 'cuadrillas'
  const [activeReport, setActiveReport] = useState('diario-gilat')

  // Conmutador de 2 Caras: 'frente' (Resumen y Despacho) | 'detras' (Estructura Excel)
  const [vistaCara, setVistaCara] = useState('frente')

  // Subpestaña para Reporte Interno en cara trasera: 'matriz' | 'detalle'
  const [subtabInternoExcel, setSubtabInternoExcel] = useState('matriz')

  // Estado de descarga y feedback
  const [downloadingReport, setDownloadingReport] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const showFeedback = (text, type = 'success') => {
    setFeedbackMsg({ text, type })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  // ========================================================
  // 1. CONFIGURACIONES DE CORREO AUTOMÁTICO
  // ========================================================
  const [configDiario, setConfigDiario] = useState(DEFAULT_CONFIG_DIARIO)
  const [configInterno, setConfigInterno] = useState(DEFAULT_CONFIG_DIARIO_INTERNO)
  const [configSemanal, setConfigSemanal] = useState(DEFAULT_CONFIG_SEMANAL)
  const [savingConfig, setSavingConfig] = useState(false)

  // ========================================================
  // 2. DATOS EN VIVO PARA LOS REPORTES
  // ========================================================
  const [fechaReporteDiario, setFechaReporteDiario] = useState(() => getPeruDateStr())
  const [datosDiario, setDatosDiario] = useState(null)
  const [loadingDiario, setLoadingDiario] = useState(false)

  const [fechaReporteInterno, setFechaReporteInterno] = useState(() => getPeruDateStr())
  const [datosInterno, setDatosInterno] = useState(null)
  const [loadingInterno, setLoadingInterno] = useState(false)

  const [datosSemanal, setDatosSemanal] = useState(null)
  const [loadingSemanal, setLoadingSemanal] = useState(false)

  // Programación
  const [fechaProg, setFechaProg] = useState(() => getPeruDateStr())
  const [mostrarTecnico, setMostrarTecnico] = useState(true)
  const [progPreviewData, setProgPreviewData] = useState(null)
  const [loadingProg, setLoadingProg] = useState(false)

  // Cuadrilla
  const [selectedCuadrilla, setSelectedCuadrilla] = useState(CUADRILLAS_CATALOGO[0])

  // ========================================================
  // 3. PERSONAL Y MODALES AUXILIARES
  // ========================================================
  const [personalList, setPersonalList] = useState([])
  const [modalPersonalOpen, setModalPersonalOpen] = useState(false)
  const [targetConfigForPersonal, setTargetConfigForPersonal] = useState('diario') // 'diario' | 'interno' | 'semanal'

  // Modal Vista Previa HTML
  const [modalPreviewOpen, setModalPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')
  const [previewDestinatarios, setPreviewDestinatarios] = useState([])
  const [previewDestinatariosCC, setPreviewDestinatariosCC] = useState([])
  const [previewAdjunto, setPreviewAdjunto] = useState('')
  const [previewReportType, setPreviewReportType] = useState('diario')

  // Modal Historial
  const [modalHistorialOpen, setModalHistorialOpen] = useState(false)
  const [historialEnvios, setHistorialEnvios] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [despachando, setDespachando] = useState(false)

  // Si el usuario no es admin/supervisor, forzar mostrarTecnico a false
  useEffect(() => {
    if (!puedeVerTecnico) {
      setMostrarTecnico(false)
    }
  }, [puedeVerTecnico])

  // Carga inicial de configuraciones y personal
  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        const [cDiario, cInterno, cSemanal, pList] = await Promise.all([
          fetchConfiguracionReporte('diario'),
          fetchConfiguracionReporte('diario_interno'),
          fetchConfiguracionReporte('semanal'),
          fetchPersonal().catch(() => [])
        ])
        if (mounted) {
          setConfigDiario(cDiario)
          setConfigInterno(cInterno)
          setConfigSemanal(cSemanal)
          setPersonalList(pList || [])
        }
      } catch (err) {
        console.warn('Error inicializando configuraciones de informes:', err)
      }
    }
    init()
    return () => { mounted = false }
  }, [])

  // Cargar datos del Reporte Diario Gilat
  const loadDiarioData = useCallback(async (targetDate) => {
    setLoadingDiario(true)
    try {
      const data = await fetchDatosReporteDiario(targetDate)
      setDatosDiario(data)
    } catch (err) {
      console.warn('Error cargando datos de reporte diario:', err)
    } finally {
      setLoadingDiario(false)
    }
  }, [])

  // Cargar datos del Reporte Diario Interno
  const loadInternoData = useCallback(async (targetDate) => {
    setLoadingInterno(true)
    try {
      const data = await fetchDatosReporteDiarioInterno(targetDate)
      setDatosInterno(data)
    } catch (err) {
      console.warn('Error cargando datos de reporte diario interno:', err)
    } finally {
      setLoadingInterno(false)
    }
  }, [])

  // Cargar datos del Reporte Semanal
  const loadSemanalData = useCallback(async () => {
    setLoadingSemanal(true)
    try {
      const data = await fetchDatosReporteSemanal()
      setDatosSemanal(data)
    } catch (err) {
      console.warn('Error cargando datos de reporte semanal:', err)
    } finally {
      setLoadingSemanal(false)
    }
  }, [])

  // Cargar datos de Programación
  const loadProgData = useCallback(async (targetDate, conTec) => {
    setLoadingProg(true)
    try {
      const data = await buildProgramacionDiariaData({ fechaStr: targetDate, conTecnico: conTec })
      setProgPreviewData(data)
    } catch (err) {
      console.warn('Error cargando preview programación:', err)
      setProgPreviewData(null)
    } finally {
      setLoadingProg(false)
    }
  }, [])

  // Cargas condicionales según el reporte seleccionado
  useEffect(() => {
    if (activeReport === 'diario-gilat' && !datosDiario) {
      loadDiarioData(fechaReporteDiario)
    } else if (activeReport === 'diario-interno' && !datosInterno) {
      loadInternoData(fechaReporteInterno)
    } else if (activeReport === 'semanal' && !datosSemanal) {
      loadSemanalData()
    } else if (activeReport === 'programacion') {
      loadProgData(fechaProg, mostrarTecnico)
    }
  }, [activeReport, fechaReporteDiario, fechaReporteInterno, fechaProg, mostrarTecnico, datosDiario, datosInterno, datosSemanal, loadDiarioData, loadInternoData, loadSemanalData, loadProgData])

  // ========================================================
  // GUARDAR CONFIGURACIÓN DE CORREO
  // ========================================================
  const handleSaveConfig = async (tipo) => {
    setSavingConfig(true)
    try {
      const userEmail = user?.email || 'coordinador'
      let configTarget = configDiario
      if (tipo === 'diario_interno') configTarget = configInterno
      if (tipo === 'semanal') configTarget = configSemanal

      await saveConfiguracionReporte(configTarget, userEmail, tipo)
      showFeedback('Configuración guardada exitosamente')
    } catch (err) {
      alert(`Error al guardar configuración: ${err.message}`)
    } finally {
      setSavingConfig(false)
    }
  }

  // ========================================================
  // DESPACHO DE CORREO DE PRUEBA
  // ========================================================
  const handleSendTest = async (tipo) => {
    setDespachando(true)
    try {
      let res = null
      if (tipo === 'diario') {
        res = await despacharReporteInmediato({ forzar: true, destinatarioPrueba: configDiario.destinatario_prueba || '' })
      } else if (tipo === 'diario_interno') {
        res = await despacharReporteInternoInmediato({ forzar: true, destinatarioPrueba: configInterno.destinatario_prueba || '' })
      } else if (tipo === 'semanal') {
        res = await despacharReporteSemanalInmediato({ forzar: true, destinatarioPrueba: configSemanal.destinatario_prueba || '' })
      }
      showFeedback(res?.message || 'Reporte de prueba despachado')
      if (modalPreviewOpen) setModalPreviewOpen(false)
    } catch (err) {
      alert(`Error al enviar prueba: ${err.message}`)
    } finally {
      setDespachando(false)
    }
  }

  // ========================================================
  // ABRIR VISTA PREVIA HTML
  // ========================================================
  const handleOpenPreview = (tipo) => {
    setPreviewReportType(tipo)
    if (tipo === 'diario') {
      const html = generarHTMLReporte({ config: configDiario, datos: datosDiario, isWebPreview: true })
      setPreviewHtml(html)
      setPreviewSubject((configDiario.asunto || '').replace('{fecha}', datosDiario?.fechaStr || ''))
      setPreviewDestinatarios(configDiario.destinatarios || [])
      setPreviewDestinatariosCC(configDiario.destinatarios_cc || [])
      setPreviewAdjunto(`Reporte_Observaciones_${datosDiario?.fechaStr || 'jornada'}.xlsx`)
    } else if (tipo === 'diario_interno') {
      const html = generarHTMLReporteInterno({ config: configInterno, datos: datosInterno, isWebPreview: true })
      setPreviewHtml(html)
      setPreviewSubject((configInterno.asunto || '').replace('{fecha}', datosInterno?.fechaStr || ''))
      setPreviewDestinatarios(configInterno.destinatarios || [])
      setPreviewDestinatariosCC(configInterno.destinatarios_cc || [])
      setPreviewAdjunto(`Reporte_Interno_Observaciones_${datosInterno?.fechaStr || 'jornada'}.xlsx`)
    } else if (tipo === 'semanal') {
      const html = generarHTMLReporteSemanal({ config: configSemanal, datos: datosSemanal, isWebPreview: true })
      setPreviewHtml(html)
      setPreviewSubject((configSemanal.asunto || '').replace('{semana}', String(datosSemanal?.numeroSemana || '')))
      setPreviewDestinatarios(configSemanal.destinatarios || [])
      setPreviewDestinatariosCC(configSemanal.destinatarios_cc || [])
      setPreviewAdjunto(`Reporte_Semanal_Observaciones_Semana_${datosSemanal?.numeroSemana || 'consolidado'}.xlsx`)
    }
    setModalPreviewOpen(true)
  }

  // ========================================================
  // HISTORIAL DE ENVÍOS
  // ========================================================
  const handleOpenHistorial = async (tipoFiltro = null) => {
    setModalHistorialOpen(true)
    setLoadingHistorial(true)
    try {
      const hist = await fetchHistorialEnvios(tipoFiltro)
      setHistorialEnvios(hist || [])
    } catch (err) {
      console.warn('Error al cargar historial:', err)
    } finally {
      setLoadingHistorial(false)
    }
  }

  const handleLimpiarHoy = async () => {
    if (!window.confirm('¿Confirmas limpiar el registro de envío del día de hoy? El cron automático podrá volver a despachar.')) return
    try {
      await limpiarHistorialEnviosHoy()
      showFeedback('Registro de envío de hoy reseteado')
      const hist = await fetchHistorialEnvios()
      setHistorialEnvios(hist || [])
    } catch (err) {
      alert(`Error al limpiar historial: ${err.message}`)
    }
  }

  // ========================================================
  // TOGGLES DE PERSONAL PARA DESTINATARIOS
  // ========================================================
  const handleTogglePersonalPara = (email) => {
    const emailNorm = email.toLowerCase().trim()
    const isInterno = targetConfigForPersonal === 'interno'
    const isSemanal = targetConfigForPersonal === 'semanal'

    const cfg = isInterno ? configInterno : (isSemanal ? configSemanal : configDiario)
    const setCfg = isInterno ? setConfigInterno : (isSemanal ? setConfigSemanal : setConfigDiario)

    const curPara = cfg.destinatarios || []
    const curCC = cfg.destinatarios_cc || []

    if (curPara.includes(emailNorm)) {
      setCfg({ ...cfg, destinatarios: curPara.filter(e => e !== emailNorm) })
    } else {
      setCfg({
        ...cfg,
        destinatarios: [...curPara, emailNorm],
        destinatarios_cc: curCC.filter(e => e !== emailNorm)
      })
    }
  }

  const handleTogglePersonalCC = (email) => {
    const emailNorm = email.toLowerCase().trim()
    const isInterno = targetConfigForPersonal === 'interno'
    const isSemanal = targetConfigForPersonal === 'semanal'

    const cfg = isInterno ? configInterno : (isSemanal ? configSemanal : configDiario)
    const setCfg = isInterno ? setConfigInterno : (isSemanal ? setConfigSemanal : setConfigDiario)

    const curPara = cfg.destinatarios || []
    const curCC = cfg.destinatarios_cc || []

    if (curCC.includes(emailNorm)) {
      setCfg({ ...cfg, destinatarios_cc: curCC.filter(e => e !== emailNorm) })
    } else {
      setCfg({
        ...cfg,
        destinatarios_cc: [...curCC, emailNorm],
        destinatarios: curPara.filter(e => e !== emailNorm)
      })
    }
  }

  // ========================================================
  // MANEJADORES DE DESCARGA DE EXCEL (.xlsx)
  // ========================================================
  const handleDownloadDiario = async () => {
    setDownloadingReport('diario-gilat')
    try {
      let d = datosDiario
      if (!d) d = await fetchDatosReporteDiario(fechaReporteDiario)
      await exportarExcelReporteDiario(d)
      showFeedback(`Reporte Diario (${d.fechaStr}) descargado exitosamente`)
    } catch (err) {
      alert(`Error al generar Excel: ${err.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  const handleDownloadInterno = async () => {
    setDownloadingReport('diario-interno')
    try {
      let d = datosInterno
      if (!d) d = await fetchDatosReporteDiarioInterno(fechaReporteInterno)
      await exportarExcelReporteDiarioInterno(d)
      showFeedback(`Reporte Diario Interno (${d.fechaStr}) descargado exitosamente`)
    } catch (err) {
      alert(`Error al generar Excel: ${err.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  const handleDownloadSemanal = async () => {
    setDownloadingReport('semanal')
    try {
      let d = datosSemanal
      if (!d) d = await fetchDatosReporteSemanal()
      await exportarExcelReporteSemanal(d)
      showFeedback('Reporte Semanal Consolidado descargado')
    } catch (err) {
      alert(`Error al generar Excel: ${err.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  const handleDownloadProgramacion = async () => {
    setDownloadingReport('programacion')
    try {
      await exportProgramacionDiariaExcel({ fechaStr: fechaProg, conTecnico: mostrarTecnico })
      showFeedback(`Programación Diaria (${fechaProg}) descargada`)
    } catch (err) {
      alert(`Error al generar Excel: ${err.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  const handleDownloadGeneral = async () => {
    setDownloadingReport('general')
    try {
      await exportTodasObservacionesExcel()
      showFeedback('Consolidado general de 4,116 observaciones descargado')
    } catch (err) {
      alert(`Error al generar Excel: ${err.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  const handleDownloadCuadrilla = async (cuad) => {
    setDownloadingReport(`cuadrilla-${cuad.code}`)
    try {
      await exportObservacionesGrupoExcel(cuad.code, cuad.title)
      showFeedback(`Excel de ${cuad.title} descargado con éxito`)
    } catch (err) {
      alert(`Error al generar Excel: ${err.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  // ========================================================
  // CATÁLOGO DE INFORMES (Panel Lateral Izquierdo)
  // ========================================================
  const reportCards = useMemo(() => [
    {
      id: 'diario-gilat',
      title: 'Reporte Diario (Gilat / General)',
      badge: 'Automático · 21:00 hrs',
      badgeColor: '#0284c7',
      icon: TrendingUp,
      description: 'Consolidado oficial nocturno con tiempo promedio de revisión y despacho por correo.'
    },
    {
      id: 'diario-interno',
      title: 'Reporte Diario Interno',
      badge: 'Automático · 21:30 hrs',
      badgeColor: '#10b981',
      icon: Layers,
      description: 'Cifras del día y Cuadro Matricial por Equipos (C1+C2, C3+C6, C4+C5) con Excel adjunto.'
    },
    {
      id: 'semanal',
      title: 'Consolidado Semanal de Subsanación',
      badge: 'Automático · Vie 20:00',
      badgeColor: '#8b5cf6',
      icon: FileSpreadsheet,
      description: 'Resumen consolidado Lunes a Domingo con métricas de productividad y cumplimiento de Hito 1.'
    },
    {
      id: 'programacion',
      title: 'Programación y Rutas Diarias',
      badge: 'Diario / Operativo',
      badgeColor: '#0ea5e9',
      icon: CalendarDays,
      description: 'Asignación de cuadrillas, CM, códigos de sitio, localidad y notas de ruta en campo.'
    },
    {
      id: 'general',
      title: 'Consolidado General de Observaciones',
      badge: '4,116 Observaciones',
      badgeColor: '#6366f1',
      icon: Layers3,
      description: 'Base de datos completa con localidad contigua al sitio, acuerdos y filtros automáticos.'
    },
    {
      id: 'cuadrillas',
      title: 'Reportes por Cuadrilla Operativa',
      badge: '6 Cuadrillas',
      badgeColor: '#f59e0b',
      icon: Users,
      description: 'Observaciones filtradas individualmente por Cuadrilla (Pedro Ruiz y Bagua Grande).'
    }
  ], [])

  // ========================================================
  // PREPARACIÓN DE COLUMNAS Y FILAS PARA LA CARA TRASERA
  // ========================================================

  // 1. Columnas y Filas: Diario Gilat
  const columnsDiarioGilat = useMemo(() => [
    { key: 'id_obs', title: 'ID Obs' },
    { key: 'zona', title: 'Zona' },
    { key: 'id_sitio', title: 'Código de Sitio' },
    { key: 'localidad', title: 'Localidad' },
    { key: 'revisor', title: 'Persona que Validó' },
    { key: 'estado', title: 'Estado Observación' },
    { key: 'fecha_solicito_revision', title: 'Solicitó Revisión' },
    { key: 'fecha_revisado', title: 'Revisado' },
    { key: 'tiempo_revision', title: 'Tiempo de Revisión' }
  ], [])

  const rowsDiarioGilat = useMemo(() => {
    if (!datosDiario) return []
    const all = [
      ...(datosDiario.validadas || []),
      ...(datosDiario.rechazadas || []),
      ...(datosDiario.enEspera || []),
      ...(datosDiario.descartadas || [])
    ]
    return all.map(r => ({
      id: r.id_obs,
      id_obs: r.id_obs || '',
      zona: r.zona || '-',
      id_sitio: r.id_sitio || r.codigo_lugar || '',
      localidad: r.localidad || getLocalidadBySiteId(r.id_sitio) || '',
      revisor: r.revisor || '-',
      estado: r.estado || 'Validado',
      fecha_solicito_revision: r.fecha_solicito_revision || '-',
      fecha_revisado: r.fecha_revisado || '-',
      tiempo_revision: r.tiempo_revision || '-'
    }))
  }, [datosDiario])

  // 2. Columnas y Filas: Diario Interno - Hoja 1: Matriz Equipos
  const columnsInternoMatriz = useMemo(() => [
    { key: 'id', title: 'Equipo' },
    { key: 'subtitulo', title: 'Cuadrillas' },
    { key: 'tecnico', title: 'Técnicos Asignados', wrap: true },
    { key: 'solicitando', title: 'Solicitando', align: 'center' },
    { key: 'enRevision', title: 'En Revisión', align: 'center' },
    { key: 'rechazados', title: 'Rechazados', align: 'center' },
    { key: 'validados', title: 'Validados', align: 'center' },
    { key: 'documentacion', title: 'Documentación', align: 'center' },
    { key: 'total', title: 'Total', align: 'center' }
  ], [])

  const rowsInternoMatriz = useMemo(() => {
    if (!datosInterno?.matrixRows) return []
    const rows = datosInterno.matrixRows.map(r => ({
      id: r.id,
      subtitulo: r.subtitulo,
      tecnico: r.tecnico,
      solicitando: r.values.solicitando,
      enRevision: r.values.enRevision,
      rechazados: r.values.rechazados,
      validados: r.values.validados,
      documentacion: r.values.documentacion,
      total: r.total
    }))

    // Fila de Total General
    const t = datosInterno.matrixTotals || {}
    rows.push({
      id: 'TOTAL GENERAL',
      subtitulo: 'Todas las cuadrillas',
      tecnico: '-',
      solicitando: t.solicitando || 0,
      enRevision: t.enRevision || 0,
      rechazados: t.rechazados || 0,
      validados: t.validados || 0,
      documentacion: t.documentacion || 0,
      total: datosInterno.matrixGrandTotal || 0
    })
    return rows
  }, [datosInterno])

  // 2. Columnas y Filas: Diario Interno - Hoja 2: Detalle Códigos
  const columnsInternoDetalle = useMemo(() => [
    { key: 'id_obs', title: 'ID Obs' },
    { key: 'equipo', title: 'Equipo' },
    { key: 'cuadrilla', title: 'Cuadrilla' },
    { key: 'tecnico', title: 'Técnico' },
    { key: 'id_sitio', title: 'Código de Sitio' },
    { key: 'localidad', title: 'Localidad' },
    { key: 'zona', title: 'Zona' },
    { key: 'estado', title: 'Estado COVEPA' },
    { key: 'revisor', title: 'Revisor' },
    { key: 'fecha_subsanacion', title: 'Fecha/Hora' },
    { key: 'detalle', title: 'Detalle', maxWidth: '300px' },
    { key: 'comentario', title: 'Comentario', maxWidth: '300px' }
  ], [])

  const rowsInternoDetalle = useMemo(() => {
    if (!datosInterno?.rows) return []
    return datosInterno.rows.map(r => ({
      id: r.id_obs,
      id_obs: r.id_obs || '',
      equipo: r.equipo || '',
      cuadrilla: r.cuadrilla || '',
      tecnico: r.tecnico || '-',
      id_sitio: r.id_sitio || r.codigo_lugar || '',
      localidad: r.localidad || getLocalidadBySiteId(r.id_sitio) || '',
      zona: r.zona || '-',
      estado: r.estado || r.estado_covepa || '',
      revisor: r.revisor || '-',
      fecha_subsanacion: r.fecha_subsanacion || r.fecha_hora || '-',
      detalle: r.detalle || r.descripcion || '',
      comentario: r.comentario || r.justificacion_demora || '-'
    }))
  }, [datosInterno])

  // 3. Columnas y Filas: Semanal
  const columnsSemanal = useMemo(() => [
    { key: 'id_obs', title: 'ID Obs' },
    { key: 'zona', title: 'Zona' },
    { key: 'id_sitio', title: 'Código de Sitio' },
    { key: 'localidad', title: 'Localidad' },
    { key: 'revisor', title: 'Persona que Validó' },
    { key: 'estado', title: 'Estado Observación' }
  ], [])

  const rowsSemanal = useMemo(() => {
    if (!datosSemanal) return []
    const all = [
      ...(datosSemanal.validadas || []),
      ...(datosSemanal.rechazadas || []),
      ...(datosSemanal.enEspera || []),
      ...(datosSemanal.descartadas || [])
    ]
    return all.map(r => ({
      id: r.id_obs,
      id_obs: r.id_obs || '',
      zona: r.zona || '-',
      id_sitio: r.id_sitio || r.codigo_lugar || '',
      localidad: r.localidad || getLocalidadBySiteId(r.id_sitio) || '',
      revisor: r.revisor || '-',
      estado: r.estado || 'Validado'
    }))
  }, [datosSemanal])

  // 4. Columnas y Filas: Programación
  const columnsProg = useMemo(() => {
    const base = [
      { key: 'cuadrilla', title: 'Cuadrilla' },
      { key: 'baseCM', title: 'Base CM' },
      { key: 'codigo_lugar', title: 'Código de Sitio' },
      { key: 'localidad', title: 'Localidad' }
    ]
    if (mostrarTecnico && puedeVerTecnico) {
      base.push({ key: 'tecnico', title: 'Técnico Responsable' })
    }
    base.push({ key: 'notas', title: 'Notas de Ruta', maxWidth: '300px' })
    return base
  }, [mostrarTecnico, puedeVerTecnico])

  const rowsProg = useMemo(() => {
    if (!progPreviewData?.rows) return []
    return progPreviewData.rows.map((r, i) => ({
      id: `prog-${i}`,
      cuadrilla: r.cuadrilla || '',
      baseCM: r.baseCM || '',
      codigo_lugar: r.codigo_lugar || r.id_sitio || '',
      localidad: r.localidad || getLocalidadBySiteId(r.codigo_lugar || r.id_sitio) || '',
      tecnico: r.tecnico || '-',
      notas: r.notas || '-'
    }))
  }, [progPreviewData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      
      {/* NOTIFICACIÓN FLOTANTE / FEEDBACK */}
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

      {/* ENCABEZADO PRINCIPAL DE INFORMES Y REPORTES */}
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
            Informes y Reportes
          </h2>
          <p className="t-body" style={{ margin: '0.2rem 0 0 0', color: '#64748b' }}>
            Gestión ejecutiva de informes, matrices por equipos, descarga de Excel (.xlsx) y automatización de envíos por correo
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => handleOpenHistorial()}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.85rem' }}
          >
            <History size={14} />
            <span>Auditoría de Envíos</span>
          </button>

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

      {/* ARQUITECTURA DE 2 PANELES: CATÁLOGO A LA IZQUIERDA Y REPORTE A LA DERECHA */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 360px) minmax(0, 1fr)',
        gap: '1.25rem',
        alignItems: 'start'
      }}>
        
        {/* ── PANEL LATERAL IZQUIERDO: CATÁLOGO DE INFORMES ── */}
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
              Selecciona el informe que deseas consultar, configurar o descargar
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
                    padding: '0.85rem 1rem',
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
                        background: isSelected ? '#e0f2fe' : '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <IconComp size={16} color={isSelected ? '#0284c7' : '#475569'} />
                      </div>
                      <span className="t-name" style={{ color: isSelected ? '#003060' : '#1e293b' }}>
                        {item.title}
                      </span>
                    </div>

                    <span className="t-badge" style={{
                      background: isSelected ? '#e0f2fe' : '#f8fafc',
                      border: `1px solid ${isSelected ? '#bae6fd' : '#e2e8f0'}`,
                      color: item.badgeColor,
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {item.badge}
                    </span>
                  </div>

                  <p className="t-meta" style={{ margin: 0, color: '#64748b', lineHeight: '1.35' }}>
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── PANEL DERECHO: EL REPORTE ACTIVO EN 2 CARAS (FRENTE / DETRÁS) ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          
          {/* BARRA SUPERIOR DE CABECERA Y SELECTOR DE CARAS (FRENTE / DETRÁS) */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #d8e5f1',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="t-title-section" style={{ color: '#003060', margin: 0 }}>
                  {reportCards.find(r => r.id === activeReport)?.title}
                </span>
              </div>
              <span className="t-meta" style={{ color: '#64748b' }}>
                Alterna entre el Resumen Ejecutivo de despacho y la Estructura Tabular de Excel
              </span>
            </div>

            {/* CONMUTADOR TIPO PÍLDORA DE LAS 2 CARAS */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1'
            }}>
              <button
                type="button"
                onClick={() => setVistaCara('frente')}
                className="t-badge"
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: vistaCara === 'frente' ? '#ffffff' : 'transparent',
                  color: vistaCara === 'frente' ? '#003060' : '#64748b',
                  fontWeight: vistaCara === 'frente' ? 'var(--fw-semibold)' : 'var(--fw-normal)',
                  boxShadow: vistaCara === 'frente' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>📊 Cara Frontal: Resumen y Despacho</span>
              </button>

              <button
                type="button"
                onClick={() => setVistaCara('detras')}
                className="t-badge"
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: vistaCara === 'detras' ? '#ffffff' : 'transparent',
                  color: vistaCara === 'detras' ? '#003060' : '#64748b',
                  fontWeight: vistaCara === 'detras' ? 'var(--fw-semibold)' : 'var(--fw-normal)',
                  boxShadow: vistaCara === 'detras' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>📑 Cara Trasera: Estructura Excel</span>
              </button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* CASO 1: REPORTE DIARIO (GILAT / GENERAL)                 */}
          {/* ======================================================== */}
          {activeReport === 'diario-gilat' && (
            vistaCara === 'frente' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Métricas y Cifras Resumidas */}
                <div style={{ background: '#ffffff', border: '1px solid #d8e5f1', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h4 className="t-name" style={{ margin: 0, color: '#003060' }}>
                        Cifras Resumidas de la Jornada
                      </h4>
                      <span className="t-meta" style={{ color: '#64748b' }}>
                        {datosDiario?.fechaFormateada || fechaReporteDiario}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="date"
                        value={fechaReporteDiario}
                        onChange={e => {
                          setFechaReporteDiario(e.target.value)
                          loadDiarioData(e.target.value)
                        }}
                        className="t-body"
                        style={{ padding: '0.35rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      />
                      <button
                        type="button"
                        onClick={handleDownloadDiario}
                        disabled={downloadingReport === 'diario-gilat'}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Download size={14} />
                        <span>Descargar Excel</span>
                      </button>
                    </div>
                  </div>

                  {/* Tarjeta Principal de Total */}
                  <div style={{ background: '#f8fafc', border: '1.5px solid #003060', borderRadius: '10px', padding: '1.1rem', textAlign: 'center', marginBottom: '0.85rem' }}>
                    <div className="t-metric-kpi" style={{ color: '#003060' }}>
                      {datosDiario?.stats?.total ?? (loadingDiario ? '...' : 0)}
                    </div>
                    <div className="t-badge" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '4px' }}>
                      Total de Observaciones Trabajadas en la Jornada
                    </div>
                  </div>

                  {/* 4 KPIs Secundarios */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ background: '#f0fdf4', border: '1.5px solid #22c55e', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#15803d', margin: 0 }}>
                        {datosDiario?.stats?.validadas ?? 0}
                      </div>
                      <div className="t-badge" style={{ color: '#166534', marginTop: '2px' }}>✓ Validadas</div>
                    </div>

                    <div style={{ background: '#fff1f2', border: '1.5px solid #f43f5e', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#be123c', margin: 0 }}>
                        {datosDiario?.stats?.rechazadas ?? 0}
                      </div>
                      <div className="t-badge" style={{ color: '#9f1239', marginTop: '2px' }}>✕ Rechazadas</div>
                    </div>

                    <div style={{ background: '#f0f9ff', border: '1.5px solid #0284c7', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#0369a1', margin: 0 }}>
                        {datosDiario?.stats?.enEspera ?? 0}
                      </div>
                      <div className="t-badge" style={{ color: '#075985', marginTop: '2px' }}>⏳ En Espera</div>
                    </div>

                    <div style={{ background: '#faf5ff', border: '1.5px solid #a855f7', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#7e22ce', margin: 0 }}>
                        {datosDiario?.stats?.descartadas ?? 0}
                      </div>
                      <div className="t-badge" style={{ color: '#6b21a8', marginTop: '2px' }}>⊘ No Aplica</div>
                    </div>
                  </div>

                  {/* Tarjeta Destacada de Tiempo Promedio de Revisión */}
                  <div style={{
                    background: '#fffbeb',
                    border: '1.5px solid #f59e0b',
                    borderRadius: '10px',
                    padding: '0.9rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Clock size={26} color="#d97706" />
                      <div>
                        <div className="t-name" style={{ color: '#92400e', margin: 0 }}>
                          Tiempo Promedio de Revisión
                        </div>
                        <span className="t-meta" style={{ color: '#b45309' }}>
                          Promedio de atención transcurrido desde que se solicitó revisión hasta el dictamen de Gilat
                        </span>
                      </div>
                    </div>

                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '0.35rem 0.85rem',
                      textAlign: 'center'
                    }}>
                      <span className="t-title-section" style={{ color: '#b45309', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {datosDiario?.stats?.tiempoPromedioRevisionTexto || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card de Automatización y Envío de Correo */}
                <CardAutomatizacionCorreo
                  config={configDiario}
                  onChangeConfig={setConfigDiario}
                  onSave={() => handleSaveConfig('diario')}
                  saving={savingConfig}
                  onOpenPreview={() => handleOpenPreview('diario')}
                  onSendTest={() => handleSendTest('diario')}
                  sendingTest={despachando}
                  onOpenHistorial={() => handleOpenHistorial('diario')}
                  onOpenPersonalSelector={() => {
                    setTargetConfigForPersonal('diario')
                    setModalPersonalOpen(true)
                  }}
                  titulo="Envío Automático del Reporte Diario a Gilat"
                  subtitulo="Despacho oficial de las 21:00 hrs con archivo Excel adjunto y tiempo de revisión"
                />
              </div>
            ) : (
              <TablaExcelDetalle
                columns={columnsDiarioGilat}
                data={rowsDiarioGilat}
                fileName={`Reporte_Observaciones_${fechaReporteDiario}.xlsx`}
                onDownload={handleDownloadDiario}
                downloading={downloadingReport === 'diario-gilat'}
                sheetNotice="Previsualización de las columnas y registros oficiales del Excel diario para Gilat."
              />
            )
          )}

          {/* ======================================================== */}
          {/* CASO 2: REPORTE DIARIO INTERNO (NUEVO)                  */}
          {/* ======================================================== */}
          {activeReport === 'diario-interno' && (
            vistaCara === 'frente' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Cuadro Matricial Ejecutivo por Equipos y Cifras de Jornada */}
                <div style={{ background: '#ffffff', border: '1px solid #d8e5f1', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h4 className="t-name" style={{ margin: 0, color: '#003060' }}>
                        Resumen Operativo Interno de Jornada
                      </h4>
                      <span className="t-meta" style={{ color: '#64748b' }}>
                        {datosInterno?.fechaFormateada || fechaReporteInterno} · Cuadro por Equipos y Cuadrillas
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="date"
                        value={fechaReporteInterno}
                        onChange={e => {
                          setFechaReporteInterno(e.target.value)
                          loadInternoData(e.target.value)
                        }}
                        className="t-body"
                        style={{ padding: '0.35rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      />
                      <button
                        type="button"
                        onClick={handleDownloadInterno}
                        disabled={downloadingReport === 'diario-interno'}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Download size={14} />
                        <span>Descargar Excel</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Métricas de Cabecera */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.15rem' }}>
                    <div style={{ background: '#f8fafc', border: '1.5px solid #003060', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#003060', margin: 0 }}>
                        {datosInterno?.matrixGrandTotal ?? (loadingInterno ? '...' : 0)}
                      </div>
                      <div className="t-badge" style={{ color: '#475569', marginTop: '2px' }}>Total Tocadas</div>
                    </div>

                    <div style={{ background: '#f0fdf4', border: '1.5px solid #22c55e', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#15803d', margin: 0 }}>
                        {datosInterno?.matrixTotals?.validados ?? 0}
                      </div>
                      <div className="t-badge" style={{ color: '#166534', marginTop: '2px' }}>✓ Validadas</div>
                    </div>

                    <div style={{ background: '#fff1f2', border: '1.5px solid #f43f5e', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#be123c', margin: 0 }}>
                        {datosInterno?.matrixTotals?.rechazados ?? 0}
                      </div>
                      <div className="t-badge" style={{ color: '#9f1239', marginTop: '2px' }}>✕ Rechazadas</div>
                    </div>

                    <div style={{ background: '#faf5ff', border: '1.5px solid #a855f7', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#7e22ce', margin: 0 }}>
                        {datosInterno?.matrixTotals?.documentacion ?? 0}
                      </div>
                      <div className="t-badge" style={{ color: '#6b21a8', marginTop: '2px' }}>📄 Documentación</div>
                    </div>
                  </div>

                  {/* CUADRO MATRICIAL EJECUTIVO POR EQUIPOS (Equipo 1: C1+C2, Equipo 2: C3+C6, Equipo 3: C4+C5) */}
                  <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ background: '#003060', padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="t-badge" style={{ color: '#ffffff', fontWeight: 'var(--fw-bold)', letterSpacing: '0.5px' }}>
                        MATRIZ EJECUTIVA POR EQUIPOS Y CUADRILLAS INTEGRADAS
                      </span>
                      <span className="t-badge" style={{ color: '#38bdf8' }}>
                        Avance Oficial de Jornada
                      </span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '0.6rem 0.85rem', color: '#003060' }} className="t-badge">Equipo / Cuadrillas</th>
                          <th style={{ padding: '0.6rem 0.85rem', color: '#003060' }} className="t-badge">Técnicos</th>
                          <th style={{ padding: '0.6rem 0.65rem', color: '#003060', textAlign: 'center' }} className="t-badge">Solicitando</th>
                          <th style={{ padding: '0.6rem 0.65rem', color: '#003060', textAlign: 'center' }} className="t-badge">En Rev.</th>
                          <th style={{ padding: '0.6rem 0.65rem', color: '#003060', textAlign: 'center' }} className="t-badge">Rechaz.</th>
                          <th style={{ padding: '0.6rem 0.65rem', color: '#003060', textAlign: 'center' }} className="t-badge">Valid.</th>
                          <th style={{ padding: '0.6rem 0.65rem', color: '#003060', textAlign: 'center' }} className="t-badge">Docum.</th>
                          <th style={{ padding: '0.6rem 0.85rem', color: '#003060', textAlign: 'center' }} className="t-badge">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(datosInterno?.matrixRows || []).map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <div className="t-name" style={{ color: '#003060' }}>{row.id}</div>
                              <span className="t-meta" style={{ color: '#64748b' }}>{row.subtitulo}</span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <span className="t-meta" style={{ color: '#334155' }}>{row.tecnico}</span>
                            </td>
                            <td style={{ padding: '0.65rem 0.65rem', textAlign: 'center' }}>
                              <span className="t-name" style={{ color: '#0284c7', fontVariantNumeric: 'tabular-nums' }}>{row.values.solicitando}</span>
                            </td>
                            <td style={{ padding: '0.65rem 0.65rem', textAlign: 'center' }}>
                              <span className="t-name" style={{ color: '#0284c7', fontVariantNumeric: 'tabular-nums' }}>{row.values.enRevision}</span>
                            </td>
                            <td style={{ padding: '0.65rem 0.65rem', textAlign: 'center' }}>
                              <span className="t-name" style={{ color: '#e11d48', fontVariantNumeric: 'tabular-nums' }}>{row.values.rechazados}</span>
                            </td>
                            <td style={{ padding: '0.65rem 0.65rem', textAlign: 'center' }}>
                              <span className="t-name" style={{ color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{row.values.validados}</span>
                            </td>
                            <td style={{ padding: '0.65rem 0.65rem', textAlign: 'center' }}>
                              <span className="t-name" style={{ color: '#7e22ce', fontVariantNumeric: 'tabular-nums' }}>{row.values.documentacion}</span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', background: '#eff6ff' }}>
                              <span className="t-title-section" style={{ color: '#003060', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{row.total}</span>
                            </td>
                          </tr>
                        ))}
                        {/* Fila Total General */}
                        <tr style={{ background: '#0f172a', color: '#ffffff', borderTop: '2px solid #003060' }}>
                          <td colSpan={2} style={{ padding: '0.75rem 0.85rem' }}>
                            <span className="t-name" style={{ color: '#ffffff', letterSpacing: '0.5px' }}>TOTAL GENERAL</span>
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', textAlign: 'center' }}>
                            <span className="t-name" style={{ color: '#bae6fd', fontVariantNumeric: 'tabular-nums' }}>{datosInterno?.matrixTotals?.solicitando || 0}</span>
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', textAlign: 'center' }}>
                            <span className="t-name" style={{ color: '#bae6fd', fontVariantNumeric: 'tabular-nums' }}>{datosInterno?.matrixTotals?.enRevision || 0}</span>
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', textAlign: 'center' }}>
                            <span className="t-name" style={{ color: '#fecdd3', fontVariantNumeric: 'tabular-nums' }}>{datosInterno?.matrixTotals?.rechazados || 0}</span>
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', textAlign: 'center' }}>
                            <span className="t-name" style={{ color: '#bbf7d0', fontVariantNumeric: 'tabular-nums' }}>{datosInterno?.matrixTotals?.validados || 0}</span>
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', textAlign: 'center' }}>
                            <span className="t-name" style={{ color: '#e9d5ff', fontVariantNumeric: 'tabular-nums' }}>{datosInterno?.matrixTotals?.documentacion || 0}</span>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', background: '#1e293b' }}>
                            <span className="t-title-section" style={{ color: '#38bdf8', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{datosInterno?.matrixGrandTotal || 0}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Card de Automatización y Envío de Correo */}
                <CardAutomatizacionCorreo
                  config={configInterno}
                  onChangeConfig={setConfigInterno}
                  onSave={() => handleSaveConfig('diario_interno')}
                  saving={savingConfig}
                  onOpenPreview={() => handleOpenPreview('diario_interno')}
                  onSendTest={() => handleSendTest('diario_interno')}
                  sendingTest={despachando}
                  onOpenHistorial={() => handleOpenHistorial('diario_interno')}
                  onOpenPersonalSelector={() => {
                    setTargetConfigForPersonal('interno')
                    setModalPersonalOpen(true)
                  }}
                  titulo="Envío Automático del Reporte Diario Interno"
                  subtitulo="Despacho nocturno (21:30 hrs) con el cuadro por equipos y el Excel con los códigos tocados"
                />
              </div>
            ) : (
              <TablaExcelDetalle
                columns={subtabInternoExcel === 'matriz' ? columnsInternoMatriz : columnsInternoDetalle}
                data={subtabInternoExcel === 'matriz' ? rowsInternoMatriz : rowsInternoDetalle}
                fileName={`Reporte_Interno_Observaciones_${fechaReporteInterno}.xlsx`}
                onDownload={handleDownloadInterno}
                downloading={downloadingReport === 'diario-interno'}
                subtabs={[
                  { id: 'matriz', label: 'Hoja 1: Matriz_Equipos' },
                  { id: 'detalle', label: 'Hoja 2: Detalle_Codigos' }
                ]}
                activeSubtab={subtabInternoExcel}
                onSubtabChange={setSubtabInternoExcel}
                sheetNotice="Previsualización de las pestañas del archivo Excel oficial del Reporte Diario Interno."
              />
            )
          )}

          {/* ======================================================== */}
          {/* CASO 3: REPORTE SEMANAL DE SUBSANACIÓN                  */}
          {/* ======================================================== */}
          {activeReport === 'semanal' && (
            vistaCara === 'frente' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: '#ffffff', border: '1px solid #d8e5f1', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h4 className="t-name" style={{ margin: 0, color: '#003060' }}>
                        Consolidado Semanal de Subsanación
                      </h4>
                      <span className="t-meta" style={{ color: '#64748b' }}>
                        {datosSemanal?.rangoSemanaStr ? `Semana ${datosSemanal.numeroSemana} · ${datosSemanal.rangoSemanaStr}` : 'Lunes a Domingo'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadSemanal}
                      disabled={downloadingReport === 'semanal'}
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Download size={14} />
                      <span>Descargar Excel Semanal</span>
                    </button>
                  </div>

                  {/* KPIs Semanales */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ background: '#f8fafc', border: '1.5px solid #003060', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#003060', margin: 0 }}>
                        {datosSemanal?.stats?.total ?? (loadingSemanal ? '...' : 0)}
                      </div>
                      <div className="t-badge" style={{ color: '#475569', marginTop: '2px' }}>Total Semana</div>
                    </div>

                    <div style={{ background: '#f0fdf4', border: '1.5px solid #22c55e', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#15803d', margin: 0 }}>
                        {datosSemanal?.stats?.validadas ?? 0}
                      </div>
                      <div className="t-badge" style={{ color: '#166534', marginTop: '2px' }}>✓ Validadas</div>
                    </div>

                    <div style={{ background: '#fff1f2', border: '1.5px solid #f43f5e', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#be123c', margin: 0 }}>
                        {datosSemanal?.stats?.rechazadas ?? 0}
                      </div>
                      <div className="t-badge" style={{ color: '#9f1239', marginTop: '2px' }}>✕ Rechazadas</div>
                    </div>

                    <div style={{ background: '#f0f9ff', border: '1.5px solid #0284c7', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div className="t-title-section" style={{ color: '#0369a1', margin: 0 }}>
                        {datosSemanal?.stats?.enEspera ?? 0}
                      </div>
                      <div className="t-badge" style={{ color: '#075985', marginTop: '2px' }}>⏳ En Espera</div>
                    </div>
                  </div>
                </div>

                <CardAutomatizacionCorreo
                  config={configSemanal}
                  onChangeConfig={setConfigSemanal}
                  onSave={() => handleSaveConfig('semanal')}
                  saving={savingConfig}
                  onOpenPreview={() => handleOpenPreview('semanal')}
                  onSendTest={() => handleSendTest('semanal')}
                  sendingTest={despachando}
                  onOpenHistorial={() => handleOpenHistorial('semanal')}
                  onOpenPersonalSelector={() => {
                    setTargetConfigForPersonal('semanal')
                    setModalPersonalOpen(true)
                  }}
                  titulo="Envío Automático del Reporte Semanal"
                  subtitulo="Despacho consolidado los días viernes a las 20:00 hrs con el resumen de la semana"
                />
              </div>
            ) : (
              <TablaExcelDetalle
                columns={columnsSemanal}
                data={rowsSemanal}
                fileName={`Reporte_Semanal_Observaciones_${datosSemanal?.numeroSemana || 'consolidado'}.xlsx`}
                onDownload={handleDownloadSemanal}
                downloading={downloadingReport === 'semanal'}
                sheetNotice="Previsualización de observaciones del consolidado semanal."
              />
            )
          )}

          {/* ======================================================== */}
          {/* CASO 4: PROGRAMACIÓN Y RUTAS DIARIAS                     */}
          {/* ======================================================== */}
          {activeReport === 'programacion' && (
            vistaCara === 'frente' ? (
              <div style={{ background: '#ffffff', border: '1px solid #d8e5f1', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h4 className="t-name" style={{ margin: 0, color: '#003060' }}>
                      Configuración de Programación Diaria
                    </h4>
                    <span className="t-meta" style={{ color: '#64748b' }}>
                      Generación bajo demanda con localidad contigua al sitio y notas de ruta
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadProgramacion}
                    disabled={downloadingReport === 'programacion'}
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={15} />
                    <span>Descargar Archivo Excel (.xlsx)</span>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label className="t-badge" style={{ color: '#003060' }}>Fecha de Programación:</label>
                    <input
                      type="date"
                      value={fechaProg}
                      onChange={e => setFechaProg(e.target.value)}
                      className="t-body"
                      style={{ padding: '0.45rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                  </div>

                  {puedeVerTecnico && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label className="t-badge" style={{ color: '#003060' }}>Columna Técnico Responsable:</label>
                      <button
                        type="button"
                        onClick={() => setMostrarTecnico(!mostrarTecnico)}
                        className="t-badge"
                        style={{
                          padding: '0.5rem 0.85rem',
                          borderRadius: '6px',
                          border: `1px solid ${mostrarTecnico ? '#86efac' : '#cbd5e1'}`,
                          background: mostrarTecnico ? '#f0fdf4' : '#ffffff',
                          color: mostrarTecnico ? '#15803d' : '#64748b',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Check size={14} />
                        <span>{mostrarTecnico ? 'Incluir Columna Técnico' : 'Omitir Columna Técnico'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {progPreviewData && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <span className="t-meta" style={{ color: '#1d4ed8' }}>
                      Sitios Programados: <strong>{progPreviewData.totalSitios || 0}</strong>
                    </span>
                    <span className="t-meta" style={{ color: '#1d4ed8' }}>
                      Cuadrillas Activas: <strong>{progPreviewData.totalCuadrillas || 0}</strong>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <TablaExcelDetalle
                columns={columnsProg}
                data={rowsProg}
                fileName={`Programacion_Diaria_${fechaProg}.xlsx`}
                onDownload={handleDownloadProgramacion}
                downloading={downloadingReport === 'programacion'}
                sheetNotice="Previsualización de rutas diarias con localidad contigua al código de sitio."
              />
            )
          )}

          {/* ======================================================== */}
          {/* CASO 5: CONSOLIDADO GENERAL (4,116 OBS)                  */}
          {/* ======================================================== */}
          {activeReport === 'general' && (
            vistaCara === 'frente' ? (
              <div style={{ background: '#ffffff', border: '1px solid #d8e5f1', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h4 className="t-name" style={{ margin: 0, color: '#003060' }}>
                      Consolidado General de Observaciones
                    </h4>
                    <span className="t-meta" style={{ color: '#64748b' }}>
                      Base de datos total (4,116 observaciones) con acuerdos y localidades
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadGeneral}
                    disabled={downloadingReport === 'general'}
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={15} />
                    <span>Descargar Base Completa (4,116 obs)</span>
                  </button>
                </div>

                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p className="t-body" style={{ margin: 0, color: '#334155' }}>
                    Esta descarga genera el archivo Excel consolidado de todas las observaciones registradas en el proyecto Amazonas. Incluye columnas oficiales de localidad contigua al código de sitio, acuerdos de subsanación y estados COVEPA y Gilat.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ background: '#ffffff', border: '1px solid #d8e5f1', borderRadius: '12px', padding: '2rem', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <Layers3 size={32} color="#003060" style={{ margin: '0 auto 0.75rem' }} />
                <h4 className="t-name" style={{ color: '#003060', margin: 0 }}>
                  Consolidado General (4,116 Observaciones)
                </h4>
                <p className="t-meta" style={{ color: '#64748b', maxWidth: '480px', margin: '0.35rem auto 1.25rem' }}>
                  Debido al volumen de la base completa de 4,116 registros, utiliza la descarga directa del archivo Excel (.xlsx) estructurado.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadGeneral}
                  disabled={downloadingReport === 'general'}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={15} />
                  <span>Descargar Archivo Excel Completo</span>
                </button>
              </div>
            )
          )}

          {/* ======================================================== */}
          {/* CASO 6: REPORTES POR CUADRILLA OPERATIVA                 */}
          {/* ======================================================== */}
          {activeReport === 'cuadrillas' && (
            <div style={{ background: '#ffffff', border: '1px solid #d8e5f1', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h4 className="t-name" style={{ margin: 0, color: '#003060' }}>
                    Reportes por Cuadrilla Operativa
                  </h4>
                  <span className="t-meta" style={{ color: '#64748b' }}>
                    Observaciones asignadas individualmente por cuadrilla
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {CUADRILLAS_CATALOGO.map(cuad => {
                  const isDownloading = downloadingReport === `cuadrilla-${cuad.code}`
                  return (
                    <div
                      key={cuad.id}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="t-name" style={{ color: '#003060' }}>{cuad.title}</span>
                          <span className="t-badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                            {cuad.baseCM}
                          </span>
                        </div>
                        <span className="t-meta" style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                          {cuad.sitios} sitios asignados · {cuad.zonas}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadCuadrilla(cuad)}
                        disabled={isDownloading}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        <span>{isDownloading ? 'Generando...' : `Descargar Excel ${cuad.title}`}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ======================================================== */}
      {/* MODALES AUXILIARES INTEGRADOS                            */}
      {/* ======================================================== */}

      {/* Modal Vista Previa HTML */}
      <ModalVistaPreviaCorreo
        isOpen={modalPreviewOpen}
        onClose={() => setModalPreviewOpen(false)}
        htmlContent={previewHtml}
        asunto={previewSubject}
        destinatarios={previewDestinatarios}
        destinatariosCC={previewDestinatariosCC}
        adjuntoNombre={previewAdjunto}
        onEnviarPrueba={() => handleSendTest(previewReportType)}
        despachando={despachando}
      />

      {/* Modal Selección de Personal */}
      <ModalSelectorPersonal
        isOpen={modalPersonalOpen}
        onClose={() => setModalPersonalOpen(false)}
        personalList={personalList}
        destinatariosPara={
          targetConfigForPersonal === 'interno'
            ? configInterno.destinatarios
            : (targetConfigForPersonal === 'semanal' ? configSemanal.destinatarios : configDiario.destinatarios)
        }
        destinatariosCC={
          targetConfigForPersonal === 'interno'
            ? configInterno.destinatarios_cc
            : (targetConfigForPersonal === 'semanal' ? configSemanal.destinatarios_cc : configDiario.destinatarios_cc)
        }
        onTogglePara={handleTogglePersonalPara}
        onToggleCC={handleTogglePersonalCC}
      />

      {/* Modal Historial de Envíos */}
      <ModalHistorialEnvios
        isOpen={modalHistorialOpen}
        onClose={() => setModalHistorialOpen(false)}
        historial={historialEnvios}
        loading={loadingHistorial}
        onRefrescar={() => handleOpenHistorial()}
        onLimpiarHoy={handleLimpiarHoy}
      />

    </div>
  )
}
