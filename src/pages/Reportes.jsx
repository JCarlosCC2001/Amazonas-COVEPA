import React, { useState, useEffect, useMemo, useContext, useRef } from 'react'
import { AuthContext } from '../context/AuthContext'
import {
  fetchConfiguracionReporte,
  saveConfiguracionReporte,
  fetchDatosReporteDiario,
  generarHTMLReporte
} from '../services/reportesCorreoService'

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

  // Inputs temporales para escribir nuevos correos
  const [nuevoPara, setNuevoPara] = useState('')
  const [nuevoCC, setNuevoCC] = useState('')

  // Datos en vivo para la vista previa
  const [datosReporte, setDatosReporte] = useState(null)

  // Referencia al timer del toast
  const toastTimerRef = useRef(null)

  const showNotification = (mensaje, tipo = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ mensaje, tipo })
    toastTimerRef.current = setTimeout(() => setToast(null), 4500)
  }

  // Cargar configuración inicial y datos de observaciones de hoy
  const cargarTodo = async () => {
    setLoading(true)
    try {
      const [cfg, datos] = await Promise.all([
        fetchConfiguracionReporte(),
        fetchDatosReporteDiario()
      ])
      setConfig(cfg)
      setDatosReporte(datos)
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

  // Guardar configuración
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
    return (config.asunto || '[COVEPA] Reporte Diario de Observaciones - {fecha}').replace('{fecha}', fecha)
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
            Programa el despacho nocturno de observaciones consolidadas desde <code>ccondor@covepa.pe</code>. El sistema despachará automáticamente todos los días.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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

          {/* Toggle Activo / Pausado */}
          <div className="reporte-toggle-box">
            <div className="reporte-toggle-label">
              <span className="reporte-toggle-title t-name">Estado del Envio Programado</span>
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
              El servidor ejecutará el envío diario a esta hora automáticamente, incluso si no tienes la aplicación abierta. Puedes cambiarla en cualquier momento para reprogramar el próximo despacho.
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

          {/* Destinatarios (Para) */}
          <div className="reporte-form-group">
            <label className="reporte-label">
              <span>👥</span> Destinatarios Principales (Para:)
            </label>
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
            <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>
              Pulsa <strong>Enter</strong> o coma tras escribir cada dirección para agregarla como destinatario.
            </span>
          </div>

          {/* Destinatarios Con Copia (CC) */}
          <div className="reporte-form-group">
            <label className="reporte-label">
              <span>📋</span> Con Copia (CC: opcional)
            </label>
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
                placeholder="Escribe un correo de copia y pulsa Enter..."
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
              Usa la etiqueta <code>{'{fecha}'}</code> para que se reemplace dinámicamente con el día del envío.
            </span>
          </div>

          {/* Notas y Justificaciones de la Jornada */}
          <div className="reporte-form-group">
            <label className="reporte-label" htmlFor="notas_jornada">
              <span>📝</span> Notas y Razones / Justificaciones de la Jornada
            </label>
            <textarea
              id="notas_jornada"
              rows={4}
              className="reporte-textarea"
              placeholder="Escribe aquí acuerdos relevantes, motivos de demora, contingencias de lluvia, accesos o comentarios generales para este envío..."
              value={config.notas_jornada}
              onChange={e => setConfig(prev => ({ ...prev, notas_jornada: e.target.value }))}
            />
            <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>
              Este texto se incorporará de forma destacada en la cabecera del correo nocturno enviado a los destinatarios.
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
    </div>
  )
}
