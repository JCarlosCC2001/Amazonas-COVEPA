import React, { useState, useEffect, useMemo } from 'react'
import {
  getStoredSheetsConfig,
  saveStoredSheetsConfig,
  getStoredUltimoSync,
  fetchDatosParaGoogleSheets,
  sincronizarGoogleSheets,
  APPS_SCRIPT_SOURCE_CODE
} from '../../services/googleSheetsSyncService'
import { RefreshCw, ExternalLink, Code2, Check, AlertCircle } from 'lucide-react'

export default function ReporteExcelOnlinePanel() {
  const [config, setConfig] = useState(getStoredSheetsConfig)
  const [ultimoSync, setUltimoSync] = useState(getStoredUltimoSync)
  const [datosSheets, setDatosSheets] = useState({ original: [], ampliacion: [], total: 0 })
  const [loadingDatos, setLoadingDatos] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [probandoWebhook, setProbandoWebhook] = useState(false)
  const [modalCodigoOpen, setModalCodigoOpen] = useState(false)
  const [codigoCopiado, setCodigoCopiado] = useState(false)
  const [mensajeEstado, setMensajeEstado] = useState(null)

  // Filtros de vista previa
  const [tabActiva, setTabActiva] = useState('ORIGINAL') // 'ORIGINAL' | 'AMPLIACION'
  const [busqueda, setBusqueda] = useState('')

  const mostrarMensaje = (texto, tipo = 'success') => {
    setMensajeEstado({ texto, tipo })
    setTimeout(() => setMensajeEstado(null), 6000)
  }

  // Cargar datos en vivo de Supabase
  const cargarDatos = async () => {
    setLoadingDatos(true)
    try {
      const data = await fetchDatosParaGoogleSheets()
      setDatosSheets(data)
    } catch (err) {
      console.error('Error cargando datos para Google Sheets:', err)
      mostrarMensaje('Error al cargar datos de observaciones: ' + err.message, 'error')
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
      mostrarMensaje('Configuración de Google Sheets guardada correctamente.', 'success')
    } else {
      mostrarMensaje('Error al guardar la configuración.', 'error')
    }
  }

  // Probar conexión con el Webhook de Google Apps Script
  const handleProbarConexion = async () => {
    if (!config.webhookUrl || !config.webhookUrl.trim()) {
      mostrarMensaje('Ingresa la URL del Webhook de Apps Script primero.', 'error')
      return
    }
    setProbandoWebhook(true)
    try {
      const res = await fetch(config.webhookUrl.trim(), { method: 'GET' })
      const json = await res.json()
      if (json && (json.status === 'online' || json.sistema)) {
        mostrarMensaje('✅ ¡Conexión exitosa con el Webhook de Google Apps Script!', 'success')
      } else {
        mostrarMensaje('El webhook respondió pero con un formato inesperado.', 'info')
      }
    } catch (err) {
      console.warn('Test webhook aviso:', err)
      mostrarMensaje('No se pudo verificar el Webhook vía GET. Asegúrate de implementar con acceso a Cualquier usuario.', 'info')
    } finally {
      setProbandoWebhook(false)
    }
  }

  // Ejecutar sincronización manual en tiempo real
  const handleSincronizarAhora = async () => {
    if (!config.webhookUrl || !config.webhookUrl.trim()) {
      mostrarMensaje('Debes configurar la URL del Webhook de Apps Script antes de sincronizar.', 'error')
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

      mostrarMensaje(
        `✅ ¡Hoja de cálculo actualizada con éxito! ${resSync.totalUpdated} filas modificadas (${resSync.updatedOriginal} Original · ${resSync.updatedAmpliacion} Ampliación).`,
        'success'
      )
    } catch (err) {
      console.error('Error al sincronizar con Google Sheets:', err)
      mostrarMensaje(`Error en la sincronización: ${err.message}`, 'error')
    } finally {
      setSincronizando(false)
    }
  }

  // Copiar código de Apps Script al portapapeles
  const handleCopiarCodigo = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_SOURCE_CODE)
    setCodigoCopiado(true)
    mostrarMensaje('Código copiado al portapapeles. Pégalo en Extensiones > Apps Script.', 'success')
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Alerta de Notificación Temporal */}
      {mensajeEstado && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            backgroundColor: mensajeEstado.tipo === 'error' ? '#fee2e2' : mensajeEstado.tipo === 'info' ? '#e0f2fe' : '#dcfce7',
            color: mensajeEstado.tipo === 'error' ? '#991b1b' : mensajeEstado.tipo === 'info' ? '#0369a1' : '#166534',
            border: `1px solid ${mensajeEstado.tipo === 'error' ? '#fca5a5' : mensajeEstado.tipo === 'info' ? '#7dd3fc' : '#86efac'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}
        >
          <span className="t-body" style={{ fontWeight: 'var(--fw-semibold)' }}>
            {mensajeEstado.tipo === 'error' ? '❌' : mensajeEstado.tipo === 'info' ? 'ℹ️' : '✅'} {mensajeEstado.texto}
          </span>
          <button
            type="button"
            onClick={() => setMensajeEstado(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'var(--fw-bold)' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Cabecera del Panel con Botón de Actualización Manual */}
      <div style={{ background: '#ffffff', border: '1px solid #d8e5f1', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 className="t-title-section" style={{ color: '#003060', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📗</span> Reporte Excel en Línea (Google Sheets)
            </h3>
            <p className="t-body" style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0 0' }}>
              Sincronización y actualización manual de Cuadrilla, Técnico, Estado, Fecha y Revisor en tus pestañas <strong>Amazonas Original</strong> y <strong>Amazonas Ampliación</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {config.urlHoja && (
              <a
                href={config.urlHoja}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
              >
                <ExternalLink size={14} />
                <span>Abrir Google Sheets</span>
              </a>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModalCodigoOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Code2 size={14} />
              <span>Ver Código Apps Script</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSincronizarAhora}
              disabled={sincronizando || loadingDatos}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#166534',
                borderColor: '#14532d',
                color: '#ffffff',
                padding: '0.55rem 1.15rem'
              }}
            >
              <RefreshCw size={15} className={sincronizando ? 'animate-spin' : ''} />
              <span style={{ fontWeight: 'var(--fw-bold)' }}>
                {sincronizando ? 'Actualizando Hoja...' : 'Actualizar Hoja de Cálculo Ahora'}
              </span>
            </button>
          </div>
        </div>

        {/* 4 KPIs de Estado */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '0.85rem',
            marginTop: '1.25rem'
          }}
        >
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
            <div className="t-meta" style={{ color: 'var(--text-secondary)' }}>Amazonas Original</div>
            <div className="t-title-section" style={{ color: '#003060', margin: '0.25rem 0', fontVariantNumeric: 'tabular-nums' }}>
              {loadingDatos ? '...' : `${datosSheets.original.length} obs`}
            </div>
            <span className="t-caption" style={{ color: '#64748b' }}>Pestaña "Amazonas Original"</span>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
            <div className="t-meta" style={{ color: 'var(--text-secondary)' }}>Amazonas Ampliación</div>
            <div className="t-title-section" style={{ color: '#003060', margin: '0.25rem 0', fontVariantNumeric: 'tabular-nums' }}>
              {loadingDatos ? '...' : `${datosSheets.ampliacion.length} obs`}
            </div>
            <span className="t-caption" style={{ color: '#64748b' }}>Pestaña "Amazonas Ampliación"</span>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
            <div className="t-meta" style={{ color: 'var(--text-secondary)' }}>Última Actualización</div>
            <div className="t-name" style={{ color: '#003060', margin: '0.25rem 0', fontWeight: 'var(--fw-bold)' }}>
              {ultimoSync ? formatoFechaPeru(ultimoSync.fecha) : 'Pendiente'}
            </div>
            <span className="t-caption" style={{ color: ultimoSync ? '#15803d' : '#b91c1c' }}>
              {ultimoSync ? `${ultimoSync.totalUpdated} filas modificadas` : 'Sin ejecuciones previas'}
            </span>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
            <div className="t-meta" style={{ color: 'var(--text-secondary)' }}>Estado Webhook</div>
            <div className="t-name" style={{ color: config.webhookUrl ? '#15803d' : '#92400e', margin: '0.25rem 0', fontWeight: 'var(--fw-bold)' }}>
              {config.webhookUrl ? '● En Línea Conectado' : '● Falta Configurar'}
            </div>
            <span className="t-caption" style={{ color: '#64748b' }}>Apps Script Web App</span>
          </div>
        </div>
      </div>

      {/* Panel Dividido: Configuración y Datos a Sincronizar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Parámetros de Conexión */}
        <div style={{ background: '#ffffff', border: '1px solid #d8e5f1', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <h4 className="t-name" style={{ color: '#003060', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚙️</span> Parámetros de Conexión
          </h4>

          <form onSubmit={handleGuardarConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                URL de tu Hoja de Cálculo:
              </label>
              <input
                type="url"
                value={config.urlHoja}
                onChange={(e) => setConfig({ ...config, urlHoja: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="t-body"
                style={{ padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label className="t-meta" style={{ fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                URL del Webhook (Apps Script):
              </label>
              <input
                type="url"
                value={config.webhookUrl}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="t-body"
                style={{ padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem' }}>
              <div className="t-meta" style={{ fontWeight: 'var(--fw-bold)', color: '#003060', marginBottom: '0.25rem' }}>
                Columnas Actualizadas en Google Sheets:
              </div>
              <ul className="t-caption" style={{ margin: 0, paddingLeft: '1.2rem', color: '#475569', lineHeight: 1.5 }}>
                <li><strong>Columna A:</strong> Código Obs <em>(Búsqueda)</em></li>
                <li><strong>Columna D:</strong> Cuadrilla Ejecutora</li>
                <li><strong>Columna E:</strong> Técnico Asignado</li>
                <li><strong>Columna F:</strong> Estado</li>
                <li><strong>Columna G:</strong> Fecha Actualización <em>(DD/MM/YYYY)</em></li>
                <li><strong>Columna H:</strong> Revisor</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Check size={14} />
                <span>Guardar Parámetros</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleProbarConexion}
                disabled={probandoWebhook}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <RefreshCw size={14} className={probandoWebhook ? 'animate-spin' : ''} />
                <span>{probandoWebhook ? 'Verificando...' : 'Probar Conexión'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Visualizador de Datos a Sincronizar */}
        <div style={{ background: '#ffffff', border: '1px solid #d8e5f1', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h4 className="t-name" style={{ color: '#003060', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>👁️</span> Datos a Sincronizar
            </h4>

            {/* Pestañas Original vs Ampliación */}
            <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '0.2rem', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setTabActiva('ORIGINAL')}
                style={{
                  border: 'none',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: tabActiva === 'ORIGINAL' ? '#003060' : 'transparent',
                  color: tabActiva === 'ORIGINAL' ? '#ffffff' : '#475569',
                  fontWeight: 'var(--fw-semibold)'
                }}
                className="t-caption"
              >
                Original ({datosSheets.original.length})
              </button>
              <button
                type="button"
                onClick={() => setTabActiva('AMPLIACION')}
                style={{
                  border: 'none',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: tabActiva === 'AMPLIACION' ? '#003060' : 'transparent',
                  color: tabActiva === 'AMPLIACION' ? '#ffffff' : '#475569',
                  fontWeight: 'var(--fw-semibold)'
                }}
                className="t-caption"
              >
                Ampliación ({datosSheets.ampliacion.length})
              </button>
            </div>
          </div>

          {/* Buscador */}
          <div style={{ marginBottom: '0.75rem' }}>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código (ej: C-4427, H1-OC-...), técnico o estado..."
              className="t-body"
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          {/* Tabla de Códigos */}
          <div style={{ overflowX: 'auto', maxHeight: '360px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#003060', color: '#ffffff' }}>
                  <th className="t-badge" style={{ padding: '0.5rem 0.6rem' }}>Código Obs</th>
                  <th className="t-badge" style={{ padding: '0.5rem 0.6rem' }}>Cuadrilla</th>
                  <th className="t-badge" style={{ padding: '0.5rem 0.6rem' }}>Técnico</th>
                  <th className="t-badge" style={{ padding: '0.5rem 0.6rem' }}>Estado</th>
                  <th className="t-badge" style={{ padding: '0.5rem 0.6rem' }}>Fecha</th>
                  <th className="t-badge" style={{ padding: '0.5rem 0.6rem' }}>Revisor</th>
                </tr>
              </thead>
              <tbody>
                {loadingDatos ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }} className="t-meta">
                      Cargando datos de observaciones...
                    </td>
                  </tr>
                ) : listaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }} className="t-meta">
                      No se encontraron registros.
                    </td>
                  </tr>
                ) : (
                  listaFiltrada.map((item, idx) => (
                    <tr
                      key={item.id_obs || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                      }}
                    >
                      <td className="t-meta" style={{ padding: '0.4rem 0.6rem', fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                        {item.id_obs}
                      </td>
                      <td className="t-caption" style={{ padding: '0.4rem 0.6rem' }}>
                        {item.cuadrilla || '—'}
                      </td>
                      <td className="t-caption" style={{ padding: '0.4rem 0.6rem' }}>
                        {item.tecnico || '—'}
                      </td>
                      <td className="t-caption" style={{ padding: '0.4rem 0.6rem' }}>
                        <span
                          className="t-badge"
                          style={{
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            background: item.estado === 'Descartado' ? '#fee2e2' : item.estado === 'Subsanada' ? '#dcfce7' : item.estado === 'Solicitando Revisión' ? '#fef3c7' : '#f1f5f9',
                            color: item.estado === 'Descartado' ? '#991b1b' : item.estado === 'Subsanada' ? '#15803d' : item.estado === 'Solicitando Revisión' ? '#92400e' : '#475569'
                          }}
                        >
                          {item.estado}
                        </span>
                      </td>
                      <td className="t-caption" style={{ padding: '0.4rem 0.6rem' }}>
                        {item.fecha || '—'}
                      </td>
                      <td className="t-caption" style={{ padding: '0.4rem 0.6rem' }}>
                        {item.revisor || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '0.4rem', textAlign: 'right' }}>
            <span className="t-caption" style={{ color: '#64748b' }}>
              Mostrando {listaFiltrada.length} de {listaActiva.length} observaciones
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
            style={{
              maxWidth: '820px',
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
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 className="t-title-section" style={{ color: '#003060', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📋</span> Código Google Apps Script para tu Hoja
                </h4>
                <p className="t-subtitle" style={{ margin: '0.25rem 0 0 0' }}>
                  Instrucciones para sincronizar con Google Drive
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalCodigoOpen(false)}
                className="t-title-section"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
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
                    maxHeight: '340px'
                  }}
                >
                  <code>{APPS_SCRIPT_SOURCE_CODE}</code>
                </pre>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalCodigoOpen(false)}>
                <span>Cerrar</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={handleCopiarCodigo} style={{ background: '#003060', color: '#ffffff' }}>
                <span>{codigoCopiado ? '✓ Copiado' : '📋 Copiar Código'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
