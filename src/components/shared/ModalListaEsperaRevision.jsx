import React, { useState, useEffect, useMemo } from 'react'
import {
  X, Search, Copy, Check, ExternalLink,
  ClipboardList, Clock, MapPin, User,
  AlertCircle, CheckCircle2, ArrowRight, Filter
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  calcWaitMins,
  formatWaitTime,
  getWaitTierInfo,
  formatTiempoRelativo,
  copyPlainCodesList
} from '../../context/NotificationContext'

export default function ModalListaEsperaRevision({
  isOpen,
  onClose,
  observaciones = [],
  sitiosMap = {}
}) {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroTiempo, setFiltroTiempo] = useState('todas') // 'todas' | 'urgentes' | 'mas1h' | 'recientes'
  const [copiedCodes, setCopiedCodes] = useState(false)
  const [copiedDetail, setCopiedDetail] = useState(false)

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Limpiar filtros al abrir
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('')
      setFiltroTiempo('todas')
      setCopiedCodes(false)
      setCopiedDetail(false)
    }
  }, [isOpen])

  // Normalizar y enriquecer lista con tiempos y localidades
  const itemsEnriquecidos = useMemo(() => {
    return (observaciones || [])
      .filter(obs => !obs.isReporteNotif && !obs.isAccumulationAlert)
      .map(obs => {
        const mins = obs.waitMins !== undefined ? obs.waitMins : calcWaitMins(obs.fecha_subsanacion)
        const localidad = obs.localidad || sitiosMap[obs.id_sitio] || ''
        const tier = getWaitTierInfo(mins)
        return {
          ...obs,
          waitMins: mins,
          waitText: formatWaitTime(mins),
          tiempoRelativo: formatTiempoRelativo(obs.fecha_subsanacion),
          localidad,
          tier
        }
      })
      .sort((a, b) => b.waitMins - a.waitMins) // Más antiguas/demoradas primero
  }, [observaciones, sitiosMap])

  // Filtrado reactivo por texto y tiempo
  const itemsFiltrados = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return itemsEnriquecidos.filter(item => {
      // Filtro de texto
      if (q) {
        const matchCode = (item.id_obs || '').toLowerCase().includes(q)
        const matchSite = (item.id_sitio || '').toLowerCase().includes(q)
        const matchLoc = (item.localidad || '').toLowerCase().includes(q)
        const matchSol = (item.solicitante || item.usuario_nombre || item.revisor || '').toLowerCase().includes(q)
        const matchSub = (item.subsistema || '').toLowerCase().includes(q)
        if (!matchCode && !matchSite && !matchLoc && !matchSol && !matchSub) return false
      }

      // Filtro de franja de tiempo
      if (filtroTiempo === 'urgentes') return item.waitMins >= 120 // >= 2 horas
      if (filtroTiempo === 'mas1h') return item.waitMins >= 60 && item.waitMins < 120 // 1 a 2 horas
      if (filtroTiempo === 'recientes') return item.waitMins < 60 // < 1 hora

      return true
    })
  }, [itemsEnriquecidos, searchTerm, filtroTiempo])

  // Copiar solo códigos simples (uno por línea)
  const handleCopyCodes = async () => {
    if (itemsFiltrados.length === 0) return
    const ok = await copyPlainCodesList(itemsFiltrados)
    if (ok) {
      setCopiedCodes(true)
      setTimeout(() => setCopiedCodes(false), 2500)
    }
  }

  // Copiar lista detallada (para informes o WhatsApp con Gilat)
  const handleCopyDetail = async () => {
    if (itemsFiltrados.length === 0) return
    const lineas = itemsFiltrados.map((it, idx) => {
      const tecnico = it.solicitante || it.usuario_nombre || it.revisor || 'Técnico en campo'
      return `${idx + 1}. ${it.id_obs} · ${it.id_sitio}${it.localidad ? ` (${it.localidad})` : ''} | Solicita: ${tecnico} | Espera: ${it.waitText}`
    })
    const fullText = `LISTA DE OBSERVACIONES A LA ESPERA DE REVISIÓN (${itemsFiltrados.length}):\n\n${lineas.join('\n')}`

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullText)
        setCopiedDetail(true)
        setTimeout(() => setCopiedDetail(false), 2500)
        return
      }
    } catch (_) {}

    // Fallback con textarea
    try {
      const ta = document.createElement('textarea')
      ta.value = fullText
      ta.style.position = 'fixed'
      ta.style.left = '-999999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedDetail(true)
      setTimeout(() => setCopiedDetail(false), 2500)
    } catch (_) {}
  }

  // Navegar a una observación específica
  const handleIrAObservacion = (idObs) => {
    onClose()
    navigate(`/observaciones?search=${encodeURIComponent(idObs)}`)
  }

  // Navegar al módulo de observaciones con filtro aplicado
  const handleVerTodasEnModulo = () => {
    onClose()
    navigate('/observaciones?estado=Solicitando Revisión')
  }

  if (!isOpen) return null

  const countUrgentes = itemsEnriquecidos.filter(i => i.waitMins >= 120).length
  const countMas1h = itemsEnriquecidos.filter(i => i.waitMins >= 60 && i.waitMins < 120).length
  const countRecientes = itemsEnriquecidos.filter(i => i.waitMins < 60).length

  return (
    <div
      className="modal-espera-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-espera-card" onClick={e => e.stopPropagation()}>
        {/* Cabecera del Modal */}
        <div className="modal-espera-header">
          <div className="modal-espera-header-left">
            <div className="modal-espera-icon-box">
              <ClipboardList size={22} color="#ea580c" />
            </div>
            <div>
              <div className="modal-espera-title-row">
                <h2 className="modal-espera-title">Observaciones a la Espera de Revisión</h2>
                <span className="modal-espera-count-badge">
                  {itemsEnriquecidos.length} {itemsEnriquecidos.length === 1 ? 'pendiente' : 'pendientes'}
                </span>
              </div>
              <p className="modal-espera-subtitle">
                Solicitudes de revisión enviadas por técnicos de campo que requieren validación por auditoría COVEPA.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-espera-close-btn"
            onClick={onClose}
            title="Cerrar ventana (Esc)"
            aria-label="Cerrar ventana"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de Herramientas: Búsqueda, Filtros y Acciones de Copiado */}
        <div className="modal-espera-toolbar">
          <div className="modal-espera-search-wrap">
            <Search size={15} className="modal-espera-search-icon" />
            <input
              type="text"
              className="modal-espera-search-input"
              placeholder="Buscar por código (C-...), sitio, localidad, técnico o subsistema..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                className="modal-espera-search-clear"
                onClick={() => setSearchTerm('')}
                title="Limpiar búsqueda"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="modal-espera-actions">
            <button
              type="button"
              className={`modal-espera-btn-action ${copiedCodes ? 'is-success' : ''}`}
              onClick={handleCopyCodes}
              disabled={itemsFiltrados.length === 0}
              title="Copiar solo códigos de observación (uno por línea) al portapapeles"
            >
              {copiedCodes ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedCodes ? '¡Códigos Copiados!' : `Copiar Códigos (${itemsFiltrados.length})`}</span>
            </button>

            <button
              type="button"
              className={`modal-espera-btn-action secondary ${copiedDetail ? 'is-success' : ''}`}
              onClick={handleCopyDetail}
              disabled={itemsFiltrados.length === 0}
              title="Copiar lista detallada con sitio, localidad y técnico"
            >
              {copiedDetail ? <Check size={14} /> : <ClipboardList size={14} />}
              <span>{copiedDetail ? '¡Detalle Copiado!' : 'Copiar con Detalle'}</span>
            </button>

            <button
              type="button"
              className="modal-espera-btn-action link"
              onClick={handleVerTodasEnModulo}
              title="Abrir vista de tabla completa en el módulo de Observaciones"
            >
              <span>Ver en Observaciones</span>
              <ExternalLink size={13} />
            </button>
          </div>
        </div>

        {/* Chips de Filtro por Tiempo de Espera */}
        <div className="modal-espera-chips-row">
          <span className="modal-espera-filter-label">
            <Filter size={12} /> Franja de espera:
          </span>
          <button
            type="button"
            className={`modal-espera-chip ${filtroTiempo === 'todas' ? 'active' : ''}`}
            onClick={() => setFiltroTiempo('todas')}
          >
            Todas ({itemsEnriquecidos.length})
          </button>
          <button
            type="button"
            className={`modal-espera-chip chip-urgente ${filtroTiempo === 'urgentes' ? 'active' : ''}`}
            onClick={() => setFiltroTiempo('urgentes')}
          >
            Urgentes &gt; 2h ({countUrgentes})
          </button>
          <button
            type="button"
            className={`modal-espera-chip chip-alerta ${filtroTiempo === 'mas1h' ? 'active' : ''}`}
            onClick={() => setFiltroTiempo('mas1h')}
          >
            1 a 2 horas ({countMas1h})
          </button>
          <button
            type="button"
            className={`modal-espera-chip chip-reciente ${filtroTiempo === 'recientes' ? 'active' : ''}`}
            onClick={() => setFiltroTiempo('recientes')}
          >
            Recientes &lt; 1h ({countRecientes})
          </button>
        </div>

        {/* Cuerpo / Tabla de Observaciones */}
        <div className="modal-espera-body">
          {itemsFiltrados.length === 0 ? (
            <div className="modal-espera-empty">
              {itemsEnriquecidos.length === 0 ? (
                <>
                  <CheckCircle2 size={36} color="#10b981" />
                  <h3 className="modal-espera-empty-title">¡Sin observaciones a la espera de revisión!</h3>
                  <p className="modal-espera-empty-desc">
                    Actualmente no hay solicitudes técnicas pendientes por dictaminar en el sistema.
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle size={36} color="#f59e0b" />
                  <h3 className="modal-espera-empty-title">No hay coincidencias</h3>
                  <p className="modal-espera-empty-desc">
                    Ninguna observación coincide con el término de búsqueda o filtro seleccionado.
                  </p>
                  <button
                    type="button"
                    className="modal-espera-chip"
                    onClick={() => { setSearchTerm(''); setFiltroTiempo('todas') }}
                    style={{ marginTop: '0.5rem' }}
                  >
                    Restablecer filtros
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="modal-espera-table-container">
              <table className="modal-espera-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>Código Obs</th>
                    <th style={{ width: '280px' }}>Sitio y Localidad</th>
                    <th>Técnico Solicitante</th>
                    <th style={{ width: '140px' }}>Subsistema</th>
                    <th style={{ width: '150px' }}>Tiempo de Espera</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsFiltrados.map((item) => {
                    const solicitanteNombre = item.solicitante || item.usuario_nombre || item.revisor || 'Técnico de Campo'
                    const isVeryOld = item.waitMins >= 120
                    const isOld = item.waitMins >= 60 && item.waitMins < 120

                    return (
                      <tr key={item.id_obs} className={isVeryOld ? 'row-urgente' : ''}>
                        {/* Código de Observación */}
                        <td>
                          <span
                            className="modal-espera-code-cell"
                            onClick={() => handleIrAObservacion(item.id_obs)}
                            title="Clic para ver detalle de la observación"
                          >
                            {item.id_obs}
                          </span>
                        </td>

                        {/* Código de Sitio y Localidad (Regla 2.1) */}
                        <td>
                          <div className="modal-espera-site-cell">
                            <MapPin size={13} color="#0284c7" style={{ flexShrink: 0 }} />
                            <span>
                              <strong>{item.id_sitio}</strong>
                              {item.localidad ? ` · ${item.localidad}` : ''}
                            </span>
                          </div>
                        </td>

                        {/* Técnico Solicitante */}
                        <td>
                          <div className="modal-espera-user-cell">
                            <User size={13} color="#64748b" style={{ flexShrink: 0 }} />
                            <span>{solicitanteNombre}</span>
                          </div>
                        </td>

                        {/* Subsistema */}
                        <td>
                          {item.subsistema ? (
                            <span className="modal-espera-subsistema-badge" title={`Subsistema: ${item.subsistema}`}>
                              {item.subsistema}
                            </span>
                          ) : (
                            <span className="t-meta" style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* Tiempo de Espera Transcurrido */}
                        <td>
                          <div className="modal-espera-time-cell">
                            <span
                              className={`modal-espera-time-badge ${
                                isVeryOld ? 'time-urgente' : isOld ? 'time-alerta' : 'time-normal'
                              }`}
                              title={`Enviado: ${item.tiempoRelativo || 'hace poco'}`}
                            >
                              <Clock size={11} />
                              <span>{item.waitText}</span>
                            </span>
                          </div>
                        </td>

                        {/* Acción Revisar */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="modal-espera-revisar-btn"
                            onClick={() => handleIrAObservacion(item.id_obs)}
                            title={`Revisar y dictaminar ${item.id_obs}`}
                          >
                            <span>Revisar</span>
                            <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="modal-espera-footer">
          <div className="modal-espera-footer-left">
            <span className="t-meta" style={{ color: '#64748b' }}>
              Mostrando <strong>{itemsFiltrados.length}</strong> de <strong>{itemsEnriquecidos.length}</strong> observaciones a la espera de revisión
            </span>
          </div>
          <div className="modal-espera-footer-right">
            <button
              type="button"
              className="modal-espera-btn-close"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
