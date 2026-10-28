import { useState, useEffect } from 'react'
import {
  Clock, ArrowRight, User, MessageSquare, Calendar,
  History, AlertCircle, Loader2, RefreshCw
} from 'lucide-react'
import { fetchHistorialObservacion } from '../../services/auditoriaSyncService'
import { estadoCovepaBadge } from '../../utils/helpers'

/**
 * Componente de Línea de Tiempo para el Historial de Cambios de Estado
 * Muestra la trazabilidad cronológica de dictámenes y motivos de una observación técnica.
 */
export default function HistorialEstadosTimeline({ idObs, refreshKey = 0 }) {
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadHistorial = async () => {
    if (!idObs) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHistorialObservacion(idObs)
      setHistorial(data || [])
    } catch (err) {
      console.error('Error cargando historial de observación:', err)
      setError('No se pudo cargar el historial.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistorial()
  }, [idObs, refreshKey])

  const formatFechaHora = (isoStr) => {
    if (!isoStr) return '—'
    try {
      const d = new Date(isoStr)
      if (isNaN(d.getTime())) return String(isoStr)
      const fecha = d.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      const hora = d.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
      return `${fecha} · ${hora}`
    } catch {
      return String(isoStr).slice(0, 16)
    }
  }

  const formatOrigen = (origen) => {
    if (!origen) return 'Web ERP'
    if (origen === 'programacion') return 'Programación'
    if (origen === 'observaciones') return 'Observaciones'
    if (origen === 'app_fotos' || origen === 'app_movil') return 'App Fotos'
    if (origen === 'sistema_trigger') return 'Sistema (Trigger)'
    return origen
  }

  return (
    <div className="historial-timeline-container">
      <div className="historial-timeline-topbar">
        <div className="historial-topbar-title">
          <History size={14} color="#003060" />
          <span>Trazabilidad de Estados ({historial.length})</span>
        </div>
        <button
          type="button"
          className="historial-refresh-btn"
          onClick={loadHistorial}
          disabled={loading}
          title="Actualizar historial"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refrescar</span>
        </button>
      </div>

      {loading && (
        <div className="historial-loading-state">
          <Loader2 size={16} className="animate-spin" color="#0284c7" />
          <span>Consultando historial de auditoría...</span>
        </div>
      )}

      {error && !loading && (
        <div className="historial-error-state">
          <AlertCircle size={15} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && historial.length === 0 && (
        <div className="historial-empty-state">
          <Clock size={16} color="#94a3b8" />
          <span>Aún no hay cambios de estado registrados para esta observación.</span>
        </div>
      )}

      {!loading && !error && historial.length > 0 && (
        <div className="historial-timeline-list">
          {historial.map((item, idx) => {
            const isLatest = idx === 0
            return (
              <div key={item.id || idx} className={`historial-timeline-item ${isLatest ? 'is-latest' : ''}`}>
                <div className="historial-timeline-marker">
                  <div className={`historial-timeline-dot ${estadoCovepaBadge(item.estado_nuevo)}`} />
                  {idx < historial.length - 1 && <div className="historial-timeline-line" />}
                </div>

                <div className="historial-timeline-card">
                  {/* Fila 1: Fecha/Hora y Canal de Origen */}
                  <div className="historial-timeline-header">
                    <div className="historial-timeline-date">
                      <Calendar size={11} color="#64748b" />
                      <span>{formatFechaHora(item.created_at)}</span>
                    </div>
                    <span className="historial-timeline-channel">
                      {formatOrigen(item.origen)}
                    </span>
                  </div>

                  {/* Fila 2: Transición de Estados */}
                  <div className="historial-timeline-transition">
                    {item.estado_anterior ? (
                      <>
                        <span className={`estado-badge ${estadoCovepaBadge(item.estado_anterior)}`}>
                          {item.estado_anterior}
                        </span>
                        <ArrowRight size={12} className="historial-arrow-icon" />
                        <span className={`estado-badge ${estadoCovepaBadge(item.estado_nuevo)}`}>
                          {item.estado_nuevo}
                        </span>
                      </>
                    ) : (
                      <span className={`estado-badge ${estadoCovepaBadge(item.estado_nuevo)}`}>
                        {item.estado_nuevo}
                      </span>
                    )}
                  </div>

                  {/* Fila 3: Responsable de cambio (usuario de la sesión activa) */}
                  <div className="historial-timeline-author">
                    <User size={11} color="#0284c7" />
                    <span>Responsable de cambio: <strong title={item.usuario_email ? `Cuenta: ${item.usuario_email}` : ''}>{item.usuario_nombre || 'Usuario de sesión'}</strong></span>
                  </div>

                  {/* Fila 4: Comentario o Nota de Dictamen (si existe) */}
                  {item.comentario && (
                    <div className="historial-timeline-comment">
                      <MessageSquare size={12} color="#0369a1" className="comment-icon" />
                      <div className="comment-text">"{item.comentario}"</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

