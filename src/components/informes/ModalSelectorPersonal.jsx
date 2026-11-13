import React, { useState, useMemo } from 'react'
import { X, Search, Users, UserCheck, Plus, Check } from 'lucide-react'

export default function ModalSelectorPersonal({
  isOpen,
  onClose,
  personalList = [],
  destinatariosPara = [],
  destinatariosCC = [],
  onTogglePara,
  onToggleCC
}) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroCargo, setFiltroCargo] = useState('TODOS')

  const personalFiltrado = useMemo(() => {
    return (personalList || []).filter(p => {
      const q = busqueda.toLowerCase().trim()
      const matchCargo = filtroCargo === 'TODOS' || (p.cargo || '').toUpperCase() === filtroCargo

      if (!matchCargo) return false
      if (!q) return true

      const nombre = (p.nombre_completo || p.nombre || '').toLowerCase()
      const email1 = (p.email || '').toLowerCase()
      const email2 = (p.email_2 || '').toLowerCase()
      const cargo = (p.cargo || '').toLowerCase()
      const cuadrilla = (p.cuadrilla || p.cuadrilla_asignada || '').toLowerCase()

      return nombre.includes(q) || email1.includes(q) || email2.includes(q) || cargo.includes(q) || cuadrilla.includes(q)
    })
  }, [personalList, busqueda, filtroCargo])

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
          maxWidth: '780px',
          height: '85vh',
          maxHeight: '740px',
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
            <Users size={18} color="#003060" />
            <h3 className="t-name" style={{ margin: 0, color: '#003060' }}>
              Seleccionar Destinatarios desde Personal
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

        {/* Buscador y Filtros */}
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.65rem', backgroundColor: '#ffffff' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por nombre, cargo, cuadrilla o correo..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="t-body"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {['TODOS', 'SUPERVISOR', 'TÉCNICO', 'CONDUCTOR'].map(c => {
              const active = filtroCargo === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFiltroCargo(c)}
                  className="t-badge"
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '6px',
                    border: `1px solid ${active ? '#0284c7' : '#e2e8f0'}`,
                    background: active ? '#eff6ff' : '#ffffff',
                    color: active ? '#0284c7' : '#64748b',
                    cursor: 'pointer',
                    fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-normal)'
                  }}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>

        {/* Lista de personal */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {personalFiltrado.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
              <span className="t-meta">No se encontraron integrantes que coincidan con la búsqueda.</span>
            </div>
          ) : (
            personalFiltrado.map(p => {
              const email1 = (p.email || '').toLowerCase().trim()
              const email2 = (p.email_2 || '').toLowerCase().trim()

              const isPara1 = email1 && destinatariosPara.map(e => e.toLowerCase()).includes(email1)
              const isCC1 = email1 && destinatariosCC.map(e => e.toLowerCase()).includes(email1)

              const isPara2 = email2 && destinatariosPara.map(e => e.toLowerCase()).includes(email2)
              const isCC2 = email2 && destinatariosCC.map(e => e.toLowerCase()).includes(email2)

              return (
                <div
                  key={p.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="t-name" style={{ color: '#003060' }}>
                        {p.nombre_completo || p.nombre}
                      </span>
                      <span className="t-badge" style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569' }}>
                        {p.cargo || 'SIN CARGO'}
                      </span>
                      {p.cuadrilla && (
                        <span className="t-badge" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
                          {p.cuadrilla}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Correo 1 */}
                  {email1 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                      <span className="t-meta" style={{ color: '#334155' }}>
                        📧 {email1}
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => onTogglePara(email1)}
                          className="t-badge"
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '5px',
                            border: `1px solid ${isPara1 ? '#0284c7' : '#cbd5e1'}`,
                            background: isPara1 ? '#0284c7' : '#ffffff',
                            color: isPara1 ? '#ffffff' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {isPara1 ? <Check size={12} /> : <Plus size={12} />}
                          <span>{isPara1 ? 'En Para' : 'Para'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onToggleCC(email1)}
                          className="t-badge"
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '5px',
                            border: `1px solid ${isCC1 ? '#64748b' : '#cbd5e1'}`,
                            background: isCC1 ? '#64748b' : '#ffffff',
                            color: isCC1 ? '#ffffff' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {isCC1 ? <Check size={12} /> : <Plus size={12} />}
                          <span>{isCC1 ? 'En CC' : 'CC'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="t-meta" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                      Sin correo electrónico registrado
                    </span>
                  )}

                  {/* Correo 2 (si existe) */}
                  {email2 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                      <span className="t-meta" style={{ color: '#334155' }}>
                        📧 {email2} (Secundario)
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => onTogglePara(email2)}
                          className="t-badge"
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '5px',
                            border: `1px solid ${isPara2 ? '#0284c7' : '#cbd5e1'}`,
                            background: isPara2 ? '#0284c7' : '#ffffff',
                            color: isPara2 ? '#ffffff' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {isPara2 ? <Check size={12} /> : <Plus size={12} />}
                          <span>{isPara2 ? 'En Para' : 'Para'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onToggleCC(email2)}
                          className="t-badge"
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '5px',
                            border: `1px solid ${isCC2 ? '#64748b' : '#cbd5e1'}`,
                            background: isCC2 ? '#64748b' : '#ffffff',
                            color: isCC2 ? '#ffffff' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {isCC2 ? <Check size={12} /> : <Plus size={12} />}
                          <span>{isCC2 ? 'En CC' : 'CC'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
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
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}

