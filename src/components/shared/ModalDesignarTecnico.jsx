import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { UserCheck, UserX, X, Check } from 'lucide-react'
import { resolveCuadrillaOficial, ID_PERSONAL_POR_TECNICO, resolverNombreTecnico, resolveTecnicoAndCuadrilla } from '../../shared/reportesCore.js'

/**
 * Modal emergente interactivo para designar al técnico responsable de una observación
 * durante cambios locales manuales en la oficina/web, atribuyendo el avance del día
 * de forma precisa al técnico y cuadrilla correspondiente, con la opción de dejar en blanco.
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

  // Pre-seleccionar al abrir: si ya tiene técnico, preseleccionarlo; si no, dejar en blanco
  useEffect(() => {
    if (isOpen) {
      const currentTec = obs?.tecnico_ejecutor
      if (currentTec) {
        const tecNom = resolverNombreTecnico(currentTec) || currentTec
        const resolved = resolveTecnicoAndCuadrilla(tecNom)
        if (resolved) {
          setSelectedCuadrilla(resolved.cuadrilla)
          setSelectedTecnico(resolved.tecnico)
          return
        }
      }
      const matchCuad = cuadrillasList.find(c => c.id === suggestedCuadrilla) || cuadrillasList[0]
      setSelectedCuadrilla(matchCuad.id)
      setSelectedTecnico(currentTec ? matchCuad.tecnicos[0] : null)
    }
  }, [isOpen, obs, suggestedCuadrilla, cuadrillasList])

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

  const handleSelectTecnico = (cuadrillaId, tecNombre) => {
    setSelectedCuadrilla(cuadrillaId)
    setSelectedTecnico(tecNombre)
  }

  const handleSelectEnBlanco = () => {
    setSelectedTecnico(null)
  }

  const handleConfirmAction = () => {
    if (selectedTecnico) {
      const idPersonal = ID_PERSONAL_POR_TECNICO[selectedTecnico] || selectedTecnico
      onConfirm({
        tecnico: idPersonal,
        tecnicoNombre: selectedTecnico,
        cuadrilla: suggestedCuadrilla
      })
    } else {
      onConfirm({
        tecnico: null,
        tecnicoNombre: null,
        cuadrilla: suggestedCuadrilla
      })
    }
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
                Designar Técnico Ejecutor
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
            Selecciona el técnico responsable para registrarlo en el avance diario, o déjalo en blanco si no corresponde:
          </div>

          {/* Opción destacada: Dejar en blanco */}
          <div
            onClick={handleSelectEnBlanco}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: selectedTecnico === null ? '1.5px solid #003060' : '1px dashed var(--border)',
              background: selectedTecnico === null ? 'rgba(0, 48, 96, 0.06)' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: selectedTecnico === null ? '#003060' : 'rgba(100, 116, 139, 0.1)',
                  color: selectedTecnico === null ? '#ffffff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <UserX size={16} />
              </div>
              <div>
                <span className="t-name" style={{ fontWeight: 'var(--fw-bold)', color: selectedTecnico === null ? '#003060' : 'var(--text-main)' }}>
                  Dejar técnico en blanco (Sin asignar)
                </span>
                <p className="t-meta" style={{ margin: 0, color: 'var(--text-muted)' }}>
                  La observación no tendrá ningún técnico ejecutor asignado
                </p>
              </div>
            </div>
            {selectedTecnico === null && <Check size={18} color="#003060" />}
          </div>

          {/* Grilla de Cuadrillas y Técnicos */}
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
                          onClick={() => handleSelectTecnico(c.id, tec)}
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
            className="btn btn-secondary t-name"
            onClick={() => {
              onConfirm({
                tecnico: null,
                tecnicoNombre: null,
                cuadrilla: suggestedCuadrilla
              })
            }}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#b91c1c',
              borderColor: '#fca5a5',
              background: '#fff1f2',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <UserX size={14} />
            Dejar en blanco
          </button>
          <button
            type="button"
            className="btn btn-primary t-name"
            onClick={handleConfirmAction}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              background: '#003060',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'var(--fw-bold)'
            }}
          >
            {selectedTecnico ? 'Confirmar Designación' : 'Confirmar (En blanco)'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
