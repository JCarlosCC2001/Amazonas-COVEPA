import React, { useState, useEffect, useMemo, useContext, useRef } from 'react'
import { AuthContext } from '../context/AuthContext'
import {
  fetchConfiguracionReporte,
  saveConfiguracionReporte,
  fetchDatosReporteDiario,
  fetchDatosReporteSemanal,
  despacharReporteInmediato,
  despacharReporteSemanalInmediato,
  generarHTMLReporte,
  generarHTMLReporteSemanal,
  exportarExcelReporteDiario,
  exportarExcelReporteSemanal,
  DEFAULT_CONFIG_DIARIO,
  DEFAULT_CONFIG_SEMANAL
} from '../services/reportesCorreoService'
import { fetchPersonal, updatePersonal } from '../services/personalService'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Reportes() {
  const auth = useContext(AuthContext)
  const userEmail = auth?.user?.email || 'coordinador'

  // Navegación: 'HUB' | 'DIARIO' | 'SEMANAL'
  const [tipoVista, setTipoVista] = useState('HUB')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [despachando, setDespachando] = useState(false)
  const [refreshingData, setRefreshingData] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [toast, setToast] = useState(null)

  // Configuraciones separadas e independientes
  const [configDiario, setConfigDiario] = useState(DEFAULT_CONFIG_DIARIO)
  const [configSemanal, setConfigSemanal] = useState(DEFAULT_CONFIG_SEMANAL)

  // Datos en vivo para las vistas previas
  const [datosReporteDiario, setDatosReporteDiario] = useState(null)
  const [datosReporteSemanal, setDatosReporteSemanal] = useState(null)

  // Modal de Vista Previa del Correo (Ventana Emergente)
  const [modalPreviewOpen, setModalPreviewOpen] = useState(false)

  // Modal de Personal para Destinatarios (Para / CC)
  const [personalList, setPersonalList] = useState([])
  const [modalPersonalOpen, setModalPersonalOpen] = useState(false)
  const [busquedaPersonal, setBusquedaPersonal] = useState('')
  const [filtroCargo, setFiltroCargo] = useState('TODOS')

  // Menú de opciones (3 puntos ⋮) en cabecera
  const [menuOpcionesOpen, setMenuOpcionesOpen] = useState(false)
  const menuOpcionesRef = useRef(null)

  // Zona activa de arrastre para chips de correos ('para' | 'cc' | null)
  const [dragOverZone, setDragOverZone] = useState(null)

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuOpcionesRef.current && !menuOpcionesRef.current.contains(e.target)) {
        setMenuOpcionesOpen(false)
      }
    }
    if (menuOpcionesOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpcionesOpen])
  const [editingTarget, setEditingTarget] = useState(null)
  const [inputEmailPersona, setInputEmailPersona] = useState('')
  const [savingEmailPersona, setSavingEmailPersona] = useState(false)

  // Inputs temporales para chips de correos
  const [nuevoPara, setNuevoPara] = useState('')
  const [nuevoCC, setNuevoCC] = useState('')

  const toastTimerRef = useRef(null)

  const showNotification = (mensaje, tipo = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ mensaje, tipo })
    toastTimerRef.current = setTimeout(() => setToast(null), 4500)
  }

  // Carga inicial completa de configuraciones, observaciones y personal
  const cargarTodo = async () => {
    setLoading(true)
    try {
      const [cfgDiario, cfgSemanal, personal] = await Promise.all([
        fetchConfiguracionReporte('diario'),
        fetchConfiguracionReporte('semanal'),
        fetchPersonal()
      ])
      // Limpiar duplicados cruzados entre destinatarios y destinatarios_cc (exclusividad mutua)
      const limpiarExclusividad = (cfg) => {
        if (!cfg) return cfg
        const dest = (cfg.destinatarios || []).map(e => e.toLowerCase().trim())
        const destCC = (cfg.destinatarios_cc || []).map(e => e.toLowerCase().trim()).filter(e => !dest.includes(e))
        return { ...cfg, destinatarios: dest, destinatarios_cc: destCC }
      }
      setConfigDiario(limpiarExclusividad(cfgDiario))
      setConfigSemanal(limpiarExclusividad(cfgSemanal))
      setPersonalList(personal || [])

      // Cargar datos de observaciones de fondo
      const [datosDia, datosSem] = await Promise.all([
        fetchDatosReporteDiario(null, cfgDiario.periodo_reporte || 'dia_actual'),
        fetchDatosReporteSemanal(null, cfgSemanal.periodo_reporte || 'semana_actual')
      ])
      setDatosReporteDiario(datosDia)
      setDatosReporteSemanal(datosSem)
    } catch (err) {
      console.error('Error cargando módulo de reportes:', err)
      showNotification('Error al cargar la información de reportes.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarTodo()
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // Referencia a la configuración activa según la vista
  const configActual = tipoVista === 'SEMANAL' ? configSemanal : configDiario
  const setConfigActual = (updater) => {
    if (tipoVista === 'SEMANAL') {
      setConfigSemanal(updater)
    } else {
      setConfigDiario(updater)
    }
  }

  // Refrescar datos en vivo
  const handleRefrescarDatos = async () => {
    setRefreshingData(true)
    try {
      if (tipoVista === 'SEMANAL') {
        const datos = await fetchDatosReporteSemanal(null, configSemanal.periodo_reporte || 'semana_actual')
        setDatosReporteSemanal(datos)
        showNotification('Datos consolidados de la semana actualizados.', 'info')
      } else {
        const datos = await fetchDatosReporteDiario(null, configDiario.periodo_reporte || 'dia_actual')
        setDatosReporteDiario(datos)
        showNotification('Datos de observaciones del día actualizados.', 'info')
      }
    } catch (err) {
      console.error('Error refrescando datos:', err)
      showNotification('No se pudo refrescar los datos del reporte.', 'error')
    } finally {
      setRefreshingData(false)
    }
  }

  // Cambio de período (Diario: Día actual/anterior | Semanal: Semana actual/anterior)
  const handleCambiarPeriodo = async (nuevoPeriodo) => {
    if (configActual.periodo_reporte === nuevoPeriodo) return
    setConfigActual(prev => ({ ...prev, periodo_reporte: nuevoPeriodo }))
    setRefreshingData(true)
    try {
      if (tipoVista === 'SEMANAL') {
        const datos = await fetchDatosReporteSemanal(null, nuevoPeriodo)
        setDatosReporteSemanal(datos)
        showNotification(`Vista previa actualizada para ${nuevoPeriodo === 'semana_anterior' ? 'la semana anterior' : 'la semana en curso'}.`, 'info')
      } else {
        const datos = await fetchDatosReporteDiario(null, nuevoPeriodo)
        setDatosReporteDiario(datos)
        showNotification(`Vista previa actualizada para ${nuevoPeriodo === 'dia_anterior' ? 'el día anterior (Ayer)' : 'el día actual (Hoy)'}.`, 'info')
      }
    } catch (err) {
      console.error('Error cambiando período:', err)
      showNotification('Error al cargar datos del período: ' + err.message, 'error')
    } finally {
      setRefreshingData(false)
    }
  }

  // Descargar archivo Excel (.xlsx) correspondiente
  const handleDescargarExcel = async () => {
    setExportingExcel(true)
    try {
      if (tipoVista === 'SEMANAL') {
        if (!datosReporteSemanal) return
        await exportarExcelReporteSemanal(datosReporteSemanal)
        showNotification(`Descargando Reporte_Semanal_Observaciones_Semana_${datosReporteSemanal.numeroSemana || 'consolidado'}.xlsx`, 'success')
      } else {
        if (!datosReporteDiario) return
        await exportarExcelReporteDiario(datosReporteDiario)
        showNotification(`Descargando Reporte_Observaciones_${datosReporteDiario.fechaStr || 'jornada'}.xlsx`, 'success')
      }
    } catch (err) {
      console.error('Error descargando Excel:', err)
      showNotification('Error al exportar Excel: ' + err.message, 'error')
    } finally {
      setExportingExcel(false)
    }
  }

  // Despachar reporte de prueba
  const handleDespacharPrueba = async () => {
    if (despachando) return
    const destinatarioPrueba = (configActual.destinatario_prueba || '').trim()
    setDespachando(true)
    try {
      if (tipoVista === 'SEMANAL') {
        await despacharReporteSemanalInmediato({ forzar: true, destinatarioPrueba })
        showNotification(
          destinatarioPrueba 
            ? `¡Prueba de reporte semanal enviada a ${destinatarioPrueba}!` 
            : '¡Prueba de reporte semanal despachada! Llegará a tu correo en breve.', 
          'success'
        )
      } else {
        await despacharReporteInmediato({ forzar: true, destinatarioPrueba })
        showNotification(
          destinatarioPrueba 
            ? `¡Envío de prueba diario despachado exclusivamente a ${destinatarioPrueba}!` 
            : '¡Envío de prueba diario iniciado! Llegará a tu bandeja en unos segundos.', 
          'success'
        )
      }
    } catch (err) {
      console.error('Error despachando reporte:', err)
      showNotification('Error al despachar el reporte: ' + err.message, 'error')
    } finally {
      setDespachando(false)
    }
  }

  // Referencias para auto-guardado seguro al salir de la zona
  const configDiarioRef = useRef(configDiario)
  configDiarioRef.current = configDiario
  const configSemanalRef = useRef(configSemanal)
  configSemanalRef.current = configSemanal
  const tipoVistaRef = useRef(tipoVista)
  tipoVistaRef.current = tipoVista

  // Auto-guardar configuración al salir de la zona
  const guardarConfiguracionActual = async (silent = false) => {
    if (tipoVistaRef.current === 'HUB') return
    const tipo = tipoVistaRef.current === 'SEMANAL' ? 'semanal' : 'diario'
    const cfg = tipo === 'semanal' ? configSemanalRef.current : configDiarioRef.current
    if (!cfg || !cfg.destinatarios || cfg.destinatarios.length === 0) return
    setSaving(true)
    try {
      await saveConfiguracionReporte(cfg, userEmail, tipo)
      if (!silent) {
        showNotification(`Configuración guardada exitosamente.`, 'success')
      }
    } catch (err) {
      console.error('Error al guardar configuración al salir:', err)
      if (!silent) {
        showNotification('Error al guardar: ' + err.message, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleVolverAlHub = async () => {
    await guardarConfiguracionActual(false)
    setTipoVista('HUB')
  }

  // Guardar automáticamente al desmontar el componente o navegar a otra página
  useEffect(() => {
    return () => {
      if (tipoVistaRef.current !== 'HUB') {
        const tipo = tipoVistaRef.current === 'SEMANAL' ? 'semanal' : 'diario'
        const cfg = tipo === 'semanal' ? configSemanalRef.current : configDiarioRef.current
        if (cfg && cfg.destinatarios?.length > 0) {
          saveConfiguracionReporte(cfg, userEmail, tipo).catch(() => {})
        }
      }
    }
  }, [userEmail])

  // Mover destinatario entre Para y Copia mediante arrastre o acción (Exclusividad Mutua)
  const moverDestinatario = (email, destino) => {
    if (!email) return
    const norm = email.toLowerCase().trim()
    if (destino === 'para') {
      setConfigActual(prev => {
        if (prev.destinatarios.includes(norm)) return prev
        return {
          ...prev,
          destinatarios: [...prev.destinatarios, norm],
          destinatarios_cc: prev.destinatarios_cc.filter(e => e !== norm)
        }
      })
      showNotification(`"${norm}" movido a Para:`, 'info')
    } else if (destino === 'cc') {
      setConfigActual(prev => {
        if (prev.destinatarios_cc.includes(norm)) return prev
        return {
          ...prev,
          destinatarios_cc: [...prev.destinatarios_cc, norm],
          destinatarios: prev.destinatarios.filter(e => e !== norm)
        }
      })
      showNotification(`"${norm}" movido a Con Copia (CC:):`, 'info')
    }
  }

  // Manejo de chips de correos: Para (con exclusividad mutua)
  const agregarPara = () => {
    const val = (nuevoPara || '').trim().toLowerCase()
    if (!val) return
    if (!EMAIL_REGEX.test(val)) {
      showNotification(`El correo "${val}" no tiene un formato válido.`, 'error')
      return
    }
    if (configActual.destinatarios.includes(val)) {
      showNotification(`El correo "${val}" ya está en Para:.`, 'info')
      setNuevoPara('')
      return
    }
    // Si estaba en CC, se mueve a Para automáticamente
    setConfigActual(prev => ({
      ...prev,
      destinatarios: [...prev.destinatarios, val],
      destinatarios_cc: prev.destinatarios_cc.filter(e => e !== val)
    }))
    setNuevoPara('')
  }

  const removerPara = (emailAEliminar) => {
    setConfigActual(prev => ({
      ...prev,
      destinatarios: prev.destinatarios.filter(e => e !== emailAEliminar)
    }))
  }

  // Manejo de chips de correos: CC (con exclusividad mutua)
  const agregarCC = () => {
    const val = (nuevoCC || '').trim().toLowerCase()
    if (!val) return
    if (!EMAIL_REGEX.test(val)) {
      showNotification(`El correo "${val}" no tiene un formato válido.`, 'error')
      return
    }
    if (configActual.destinatarios_cc.includes(val)) {
      showNotification(`El correo "${val}" ya está en la lista de CC:.`, 'info')
      setNuevoCC('')
      return
    }
    // Si estaba en Para, se mueve a CC automáticamente
    setConfigActual(prev => ({
      ...prev,
      destinatarios_cc: [...prev.destinatarios_cc, val],
      destinatarios: prev.destinatarios.filter(e => e !== val)
    }))
    setNuevoCC('')
  }

  const removerCC = (emailAEliminar) => {
    setConfigActual(prev => ({
      ...prev,
      destinatarios_cc: prev.destinatarios_cc.filter(e => e !== emailAEliminar)
    }))
  }

  // Alternar destinatario desde modal de personal con exclusividad mutua
  const toggleDestinatarioPara = (email) => {
    if (!email) return
    const norm = email.toLowerCase().trim()
    setConfigActual(prev => {
      const exists = prev.destinatarios.includes(norm)
      return {
        ...prev,
        destinatarios: exists ? prev.destinatarios.filter(e => e !== norm) : [...prev.destinatarios, norm],
        destinatarios_cc: prev.destinatarios_cc.filter(e => e !== norm)
      }
    })
  }

  const toggleDestinatarioCC = (email) => {
    if (!email) return
    const norm = email.toLowerCase().trim()
    setConfigActual(prev => {
      const exists = prev.destinatarios_cc.includes(norm)
      return {
        ...prev,
        destinatarios_cc: exists ? prev.destinatarios_cc.filter(e => e !== norm) : [...prev.destinatarios_cc, norm],
        destinatarios: prev.destinatarios.filter(e => e !== norm)
      }
    })
  }

  // Iniciar / Cancelar / Guardar edición de correo de personal en BD
  const iniciarEdicionCorreo = (personId, field, valorActual) => {
    setEditingTarget({ personId, field })
    setInputEmailPersona(valorActual || '')
  }

  const cancelarEdicionCorreo = () => {
    setEditingTarget(null)
    setInputEmailPersona('')
  }

  const handleGuardarEmailPersona = async (personId, field) => {
    const emailVal = (inputEmailPersona || '').trim().toLowerCase()
    if (!emailVal || !EMAIL_REGEX.test(emailVal)) {
      showNotification('Ingresa un correo electrónico válido.', 'error')
      return
    }

    setSavingEmailPersona(true)
    try {
      await updatePersonal(personId, { [field]: emailVal })
      setPersonalList(prev => prev.map(p => p.id === personId ? { ...p, [field]: emailVal } : p))
      const label = field === 'email' ? 'Correo 1 (Principal)' : 'Correo 2 (Secundario)'
      showNotification(`${label} guardado exitosamente en la base de datos.`, 'success')
      cancelarEdicionCorreo()
    } catch (err) {
      console.error('Error guardando correo en personal:', err)
      showNotification('Error al guardar correo: ' + err.message, 'error')
    } finally {
      setSavingEmailPersona(false)
    }
  }

  // Filtrado de personal en el modal
  const personalFiltrado = useMemo(() => {
    return personalList.filter(p => {
      if (filtroCargo !== 'TODOS') {
        const c = (p.cargo || '').toUpperCase()
        if (filtroCargo === 'TÉCNICO' && !c.includes('TÉCN') && !c.includes('TECN')) return false
        if (filtroCargo === 'CONDUCTOR' && !c.includes('COND')) return false
        if (filtroCargo === 'SUPERVISOR' && !c.includes('SUPER')) return false
      }
      if (busquedaPersonal) {
        const q = busquedaPersonal.toLowerCase()
        const matchName = (p.nombre_completo || '').toLowerCase().includes(q)
        const matchEmail1 = (p.email || '').toLowerCase().includes(q)
        const matchEmail2 = (p.email_2 || '').toLowerCase().includes(q)
        const matchCargo = (p.cargo || '').toLowerCase().includes(q)
        const matchCuad = (p.cuadrilla || '').toLowerCase().includes(q)
        if (!matchName && !matchEmail1 && !matchEmail2 && !matchCargo && !matchCuad) return false
      }
      return true
    })
  }, [personalList, filtroCargo, busquedaPersonal])

  // Obtener nombre oficial asociado a un correo para visualización amigable
  const getNombreDestinatario = (email) => {
    if (!email) return ''
    const clean = email.toLowerCase().trim()
    const found = personalList.find(p => 
      (p.email && p.email.toLowerCase().trim() === clean) ||
      (p.email_2 && p.email_2.toLowerCase().trim() === clean)
    )
    if (found?.nombre_completo) return found.nombre_completo
    const CONOCIDOS = {
      'ccondor@covepa.pe': 'Carlos Condor',
      'ksedano@covepa.pe': 'Katherine Sedano',
      'hventocilla@covepa.pe': 'Higinio Ventocilla',
      'mventocilla@covepa.pe': 'Manuel Ventocilla',
      'projas@covepa.pe': 'Percy Rojas',
      'wavila@covepa.pe': 'William Avila',
      'crivera@covepa.pe': 'Cristhian Rivera',
      'jhospina@covepa.pe': 'Jhon Hospina',
      'mchavez@covepa.pe': 'Milton Chavez',
      'jcarloscc1101@gmail.com': 'Carlos Condor'
    }
    return CONOCIDOS[clean] || null
  }

  // HTML generado para el correo de ejemplo
  const previewHtml = useMemo(() => {
    if (tipoVista === 'SEMANAL') {
      if (!datosReporteSemanal) return '<p style="padding:20px;font-family:sans-serif;">Cargando vista previa semanal...</p>'
      try {
        return generarHTMLReporteSemanal({ config: configSemanal, datos: datosReporteSemanal })
      } catch (e) {
        return `<p style="padding:20px;color:red;font-family:sans-serif;">Error al generar vista previa semanal: ${e.message}</p>`
      }
    } else {
      if (!datosReporteDiario) return '<p style="padding:20px;font-family:sans-serif;">Cargando vista previa diaria...</p>'
      try {
        return generarHTMLReporte({ config: configDiario, datos: datosReporteDiario })
      } catch (e) {
        return `<p style="padding:20px;color:red;font-family:sans-serif;">Error al generar vista previa diaria: ${e.message}</p>`
      }
    }
  }, [tipoVista, configDiario, configSemanal, datosReporteDiario, datosReporteSemanal])

  // Asunto procesado para la cabecera
  const asuntoRenderizado = useMemo(() => {
    if (tipoVista === 'SEMANAL') {
      const sem = datosReporteSemanal?.numeroSemana ? String(datosReporteSemanal.numeroSemana) : 'Semana'
      const base = configSemanal.asunto || '[COVEPA] Reporte Semanal de Levantamiento de Observaciones Amazonas - {semana}'
      return base.includes('{semana}') ? base.replace('{semana}', sem) : base
    } else {
      const fecha = datosReporteDiario?.fechaFormateada || 'Hoy'
      const base = configDiario.asunto || '[COVEPA] Reporte Diario de Observaciones - {fecha}'
      return base.includes('{fecha}') ? base.replace('{fecha}', fecha) : base
    }
  }, [tipoVista, configDiario.asunto, configSemanal.asunto, datosReporteDiario, datosReporteSemanal])

  if (loading) {
    return (
      <div className="reportes-container">
        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="t-name">Cargando módulo de reportes automáticos...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="reportes-container">
      {/* Toast de notificación */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            backgroundColor: toast.tipo === 'error' ? '#fee2e2' : toast.tipo === 'info' ? '#e0f2fe' : '#dcfce7',
            color: toast.tipo === 'error' ? '#991b1b' : toast.tipo === 'info' ? '#0369a1' : '#166534',
            border: `1px solid ${toast.tipo === 'error' ? '#fca5a5' : toast.tipo === 'info' ? '#7dd3fc' : '#86efac'}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            animation: 'fadeIn 0.25s ease'
          }}
        >
          <span className="t-body" style={{ fontWeight: 'var(--fw-semibold)' }}>
            {toast.tipo === 'error' ? '❌' : toast.tipo === 'info' ? 'ℹ️' : '✅'} {toast.mensaje}
          </span>
          <button
            onClick={() => setToast(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '0 0.25rem',
              fontWeight: 'var(--fw-bold)'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         VISTA 1: HUB DE SELECCIÓN (REPORTE DIARIO VS SEMANAL)
         ══════════════════════════════════════════════════════════ */}
      {tipoVista === 'HUB' && (
        <>
          <header className="reportes-header">
            <div className="reportes-title-group">
              <h1 className="reportes-main-title t-title-page">
                <span>📧</span> Módulo de Reportes Automáticos por Correo
              </h1>
              <p className="reportes-subtitle t-subtitle">
                Selecciona el tipo de informe que deseas parametrizar y despachar automáticamente desde <code>ccondor@covepa.pe</code>.
              </p>
            </div>
          </header>

          <div className="reportes-hub-grid">
            {/* Tarjeta 1: Reporte Diario */}
            <div className="reporte-hub-card" onClick={() => setTipoVista('DIARIO')}>
              <div className="reporte-hub-card-top">
                <div className="reporte-hub-icon-wrap">
                  <span>📅</span>
                </div>
                <span
                  className={`t-badge ${configDiario.activo ? 'badge-activo' : 'badge-pausado'}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '12px',
                    background: configDiario.activo ? '#dcfce7' : '#fee2e2',
                    color: configDiario.activo ? '#15803d' : '#b91c1c',
                    border: `1px solid ${configDiario.activo ? '#86efac' : '#fca5a5'}`
                  }}
                >
                  <span className="t-caption" style={{ lineHeight: 1 }}>●</span>
                  {configDiario.activo ? 'Envío Activo' : 'Envío Pausado'}
                </span>
              </div>
              <div className="reporte-hub-card-content">
                <h2 className="reporte-hub-card-title t-title-section">Reporte Diario</h2>
                <p className="reporte-hub-card-desc t-body">
                  Despacho nocturno del consolidado diario de observaciones por correo con archivo Excel adjunto (.xlsx), métricas de avance y lista de códigos trabajados en la jornada.
                </p>
              </div>
              <div className="reporte-hub-card-meta">
                <div className="reporte-hub-meta-item">
                  <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>Frecuencia:</span>
                  <span className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                    Diario · {configDiario.hora_envio || '21:00'} hrs
                  </span>
                </div>
                <div className="reporte-hub-meta-item">
                  <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>Destinatarios:</span>
                  <span className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                    {configDiario.destinatarios?.length || 0} en Para {configDiario.destinatarios_cc?.length > 0 ? `· ${configDiario.destinatarios_cc.length} en CC` : ''}
                  </span>
                </div>
                <div className="reporte-hub-meta-item">
                  <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>Período predeterminado:</span>
                  <span className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                    {configDiario.periodo_reporte === 'dia_anterior' ? 'Día anterior (Ayer)' : 'Día actual (Hoy)'}
                  </span>
                </div>
              </div>
              <button type="button" className="btn-reporte-hub-action">
                <span>Configurar Reporte Diario</span>
                <span>→</span>
              </button>
            </div>

            {/* Tarjeta 2: Reporte Semanal */}
            <div className="reporte-hub-card" onClick={() => setTipoVista('SEMANAL')}>
              <div className="reporte-hub-card-top">
                <div className="reporte-hub-icon-wrap" style={{ background: '#003060', color: '#ffffff', borderColor: '#002244' }}>
                  <span>📊</span>
                </div>
                <span
                  className={`t-badge ${configSemanal.activo ? 'badge-activo' : 'badge-pausado'}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '12px',
                    background: configSemanal.activo ? '#dcfce7' : '#fee2e2',
                    color: configSemanal.activo ? '#15803d' : '#b91c1c',
                    border: `1px solid ${configSemanal.activo ? '#86efac' : '#fca5a5'}`
                  }}
                >
                  <span className="t-caption" style={{ lineHeight: 1 }}>●</span>
                  {configSemanal.activo ? 'Envío Activo' : 'Envío Pausado'}
                </span>
              </div>
              <div className="reporte-hub-card-content">
                <h2 className="reporte-hub-card-title t-title-section">Reporte Semanal</h2>
                <p className="reporte-hub-card-desc t-body">
                  Resumen consolidado semanal de Lunes a Domingo, desglose día por día, métricas generales de avance acumulado y archivo Excel con pestañas analíticas.
                </p>
              </div>
              <div className="reporte-hub-card-meta">
                <div className="reporte-hub-meta-item">
                  <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>Frecuencia:</span>
                  <span className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                    Semanal · {configSemanal.dia_semana_envio === '7' ? 'Domingos' : configSemanal.dia_semana_envio === '6' ? 'Sábados' : 'Viernes'} ({configSemanal.hora_envio || '20:00'} hrs)
                  </span>
                </div>
                <div className="reporte-hub-meta-item">
                  <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>Destinatarios:</span>
                  <span className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                    {configSemanal.destinatarios?.length || 0} en Para {configSemanal.destinatarios_cc?.length > 0 ? `· ${configSemanal.destinatarios_cc.length} en CC` : ''}
                  </span>
                </div>
                <div className="reporte-hub-meta-item">
                  <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>Período predeterminado:</span>
                  <span className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                    {configSemanal.periodo_reporte === 'semana_anterior' ? 'Semana anterior' : 'Semana en curso'}
                  </span>
                </div>
              </div>
              <button type="button" className="btn-reporte-hub-action">
                <span>Configurar Reporte Semanal</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
         VISTA 2 Y 3: FORMULARIO DE CONFIGURACIÓN (DIARIO O SEMANAL)
         ══════════════════════════════════════════════════════════ */}
      {tipoVista !== 'HUB' && (
        <>
          {/* Barra de Navegación Superior */}
          <div>
            <button
              type="button"
              className="btn-back-hub"
              onClick={handleVolverAlHub}
            >
              <span>← Volver a Selección de Reportes</span>
            </button>
          </div>

          {/* Cabecera Principal */}
          <header className="reportes-header">
            <div className="reportes-title-group">
              <h1 className="reportes-main-title t-title-page">
                <span>{tipoVista === 'SEMANAL' ? '📊' : '📧'}</span>
                <span>{tipoVista === 'SEMANAL' ? 'Reporte Semanal Consolidado por Correo' : 'Reporte Diario Automático por Correo'}</span>
              </h1>
              <p className="reportes-subtitle t-subtitle">
                {tipoVista === 'SEMANAL'
                  ? 'En esta zona se configurará el reporte semanal consolidado por correo.'
                  : 'En esta zona se configurará el reporte diario automático por correo.'}
              </p>
            </div>

            {/* Menú de opciones de 3 puntos (⋮) */}
            <div ref={menuOpcionesRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setMenuOpcionesOpen(prev => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#003060',
                  cursor: 'pointer',
                  fontWeight: 'var(--fw-bold)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.15s ease'
                }}
                className="t-name"
                title="Más opciones de reporte"
                aria-label="Más opciones"
              >
                <span>⋮</span>
              </button>

              {menuOpcionesOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 100,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                    minWidth: '240px',
                    padding: '0.45rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    animation: 'fadeIn 0.15s ease'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpcionesOpen(false)
                      setModalPreviewOpen(true)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      background: 'none',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: '#003060',
                      transition: 'background 0.15s'
                    }}
                    className="t-body"
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span>👁️</span>
                    <span>Vista Previa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpcionesOpen(false)
                      handleDescargarExcel()
                    }}
                    disabled={exportingExcel}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      background: 'none',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: exportingExcel ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      color: '#003060',
                      transition: 'background 0.15s'
                    }}
                    className="t-body"
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span>📊</span>
                    <span>{exportingExcel ? 'Descargando...' : 'Descargar Excel'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpcionesOpen(false)
                      handleDespacharPrueba()
                    }}
                    disabled={despachando || saving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      background: 'none',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: despachando ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      color: '#003060',
                      transition: 'background 0.15s'
                    }}
                    className="t-body"
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span>{despachando ? '⏳' : '🚀'}</span>
                    <span>{despachando ? 'Enviando...' : 'Enviar Reporte de Prueba'}</span>
                  </button>

                  <a
                    href="https://console.cron-job.org/jobs"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpcionesOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      color: '#003060',
                      transition: 'background 0.15s',
                      boxSizing: 'border-box'
                    }}
                    className="t-body"
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span>⏰</span>
                    <span>Configurar Hora ↗</span>
                  </a>

                  <div style={{ height: '1px', background: '#e2e8f0', margin: '0.25rem 0' }} />

                  <a
                    href="https://github.com/JCarlosCC2001/Amazonas-COVEPA/actions/workflows/reporte-diario.yml"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpcionesOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      color: '#475569',
                      transition: 'background 0.15s',
                      boxSizing: 'border-box'
                    }}
                    className="t-caption"
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    title="Ver consola de ejecución y disparar despacho manual en GitHub"
                  >
                    <span>⚙️</span>
                    <span>Ver en GitHub Actions ↗</span>
                  </a>
                </div>
              )}
            </div>
          </header>

          {/* Tarjeta de Configuración de Reporte (Reorganizada y Optimizada) */}
          <div className="reporte-card" style={{ maxWidth: '1060px', margin: '0 auto', width: '100%', padding: '1.25rem 1.5rem', gap: '1rem' }}>
            {/* Cabecera de la Tarjeta con Switch Arriba (Sin texto de configuración) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '0.75rem',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span className="t-name" style={{ color: '#003060', fontWeight: 'var(--fw-bold)' }}>
                  Estado del Envío Automático
                </span>
                <span
                  className="t-meta"
                  style={{
                    color: configActual.activo ? '#166534' : '#991b1b',
                    background: configActual.activo ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${configActual.activo ? '#bbf7d0' : '#fecaca'}`,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '12px',
                    fontWeight: 'var(--fw-medium)'
                  }}
                >
                  {configActual.activo ? '● Programación activa' : '○ Programación pausada'}
                </span>
              </div>

              <button
                type="button"
                className={`reporte-switch-btn ${configActual.activo ? 'active' : 'paused'}`}
                onClick={() => setConfigActual(prev => ({ ...prev, activo: !prev.activo }))}
                title={configActual.activo ? 'Pausar el envío automático' : 'Activar el envío automático'}
              >
                <span>{configActual.activo ? '✅ ACTIVO' : '⏸️ PAUSADO'}</span>
              </button>
            </div>

            {/* Fila 1: Asunto del Correo (Primera fila de arriba) */}
            <div className="reporte-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="reporte-label" htmlFor="asunto_input">
                  <span>🏷️</span> Asunto del Correo
                </label>
                <span className="t-caption">
                  {tipoVista === 'SEMANAL' ? '{semana} dinámica' : '{fecha} dinámica'}
                </span>
              </div>
              <input
                id="asunto_input"
                type="text"
                className="reporte-input"
                value={configActual.asunto}
                onChange={e => setConfigActual(prev => ({ ...prev, asunto: e.target.value }))}
                placeholder="Asunto oficial del reporte..."
              />
            </div>

            {/* Fila 2: Remitente Autorizado (Debajo de este en la otra fila, no modificable) */}
            <div className="reporte-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="reporte-label">
                  <span>📤</span> Remitente Autorizado
                </label>
                <span className="t-caption" style={{ color: '#166534', fontWeight: 'var(--fw-medium)' }}>
                  ✓ Servidor SMTP Covepa (mail.covepa.pe · Puerto 465 SSL)
                </span>
              </div>
              <input
                type="text"
                readOnly
                disabled
                className="reporte-input"
                value="ccondor@covepa.pe (Servidor SMTP mail.covepa.pe)"
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  fontWeight: 'var(--fw-semibold)',
                  cursor: 'not-allowed',
                  border: '1px solid #cbd5e1'
                }}
                title="Este remitente está preconfigurado en el servidor y no puede modificarse"
              />
            </div>

            {/* Fila 3: Recuadro de Destinatarios (Dividido en Para y Copia) */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.45rem' }}>
                <span className="t-name" style={{ color: '#003060', fontWeight: 'var(--fw-bold)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>👥</span> Destinatarios del Reporte
                </span>
                <span className="t-caption">
                  Configura los correos principales y de copia
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', alignItems: 'flex-start' }}>
                {/* Columna Para: (Zona de recepción Droppable) */}
                <div className="reporte-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <label className="reporte-label">
                      <span>Para:</span>
                    </label>
                    <button
                      type="button"
                      className="btn-open-personal"
                      onClick={() => setModalPersonalOpen(true)}
                    >
                      <span>👥</span>
                      <span>Seleccionar Personal</span>
                    </button>
                  </div>
                  <div
                    className="reporte-chips-wrap"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (dragOverZone !== 'para') setDragOverZone('para')
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget)) return
                      setDragOverZone(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOverZone(null)
                      const email = e.dataTransfer.getData('text/plain')
                      if (email) moverDestinatario(email, 'para')
                    }}
                    style={{
                      minHeight: '44px',
                      maxHeight: '110px',
                      overflowY: 'auto',
                      background: dragOverZone === 'para' ? '#eff6ff' : '#ffffff',
                      border: dragOverZone === 'para' ? '2px dashed #0284c7' : '1px solid var(--border)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {configActual.destinatarios.map(email => {
                      const nombre = getNombreDestinatario(email)
                      return (
                        <span
                          key={email}
                          className="reporte-email-chip"
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', email)
                            e.dataTransfer.setData('sourceZone', 'para')
                          }}
                          style={{ cursor: 'grab', userSelect: 'none' }}
                          title={`Arrastra este correo a 'Con Copia' para moverlo (${email})`}
                        >
                          <span style={{ opacity: 0.45, marginRight: '2px', cursor: 'grab' }}>⠿</span>
                          <span>{nombre ? `${nombre} · ${email}` : email}</span>
                          <button
                            type="button"
                            className="reporte-chip-remove"
                            onClick={() => removerPara(email)}
                            title="Remover correo"
                          >
                            ✕
                          </button>
                        </span>
                      )
                    })}
                    <input
                      type="email"
                      className="reporte-chip-input"
                      placeholder="Escribe un correo y pulsa Enter..."
                      value={nuevoPara}
                      onChange={e => setNuevoPara(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          agregarPara()
                        }
                      }}
                      onBlur={agregarPara}
                    />
                  </div>
                  <span className="t-caption">
                    Reciben directamente el informe y archivo Excel adjunto.
                  </span>
                </div>

                {/* Columna Copia (CC:): (Zona de recepción Droppable) */}
                <div className="reporte-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <label className="reporte-label">
                      <span>Con Copia (CC:):</span>
                    </label>
                    <button
                      type="button"
                      className="btn-open-personal"
                      onClick={() => setModalPersonalOpen(true)}
                    >
                      <span>👥</span>
                      <span>Seleccionar Personal</span>
                    </button>
                  </div>
                  <div
                    className="reporte-chips-wrap"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (dragOverZone !== 'cc') setDragOverZone('cc')
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget)) return
                      setDragOverZone(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOverZone(null)
                      const email = e.dataTransfer.getData('text/plain')
                      if (email) moverDestinatario(email, 'cc')
                    }}
                    style={{
                      minHeight: '44px',
                      maxHeight: '110px',
                      overflowY: 'auto',
                      background: dragOverZone === 'cc' ? '#eff6ff' : '#ffffff',
                      border: dragOverZone === 'cc' ? '2px dashed #0284c7' : '1px solid var(--border)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {configActual.destinatarios_cc.map(email => {
                      const nombre = getNombreDestinatario(email)
                      return (
                        <span
                          key={email}
                          className="reporte-email-chip"
                          style={{ background: '#f1f5f9', borderColor: '#cbd5e1', color: '#334155', cursor: 'grab', userSelect: 'none' }}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', email)
                            e.dataTransfer.setData('sourceZone', 'cc')
                          }}
                          title={`Arrastra este correo a 'Para:' para moverlo (${email})`}
                        >
                          <span style={{ opacity: 0.45, marginRight: '2px', cursor: 'grab' }}>⠿</span>
                          <span>{nombre ? `${nombre} · ${email}` : email}</span>
                          <button
                            type="button"
                            className="reporte-chip-remove"
                            onClick={() => removerCC(email)}
                            title="Remover correo"
                          >
                            ✕
                          </button>
                        </span>
                      )
                    })}
                    <input
                      type="email"
                      className="reporte-chip-input"
                      placeholder="Escribe un correo de copia..."
                      value={nuevoCC}
                      onChange={e => setNuevoCC(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          agregarCC()
                        }
                      }}
                      onBlur={agregarCC}
                    />
                  </div>
                  <span className="t-caption">
                    Opcional. Reciben copia visible informativa.
                  </span>
                </div>
              </div>

              {/* Indicador de Ayuda de Arrastre y Exclusividad */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.45rem', borderTop: '1px dashed #e2e8f0' }}>
                <span className="t-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>✋</span>
                  <span>Puedes <strong>arrastrar los correos</strong> entre Para y Copia para cambiarlos de lista al instante.</span>
                </span>
                <span className="t-caption" style={{ color: '#0369a1', fontWeight: 'var(--fw-medium)' }}>
                  ✓ Exclusividad mutua activa (nunca en ambos)
                </span>
              </div>
            </div>

            {/* Fila 4: Comentarios (Un cuadro de texto un poco más alto) */}
            <div className="reporte-form-group">
              <label className="reporte-label" htmlFor="notas_input">
                <span>💬</span> {tipoVista === 'SEMANAL' ? 'Comentarios y Conclusiones de la Semana (Opcional)' : 'Comentarios u Observaciones de la Jornada (Opcional)'}
              </label>
              <textarea
                id="notas_input"
                rows={4}
                className="reporte-textarea"
                placeholder={tipoVista === 'SEMANAL'
                  ? 'Escribe acuerdos de cierre semanal, hitos alcanzados, contingencias de ruta...'
                  : 'Escribe acuerdos de la jornada, contingencias o comentarios especiales...'}
                value={configActual.notas_jornada}
                onChange={e => setConfigActual(prev => ({ ...prev, notas_jornada: e.target.value }))}
                style={{ minHeight: '85px', resize: 'vertical' }}
              />
              <span className="t-caption">
                Se incluye en el cuerpo del correo antes de la firma institucional. Si se deja vacío, no aparecerá.
              </span>
            </div>

            {/* Fila 5: Destinatario Exclusivo para Correo de Prueba */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.45rem' }}>
                <span className="t-name" style={{ color: '#003060', fontWeight: 'var(--fw-bold)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🧪</span> Destinatario para Correo de Prueba
                </span>
                <span className="t-badge" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '12px', fontWeight: 'var(--fw-semibold)' }}>
                  ✓ No contabiliza en el reporte diario
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  id="destinatario_prueba_input"
                  type="email"
                  className="reporte-input"
                  placeholder="ejemplo@covepa.pe o tu-correo@gmail.com"
                  value={configActual.destinatario_prueba || ''}
                  onChange={e => setConfigActual(prev => ({ ...prev, destinatario_prueba: e.target.value }))}
                  style={{ flex: '1 1 260px' }}
                />
                <button
                  type="button"
                  onClick={handleDespacharPrueba}
                  disabled={despachando}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.55rem 1.15rem',
                    background: despachando ? '#64748b' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: despachando ? 'not-allowed' : 'pointer',
                    fontWeight: 'var(--fw-semibold)',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                  className="t-meta"
                  title="Despachar correo de prueba únicamente a esta dirección"
                >
                  <span>{despachando ? '⏳' : '🚀'}</span>
                  <span>{despachando ? 'Despachando...' : 'Enviar Prueba'}</span>
                </button>
              </div>

              <span className="t-caption">
                Al enviar una prueba, el correo se dirigirá <strong>únicamente a esta dirección</strong> (sin enviar a los destinatarios principales ni con copia). No incrementa el contador de envíos del día, por lo que el despacho automático nocturno se ejecutará con normalidad.
              </span>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
         VENTANA EMERGENTE (MODAL): VISTA PREVIA DEL CORREO DE EJEMPLO
         ══════════════════════════════════════════════════════════ */}
      {modalPreviewOpen && (
        <div className="reporte-modal-overlay" onClick={() => setModalPreviewOpen(false)}>
          <div className="modal-preview-correo-dialog" onClick={e => e.stopPropagation()}>
            {/* Header del Modal */}
            <div className="modal-preview-header">
              <div className="modal-preview-title-wrap">
                <span className="t-title-page">👁️</span>
                <div>
                  <h3 className="t-title-section" style={{ margin: 0, color: '#003060' }}>
                    Vista Previa del Correo Oficial ({tipoVista === 'SEMANAL' ? 'Reporte Semanal' : 'Reporte Diario'})
                  </h3>
                  <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>
                    Simulación exacta de renderizado compatible con Outlook, Gmail y dispositivos móviles.
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleDescargarExcel}
                  disabled={exportingExcel}
                  className="btn-preview-tool"
                  title="Descargar archivo Excel oficial (.xlsx) que irá adjunto"
                >
                  <span>📊</span>
                  <span>{exportingExcel ? 'Generando...' : 'Descargar Excel Adjunto'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRefrescarDatos}
                  disabled={refreshingData}
                  className="btn-preview-tool"
                  title="Recargar observaciones en vivo"
                >
                  <span>🔄</span>
                  <span>{refreshingData ? 'Actualizando...' : 'Recargar Datos'}</span>
                </button>
                <button
                  type="button"
                  className="reporte-modal-close"
                  onClick={() => setModalPreviewOpen(false)}
                  title="Cerrar ventana emergente"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Cabecera del Visor de Correo con Metadatos */}
            <div className="email-sim-header">
              <div className="email-sim-meta-row">
                <span className="email-sim-meta-label">De:</span>
                <span className="email-sim-meta-val" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                  Carlos Cóndor &lt;ccondor@covepa.pe&gt;
                </span>
              </div>
              <div className="email-sim-meta-row">
                <span className="email-sim-meta-label">Para:</span>
                <span className="email-sim-meta-val">
                  {configActual.destinatarios?.length > 0 ? configActual.destinatarios.join(', ') : '(Sin destinatarios configurados)'}
                </span>
              </div>
              {configActual.destinatarios_cc?.length > 0 && (
                <div className="email-sim-meta-row">
                  <span className="email-sim-meta-label">CC:</span>
                  <span className="email-sim-meta-val">
                    {configActual.destinatarios_cc.join(', ')}
                  </span>
                </div>
              )}
              <div className="email-sim-meta-row">
                <span className="email-sim-meta-label">Asunto:</span>
                <span className="email-sim-meta-val" style={{ fontWeight: 'var(--fw-bold)', color: '#0f172a' }}>
                  {asuntoRenderizado}
                </span>
              </div>
              <div className="email-sim-meta-row">
                <span className="email-sim-meta-label">Adjunto:</span>
                <span className="email-sim-meta-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span
                    className="t-badge"
                    style={{
                      background: '#f0f9ff',
                      color: '#003060',
                      border: '1px solid #bae6fd',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      fontWeight: 'var(--fw-semibold)'
                    }}
                  >
                    📎 {tipoVista === 'SEMANAL'
                      ? `Reporte_Semanal_Observaciones_Semana_${datosReporteSemanal?.numeroSemana || 'consolidado'}.xlsx (ID · Zona · Código · Localidad · Revisor · Estado)`
                      : `Reporte_Observaciones_${datosReporteDiario?.fechaStr || 'jornada'}.xlsx (ID · Zona · Código · Localidad · Revisor · Estado)`}
                  </span>
                </span>
              </div>
            </div>

            {/* Cuerpo del correo renderizado de forma aislada en iframe */}
            <div className="modal-preview-body">
              <iframe
                title="Vista previa del correo de reporte"
                srcDoc={previewHtml}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '480px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>

            {/* Pie del Modal con acciones */}
            <div className="modal-preview-footer">
              <button
                type="button"
                onClick={handleDespacharPrueba}
                disabled={despachando}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 1rem',
                  background: despachando ? '#64748b' : '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: despachando ? 'not-allowed' : 'pointer',
                  fontWeight: 'var(--fw-semibold)'
                }}
                className="t-meta"
              >
                <span>{despachando ? '⏳' : '🚀'}</span>
                <span>{despachando ? 'Despachando...' : 'Enviar Reporte de Prueba'}</span>
              </button>

              <button
                type="button"
                className="btn-reporte-save"
                style={{ padding: '0.5rem 1.25rem' }}
                onClick={() => setModalPreviewOpen(false)}
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         MODAL: SELECCIONAR DESTINATARIOS DESDE PERSONAL (2 CORREOS)
         ══════════════════════════════════════════════════════════ */}
      {modalPersonalOpen && (
        <div className="reporte-modal-overlay" onClick={() => setModalPersonalOpen(false)}>
          <div className="reporte-modal-content" onClick={e => e.stopPropagation()}>
            <div className="reporte-modal-header">
              <h3 className="reporte-modal-title">
                <span>👥</span> Seleccionar Destinatarios desde Personal
              </h3>
              <button
                type="button"
                className="reporte-modal-close"
                onClick={() => setModalPersonalOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Buscador y Filtros Rápidos */}
            <div className="reporte-modal-controls">
              <input
                type="text"
                className="reporte-modal-search"
                placeholder="Buscar por nombre, cargo, cuadrilla o correo..."
                value={busquedaPersonal}
                onChange={e => setBusquedaPersonal(e.target.value)}
                autoFocus
              />
              <div className="reporte-filter-tabs">
                {['TODOS', 'SUPERVISOR', 'TÉCNICO', 'CONDUCTOR'].map(cargo => (
                  <button
                    key={cargo}
                    type="button"
                    className={`reporte-tab-btn ${filtroCargo === cargo ? 'active' : ''}`}
                    onClick={() => setFiltroCargo(cargo)}
                  >
                    {cargo}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Personal con soporte para 2 Correos */}
            <div className="reporte-modal-list">
              {personalFiltrado.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                  <span className="t-meta">No se encontraron integrantes que coincidan con la búsqueda.</span>
                </div>
              ) : (
                personalFiltrado.map(p => {
                  const hasEmail1 = Boolean(p.email)
                  const hasEmail2 = Boolean(p.email_2)

                  const isPara1 = hasEmail1 && configActual.destinatarios.includes(p.email.toLowerCase())
                  const isCC1 = hasEmail1 && configActual.destinatarios_cc.includes(p.email.toLowerCase())

                  const isPara2 = hasEmail2 && configActual.destinatarios.includes(p.email_2.toLowerCase())
                  const isCC2 = hasEmail2 && configActual.destinatarios_cc.includes(p.email_2.toLowerCase())

                  const isEditing1 = editingTarget?.personId === p.id && editingTarget?.field === 'email'
                  const isEditing2 = editingTarget?.personId === p.id && editingTarget?.field === 'email_2'

                  return (
                    <div key={p.id} className="reporte-person-card">
                      <div className="reporte-person-name-row">
                        <span className="reporte-person-name">{p.nombre_completo}</span>
                        <span className="t-badge" style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
                          {p.cargo || 'SIN CARGO'}
                        </span>
                        {p.cuadrilla && (
                          <span className="t-badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                            {p.cuadrilla}
                          </span>
                        )}
                      </div>

                      {/* CORREO 1 (PRINCIPAL) */}
                      <div className="reporte-email-entry-row">
                        {isEditing1 ? (
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flex: 1 }}>
                            <span className="t-meta" style={{ fontWeight: 'var(--fw-bold)', color: '#003060' }}>Correo 1:</span>
                            <input
                              type="email"
                              className="reporte-input"
                              style={{ padding: '0.25rem 0.5rem', maxWidth: '240px' }}
                              placeholder="correo.principal@covepa.pe"
                              value={inputEmailPersona}
                              onChange={e => setInputEmailPersona(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="btn-toggle-dest para-active"
                              onClick={() => handleGuardarEmailPersona(p.id, 'email')}
                              disabled={savingEmailPersona}
                            >
                              {savingEmailPersona ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              className="btn-toggle-dest cc-inactive"
                              onClick={cancelarEdicionCorreo}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : hasEmail1 ? (
                          <>
                            <div className="reporte-person-email">
                              <span style={{ fontWeight: 'var(--fw-semibold)', color: '#475569' }}>Correo 1:</span>
                              <span>{p.email}</span>
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}
                                className="t-meta"
                                onClick={() => iniciarEdicionCorreo(p.id, 'email', p.email)}
                                title="Editar Correo 1 en la base de datos"
                              >
                                Editar
                              </button>
                            </div>
                            <div className="reporte-person-actions">
                              <button
                                type="button"
                                className={`btn-toggle-dest ${isPara1 ? 'para-active' : 'para-inactive'}`}
                                onClick={() => toggleDestinatarioPara(p.email)}
                                title={isPara1 ? 'Remover Correo 1 de Para:' : 'Agregar Correo 1 a Para:'}
                              >
                                {isPara1 ? '✓ En Para' : '+ Para'}
                              </button>
                              <button
                                type="button"
                                className={`btn-toggle-dest ${isCC1 ? 'cc-active' : 'cc-inactive'}`}
                                onClick={() => toggleDestinatarioCC(p.email)}
                                title={isCC1 ? 'Remover Correo 1 de CC:' : 'Agregar Correo 1 a CC:'}
                              >
                                {isCC1 ? '✓ En CC' : '+ CC'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span className="reporte-person-no-email">Correo 1: Sin registrar</span>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: 'var(--fw-semibold)', textDecoration: 'underline' }}
                              className="t-meta"
                              onClick={() => iniciarEdicionCorreo(p.id, 'email', '')}
                            >
                              + Asignar Correo 1
                            </button>
                          </div>
                        )}
                      </div>

                      {/* CORREO 2 (SECUNDARIO / ALTERNATIVO) */}
                      <div className="reporte-email-entry-row">
                        {isEditing2 ? (
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flex: 1 }}>
                            <span className="t-meta" style={{ fontWeight: 'var(--fw-bold)', color: '#003060' }}>Correo 2:</span>
                            <input
                              type="email"
                              className="reporte-input"
                              style={{ padding: '0.25rem 0.5rem', maxWidth: '240px' }}
                              placeholder="correo.secundario@gmail.com"
                              value={inputEmailPersona}
                              onChange={e => setInputEmailPersona(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="btn-toggle-dest para-active"
                              onClick={() => handleGuardarEmailPersona(p.id, 'email_2')}
                              disabled={savingEmailPersona}
                            >
                              {savingEmailPersona ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              className="btn-toggle-dest cc-inactive"
                              onClick={cancelarEdicionCorreo}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : hasEmail2 ? (
                          <>
                            <div className="reporte-person-email">
                              <span style={{ fontWeight: 'var(--fw-semibold)', color: '#475569' }}>Correo 2:</span>
                              <span>{p.email_2}</span>
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}
                                className="t-meta"
                                onClick={() => iniciarEdicionCorreo(p.id, 'email_2', p.email_2)}
                                title="Editar Correo 2 en la base de datos"
                              >
                                Editar
                              </button>
                            </div>
                            <div className="reporte-person-actions">
                              <button
                                type="button"
                                className={`btn-toggle-dest ${isPara2 ? 'para-active' : 'para-inactive'}`}
                                onClick={() => toggleDestinatarioPara(p.email_2)}
                                title={isPara2 ? 'Remover Correo 2 de Para:' : 'Agregar Correo 2 a Para:'}
                              >
                                {isPara2 ? '✓ En Para' : '+ Para'}
                              </button>
                              <button
                                type="button"
                                className={`btn-toggle-dest ${isCC2 ? 'cc-active' : 'cc-inactive'}`}
                                onClick={() => toggleDestinatarioCC(p.email_2)}
                                title={isCC2 ? 'Remover Correo 2 de CC:' : 'Agregar Correo 2 a CC:'}
                              >
                                {isCC2 ? '✓ En CC' : '+ CC'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span className="reporte-person-no-email">Correo 2: Sin registrar (opcional)</span>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: 'var(--fw-semibold)', textDecoration: 'underline' }}
                              className="t-meta"
                              onClick={() => iniciarEdicionCorreo(p.id, 'email_2', '')}
                            >
                              + Asignar Correo 2
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Pie del Modal con Resumen de Selección */}
            <div className="reporte-modal-footer">
              <span className="t-meta" style={{ color: '#334155' }}>
                Seleccionados: <strong>{configActual.destinatarios.length}</strong> en Para · <strong>{configActual.destinatarios_cc.length}</strong> en CC
              </span>
              <button
                type="button"
                className="btn-reporte-save"
                style={{ padding: '0.45rem 1.1rem' }}
                onClick={() => setModalPersonalOpen(false)}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
