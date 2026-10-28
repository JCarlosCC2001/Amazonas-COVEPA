import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * ErrorBoundary robusto para evitar pantallas en blanco en la SPA.
 * Captura errores de red por inactividad, fallos en la carga dinámica de módulos (chunks)
 * o desincronizaciones de pestañas en segundo plano.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[COVEPA-ERROR-BOUNDARY] Error capturado en la aplicación:', error, errorInfo)

    // Si el error se debe a un fallo de red al descargar un chunk tras periodo de inactividad
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed')

    if (isChunkError) {
      const lastRetry = sessionStorage.getItem('covepa_chunk_retry')
      const now = Date.now()
      // Si no se ha reintentado en los últimos 10 segundos, recargar automáticamente
      if (!lastRetry || now - parseInt(lastRetry, 10) > 10000) {
        sessionStorage.setItem('covepa_chunk_retry', String(now))
        window.location.reload()
      }
    }
  }

  handleReload = () => {
    sessionStorage.removeItem('covepa_chunk_retry')
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            background: 'var(--color-bg, #080c14)',
            color: 'var(--color-text, #f8fafc)',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              background: 'var(--color-surface, #0d1526)',
              border: '1px solid var(--color-border, #1e293b)',
              borderRadius: '16px',
              padding: '2.5rem 2rem',
              maxWidth: '480px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                marginBottom: '1.25rem'
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h2
              className="t-title-section"
              style={{
                color: '#ffffff',
                marginBottom: '0.75rem'
              }}
            >
              Sesión o conexión desincronizada
            </h2>

            <p
              className="t-body"
              style={{
                color: '#94a3b8',
                lineHeight: '1.5',
                marginBottom: '1.75rem'
              }}
            >
              La pestaña estuvo en pausa o la red se suspendió temporalmente. Haz clic en el botón inferior para restablecer la conexión.
            </p>

            <button
              type="button"
              onClick={this.handleReload}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} />
              <span>Restablecer y Actualizar</span>
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
