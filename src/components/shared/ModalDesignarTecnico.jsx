import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { UserCheck, X, Shield, MapPin, Check } from 'lucide-react'
import { DEFAULT_CUADRILLAS_CONFIG } from '../../services/personalService.js'
import { resolveCuadrillaOficial } from '../../shared/reportesCore.js'
import { formatPrimerNombrePrimerApellido } from '../../utils/helpers.js'

/**
 * Modal emergente interactivo para designar al técnico responsable de una observación
 * durante cambios locales manuales en la oficina/web, atribuyendo el avance del día
 * de forma precisa al técnico y cuadrilla correspondiente.
 */
export default function ModalDesignarTecnico({
  isOpen,
  obs,
  nuevoEstado,
  onConfirm,
  onClose
}) {
  const [selectedTecnico, setSelectedTecnico] = useState(null)
  const [selectedCuadrilla, setSelectedCuadrilla] = useState(null)

  // Cuadrillas oficiales y sus 2 técnicos
  const cuadrillasList = useMemo(() => {
    return [
      {
        id: 'CUADRILLA 1',
        label: 'CUADRILLA 1',
        tecnicos: ['Jhonatan Flores', 'Marco Chamba']
      },
      {
        id: 'CUADRILLA 2',
        label: 'CUADRILLA 2',
        tecnicos: ['Juan Castro', 'Willy Fernández']
      },
      {
        id: 'CUADRILLA 3',
        label: 'CUADRILLA 3',
        tecnicos: ['Alfonso Curi', 'William Avila']
      },
      {
        id: 'CUADRILLA 4',
        label: 'CUADRILLA 4',
        tecnicos: ['Hugo Espinoza', 'Daniel Javier']
      }
    ]
  }, [])

  // Cuadrilla sugerida según asignación oficial del sitio
  const suggestedCuadrilla = useMemo(() => {
    if (!obs) return 'CUADRILLA 1'
    return resolveCuadrillaOficial(obs)
  }, [obs])

  // Pre-seleccionar por defecto el primer técnico de la cuadrilla sugerida al abrir
  useEffect(() => {
    if (isOpen) {
      const matchCuad = cuadrillasList.find(c => c.id === suggestedCuadrilla) || cuadrillasList[0]
      setSelectedCuadrilla(matchCuad.id)
      setSelectedTecnico(matchCuad.tecnicos[0])
    }
  }, [isOpen, suggestedCuadrilla, cuadrillasList])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !obs) return null

  const handleSelect = (cuadrillaId, tecNombre) => {
    setSelectedCuadrilla(cuadrillaId)
    setSelectedTecnico(tecNombre)
  }

  const handleConfirmAction = () => {
    if (!selectedTecnico || !selectedCuadrilla) return
    onConfirm({
      tecnico: selectedTecnico,
      cuadrilla: selectedCuadrilla
    })
  }

  const modalContent = (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', width: '95%', padding: 0, overflow: 'hidden' }}
      >
        {/* Cabecera */}
        <div className="modal-header" style={{ padding: '1.25rem 1.5rem', background: 'var(--bg-card)' }}>
          <div className="modal-title-wrap" style={{ gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(0, 48, 96, 0.08)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="t-title-section" style={{ margin: 0, color: '#003060' }}>
                ¿A qué técnico se le designará?
              </h3>
              <p className="t-meta" style={{ margin: 0, color: 'var(--text-muted)' }}>
                Observación: <strong style={{ color: '#003060' }}>{obs.id_obs}</strong>
                {obs.id_sitio && ` · ${obs.id_sitio}`}
                {nuevoEstado && ` · Pase a ${nuevoEstado}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido / Selección de Técnicos */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '68vh', overflowY: 'auto' }}>
          <div className="t-body" style={{ color: 'var(--text-secondary)' }}>
            Selecciona el técnico responsable para registrarlo en el avance diario y atribuir el conteo a su cuadrilla:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {cuadrillasList.map(c => {
              const isSuggested = c.id === suggestedCuadrilla

              return (
                <div
                  key={c.id}
                  style={{
                    border: isSuggested ? '1.5px solid rgba(0, 48, 96, 0.35)' : '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    background: isSuggested ? 'rgba(0, 48, 96, 0.02)' : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="t-name" style={{ fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                      {c.label}
                    </span>
                    {isSuggested && (
                      <span
                        className="t-badge"
                        style={{
                          background: 'rgba(0, 48, 96, 0.1)',
                          color: '#003060',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          fontWeight: 'var(--fw-semibold)'
                        }}
                      >
                        Sugerido por Sitio
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {c.tecnicos.map(tec => {
                      const isSelected = selectedTecnico === tec

                      return (
                        <button
                          key={tec}
                          type="button"
                          onClick={() => handleSelect(c.id, tec)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.75rem',
                            borderRadius: '8px',
                            border: isSelected ? '1.5px solid #003060' : '1px solid var(--border)',
                            background: isSelected ? '#003060' : '#ffffff',
                            color: isSelected ? '#ffffff' : 'var(--text-main)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span className="t-name" style={{ fontWeight: isSelected ? 'var(--fw-bold)' : 'var(--fw-medium)' }}>
                            {tec}
                          </span>
                          {isSelected && <Check size={16} color="#ffffff" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-muted, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary t-name"
            onClick={onClose}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary t-name"
            onClick={handleConfirmAction}
            disabled={!selectedTecnico}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              background: '#003060',
              color: '#ffffff',
              border: 'none',
              cursor: selectedTecnico ? 'pointer' : 'not-allowed',
              fontWeight: 'var(--fw-bold)'
            }}
          >
            Confirmar Designación
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
