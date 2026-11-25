import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { UserCheck, UserX, X, Check, Search, ChevronDown, ChevronUp, User } from 'lucide-react'
import {
  resolveCuadrillaOficial,
  ID_PERSONAL_POR_TECNICO,
  resolverNombreTecnico,
  resolveTecnicoAndCuadrilla
} from '../../shared/reportesCore.js'
import { fetchPersonal } from '../../services/personalService.js'
import { formatPrimerNombrePrimerApellido } from '../../utils/helpers.js'

// Fallback canónico con los 8 técnicos oficiales con cuadrilla designada
const TECNICOS_CUADRILLA_FALLBACK = [
  { id: '554a3a58-bf04-480a-8795-d85e055ee4c6', nombre_completo: 'Jhonatan Flores', cargo: 'TÉCNICO', cuadrilla: 'CUADRILLA 1' },
  { id: '4f9d2cc7-3a88-42f9-b9ac-e97eec0277fe', nombre_completo: 'Marco Chamba', cargo: 'TÉCNICO', cuadrilla: 'CUADRILLA 1' },
  { id: '84444118-163f-4568-8040-e60e1824fd73', nombre_completo: 'Juan Castro', cargo: 'TÉCNICO', cuadrilla: 'CUADRILLA 2' },
  { id: '61d6e0fc-81ae-4e84-9841-1436795d27fd', nombre_completo: 'Willy Fernández', cargo: 'TÉCNICO', cuadrilla: 'CUADRILLA 2' },
  { id: '4b56f618-981f-4f2a-a901-4a4de4543899', nombre_completo: 'Alfonso Curi', cargo: 'TÉCNICO', cuadrilla: 'CUADRILLA 3' },
  { id: '19ff0cdf-7afc-4e50-94b2-f1a9998de148', nombre_completo: 'William Avila', cargo: 'TÉCNICO', cuadrilla: 'CUADRILLA 3' },
  { id: '98a85d5b-9514-43f6-ae29-6a8c2ef6d06c', nombre_completo: 'Hugo Espinoza', cargo: 'TÉCNICO', cuadrilla: 'CUADRILLA 4' },
  { id: '05db4c32-3c7a-42e4-a0aa-8ac33dd5c75f', nombre_completo: 'Daniel Javier', cargo: 'TÉCNICO', cuadrilla: 'CUADRILLA 4' }
]

/**
 * Modal interactivo en lista para designar al técnico ejecutor de una observación.
 * Muestra primero el personal con cuadrilla designada, permite búsqueda en tiempo real
 * y ofrece la opción "Ver más" para desplegar el resto del personal.
 */
export default function ModalDesignarTecnico({
  isOpen,
  obs,
  nuevoEstado,
  onConfirm,
  onClose
}) {
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [mostrarMas, setMostrarMas] = useState(false)
  const [personalList, setPersonalList] = useState([])
  const [loadingStaff, setLoadingStaff] = useState(false)

  // Cuadrilla sugerida según asignación oficial del sitio
  const suggestedCuadrilla = useMemo(() => {
    if (!obs) return 'CUADRILLA 1'
    return resolveCuadrillaOficial(obs)
  }, [obs])

  // Cargar lista completa de personal desde la base de datos
  useEffect(() => {
    let mounted = true
    if (isOpen) {
      setLoadingStaff(true)
      fetchPersonal()
        .then(list => {
          if (mounted) {
            setPersonalList(list && list.length > 0 ? list : TECNICOS_CUADRILLA_FALLBACK)
            setLoadingStaff(false)
          }
        })
        .catch(err => {
          console.warn('Error cargando catálogo de personal en ModalDesignarTecnico:', err)
          if (mounted) {
            setPersonalList(TECNICOS_CUADRILLA_FALLBACK)
            setLoadingStaff(false)
          }
        })
    }
    return () => { mounted = false }
  }, [isOpen])

  // Pre-seleccionar al abrir: si ya tiene técnico, preseleccionarlo; si no, dejar en blanco
  useEffect(() => {
    if (isOpen && obs) {
      setSearchTerm('')
      setMostrarMas(false)
      const currentTec = obs?.tecnico_ejecutor
      if (currentTec) {
        const tecNom = resolverNombreTecnico(currentTec) || currentTec
        const resolved = resolveTecnicoAndCuadrilla(tecNom)
        const idPersonal = ID_PERSONAL_POR_TECNICO[tecNom] || currentTec
        setSelectedPerson({
          id: idPersonal,
          nombre: formatPrimerNombrePrimerApellido(resolved?.tecnico || tecNom),
          cuadrilla: resolved?.cuadrilla || suggestedCuadrilla
        })
      } else {
        setSelectedPerson(null)
      }
    }
  }, [isOpen, obs, suggestedCuadrilla])

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Separar personal en dos grupos: con cuadrilla designada y el resto
  const { conCuadrilla, sinCuadrilla } = useMemo(() => {
    const list = (personalList.length > 0 ? personalList : TECNICOS_CUADRILLA_FALLBACK).filter(p => p.activo !== false)

    // Mapa para evitar duplicados por ID o nombre
    const seen = new Set()
    const conCuad = []
    const sinCuad = []

    // Asegurar que los 8 técnicos oficiales estén presentes con su cuadrilla
    const mergedList = [...list]
    TECNICOS_CUADRILLA_FALLBACK.forEach(fb => {
      const exists = mergedList.some(p =>
        (p.id && p.id === fb.id) ||
        (p.nombre_completo && p.nombre_completo.toLowerCase() === fb.nombre_completo.toLowerCase())
      )
      if (!exists) mergedList.push(fb)
    })

    mergedList.forEach(p => {
      const key = (p.id || p.nombre_completo || p.nombre || '').toLowerCase().trim()
      if (!key || seen.has(key)) return
      seen.add(key)

      const c = String(p.cuadrilla || p.cuadrilla_asignada || '').trim().toUpperCase()
      const hasCuad = c.startsWith('CUADRILLA')

      const item = {
        id: p.id || ID_PERSONAL_POR_TECNICO[p.nombre_completo || p.nombre] || key,
        nombre: formatPrimerNombrePrimerApellido(p.nombre_completo || p.nombre) || (p.nombre_completo || p.nombre),
        cargo: p.cargo || (hasCuad ? 'TÉCNICO' : 'PERSONAL'),
        cuadrilla: hasCuad ? c : null,
        raw: p
      }

      if (hasCuad) {
        conCuad.push(item)
      } else {
        sinCuad.push(item)
      }
    })

    // Ordenar conCuad por cuadrilla y luego nombre
    conCuad.sort((a, b) => {
      const cComp = (a.cuadrilla || '').localeCompare(b.cuadrilla || '')
      if (cComp !== 0) return cComp
      return a.nombre.localeCompare(b.nombre)
    })

    // Ordenar sinCuad por nombre
    sinCuad.sort((a, b) => a.nombre.localeCompare(b.nombre))

    return { conCuadrilla: conCuad, sinCuadrilla: sinCuad }
  }, [personalList])

  // Filtrado por buscador
  const q = searchTerm.toLowerCase().trim()
  const conCuadrillaFiltrado = useMemo(() => {
    if (!q) return conCuadrilla
    return conCuadrilla.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      (p.cargo && p.cargo.toLowerCase().includes(q)) ||
      (p.cuadrilla && p.cuadrilla.toLowerCase().includes(q))
    )
  }, [conCuadrilla, q])

  const sinCuadrillaFiltrado = useMemo(() => {
    if (!q) return sinCuadrilla
    return sinCuadrilla.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      (p.cargo && p.cargo.toLowerCase().includes(q))
    )
  }, [sinCuadrilla, q])

  if (!isOpen || !obs) return null

  const isPersonSelected = (p) => {
    if (!selectedPerson) return false
    if (selectedPerson.id && p.id && String(selectedPerson.id).toLowerCase() === String(p.id).toLowerCase()) {
      return true
    }
    const pNom = (p.nombre || '').toLowerCase().trim()
    const sNom = (selectedPerson.nombre || '').toLowerCase().trim()
    return pNom === sNom
  }

  const handleSelectPerson = (p) => {
    setSelectedPerson({
      id: p.id,
      nombre: p.nombre,
      cuadrilla: p.cuadrilla || suggestedCuadrilla
    })
  }

  const handleSelectEnBlanco = () => {
    setSelectedPerson(null)
  }

  const handleConfirmAction = () => {
    if (selectedPerson) {
      onConfirm({
        tecnico: selectedPerson.id,
        tecnicoNombre: selectedPerson.nombre,
        cuadrilla: selectedPerson.cuadrilla || suggestedCuadrilla
      })
    } else {
      onConfirm({
        tecnico: null,
        tecnicoNombre: null,
        cuadrilla: suggestedCuadrilla
      })
    }
  }

  const renderPersonaRow = (p) => {
    const isSelected = isPersonSelected(p)
    const isSuggested = p.cuadrilla && p.cuadrilla === suggestedCuadrilla

    return (
      <div
        key={p.id}
        onClick={() => handleSelectPerson(p)}
        onDoubleClick={() => {
          handleSelectPerson(p)
          onConfirm({
            tecnico: p.id,
            tecnicoNombre: p.nombre,
            cuadrilla: p.cuadrilla || suggestedCuadrilla
          })
        }}
        style={{
          padding: '0.55rem 0.85rem',
          borderRadius: '8px',
          border: isSelected ? '1.5px solid #003060' : '1px solid #e2e8f0',
          background: isSelected ? '#eff6ff' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '7px',
              background: isSelected ? '#003060' : '#f1f5f9',
              color: isSelected ? '#ffffff' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <User size={16} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span
                className="t-name"
                style={{
                  fontWeight: isSelected ? 'var(--fw-bold)' : 'var(--fw-semibold)',
                  color: isSelected ? '#003060' : '#1e293b'
                }}
              >
                {p.nombre}
              </span>
              {p.cuadrilla && (
                <span
                  className="t-badge"
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1d4ed8',
                    padding: '1px 6px'
                  }}
                >
                  {p.cuadrilla}
                </span>
              )}
              {isSuggested && (
                <span
                  className="t-badge"
                  style={{
                    background: 'rgba(0, 48, 96, 0.08)',
                    border: '1px solid rgba(0, 48, 96, 0.2)',
                    color: '#003060',
                    padding: '1px 6px',
                    fontWeight: 'var(--fw-semibold)'
                  }}
                  title="Coincide con la cuadrilla asignada al sitio"
                >
                  Sugerido por Sitio
                </span>
              )}
            </div>
            <span className="t-meta" style={{ color: '#64748b', marginTop: '1px' }}>
              {p.cargo}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: '8px' }}>
          {isSelected && (
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#003060',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Check size={13} />
            </div>
          )}
        </div>
      </div>
    )
  }

  const modalContent = (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px', width: '95%', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}
      >
        {/* Cabecera */}
        <div className="modal-header" style={{ padding: '1rem 1.25rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <div className="modal-title-wrap" style={{ gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(0, 48, 96, 0.08)',
                color: '#003060',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <UserCheck size={18} />
            </div>
            <div>
              <h3 className="t-title-section" style={{ margin: 0, color: '#003060' }}>
                Designar Técnico Ejecutor
              </h3>
              <p className="t-meta" style={{ margin: 0, color: '#64748b' }}>
                Observación: <strong style={{ color: '#003060' }}>{obs.id_obs}</strong>
                {obs.id_sitio && ` · ${obs.id_sitio}`}
                {nuevoEstado && ` · Pase a ${nuevoEstado}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: '4px' }}
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Buscador de personal */}
        <div style={{ padding: '0.75rem 1.25rem 0.5rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #edf2f7' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={15}
              color="#64748b"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Escribe para buscar por nombre, cargo o cuadrilla..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="t-body"
              style={{
                width: '100%',
                padding: '0.45rem 2.2rem 0.45rem 2.2rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                outline: 'none',
                boxShadow: 'none'
              }}
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '2px'
                }}
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Contenedor desplazable de la lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Opción destacada: Dejar técnico en blanco */}
          <div
            onClick={handleSelectEnBlanco}
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              border: selectedPerson === null ? '1.5px solid #003060' : '1px dashed #cbd5e1',
              background: selectedPerson === null ? 'rgba(0, 48, 96, 0.05)' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginBottom: '0.35rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '7px',
                  background: selectedPerson === null ? '#003060' : '#f1f5f9',
                  color: selectedPerson === null ? '#ffffff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <UserX size={16} />
              </div>
              <div>
                <span
                  className="t-name"
                  style={{
                    fontWeight: 'var(--fw-bold)',
                    color: selectedPerson === null ? '#003060' : '#1e293b'
                  }}
                >
                  Dejar técnico en blanco (Sin asignar)
                </span>
                <p className="t-meta" style={{ margin: 0, color: '#64748b' }}>
                  La observación no tendrá ningún técnico ejecutor asignado
                </p>
              </div>
            </div>
            {selectedPerson === null && (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#003060',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Check size={13} />
              </div>
            )}
          </div>

          {/* Sección 1: Personal con Cuadrilla Designada */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem', marginBottom: '0.15rem' }}>
            <span
              className="t-badge"
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#003060',
                fontWeight: 'var(--fw-bold)'
              }}
            >
              Personal con Cuadrilla Asignada ({conCuadrillaFiltrado.length})
            </span>
          </div>

          {conCuadrillaFiltrado.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>
              <span className="t-meta">No hay personal de cuadrilla que coincida con "{searchTerm}"</span>
            </div>
          ) : (
            conCuadrillaFiltrado.map(p => renderPersonaRow(p))
          )}

          {/* Botón "Ver más" o listado del resto de personal */}
          {sinCuadrillaFiltrado.length > 0 && !searchTerm && (
            <button
              type="button"
              onClick={() => setMostrarMas(!mostrarMas)}
              className="t-badge"
              style={{
                marginTop: '0.4rem',
                marginBottom: '0.2rem',
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                background: '#f8fafc',
                color: '#003060',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                fontWeight: 'var(--fw-semibold)'
              }}
            >
              <span>{mostrarMas ? 'Ocultar resto de personal' : `Ver más personal (${sinCuadrillaFiltrado.length})`}</span>
              {mostrarMas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}

          {/* Sección 2: Resto de personal (desplegado si mostrarMas es true o si hay búsqueda activa) */}
          {(mostrarMas || (searchTerm && sinCuadrillaFiltrado.length > 0)) && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem', marginBottom: '0.15rem' }}>
                <span
                  className="t-badge"
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#64748b',
                    fontWeight: 'var(--fw-bold)'
                  }}
                >
                  Resto del Personal ({sinCuadrillaFiltrado.length})
                </span>
              </div>
              {sinCuadrillaFiltrado.map(p => renderPersonaRow(p))}
            </>
          )}

          {conCuadrillaFiltrado.length === 0 && sinCuadrillaFiltrado.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
              <span className="t-meta">No se encontró ningún integrante que coincida con la búsqueda.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.65rem'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary t-name"
            onClick={onClose}
            style={{ padding: '0.45rem 1rem', borderRadius: '7px', cursor: 'pointer' }}
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
              padding: '0.45rem 1rem',
              borderRadius: '7px',
              cursor: 'pointer',
              color: '#b91c1c',
              borderColor: '#fca5a5',
              background: '#fff1f2',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <UserX size={13} />
            Dejar en blanco
          </button>
          <button
            type="button"
            className="btn btn-primary t-name"
            onClick={handleConfirmAction}
            style={{
              padding: '0.45rem 1.25rem',
              borderRadius: '7px',
              background: '#003060',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'var(--fw-bold)'
            }}
          >
            {selectedPerson ? 'Confirmar Designación' : 'Confirmar (En blanco)'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
