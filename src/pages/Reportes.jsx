import React, { useState, useEffect, useMemo, useContext, useRef } from 'react'
import { AuthContext } from '../context/AuthContext'
import {
  fetchConfiguracionReporte,
  saveConfiguracionReporte,
  fetchDatosReporteDiario,
  generarHTMLReporte
} from '../services/reportesCorreoService'
import { fetchPersonal, updatePersonal } from '../services/personalService'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Reportes() {
  const auth = useContext(AuthContext)
  const userEmail = auth?.user?.email || 'coordinador'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshingData, setRefreshingData] = useState(false)
  const [toast, setToast] = useState(null)

  // Estados de configuración
  const [config, setConfig] = useState({
    activo: true,
    hora_envio: '21:00',
    destinatarios: ['ccondor@covepa.pe'],
    destinatarios_cc: [],
    asunto: '[COVEPA] Reporte Diario de Observaciones - {fecha}',
    notas_jornada: 'Cierre operativo de observaciones de la jornada.'
  })

  // Inputs temporales para escribir nuevos correos manualmente
  const [nuevoPara, setNuevoPara] = useState('')
  const [nuevoCC, setNuevoCC] = useState('')

  // Datos en vivo para la vista previa
  const [datosReporte, setDatosReporte] = useState(null)

  // Lista de personal para selector de destinatarios
  const [personalList, setPersonalList] = useState([])
  const [modalPersonalOpen, setModalPersonalOpen] = useState(false)
  const [busquedaPersonal, setBusquedaPersonal] = useState('')
  const [filtroCargo, setFiltroCargo] = useState('TODOS')

  // Estado para asignar o editar cualquiera de los 2 correos a un integrante
  // { personId: string, field: 'email' | 'email_2' }
  const [editingTarget, setEditingTarget] = useState(null)
  const [inputEmailPersona, setInputEmailPersona] = useState('')
  const [savingEmailPersona, setSavingEmailPersona] = useState(false)

  // Referencia al timer del toast
  const toastTimerRef = useRef(null)

  const showNotification = (mensaje, tipo = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ mensaje, tipo })
    toastTimerRef.current = setTimeout(() => setToast(null), 4500)
  }

  // Cargar configuración inicial, observaciones de hoy y lista de personal
  const cargarTodo = async () => {
    setLoading(true)
    try {
      const [cfg, datos, personal] = await Promise.all([
        fetchConfiguracionReporte(),
        fetchDatosReporteDiario(),
        fetchPersonal()
      ])
      setConfig(cfg)
      setDatosReporte(datos)
      setPersonalList(personal || [])
    } catch (err) {
      console.error('Error cargando datos de reporte:', err)
      showNotification('Error al cargar la información inicial.', 'error')
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

  // Refrescar únicamente los datos de hoy para actualizar el simulador
  const handleRefrescarDatos = async () => {
    setRefreshingData(true)
    try {
      const datos = await fetchDatosReporteDiario()
      setDatosReporte(datos)
      showNotification('Datos de observaciones actualizados.', 'info')
    } catch (err) {
      console.error('Error refrescando datos:', err)
      showNotification('No se pudo refrescar los datos del reporte.', 'error')
    } finally {
      setRefreshingData(false)
    }
  }

  // Manejo de chips de correos: Para
  const agregarPara = () => {
    const val = (nuevoPara || '').trim().toLowerCase()
    if (!val) return
    if (!EMAIL_REGEX.test(val)) {
      showNotification(`El correo "${val}" no tiene un formato válido.`, 'error')
      return
    }
    if (config.destinatarios.includes(val)) {
      showNotification(`El correo "${val}" ya está en la lista.`, 'info')
      setNuevoPara('')
      return
    }
    setConfig(prev => ({ ...prev, destinatarios: [...prev.destinatarios, val] }))
    setNuevoPara('')
  }

  const removerPara = (emailAEliminar) => {
    setConfig(prev => ({
      ...prev,
      destinatarios: prev.destinatarios.filter(e => e !== emailAEliminar)
    }))
  }

  // Manejo de chips de correos: CC
  const agregarCC = () => {
    const val = (nuevoCC || '').trim().toLowerCase()
    if (!val) return
    if (!EMAIL_REGEX.test(val)) {
      showNotification(`El correo "${val}" no tiene un formato válido.`, 'error')
      return
    }
    if (config.destinatarios_cc.includes(val)) {
      showNotification(`El correo "${val}" ya está en la lista de CC.`, 'info')
      setNuevoCC('')
      return
    }
    setConfig(prev => ({ ...prev, destinatarios_cc: [...prev.destinatarios_cc, val] }))
    setNuevoCC('')
  }

  const removerCC = (emailAEliminar) => {
    setConfig(prev => ({
      ...prev,
      destinatarios_cc: prev.destinatarios_cc.filter(e => e !== emailAEliminar)
    }))
  }

  // Alternar destinatario desde modal de personal
  const toggleDestinatarioPara = (email) => {
    if (!email) return
    const norm = email.toLowerCase().trim()
    setConfig(prev => {
      const exists = prev.destinatarios.includes(norm)
      return {
        ...prev,
        destinatarios: exists ? prev.destinatarios.filter(e => e !== norm) : [...prev.destinatarios, norm]
      }
    })
  }

  const toggleDestinatarioCC = (email) => {
    if (!email) return
    const norm = email.toLowerCase().trim()
    setConfig(prev => {
      const exists = prev.destinatarios_cc.includes(norm)
      return {
        ...prev,
        destinatarios_cc: exists ? prev.destinatarios_cc.filter(e => e !== norm) : [...prev.destinatarios_cc, norm]
      }
    })
  }

  // Iniciar edición de un correo específico (email o email_2)
  const iniciarEdicionCorreo = (personId, field, valorActual) => {
    setEditingTarget({ personId, field })
    setInputEmailPersona(valorActual || '')
  }

  // Cancelar edición
  const cancelarEdicionCorreo = () => {
    setEditingTarget(null)
    setInputEmailPersona('')
  }

  // Guardar correo (email o email_2) en la BD externa
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

  // Guardar configuración general del reporte
  const handleGuardar = async () => {
    if (config.destinatarios.length === 0) {
      showNotification('Debes ingresar al menos un correo principal de destinatario.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveConfiguracionReporte(config, userEmail)
      showNotification('Configuración guardada exitosamente. El cron despachará a la hora programada.', 'success')
    } catch (err) {
      console.error('Error al guardar configuración:', err)
      showNotification('Error al guardar la configuración: ' + err.message, 'error')
    } finally {
      setSaving(false)
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

  // Generar HTML en vivo para el simulador
  const previewHtml = useMemo(() => {
    if (!datosReporte) return '<p style="padding:20px;font-family:sans-serif;">Cargando vista previa...</p>'
    try {
      return generarHTMLReporte({ config, datos: datosReporte })
    } catch (e) {
      return `<p style="padding:20px;color:red;font-family:sans-serif;">Error al generar vista previa: ${e.message}</p>`
    }
  }, [config, datosReporte])

  // Asunto procesado para la cabecera del visor
  const asuntoRenderizado = useMemo(() => {
    const fecha = datosReporte?.fechaFormateada || 'Hoy'
    const base = config.asunto || 'Reporte Diario de Levantamiento de Observaciones Amazonas - Zona 2 y Zona 7'
    return base.includes('{fecha}') ? base.replace('{fecha}', fecha) : base
  }, [config.asunto, datosReporte])

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

      {/* Cabecera Principal */}
      <header className="reportes-header">
        <div className="reportes-title-group">
          <h1 className="reportes-main-title t-title-page">
            <span>📧</span> Reporte Diario Automático por Correo
          </h1>
          <p className="reportes-subtitle t-subtitle">
            Programa el despacho nocturno de observaciones consolidadas desde <code>ccondor@covepa.pe</code>. Selecciona destinatarios de tu lista de personal o agrégalos manualmente.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a
            href="https://github.com/JCarlosCC2001/Amazonas-COVEPA/actions/workflows/reporte-diario.yml"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 0.95rem',
              background: '#0284c7',
              color: '#ffffff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 'var(--fw-semibold)',
              fontSize: 'var(--text-body)',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
            }}
            title="Abrir consola de GitHub Actions para despachar un envío inmediato con un solo clic"
          >
            <span>🚀</span>
            <span>Despachar Envío de Prueba</span>
          </a>
          <button
            type="button"
            className="btn-reporte-save"
            onClick={handleGuardar}
            disabled={saving}
          >
            <span>💾</span>
            <span>{saving ? 'Guardando...' : 'Guardar Parámetros'}</span>
          </button>
        </div>
      </header>

      {/* Disposición Dividida: Configuración + Simulador */}
      <div className="reportes-split-layout">
        {/* PANEL IZQUIERDO: CONFIGURACIÓN */}
        <div className="reporte-card">
          <div className="reporte-card-header">
            <h2 className="reporte-card-title t-title-section">
              <span>⚙️</span> Parámetros de Programación
            </h2>
            <span
              className={`t-badge ${config.activo ? 'badge-activo' : 'badge-pausado'}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '12px',
                background: config.activo ? '#dcfce7' : '#fee2e2',
                color: config.activo ? '#15803d' : '#b91c1c',
                border: `1px solid ${config.activo ? '#86efac' : '#fca5a5'}`
              }}
            >
              <span style={{ fontSize: 'var(--text-xs)', lineHeight: 1 }}>●</span>
              {config.activo ? `Envío activo: ${config.hora_envio} hrs` : 'Envío pausado'}
            </span>
          </div>

          {/* Banner de Estado del Último Despacho */}
          {config.ultimo_envio_at && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              color: '#166534'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: 'var(--text-lg)' }}>📬</span>
                <div>
                  <div className="t-name" style={{ color: '#14532d' }}>Último reporte despachado con éxito</div>
                  <div className="t-meta" style={{ color: '#15803d' }}>
                    Enviado: {new Date(config.ultimo_envio_at).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })} (Hora Perú)
                  </div>
                </div>
              </div>
              <span className="t-badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                ✓ Entregado
              </span>
            </div>
          )}

          {/* Card explicativa y botón de prueba rápida */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span className="t-name" style={{ color: '#003060', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>⚡</span> Despacho Inmediato vs Programado
              </span>
              <a
                href="https://github.com/JCarlosCC2001/Amazonas-COVEPA/actions/workflows/reporte-diario.yml"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 'var(--text-xs)',
                  color: '#0284c7',
                  fontWeight: 'var(--fw-semibold)',
                  textDecoration: 'underline'
                }}
              >
                Abrir GitHub Actions ↗
              </a>
            </div>
            <p className="t-meta" style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              El despacho programado se ejecuta de forma autónoma en la nube cada noche. Si deseas recibir o verificar un correo de prueba de inmediato sin esperar el cron de GitHub, haz clic en el botón superior <strong>[ 🚀 Despachar Envío de Prueba ]</strong> y luego pulsa <strong>Run workflow</strong> en GitHub.
            </p>
          </div>

          {/* Toggle Activo / Pausado */}
          <div className="reporte-toggle-box">
            <div className="reporte-toggle-label">
              <span className="reporte-toggle-title t-name">Estado del Envío Programado</span>
              <span className="reporte-toggle-sub t-meta">
                {config.activo
                  ? 'El robot nocturno despachará el reporte a la hora configurada.'
                  : 'El despacho automático está suspendido temporalmente.'}
              </span>
            </div>
            <button
              type="button"
              className={`reporte-switch-btn ${config.activo ? 'active' : 'paused'}`}
              onClick={() => setConfig(prev => ({ ...prev, activo: !prev.activo }))}
            >
              <span>{config.activo ? '✅ ACTIVO' : '⏸️ PAUSADO'}</span>
            </button>
          </div>

          {/* Hora de Envío */}
          <div className="reporte-form-group">
            <label className="reporte-label" htmlFor="hora_envio">
              <span>⏰</span> Hora de Envío Automático (Hora de Perú)
            </label>
            <input
              id="hora_envio"
              type="time"
              className="reporte-input"
              value={config.hora_envio}
              onChange={e => setConfig(prev => ({ ...prev, hora_envio: e.target.value }))}
            />
            <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>
              El servidor ejecutará el envío diario a esta hora automáticamente. Puedes cambiarla en cualquier momento para reprogramar el próximo despacho.
            </span>
          </div>

          {/* Remitente Fijo */}
          <div className="reporte-form-group">
            <label className="reporte-label">
              <span>📤</span> Remitente Autorizado (Servidor Covepa)
            </label>
            <input
              type="text"
              readOnly
              className="reporte-input"
              value="ccondor@covepa.pe (Servidor SMTP mail.covepa.pe · Puerto 465 SSL)"
              style={{ background: '#f8fafc', color: '#003060', fontWeight: 'var(--fw-semibold)' }}
            />
          </div>

          {/* Destinatarios (Para) con botón a lista de personal */}
          <div className="reporte-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="reporte-label">
                <span>👥</span> Destinatarios Principales (Para:)
              </label>
              <button
                type="button"
                className="btn-open-personal"
                onClick={() => setModalPersonalOpen(true)}
              >
                <span>👥</span>
                <span>Seleccionar desde Personal</span>
              </button>
            </div>
            <div className="reporte-chips-wrap">
              {config.destinatarios.map(email => (
                <span key={email} className="reporte-email-chip">
                  <span>{email}</span>
                  <button
                    type="button"
                    className="reporte-chip-remove"
                    onClick={() => removerPara(email)}
                    title="Remover correo"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                type="email"
                className="reporte-chip-input"
                placeholder="Escribe un correo o usa 'Seleccionar desde Personal'..."
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
            <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>
              Pulsa <strong>Enter</strong> o coma tras escribir cada dirección, o pulsa <strong>"Seleccionar desde Personal"</strong>.
            </span>
          </div>

          {/* Destinatarios Con Copia (CC) */}
          <div className="reporte-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="reporte-label">
                <span>📋</span> Con Copia (CC: opcional)
              </label>
              <button
                type="button"
                className="btn-open-personal"
                onClick={() => setModalPersonalOpen(true)}
              >
                <span>👥</span>
                <span>Seleccionar desde Personal</span>
              </button>
            </div>
            <div className="reporte-chips-wrap">
              {config.destinatarios_cc.map(email => (
                <span key={email} className="reporte-email-chip" style={{ background: '#f1f5f9', borderColor: '#cbd5e1', color: '#334155' }}>
                  <span>{email}</span>
                  <button
                    type="button"
                    className="reporte-chip-remove"
                    onClick={() => removerCC(email)}
                    title="Remover correo"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                type="email"
                className="reporte-chip-input"
                placeholder="Escribe un correo de copia o selecciónalo..."
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
          </div>

          {/* Asunto */}
          <div className="reporte-form-group">
            <label className="reporte-label" htmlFor="asunto">
              <span>🏷️</span> Asunto del Correo
            </label>
            <input
              id="asunto"
              type="text"
              className="reporte-input"
              value={config.asunto}
              onChange={e => setConfig(prev => ({ ...prev, asunto: e.target.value }))}
            />
            <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>
              Asunto oficial. Puedes incluir <code>{'{fecha}'}</code> si deseas agregar la fecha automáticamente.
            </span>
          </div>

          {/* Notas y Comentarios de la Jornada */}
          <div className="reporte-form-group">
            <label className="reporte-label" htmlFor="notas_jornada">
              <span>💬</span> Comentarios u Observaciones de la Jornada (Opcional)
            </label>
            <textarea
              id="notas_jornada"
              rows={3}
              className="reporte-textarea"
              placeholder="Escribe aquí acuerdos de la jornada, contingencias o comentarios especiales. Si lo dejas vacío, no aparecerá en el correo..."
              value={config.notas_jornada}
              onChange={e => setConfig(prev => ({ ...prev, notas_jornada: e.target.value }))}
            />
            <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>
              Aparecerá al final del correo antes de la firma. Si está vacío no se incluirá nada. Se limpia automáticamente cada día a las 00:00 horas.
            </span>
          </div>

          {/* Barra de Acciones */}
          <div className="reporte-actions-bar">
            <button
              type="button"
              className="btn-reporte-save"
              onClick={handleGuardar}
              disabled={saving}
            >
              <span>💾</span>
              <span>{saving ? 'Guardando...' : 'Guardar Parámetros'}</span>
            </button>
          </div>
        </div>

        {/* PANEL DERECHO: SIMULADOR DE CORREO EN VIVO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="t-title-section" style={{ margin: 0, color: '#003060', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span>👁️</span> Simulador de Vista Previa en Vivo
            </h2>
            <button
              type="button"
              onClick={handleRefrescarDatos}
              disabled={refreshingData}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#334155'
              }}
              className="t-meta"
            >
              <span>🔄</span>
              <span>{refreshingData ? 'Actualizando...' : 'Recargar Observaciones'}</span>
            </button>
          </div>

          <div className="email-sim-window">
            {/* Cabecera del visor de correo */}
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
                  {config.destinatarios.length > 0 ? config.destinatarios.join(', ') : '(Sin destinatarios)'}
                </span>
              </div>
              {config.destinatarios_cc.length > 0 && (
                <div className="email-sim-meta-row">
                  <span className="email-sim-meta-label">CC:</span>
                  <span className="email-sim-meta-val">
                    {config.destinatarios_cc.join(', ')}
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
                <span className="email-sim-meta-label">Hora:</span>
                <span className="email-sim-meta-val" style={{ color: '#64748b' }}>
                  Programado para las {config.hora_envio} hrs (Hora Perú)
                </span>
              </div>
            </div>

            {/* Cuerpo del correo renderizado de forma aislada en iframe */}
            <div className="email-sim-body">
              <iframe
                title="Vista previa del correo de reporte"
                srcDoc={previewHtml}
                style={{
                  width: '100%',
                  height: '660px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: SELECCIONAR DESTINATARIOS DESDE PERSONAL (SOPORTE DE 2 CORREOS) */}
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

                  const isPara1 = hasEmail1 && config.destinatarios.includes(p.email.toLowerCase())
                  const isCC1 = hasEmail1 && config.destinatarios_cc.includes(p.email.toLowerCase())

                  const isPara2 = hasEmail2 && config.destinatarios.includes(p.email_2.toLowerCase())
                  const isCC2 = hasEmail2 && config.destinatarios_cc.includes(p.email_2.toLowerCase())

                  const isEditing1 = editingTarget?.personId === p.id && editingTarget?.field === 'email'
                  const isEditing2 = editingTarget?.personId === p.id && editingTarget?.field === 'email_2'

                  return (
                    <div key={p.id} className="reporte-person-card">
                      {/* Cabecera del Integrante */}
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

                      {/* ESPACIO 1: CORREO ELECTRÓNICO 1 (PRINCIPAL) */}
                      <div className="reporte-email-entry-row">
                        {isEditing1 ? (
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flex: 1 }}>
                            <span className="t-meta" style={{ fontWeight: 'var(--fw-bold)', color: '#003060' }}>Correo 1:</span>
                            <input
                              type="email"
                              className="reporte-input"
                              style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-xs)', maxWidth: '240px' }}
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
                                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 'var(--text-xs)', textDecoration: 'underline' }}
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
                              style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', textDecoration: 'underline' }}
                              onClick={() => iniciarEdicionCorreo(p.id, 'email', '')}
                            >
                              + Asignar Correo 1
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ESPACIO 2: CORREO ELECTRÓNICO 2 (SECUNDARIO / ALTERNATIVO) */}
                      <div className="reporte-email-entry-row">
                        {isEditing2 ? (
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flex: 1 }}>
                            <span className="t-meta" style={{ fontWeight: 'var(--fw-bold)', color: '#003060' }}>Correo 2:</span>
                            <input
                              type="email"
                              className="reporte-input"
                              style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-xs)', maxWidth: '240px' }}
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
                                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 'var(--text-xs)', textDecoration: 'underline' }}
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
                              style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', textDecoration: 'underline' }}
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
                Seleccionados: <strong>{config.destinatarios.length}</strong> en Para · <strong>{config.destinatarios_cc.length}</strong> en CC
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
