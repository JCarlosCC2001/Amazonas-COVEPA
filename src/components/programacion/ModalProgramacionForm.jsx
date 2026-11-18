import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Calendar, Edit3, X, AlertCircle, Users, Search, MapPin, RefreshCw, Check } from 'lucide-react'
import { createProgramacion, updateProgramacion } from '../../services/programacionService'
import { ASIGNACIONES_BASE, getCachedSitiosAsignados } from '../../services/sitiosService'
import { toLocalDateString, getInitials, getCargoClass } from '../../utils/helpers'
// ────────────────────────────────────────────────────────────
// SUBCOMPONENTE: Modal Formulario de Programación (Crear / Editar)
// ────────────────────────────────────────────────────────────
export default function ModalProgramacionForm({ initialDate, editingProg, initialSiteId = null, tecnicos, programacionesExistentes, onClose, onSaved }) {
  const isEditing = Boolean(editingProg)

  const fecha = useMemo(() => {
    if (editingProg?.fecha) return editingProg.fecha
    return initialDate || toLocalDateString(new Date())
  }, [editingProg, initialDate])

  const dateFormatted = useMemo(() => {
    if (!fecha) return ''
    try {
      const [y, m, d] = fecha.split('-').map(Number)
      const dt = new Date(y, m - 1, d)
      const str = dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      return str.charAt(0).toUpperCase() + str.slice(1)
    } catch {
      return fecha
    }
  }, [fecha])

  const [selectedPersonalIds, setSelectedPersonalIds] = useState(() => {
    if (editingProg) {
      if (editingProg.equipo && editingProg.equipo.length > 0) {
        return editingProg.equipo.map(m => m.id).filter(Boolean)
      }
      if (editingProg.id_tecnico) return [editingProg.id_tecnico]
    }
    return []
  })

  const [searchStaff, setSearchStaff] = useState('')
  const [notas, setNotas] = useState(() => editingProg?.notas || '')
  const [searchSite, setSearchSite] = useState('')
  const [selectedSite, setSelectedSite] = useState(() => {
    if (editingProg?.sitios && editingProg.sitios.length > 0) {
      const first = editingProg.sitios[0]
      return first?.id_sitio || first || ''
    }
    return initialSiteId || ''
  })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Listener para cerrar modal con tecla ESC
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Lista de TODO el personal activo de la base de datos (con o sin cuadrilla, de cualquier empresa)
  const staffFiltrado = useMemo(() => {
    const activos = tecnicos.filter(p => p.activo !== false && (p.estado || '').toUpperCase() !== 'INACTIVO')

    // Ordenar: primero quienes tienen cuadrilla asignada (CUADRILLA 1 a 6), luego por nombre
    const sorted = [...activos].sort((a, b) => {
      const cA = a.cuadrilla || ''
      const cB = b.cuadrilla || ''
      if (cA && !cB) return -1
      if (!cA && cB) return 1
      if (cA && cB && cA !== cB) return cA.localeCompare(cB, undefined, { numeric: true })
      return (a.nombre_completo || '').localeCompare(b.nombre_completo || '')
    })

    const q = searchStaff.toLowerCase().trim()
    if (!q) return sorted
    return sorted.filter(p =>
      (p.nombre_completo && p.nombre_completo.toLowerCase().includes(q)) ||
      (p.cargo && p.cargo.toLowerCase().includes(q)) ||
      (p.cuadrilla && p.cuadrilla.toLowerCase().includes(q)) ||
      (p.empresa && p.empresa.toLowerCase().includes(q))
    )
  }, [tecnicos, searchStaff])

  // Cuadrilla del personal o técnico actualmente seleccionado (solo si tiene cuadrilla designada)
  const selectedTechCuadrilla = useMemo(() => {
    if (selectedPersonalIds.length === 0) return null
    const selectedMembers = tecnicos.filter(t => selectedPersonalIds.includes(t.id))
    // Buscar si algún integrante seleccionado tiene cuadrilla designada
    const memberWithCuadrilla = selectedMembers.find(m => m.cuadrilla && m.cuadrilla.trim())
    if (!memberWithCuadrilla) return null

    return memberWithCuadrilla.cuadrilla.trim().toUpperCase()
  }, [selectedPersonalIds, tecnicos])

  const toggleSelectStaff = id => {
    const person = tecnicos.find(p => p.id === id)
    const isLead = person && ((person.cargo || '').toUpperCase().includes('TÉCNICO') || (person.cargo || '').toUpperCase().includes('SUPERVISOR'))

    if (selectedPersonalIds.includes(id)) {
      setSelectedPersonalIds(prev => prev.filter(p => p !== id))
    } else {
      // Si se selecciona un nuevo técnico principal, reemplazar al técnico anterior
      if (isLead) {
        setSelectedPersonalIds(prev => {
          const others = prev.filter(prevId => {
            const op = tecnicos.find(t => t.id === prevId)
            return op && !(op.cargo || '').toUpperCase().includes('TÉCNICO') && !(op.cargo || '').toUpperCase().includes('SUPERVISOR')
          })
          return [id, ...others]
        })
      } else {
        setSelectedPersonalIds(prev => [...prev, id])
      }
    }
  }

  // Catálogo de sitios enriquecidos con código de lugar, nombre_nodo, localidad, zona y grupo
  const [sitiosCatalogo, setSitiosCatalogo] = useState(() => {
    return ASIGNACIONES_BASE.map(s => {
      const parts = (s.id_site || '').split('-')
      const codigoLugar = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : s.id_site
      return {
        ...s,
        codigo_lugar: codigoLugar,
        nombre_nodo: s.id_site,
        localidad: ''
      }
    })
  })

  // Cargar metadata completa de sitios en segundo plano (asíncrono y cacheado)
  useEffect(() => {
    let active = true
    getCachedSitiosAsignados()
      .then(data => {
        if (active && data && data.length > 0) {
          setSitiosCatalogo(data)
        }
      })
      .catch(err => console.warn('Error cargando sitios en modal:', err))
    return () => { active = false }
  }, [])

  // Filtrado reactivo de sitios según el técnico seleccionado y término de búsqueda
  const sitiosFiltrados = useMemo(() => {
    let list = sitiosCatalogo

    // Si hay un técnico con cuadrilla seleccionada, SOLO mostrar los sitios designados a esa cuadrilla
    if (selectedTechCuadrilla) {
      list = list.filter(s => {
        const c = (s.cuadrilla || s.grupo || '').trim().toUpperCase()
        return c === selectedTechCuadrilla
      })
    }

    const q = searchSite.toLowerCase().trim()
    if (!q) return list
    return list.filter(s =>
      (s.id_site && s.id_site.toLowerCase().includes(q)) ||
      (s.codigo_lugar && s.codigo_lugar.toLowerCase().includes(q)) ||
      (s.nombre_nodo && s.nombre_nodo.toLowerCase().includes(q)) ||
      (s.localidad && s.localidad.toLowerCase().includes(q)) ||
      (s.zona && s.zona.toLowerCase().includes(q)) ||
      (s.cuadrilla && s.cuadrilla.toLowerCase().includes(q)) ||
      (s.grupo && s.grupo.toLowerCase().includes(q))
    )
  }, [sitiosCatalogo, selectedTechCuadrilla, searchSite])

  // Si cambia la cuadrilla del técnico y el sitio actual no coincide, limpiar selección de sitio
  useEffect(() => {
    if (selectedTechCuadrilla && selectedSite) {
      const currentSite = sitiosCatalogo.find(s => s.id_site === selectedSite)
      const siteCuad = (currentSite?.cuadrilla || currentSite?.grupo || '').trim().toUpperCase()
      if (siteCuad && siteCuad !== selectedTechCuadrilla) {
        setSelectedSite('')
      }
    }
  }, [selectedTechCuadrilla, selectedSite, sitiosCatalogo])

  const applySiteSelection = useCallback(siteId => {
    if (!siteId) {
      setSelectedSite('')
      return
    }
    setSelectedSite(siteId)

    // Si el sitio tiene una cuadrilla designada, auto-seleccionar ÚNICAMENTE al técnico o supervisor (NO al conductor)
    const siteObj = sitiosCatalogo.find(s => s.id_site === siteId)
    if (siteObj) {
      let siteCuad = (siteObj.cuadrilla || siteObj.grupo || '').trim().toUpperCase()
      siteCuad = siteCuad.replace(/GRUPO/gi, 'CUADRILLA')

      if (siteCuad && !siteCuad.includes('SIN CUADRILLA')) {
        const cuadrillaMembers = tecnicos.filter(t => {
          const tCuad = (t.cuadrilla || '').trim().toUpperCase().replace(/GRUPO/gi, 'CUADRILLA')
          return tCuad === siteCuad
        })

        // Filtrar exclusivamente técnicos o supervisores (excluyendo terminantemente conductores)
        const leads = cuadrillaMembers.filter(t => {
          const cargo = (t.cargo || '').toUpperCase()
          const isLead = cargo.includes('TÉCNICO') || cargo.includes('TECNICO') || cargo.includes('SUPERVISOR')
          const isConductor = cargo.includes('CONDUCTOR')
          return isLead && !isConductor
        })

        if (leads.length > 0) {
          // Auto-asignar únicamente al técnico o supervisor designado
          setSelectedPersonalIds([leads[0].id])
        } else {
          // Si no tiene cargo explícito pero tampoco es conductor
          const nonConductors = cuadrillaMembers.filter(t => !(t.cargo || '').toUpperCase().includes('CONDUCTOR'))
          if (nonConductors.length > 0) {
            setSelectedPersonalIds([nonConductors[0].id])
          }
        }
      }
    }
  }, [sitiosCatalogo, tecnicos])

  const handleSelectSite = siteId => {
    if (selectedSite === siteId) {
      setSelectedSite('')
      return
    }
    applySiteSelection(siteId)
  }

  // Preselección automática cuando se abre para un sitio específico desde el buscador de observaciones
  const autoAppliedRef = useRef(false)
  useEffect(() => {
    if (initialSiteId && !editingProg && !autoAppliedRef.current && sitiosCatalogo.length > 0 && tecnicos.length > 0) {
      applySiteSelection(initialSiteId)
      autoAppliedRef.current = true
    }
  }, [initialSiteId, editingProg, sitiosCatalogo, tecnicos, applySiteSelection])

  const handleSubmit = async e => {
    e.preventDefault()
    setErrorMsg('')

    if (!fecha) {
      setErrorMsg('No se especificó la fecha de la jornada.')
      return
    }
    if (selectedPersonalIds.length === 0) {
      setErrorMsg('Debes seleccionar al menos un integrante de personal para la programación.')
      return
    }
    if (!selectedSite) {
      setErrorMsg('Debes seleccionar un sitio para la jornada.')
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        await updateProgramacion(editingProg.id, {
          personal_ids: selectedPersonalIds,
          fecha,
          notas,
          sitios: [selectedSite]
        })
      } else {
        await createProgramacion({
          personal_ids: selectedPersonalIds,
          fecha,
          notas,
          sitios: [selectedSite]
        })
      }
      onSaved()
    } catch (err) {
      setErrorMsg(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="prog-modal-overlay">
      <div className="prog-modal prog-modal-wide">
        {/* Cabecera del Modal con Fecha Debajo del Título */}
        <div className="prog-modal-header">
          <div className="prog-modal-header-main">
            <div className="prog-modal-title-icon">
              {isEditing ? <Edit3 size={18} color="#003060" /> : <Calendar size={18} color="#003060" />}
            </div>
            <div className="prog-modal-title-group">
              <h3 className="prog-modal-heading">
                {isEditing ? 'Editar Programación' : 'Nueva Programación'}
              </h3>
              <span className="prog-modal-header-date">
                <Calendar size={12} color="#0284c7" />
                <span>{dateFormatted}</span>
              </span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} title="Cerrar ventana">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
          {errorMsg && (
            <div className="prog-modal-error-banner">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="prog-modal-body prog-modal-2col">
            {/* ── COLUMNA IZQUIERDA: PERSONAL OPERATIVO ── */}
            <div className="prog-modal-col-left">

              {/* Cabecera de Sección: Personal Asignado */}
              <div className="prog-pane-header">
                <div className="prog-pane-title">
                  <Users size={15} color="#003060" />
                  <span>Personal Asignado</span>
                  {selectedPersonalIds.length > 0 && (
                    <span className="prog-badge-count">{selectedPersonalIds.length}</span>
                  )}
                </div>
                {selectedPersonalIds.length > 0 && (
                  <button
                    type="button"
                    className="prog-clean-link-btn"
                    onClick={() => setSelectedPersonalIds([])}
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Chips de personal seleccionado */}
              {selectedPersonalIds.length > 0 && (
                <div className="prog-selected-chips-box">
                  {selectedPersonalIds.map(id => {
                    const person = tecnicos.find(t => t.id === id)
                    if (!person) return null
                    const cClass = getCargoClass(person.cargo)
                    return (
                      <span key={id} className="prog-selected-staff-pill">
                        <span className="staff-pill-name">{person.nombre_completo}</span>
                        <span className={`role-badge ${cClass}`}>{person.cargo}</span>
                        {person.cuadrilla ? (
                          <span
                            style={{
                              fontSize: 'var(--text-2xs)',
                              fontWeight: 'var(--fw-bold)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'rgba(0,48,96,0.12)',
                              color: '#003060',
                              border: '1px solid rgba(0,48,96,0.2)'
                            }}
                          >
                            {person.cuadrilla}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 'var(--text-2xs)',
                              fontWeight: 'var(--fw-semibold)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(100,116,139,0.1)',
                              color: '#64748b'
                            }}
                          >
                            Sin Cuadrilla
                          </span>
                        )}
                        <button
                          type="button"
                          className="staff-pill-remove"
                          onClick={() => toggleSelectStaff(id)}
                          title="Quitar"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Buscador de personal */}
              <div className="prog-clean-search-wrap">
                <Search size={13} color="#64748b" />
                <input
                  type="text"
                  placeholder="Buscar personal por nombre, cargo, cuadrilla o empresa..."
                  value={searchStaff}
                  onChange={e => setSearchStaff(e.target.value)}
                />
                {searchStaff && (
                  <button type="button" onClick={() => setSearchStaff('')} className="btn-input-clear">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Lista de personal con ALTO CONTRASTE y diseño corporativo */}
              <div className="prog-staff-list-container">
                {staffFiltrado.map(p => {
                  const isSelected = selectedPersonalIds.includes(p.id)
                  const cClass = getCargoClass(p.cargo)

                  return (
                    <div
                      key={p.id}
                      className={`prog-staff-row-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSelectStaff(p.id)}
                    >
                      <div className="prog-staff-row-left">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="prog-staff-checkbox"
                        />
                        <div className={`person-avatar ${cClass}`}>
                          {getInitials(p.nombre_completo)}
                        </div>
                        <div className="prog-staff-info-col">
                          <span className="prog-staff-row-name">
                            {p.nombre_completo}
                          </span>
                          <div className="prog-staff-row-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className={`role-badge ${cClass}`}>{p.cargo}</span>
                            {p.empresa && (
                              <span
                                style={{
                                  fontSize: 'var(--text-2xs)',
                                  fontWeight: 'var(--fw-semibold)',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: '#f1f5f9',
                                  color: '#475569'
                                }}
                              >
                                {p.empresa}
                              </span>
                            )}
                            {p.cuadrilla ? (
                              <span
                                className="prog-card-cuadrilla-badge"
                                style={{
                                  fontWeight: 'var(--fw-bold)',
                                  background: 'rgba(0,48,96,0.08)',
                                  color: '#003060',
                                  border: '1px solid rgba(0,48,96,0.2)'
                                }}
                              >
                                {p.cuadrilla}
                              </span>
                            ) : (
                              <span
                                className="prog-cuadrilla-badge-rotativo"
                                style={{
                                  background: 'rgba(100,116,139,0.08)',
                                  color: '#64748b',
                                  border: '1px solid rgba(100,116,139,0.15)'
                                }}
                              >
                                Sin Cuadrilla
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {staffFiltrado.length === 0 && (
                  <div className="prog-empty-hint">
                    No se encontró personal con ese criterio.
                  </div>
                )}
              </div>
            </div>

            {/* ── COLUMNA DERECHA: SITIO ASIGNADO (SELECCIÓN ÚNICA) ── */}
            <div className="prog-modal-col-right">
              {/* Cabecera de Selección de Sitio */}
              <div className="prog-pane-header">
                <div className="prog-pane-title">
                  <MapPin size={15} color="#003060" />
                  <span>Seleccionar Sitio</span>
                  {selectedTechCuadrilla ? (
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--fw-bold)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(0,48,96,0.08)',
                        color: '#003060',
                        border: '1px solid rgba(0,48,96,0.18)'
                      }}
                    >
                      {selectedTechCuadrilla} ({sitiosFiltrados.length})
                    </span>
                  ) : (
                    <span className="prog-badge-count">{sitiosFiltrados.length}</span>
                  )}
                </div>
                {selectedSite && (
                  <button
                    type="button"
                    className="prog-clean-link-btn"
                    onClick={() => setSelectedSite('')}
                  >
                    Desmarcar selección
                  </button>
                )}
              </div>

              {/* Barra de Búsqueda */}
              <div className="prog-clean-search-wrap">
                <Search size={13} color="#64748b" />
                <input
                  type="text"
                  placeholder="Buscar por código (ej: AM-0038), localidad o nodo..."
                  value={searchSite}
                  onChange={e => setSearchSite(e.target.value)}
                />
                {searchSite && (
                  <button type="button" onClick={() => setSearchSite('')} className="btn-input-clear">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Lista Enriquecida de Sitios — Solo Código, Lugar y Zona */}
              <div className="prog-sites-clean-list">
                {sitiosFiltrados.map(s => {
                  const isSelected = selectedSite === s.id_site
                  const loc = s.localidad || 'Sin localidad'

                  return (
                    <div
                      key={s.id_site}
                      className={`prog-site-item-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectSite(s.id_site)}
                    >
                      <div className="prog-site-item-main">
                        <input
                          type="radio"
                          name="selected_programacion_site"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ cursor: 'pointer', accentColor: '#003060', width: '15px', height: '15px', flexShrink: 0 }}
                        />
                        <div className="site-2row-top">
                          <MapPin size={13} className="site-2row-pin" />
                          <span className="site-2row-code">{s.id_site}</span>
                          <span className="site-2row-loc">· {loc}</span>
                        </div>
                      </div>

                      <div className="prog-site-item-badges">
                        {s.cuadrilla && (
                          <span
                            style={{
                              fontSize: 'var(--text-2xs)',
                              fontWeight: 'var(--fw-bold)',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              background: 'rgba(0,48,96,0.08)',
                              color: '#003060',
                              border: '1px solid rgba(0,48,96,0.18)'
                            }}
                          >
                            {s.cuadrilla}
                          </span>
                        )}
                        {s.zona && <span className="meta-pill">{s.zona}</span>}
                      </div>
                    </div>
                  )
                })}

                {sitiosFiltrados.length === 0 && (
                  <div className="prog-empty-hint">
                    No se encontraron sitios con ese criterio de búsqueda.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pie del Modal */}
          <div className="prog-modal-footer">
            <div className="prog-modal-footer-actions" style={{ marginLeft: 'auto' }}>
              <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>{isEditing ? 'Guardar Cambios' : 'Crear Programación'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
