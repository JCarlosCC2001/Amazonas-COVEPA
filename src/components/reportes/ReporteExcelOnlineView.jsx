import React, { useState, useEffect, useMemo } from 'react'
import {
  getStoredSheetsConfig,
  saveStoredSheetsConfig,
  getStoredUltimoSync,
  fetchDatosParaGoogleSheets,
  sincronizarGoogleSheets,
  APPS_SCRIPT_SOURCE_CODE
} from '../../services/googleSheetsSyncService'

export default function ReporteExcelOnlineView({ onVolver, showNotification }) {
  const [config, setConfig] = useState(getStoredSheetsConfig)
  const [ultimoSync, setUltimoSync] = useState(getStoredUltimoSync)
  const [datosSheets, setDatosSheets] = useState({ original: [], ampliacion: [], total: 0 })
  const [loadingDatos, setLoadingDatos] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [probandoWebhook, setProbandoWebhook] = useState(false)
  const [modalCodigoOpen, setModalCodigoOpen] = useState(false)
  const [codigoCopiado, setCodigoCopiado] = useState(false)

  // Filtros de vista previa
  const [tabActiva, setTabActiva] = useState('ORIGINAL') // 'ORIGINAL' | 'AMPLIACION'
  const [busqueda, setBusqueda] = useState('')

  // Cargar datos en vivo de Supabase
  const cargarDatos = async () => {
    setLoadingDatos(true)
    try {
      const data = await fetchDatosParaGoogleSheets()
      setDatosSheets(data)
    } catch (err) {
      console.error('Error cargando datos para Google Sheets:', err)
      showNotification('Error al cargar datos de observaciones.', 'error')
    } finally {
      setLoadingDatos(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  // Guardar configuración de URLs
  const handleGuardarConfig = (e) => {
    e.preventDefault()
    const success = saveStoredSheetsConfig(config)
    if (success) {
      showNotification('Configuración de Google Sheets guardada correctamente.', 'success')
    } else {
      showNotification('Error al guardar la configuración.', 'error')
    }
  }

  // Probar conexión con el Webhook de Google Apps Script
  const handleProbarConexion = async () => {
    if (!config.webhookUrl || !config.webhookUrl.trim()) {
      showNotification('Ingresa la URL del Webhook de Apps Script primero.', 'error')
      return
    }
    setProbandoWebhook(true)
    try {
      const res = await fetch(config.webhookUrl.trim(), { method: 'GET' })
      const json = await res.json()
      if (json && (json.status === 'online' || json.sistema)) {
        showNotification('✅ ¡Conexión exitosa con el Webhook de Google Apps Script!', 'success')
      } else {
        showNotification('El webhook respondió pero con un formato inesperado.', 'info')
      }
    } catch (err) {
      console.warn('Test webhook aviso:', err)
      showNotification('No se pudo verificar el Webhook vía GET. Asegúrate de implementar como Aplicación Web con acceso a Cualquier usuario.', 'info')
    } finally {
      setProbandoWebhook(false)
    }
  }

  // Ejecutar sincronización en tiempo real
  const handleSincronizarAhora = async () => {
    if (!config.webhookUrl || !config.webhookUrl.trim()) {
      showNotification('Debes configurar la URL del Webhook de Apps Script antes de sincronizar.', 'error')
      return
    }

    setSincronizando(true)
    try {
      // 1. Refrescar datos frescos desde la base de datos
      const datosFrescos = await fetchDatosParaGoogleSheets()
      setDatosSheets(datosFrescos)

      // 2. Enviar actualización a Google Sheets
      const resSync = await sincronizarGoogleSheets(config.webhookUrl, datosFrescos)
      setUltimoSync(resSync)

      showNotification(
        `✅ ¡Hoja de cálculo actualizada! ${resSync.totalUpdated} filas modificadas (${resSync.updatedOriginal} Original · ${resSync.updatedAmpliacion} Ampliación).`,
        'success'
      )
    } catch (err) {
      console.error('Error al sincronizar con Google Sheets:', err)
      showNotification(`Error en la sincronización: ${err.message}`, 'error')
    } finally {
      setSincronizando(false)
    }
  }

  // Copiar código de Apps Script al portapapeles
  const handleCopiarCodigo = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_SOURCE_CODE)
    setCodigoCopiado(true)
    showNotification('Código copiado al portapapeles. Pégalo en Extensiones > Apps Script.', 'success')
    setTimeout(() => setCodigoCopiado(false), 3000)
  }

  // Lista filtrada para la tabla de vista previa
  const listaActiva = tabActiva === 'ORIGINAL' ? datosSheets.original : datosSheets.ampliacion
  const listaFiltrada = useMemo(() => {
    if (!busqueda.trim()) return listaActiva.slice(0, 100)
    const q = busqueda.toLowerCase().trim()
    return listaActiva.filter(item => {
      const matchCod = String(item.id_obs || '').toLowerCase().includes(q)
      const matchSitio = String(item.id_sitio || '').toLowerCase().includes(q)
      const matchCuad = String(item.cuadrilla || '').toLowerCase().includes(q)
      const matchTec = String(item.tecnico || '').toLowerCase().includes(q)
      const matchEst = String(item.estado || '').toLowerCase().includes(q)
      const matchRev = String(item.revisor || '').toLowerCase().includes(q)
      return matchCod || matchSitio || matchCuad || matchTec || matchEst || matchRev
    }).slice(0, 100)
  }, [listaActiva, busqueda])

  const formatoFechaPeru = (isoStr) => {
    if (!isoStr) return '—'
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('es-PE', {
        timeZone: 'America/Lima',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (_) {
      return isoStr
    }
  }

  return (
    <>
      {/* Botón Volver al Hub */}
      <div>
        <button
          type="button"
          className="btn-back-hub"
          onClick={onVolver}
        >
          <span>← Volver a Selección de Reportes</span>
        </button>
      </div>

      {/* Cabecera Principal */}
      <header className="reportes-header">
        <div className="reportes-title-group">
          <h1 className="reportes-main-title t-title-page">
            <span>📗</span>
            <span>Reporte Excel en Línea (Google Sheets)</span>
          </h1>
          <p className="reportes-subtitle t-subtitle">
            Actualiza en tiempo real las pestañas <strong>"Amazonas Original"</strong> y <strong>"Amazonas Ampliación"</strong> de tu hoja de cálculo con Cuadrilla Ejecutora, Técnico Asignado, Estado, Fecha Actualización y Revisor.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {config.urlHoja && (
            <a
              href={config.urlHoja}
              target="_blank"
              rel="noreferrer"
              className="btn-reportes-action"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                textDecoration: 'none',
                background: '#f0fdf4',
                color: '#166534',
                borderColor: '#86efac'
              }}
            >
              <span>🔗 Abrir en Google Sheets</span>
            </a>
          )}
          <button
            type="button"
            className="btn-reportes-action"
            onClick={() => setModalCodigoOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#e0f2fe',
              color: '#0369a1',
              borderColor: '#7dd3fc'
            }}
          >
            <span>📋 Ver Código Apps Script</span>
          </button>
          <button
            type="button"
            className="btn-reportes-action btn-reportes-primary"
            onClick={handleSincronizarAhora}
            disabled={sincronizando || loadingDatos}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#003060',
              color: '#ffffff'
            }}
          >
            <span>{sincronizando ? '⏳' : '⚡'}</span>
            <span>{sincronizando ? 'Actualizando Hoja...' : 'Actualizar Hoja de Cálculo Ahora'}</span>
          </button>
        </div>
      </header>

      {/* Tarjetas KPI de Estado */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
          margin: '0.5rem 0'
        }}
      >
        {/* KPI 1: Amazonas Original */}
        <div className="reporte-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>Amazonas Original</span>
            <span className="t-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>Pestaña 1</span>
          </div>
          <div className="t-metric-kpi" style={{ color: '#003060', margin: '0.4rem 0' }}>
            {loadingDatos ? '—' : `${datosSheets.original.length} obs`}
          </div>
          <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>
            Listos para cotejar en columna "Código Obs"
          </span>
        </div>

        {/* KPI 2: Amazonas Ampliación */}
        <div className="reporte-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>Amazonas Ampliación</span>
            <span className="t-badge" style={{ background: '#fef3c7', color: '#92400e' }}>Pestaña 2</span>
          </div>
          <div className="t-metric-kpi" style={{ color: '#003060', margin: '0.4rem 0' }}>
            {loadingDatos ? '—' : `${datosSheets.ampliacion.length} obs`}
          </div>
          <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>
            Códigos prefijo AMEX listos para sincronizar
          </span>
        </div>

        {/* KPI 3: Última Sincronización */}
        <div className="reporte-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>Última Actualización</span>
            <span
              className="t-badge"
              style={{
                background: ultimoSync ? '#dcfce7' : '#fee2e2',
                color: ultimoSync ? '#15803d' : '#b91c1c'
              }}
            >
              {ultimoSync ? 'Sincronizado' : 'Sin Ejecutar'}
            </span>
          </div>
          <div className="t-name" style={{ color: '#003060', margin: '0.4rem 0', fontWeight: 'var(--fw-bold)' }}>
            {ultimoSync ? formatoFechaPeru(ultimoSync.fecha) : 'Nunca'}
          </div>
          <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>
            {ultimoSync ? `${ultimoSync.totalUpdated} filas modificadas` : 'Pendiente de primera sincronización'}
          </span>
        </div>

        {/* KPI 4: Estado del Webhook */}
        <div className="reporte-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="t-meta" style={{ color: 'var(--text-secondary)' }}>Estado Conexión</span>
            <span
              className="t-badge"
              style={{
                background: config.webhookUrl ? '#dcfce7' : '#fef3c7',
                color: config.webhookUrl ? '#15803d' : '#92400e'
              }}
            >
              {config.webhookUrl ? '● Configurado' : '● Pendiente'}
            </span>
          </div>
          <div className="t-name" style={{ color: '#003060', margin: '0.4rem 0', fontWeight: 'var(--fw-bold)' }}>
            {config.webhookUrl ? 'Apps Script Activo' : 'Falta URL Webhook'}
          </div>
          <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>
            {config.webhookUrl ? 'Listo para recibir actualizaciones' : 'Pega la URL del script abajo'}
          </span>
        </div>
      </div>

      {/* Layout Dividido: Panel de Configuración y Panel de Vista Previa */}
      <div className="reportes-split-layout">
        {/* Lado Izquierdo: Configuración del Webhook y URLs */}
        <div className="reporte-card">
          <div className="reporte-card-header">
            <h2 className="reporte-card-title t-title-section">
              <span>⚙️</span> Parámetros de Conexión Google Drive
            </h2>
          </div>

          <form onSubmit={handleGuardarConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                URL de tu Hoja de Cálculo (Google Sheets):
              </label>
              <input
                type="url"
                value={config.urlHoja}
                onChange={(e) => setConfig({ ...config, urlHoja: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)'
                }}
              />
              <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>
                Enlace directo al documento para abrirlo en una pestaña con un solo clic.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                URL del Webhook (Google Apps Script):
              </label>
              <input
                type="url"
                value={config.webhookUrl}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/.../exec"
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)'
                }}
              />
              <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>
                URL de la Aplicación Web generada al implementar el Apps Script en tu hoja.
              </span>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}
            >
              <div className="t-meta" style={{ fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                Columnas Mapeadas Automáticamente:
              </div>
              <ul className="t-caption" style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                <li><strong>Columna A:</strong> Código Obs <em>(Clave de búsqueda)</em></li>
                <li><strong>Columna D:</strong> Cuadrilla Ejecutora</li>
                <li><strong>Columna E:</strong> Técnico Asignado</li>
                <li><strong>Columna F:</strong> Estado</li>
                <li><strong>Columna G:</strong> Fecha Actualización <em>(DD/MM/YYYY)</em></li>
                <li><strong>Columna H:</strong> Revisor</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn-reportes-action btn-reportes-primary"
                style={{ background: '#003060', color: '#ffffff' }}
              >
                <span>💾 Guardar Configuración</span>
              </button>
              <button
                type="button"
                className="btn-reportes-action"
                onClick={handleProbarConexion}
                disabled={probandoWebhook}
              >
                <span>{probandoWebhook ? '⏳ Verificando...' : '🔍 Probar Conexión'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Lado Derecho: Visualizador de Datos Listos para Sincronizar */}
        <div className="reporte-card">
          <div className="reporte-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 className="reporte-card-title t-title-section">
              <span>👁️</span> Datos a Sincronizar
            </h2>

            {/* Selector de Pestaña */}
            <div style={{ display: 'flex', gap: '0.35rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setTabActiva('ORIGINAL')}
                style={{
                  border: 'none',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: tabActiva === 'ORIGINAL' ? '#003060' : 'transparent',
                  color: tabActiva === 'ORIGINAL' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 'var(--fw-semibold)'
                }}
              >
                Amazonas Original ({datosSheets.original.length})
              </button>
              <button
                type="button"
                onClick={() => setTabActiva('AMPLIACION')}
                style={{
                  border: 'none',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: tabActiva === 'AMPLIACION' ? '#003060' : 'transparent',
                  color: tabActiva === 'AMPLIACION' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 'var(--fw-semibold)'
                }}
              >
                Amazonas Ampliación ({datosSheets.ampliacion.length})
              </button>
            </div>
          </div>

          {/* Buscador de Códigos */}
          <div style={{ margin: '0.5rem 0' }}>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código (ej: C-4427, H1-OC-...), técnico o estado..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)'
              }}
            />
          </div>

          {/* Tabla de Vista Previa */}
          <div style={{ overflowX: 'auto', maxHeight: '420px', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#003060', color: '#ffffff' }}>
                  <th className="t-meta" style={{ padding: '0.5rem 0.65rem' }}>Código Obs</th>
                  <th className="t-meta" style={{ padding: '0.5rem 0.65rem' }}>Cuadrilla</th>
                  <th className="t-meta" style={{ padding: '0.5rem 0.65rem' }}>Técnico</th>
                  <th className="t-meta" style={{ padding: '0.5rem 0.65rem' }}>Estado</th>
                  <th className="t-meta" style={{ padding: '0.5rem 0.65rem' }}>Fecha</th>
                  <th className="t-meta" style={{ padding: '0.5rem 0.65rem' }}>Revisor</th>
                </tr>
              </thead>
              <tbody>
                {loadingDatos ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }} className="t-meta">
                      Cargando observaciones en vivo...
                    </td>
                  </tr>
                ) : listaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }} className="t-meta">
                      No se encontraron códigos que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  listaFiltrada.map((item, idx) => (
                    <tr
                      key={item.id_obs || idx}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                      }}
                    >
                      <td className="t-meta" style={{ padding: '0.45rem 0.65rem', fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                        {item.id_obs}
                      </td>
                      <td className="t-caption" style={{ padding: '0.45rem 0.65rem' }}>
                        {item.cuadrilla || '—'}
                      </td>
                      <td className="t-caption" style={{ padding: '0.45rem 0.65rem' }}>
                        {item.tecnico || '—'}
                      </td>
                      <td className="t-caption" style={{ padding: '0.45rem 0.65rem' }}>
                        <span
                          className="t-badge"
                          style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: item.estado === 'Descartado' ? '#fee2e2' : item.estado === 'Subsanada' ? '#dcfce7' : item.estado === 'Solicitando Revisión' ? '#fef3c7' : '#f1f5f9',
                            color: item.estado === 'Descartado' ? '#991b1b' : item.estado === 'Subsanada' ? '#15803d' : item.estado === 'Solicitando Revisión' ? '#92400e' : '#475569'
                          }}
                        >
                          {item.estado}
                        </span>
                      </td>
                      <td className="t-caption" style={{ padding: '0.45rem 0.65rem' }}>
                        {item.fecha || '—'}
                      </td>
                      <td className="t-caption" style={{ padding: '0.45rem 0.65rem' }}>
                        {item.revisor || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
            <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>
              Mostrando {listaFiltrada.length} de {listaActiva.length} observaciones en {tabActiva === 'ORIGINAL' ? 'Amazonas Original' : 'Amazonas Ampliación'}
            </span>
          </div>
        </div>
      </div>

      {/* Modal Guía y Código de Apps Script */}
      {modalCodigoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalCodigoOpen(false)
          }}
        >
          <div
            className="modal-preview-correo-dialog"
            style={{
              maxWidth: '850px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            {/* Cabecera del Modal */}
            <div className="modal-preview-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div className="modal-preview-title-wrap">
                <span className="t-title-section" style={{ color: '#003060', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📋</span> Código Google Apps Script para tu Hoja de Cálculo
                </span>
                <span className="t-subtitle">
                  Sigue estos 5 sencillos pasos para habilitar la actualización automática en tu Google Drive:
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalCodigoOpen(false)}
                className="t-title-section"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >
                ✕
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="modal-preview-body" style={{ padding: '1.5rem', overflowY: 'auto' }}>
              <ol className="t-body" style={{ margin: '0 0 1rem 0', paddingLeft: '1.25rem', lineHeight: 1.6, color: '#003060' }}>
                <li>Abre tu hoja de cálculo <strong>"Levantamiento de Observaciones Amazonas"</strong> en Google Drive.</li>
                <li>En el menú superior ve a: <strong>Extensiones</strong> ➔ <strong>Apps Script</strong>.</li>
                <li>Borra cualquier texto existente en el editor y pega el código que aparece abajo.</li>
                <li>Haz clic en el botón azul <strong>Implementar</strong> (arriba a la derecha) ➔ <strong>Nueva implementación</strong>.</li>
                <li>Selecciona el tipo <strong>Aplicación web</strong>, configura:
                  <ul style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>
                    <li><strong>Ejecutar como:</strong> <em>Yo (tu cuenta)</em></li>
                    <li><strong>Quién tiene acceso:</strong> <em>Cualquier usuario</em></li>
                  </ul>
                  Haz clic en <strong>Implementar</strong>, copia la URL que termina en <code>/exec</code> y pégala en el campo Webhook del sistema.
                </li>
              </ol>

              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={handleCopiarCodigo}
                  style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: codigoCopiado ? '#16a34a' : '#003060',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontWeight: 'var(--fw-semibold)'
                  }}
                  className="t-caption"
                >
                  {codigoCopiado ? '✓ Copiado' : '📋 Copiar Código'}
                </button>
                <pre
                  style={{
                    background: '#0f172a',
                    color: '#f8fafc',
                    padding: '1.25rem',
                    borderRadius: '8px',
                    fontSize: 'var(--text-caption)',
                    lineHeight: 1.5,
                    overflowX: 'auto',
                    maxHeight: '320px'
                  }}
                >
                  <code>{APPS_SCRIPT_SOURCE_CODE}</code>
                </pre>
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="modal-preview-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-reportes-action"
                onClick={() => setModalCodigoOpen(false)}
              >
                <span>Cerrar</span>
              </button>
              <button
                type="button"
                className="btn-reportes-action btn-reportes-primary"
                onClick={handleCopiarCodigo}
                style={{ background: '#003060', color: '#ffffff' }}
              >
                <span>{codigoCopiado ? '✓ Código Copiado' : '📋 Copiar Código'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
