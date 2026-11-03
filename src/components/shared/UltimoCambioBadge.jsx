import { useState, useEffect, useCallback } from 'react'
import { UserCheck, Clock, History, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { fetchUltimoCambioObservacion } from '../../services/auditoriaSyncService'
import HistorialEstadosTimeline from './HistorialEstadosTimeline'
import { estadoCovepaBadge } from '../../utils/helpers'

/**
 * Formatea un timestamp ISO a tiempo relativo legible en español (hora de Perú)
 */
function formatTiempoRelativo(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    const diffMs = Date.now() - d.getTime()
    if (diffMs < 0) return 'hace un momento'
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'hace un momento'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `hace ${diffMin} ${diffMin === 1 ? 'min' : 'mins'}`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays <= 7) return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return ''
  }
}

/**
 * Formatea fecha y hora completa para tooltip y auditoría
 */
function formatFechaCompleta(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    const fecha = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })
    return `${fecha} · ${hora}`
  } catch {
    return String(isoStr)
  }
}

/**
 * Componente Insignia de Último Cambio (Auditoría Directa en Modal/Tarjeta)
 * Exhibe el nombre del usuario de la cuenta que realizó el cambio más reciente
 * y permite desplegar la trazabilidad cronológica con un solo clic.
 */
export default function UltimoCambioBadge({
  idObs,
  refreshKey = 0,
  initialOpen = false,
  showTimeline = true,
  className = ''
}) {
  const [data, setData] = useState({ latest: null, count: 0 })
  const [loading, setLoading] = useState(true)
  const [timelineOpen, setTimelineOpen] = useState(initialOpen)

  const loadLatest = useCallback(async () => {
    if (!idObs) return
    setLoading(true)
    try {
      const res = await fetchUltimoCambioObservacion(idObs)
      setData(res)
    } finally {
      setLoading(false)
    }
  }, [idObs])

  useEffect(() => {
    loadLatest()
  }, [idObs, refreshKey, loadLatest])

  const { latest, count } = data

  return (
    <div className={`obs-audit-badge-wrapper ${className}`}>
      <div className={`obs-ultimo-cambio-card ${timelineOpen ? 'is-expanded' : ''}`}>
        <div className="obs-ultimo-cambio-left">
          <UserCheck size={13} className="obs-ultimo-cambio-icon" />
          <span className="obs-ultimo-cambio-label">Último cambio:</span>
          {loading ? (
            <span className="obs-ultimo-cambio-loading">
              <Loader2 size={11} className="animate-spin" /> Consultando...
            </span>
          ) : latest ? (
            <>
              <strong
                className="obs-ultimo-cambio-author"
                title={latest.usuario_email ? `Cuenta: ${latest.usuario_email}\nRegistrado: ${formatFechaCompleta(latest.created_at)}` : ''}
              >
                {latest.usuario_nombre || 'Usuario del Sistema'}
              </strong>
              {latest.estado_nuevo && (
                <span className={`obs-ultimo-cambio-action estado-badge ${estadoCovepaBadge(latest.estado_nuevo)}`}>
                  {latest.estado_nuevo}
                </span>
              )}
            </>
          ) : (
            <span className="obs-ultimo-cambio-none">Sin modificaciones registradas</span>
          )}
        </div>

        <div className="obs-ultimo-cambio-right">
          {!loading && latest?.created_at && (
            <div
              className="obs-ultimo-cambio-time-wrap"
              title={`Fecha y hora exacta: ${formatFechaCompleta(latest.created_at)}`}
            >
              <Clock size={11} />
              <span className="obs-ultimo-cambio-time">{formatTiempoRelativo(latest.created_at)}</span>
            </div>
          )}

          {showTimeline && count > 0 && (
            <button
              type="button"
              onClick={() => setTimelineOpen(prev => !prev)}
              className={`obs-ultimo-cambio-btn ${timelineOpen ? 'is-active' : ''}`}
              title="Ver u ocultar trazabilidad completa de cambios"
            >
              <History size={11} />
              <span>Historial ({count})</span>
              {timelineOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>
      </div>

      {showTimeline && timelineOpen && (
        <div className="obs-audit-badge-timeline">
          <HistorialEstadosTimeline idObs={idObs} refreshKey={refreshKey} />
        </div>
      )}
    </div>
  )
}
