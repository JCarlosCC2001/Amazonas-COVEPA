import React, { useState, useMemo } from 'react'
import { X, RefreshCw, Trash2, Search, ExternalLink, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { formatPeruDateTime, isHoyPeru } from '../../utils/helpers'

export default function ModalHistorialEnvios({
  isOpen,
  onClose,
  historial = [],
  loading = false,
  onRefrescar,
  onLimpiarHoy
}) {
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  const historialFiltrado = useMemo(() => {
    return (historial || []).filter(item => {
      const q = busqueda.toLowerCase().trim()
      const matchTipo =
        filtroTipo === 'todos' ||
        (filtroTipo === 'oficial' && (item.tipo === 'oficial' || item.tipo === 'manual')) ||
        (filtroTipo === 'prueba' && item.tipo === 'prueba') ||
        (filtroTipo === 'exitoso' && item.estado === 'exitoso') ||
        (filtroTipo === 'fallido' && (item.estado === 'fallido' || item.estado === 'error'))

      if (!matchTipo) return false
      if (!q) return true

      const asunto = (item.asunto || '').toLowerCase()
      const dest = (Array.isArray(item.destinatarios) ? item.destinatarios.join(' ') : String(item.destinatarios || '')).toLowerCase()
      const actor = (item.actor || '').toLowerCase()
      const estado = (item.estado || '').toLowerCase()

      return asunto.includes(q) || dest.includes(q) || actor.includes(q) || estado.includes(q)
    })
  }, [historial, filtroTipo, busqueda])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '960px',
          height: '85vh',
          maxHeight: '780px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #cbd5e1',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="#003060" />
            <h3 className="t-name" style={{ margin: 0, color: '#003060' }}>
              Historial y Auditoría de Envíos de Reportes
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Filtros y Acciones */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            backgroundColor: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Buscar por destinatario, asunto o estado..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="t-body"
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2.1rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={onRefrescar}
                disabled={loading}
                className="t-badge"
                style={{
                  padding: '0.45rem 0.8rem',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#003060',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>{loading ? 'Actualizando...' : 'Actualizar'}</span>
              </button>

              {onLimpiarHoy && (
                <button
                  type="button"
                  onClick={onLimpiarHoy}
                  className="t-badge"
                  style={{
                    padding: '0.45rem 0.8rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title="Permite que el cron vuelva a enviar el reporte si ya se había despachado hoy"
                >
                  <Trash2 size={13} />
                  <span>Limpiar Envío de Hoy</span>
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'oficial', label: 'Oficiales' },
              { id: 'prueba', label: 'Pruebas' },
              { id: 'exitoso', label: 'Exitosos' },
              { id: 'fallido', label: 'Fallidos' }
            ].map(f => {
              const active = filtroTipo === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroTipo(f.id)}
                  className="t-badge"
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: '5px',
                    border: `1px solid ${active ? '#0284c7' : '#e2e8f0'}`,
                    background: active ? '#eff6ff' : '#ffffff',
                    color: active ? '#0284c7' : '#64748b',
                    cursor: 'pointer',
                    fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-normal)'
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tabla de Historial */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                <th style={{ padding: '0.6rem 0.75rem', color: '#003060' }} className="t-badge">Fecha / Hora</th>
                <th style={{ padding: '0.6rem 0.75rem', color: '#003060' }} className="t-badge">Tipo</th>
                <th style={{ padding: '0.6rem 0.75rem', color: '#003060' }} className="t-badge">Destinatario(s)</th>
                <th style={{ padding: '0.6rem 0.75rem', color: '#003060' }} className="t-badge">Métricas</th>
                <th style={{ padding: '0.6rem 0.75rem', color: '#003060' }} className="t-badge">Estado</th>
                <th style={{ padding: '0.6rem 0.75rem', color: '#003060', textAlign: 'right' }} className="t-badge">Acción</th>
              </tr>
            </thead>
            <tbody>
              {historialFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                    <span className="t-meta">No se encontraron envíos que coincidan con los filtros seleccionados.</span>
                  </td>
                </tr>
              ) : (
                historialFiltrado.map((h, i) => {
                  const isHoy = isHoyPeru ? isHoyPeru(h.created_at) : false
                  const isPrueba = h.tipo === 'prueba'
                  const isExitoso = h.estado === 'exitoso'
                  const destStr = Array.isArray(h.destinatarios) ? h.destinatarios.join(', ') : String(h.destinatarios || '')

                  return (
                    <tr
                      key={h.id || i}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc'
                      }}
                    >
                      {/* Fecha */}
                      <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span className="t-meta" style={{ color: '#003060', fontWeight: 'var(--fw-medium)' }}>
                            {formatPeruDateTime ? formatPeruDateTime(h.created_at) : (h.created_at ? new Date(h.created_at).toLocaleString('es-PE') : '-')}
                          </span>
                          {isHoy && (
                            <span className="t-badge" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '1px 5px', borderRadius: '4px' }}>
                              Hoy
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tipo */}
                      <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                        {isPrueba ? (
                          <span className="t-badge" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '2px 6px', borderRadius: '4px' }}>
                            🧪 Prueba
                          </span>
                        ) : (
                          <span className="t-badge" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 6px', borderRadius: '4px' }}>
                            🚀 Oficial
                          </span>
                        )}
                      </td>

                      {/* Destinatarios */}
                      <td style={{ padding: '0.65rem 0.75rem', maxWidth: '280px' }}>
                        <span className="t-meta" style={{ color: '#334155', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={destStr}>
                          {destStr || (h.actor ? `Por @${h.actor}` : 'Destinatarios oficiales')}
                        </span>
                      </td>

                      {/* Métricas */}
                      <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                        {h.total_obs !== null && h.total_obs !== undefined ? (
                          <span className="t-meta" style={{ color: '#003060', fontWeight: 'var(--fw-medium)' }}>
                            {h.total_obs} obs ({h.validadas || 0} val · {h.rechazadas || 0} rech)
                          </span>
                        ) : h.run_number ? (
                          <span className="t-meta" style={{ color: '#64748b' }}>
                            Run #{h.run_number}
                          </span>
                        ) : (
                          <span className="t-meta" style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                        {isExitoso ? (
                          <span className="t-badge" style={{ color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={13} color="#16a34a" /> Exitoso
                          </span>
                        ) : (
                          <span className="t-badge" style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={13} color="#dc2626" /> Fallido
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                        {h.url_log ? (
                          <a
                            href={h.url_log}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="t-badge"
                            style={{
                              color: '#0284c7',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff'
                            }}
                          >
                            <span>Ver log</span>
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span className="t-meta" style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pie */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            backgroundColor: '#ffffff'
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-primary">
            Cerrar Historial
          </button>
        </div>
      </div>
    </div>
  )
}

