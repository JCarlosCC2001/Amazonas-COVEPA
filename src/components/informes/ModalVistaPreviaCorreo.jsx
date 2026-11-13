import React from 'react'
import { X, Send, Paperclip, Mail } from 'lucide-react'

export default function ModalVistaPreviaCorreo({
  isOpen,
  onClose,
  htmlContent,
  asunto,
  destinatarios = [],
  destinatariosCC = [],
  adjuntoNombre = '',
  onEnviarPrueba,
  despachando = false
}) {
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
          maxWidth: '920px',
          height: '90vh',
          maxHeight: '840px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #cbd5e1',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera del modal */}
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
            <Mail size={18} color="#003060" />
            <h3 className="t-name" style={{ margin: 0, color: '#003060' }}>
              Vista Previa del Correo Oficial
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
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Cerrar vista previa"
          >
            <X size={20} />
          </button>
        </div>

        {/* Ficha técnica del correo (Para, CC, Asunto, Adjunto) */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span className="t-badge" style={{ color: '#475569', minWidth: '60px' }}>Para:</span>
            <span className="t-meta" style={{ color: '#0284c7', fontWeight: 'var(--fw-medium)' }}>
              {destinatarios.length > 0 ? destinatarios.join(', ') : '(Sin destinatarios principales)'}
            </span>
          </div>

          {destinatariosCC.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span className="t-badge" style={{ color: '#475569', minWidth: '60px' }}>CC:</span>
              <span className="t-meta" style={{ color: '#64748b' }}>
                {destinatariosCC.join(', ')}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span className="t-badge" style={{ color: '#475569', minWidth: '60px' }}>Asunto:</span>
            <span className="t-meta" style={{ color: '#0f172a', fontWeight: 'var(--fw-semibold)' }}>
              {asunto || 'Reporte de Observaciones'}
            </span>
          </div>

          {adjuntoNombre && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
              <span className="t-badge" style={{ color: '#475569', minWidth: '60px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Paperclip size={12} /> Adjunto:
              </span>
              <span className="t-badge" style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px'
              }}>
                {adjuntoNombre}
              </span>
            </div>
          )}
        </div>

        {/* Cuerpo aislado en iframe */}
        <div style={{ flex: 1, backgroundColor: '#f1f5f9', padding: '0.75rem', overflow: 'hidden' }}>
          <iframe
            title="Vista previa del correo"
            srcDoc={htmlContent}
            style={{
              width: '100%',
              height: '100%',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              backgroundColor: '#ffffff'
            }}
          />
        </div>

        {/* Pie con acciones */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff'
          }}
        >
          {onEnviarPrueba ? (
            <button
              type="button"
              onClick={onEnviarPrueba}
              disabled={despachando}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Send size={15} />
              <span>{despachando ? 'Despachando prueba...' : 'Enviar Correo de Prueba'}</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
          >
            Cerrar Vista Previa
          </button>
        </div>
      </div>
    </div>
  )
}

