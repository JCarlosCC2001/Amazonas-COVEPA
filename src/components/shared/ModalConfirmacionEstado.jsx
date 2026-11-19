import React, { useEffect } from 'react'
import { AlertTriangle, Camera, XCircle, AlertCircle, X, Check, ArrowRight, MapPin, Ban } from 'lucide-react'
import { estadoCovepaBadge } from '../../utils/helpers'

// Estados que requieren confirmación obligatoria mediante ventana emergente
const ESTADOS_CONFIRMACION = new Set(['Crítico', 'Critico', 'Descartado', 'Pre-validado'])

export function esEstadoRequiereConfirmacion(estado) {
  if (!estado) return false
  return ESTADOS_CONFIRMACION.has(estado.trim())
}

// Estados protegidos exclusivos de Administrador
const ESTADOS_PROTEGIDOS = new Set(['Pre-validado', 'Crítico', 'Critico', 'Descartado'])

export function esEstadoProtegido(estado) {
  if (!estado) return false
  return ESTADOS_PROTEGIDOS.has(estado.trim())
}

export default function ModalConfirmacionEstado({
  isOpen,
  onClose,
  onConfirm,
  idObs,
  idSitio,
  localidad,
  estadoAnterior,
  estadoNuevo,
  loading = false
}) {
  // Manejo de teclado: Escape para cancelar
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, loading, onClose])

  if (!isOpen) return null

  const estNormal = (estadoNuevo || '').trim()
  let themeVariant = 'default'
  let icon = <AlertCircle size={22} />
  let title = 'Confirmar Cambio de Estado'
  let textoExplicativo = '¿Estás seguro de que deseas actualizar el estado de esta observación?'

  if (estNormal === 'Crítico' || estNormal === 'Critico') {
    themeVariant = 'critico'
    icon = <AlertTriangle size={22} />
    title = 'Confirmar pase a Crítico'
    textoExplicativo = 'Esta observación será clasificada como CRÍTICA. No se ejecutará en campo y se limpiará cualquier fecha o revisor asociado.'
  } else if (estNormal === 'Descartado') {
    themeVariant = 'descartado'
    icon = <Ban size={22} />
    title = 'Confirmar pase a Descartado'
    textoExplicativo = 'Esta observación será clasificada como DESCARTADA. Se considerará no aplicable o no subsanable según los acuerdos técnicos del proyecto.'
  } else if (estNormal === 'Pre-validado') {
    themeVariant = 'pre-validado'
    icon = <Camera size={22} />
    title = 'Confirmar pase a Pre-validado'
    textoExplicativo = 'Esta observación quedará marcada como PRE-VALIDADA. Indica que la subsanación técnica se realizó en campo y queda pendiente de sustento fotográfico.'
  } else if (esEstadoRequiereConfirmacion(estadoAnterior)) {
    themeVariant = 'warning'
    icon = <AlertCircle size={22} />
    title = `Cambiar desde estado ${estadoAnterior}`
    textoExplicativo = `La observación actualmente tiene el estado protegido "${estadoAnterior}". Al cambiarla a "${estadoNuevo}", se modificarán sus condiciones de auditoría.`
  }

  return (
    <div
      className="modal-confirm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div className="modal-confirm-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera Corporativa */}
        <div className="modal-confirm-header">
          <div className="modal-confirm-header-left">
            <div className={`modal-confirm-icon-box ${themeVariant}`}>
              {icon}
            </div>
            <div className="modal-confirm-header-texts">
              <h3 className="modal-confirm-title">{title}</h3>
              <span className="modal-confirm-subtitle">Acción reservada para Administrador</span>
            </div>
          </div>
          <button
            type="button"
            className="modal-confirm-close-btn"
            onClick={onClose}
            disabled={loading}
            title="Cancelar (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="modal-confirm-body">
          {/* Identificación de la Observación y Sitio */}
          <div className="modal-confirm-context-card">
            <div className="modal-confirm-context-top">
              <span className="modal-confirm-code-badge">{idObs}</span>
              <span className="modal-confirm-role-tag">Auditoría COVEPA</span>
            </div>
            <div className="modal-confirm-site-info">
              <MapPin size={13} color="#0284c7" />
              <span><strong>{idSitio}</strong>{localidad ? ` · ${localidad}` : ''}</span>
            </div>
          </div>

          {/* Transición Visual de Estados */}
          <div className="modal-confirm-transition-box">
            <div className="modal-confirm-step">
              <span className="modal-confirm-step-label">Estado Actual</span>
              <span className={`estado-badge ${estadoCovepaBadge(estadoAnterior)}`} style={{ margin: 0 }}>
                {estadoAnterior || 'Pendiente'}
              </span>
            </div>
            <div className="modal-confirm-arrow-wrap">
              <ArrowRight size={14} color="#64748b" />
            </div>
            <div className="modal-confirm-step">
              <span className="modal-confirm-step-label">Nuevo Estado</span>
              <span className={`estado-badge ${estadoCovepaBadge(estadoNuevo)}`} style={{ margin: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                {estadoNuevo}
              </span>
            </div>
          </div>

          {/* Mensaje de Advertencia / Impacto */}
          <div className={`modal-confirm-alert-box ${themeVariant}`}>
            <p className="modal-confirm-alert-text">
              {textoExplicativo}
            </p>
          </div>
        </div>

        {/* Pie de Acciones */}
        <div className="modal-confirm-footer">
          <button
            type="button"
            className="modal-confirm-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`modal-confirm-btn-action ${themeVariant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span>Guardando...</span>
            ) : (
              <>
                <Check size={16} />
                <span>Confirmar Cambio</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
