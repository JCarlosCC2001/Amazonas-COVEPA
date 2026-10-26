import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users, UserPlus, Search, Phone, MessageSquare, Edit2,
  Trash2, Shield, Wrench, Truck, MapPin, RefreshCw, X,
  LayoutGrid, List, PhoneCall, Eye, EyeOff, ChevronRight,
  KeyRound, Lock, CheckCircle2, AlertCircle
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  fetchPersonal,
  createPersonal,
  updatePersonal,
  deletePersonal,
  updateCuadrillaAssignments
} from '../services/personalService'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'

// Helper para parsear hasta 2 teléfonos y operadores estructurados
function parsePhoneLines(telefono, operador) {
  if (!telefono) return []
  const phones = telefono.split('/').map(s => s.trim()).filter(Boolean)
  const ops = (operador || '').split('/').map(s => s.trim()).filter(Boolean)

  return phones.map((p, idx) => {
    const cleanMatch = p.match(/\d{9}/)
    const clean = cleanMatch ? cleanMatch[0] : p.replace(/\D/g, '')
    const op = ops[idx] || (ops.length === 1 && idx === 0 ? ops[0] : '')
    return {
      phone: p,
      clean,
      operator: op.toUpperCase()
    }
  })
}

// Helper para estilo del operador
function getOperatorClass(op) {
  const o = (op || '').toUpperCase()
  if (o.includes('BITEL')) return 'bitel'
  if (o.includes('CLARO')) return 'claro'
  if (o.includes('MOVISTAR')) return 'movistar'
  if (o.includes('ENTEL')) return 'entel'
  return 'otro'
}

// Helper para iniciales de avatar
function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`
  return parts[0].slice(0, 2).toUpperCase()
}

// Helper para clase de cargo
function getCargoClass(cargo) {
  const c = (cargo || '').toUpperCase()
  if (c.includes('TÉCNICO') || c.includes('TECNICO')) return 'tecnico'
  if (c.includes('CONDUCTOR')) return 'conductor'
  if (c.includes('SUPERVISOR')) return 'supervisor'
  return 'tecnico'
}

export default function Tecnicos() {
  const { user, isAdmin } = useAuth()
  const [personal, setPersonal] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCargo, setFilterCargo] = useState('TODOS')
  const [filterEmpresa, setFilterEmpresa] = useState('TODOS')
  const [viewMode, setViewMode] = useState('tarjetas') // 'tarjetas' | 'lista'

  // Modales y Drawers
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [selectedDrawerPerson, setSelectedDrawerPerson] = useState(null)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPersonal()
      setPersonal(data)
    } catch (err) {
      console.error('Error cargando personal:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Mantener sincronizado el integrante abierto en el drawer
  useEffect(() => {
    if (selectedDrawerPerson) {
      const fresh = personal.find(p => p.id === selectedDrawerPerson.id)
      if (fresh) setSelectedDrawerPerson(fresh)
    }
  }, [personal])

  // Lista de cargos únicos para filtros
  const cargos = useMemo(() => {
    const list = [...new Set(personal.map(p => p.cargo).filter(Boolean))]
    return list.sort()
  }, [personal])

  // Filtrado reactivo
  const filteredPersonal = useMemo(() => {
    const q = search.toLowerCase().trim()
    return personal.filter(p => {
      const matchSearch =
        !q ||
        (p.nombre_completo && p.nombre_completo.toLowerCase().includes(q)) ||
        (p.telefono && p.telefono.includes(q)) ||
        (p.origen && p.origen.toLowerCase().includes(q)) ||
        (p.operador && p.operador.toLowerCase().includes(q)) ||
        (p.cuadrilla && p.cuadrilla.toLowerCase().includes(q))

      const matchCargo = filterCargo === 'TODOS' || p.cargo === filterCargo
      const matchEmpresa = filterEmpresa === 'TODOS' || (p.empresa || 'COVEPA').toUpperCase() === filterEmpresa.toUpperCase()

      return matchSearch && matchCargo && matchEmpresa
    })
  }, [personal, search, filterCargo, filterEmpresa])

  // KPIs
  const kpis = useMemo(() => {
    const total = personal.length
    const covepa = personal.filter(p => (!p.empresa || p.empresa.toUpperCase() === 'COVEPA')).length
    const gilat = personal.filter(p => p.empresa && p.empresa.toUpperCase() === 'GILAT').length
    const tecnicos = personal.filter(p => (p.cargo || '').includes('TÉCNICO') || (p.cargo || '').includes('TECNICO')).length
    const conductores = personal.filter(p => (p.cargo || '').includes('CONDUCTOR')).length
    const supervisores = personal.filter(p => (p.cargo || '').includes('SUPERVISOR')).length
    return { total, covepa, gilat, tecnicos, conductores, supervisores }
  }, [personal])

  const handleOpenEdit = member => {
    setEditingMember(member)
    setModalOpen(true)
  }

  const handleOpenCreate = () => {
    setEditingMember(null)
    setModalOpen(true)
  }

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Seguro que deseas eliminar a ${nombre} del directorio de personal?`)) return
    try {
      await deletePersonal(id)
      setPersonal(prev => prev.filter(p => p.id !== id))
      if (selectedDrawerPerson?.id === id) {
        setSelectedDrawerPerson(null)
      }
    } catch (err) {
      alert('Error eliminando integrante: ' + err.message)
    }
  }

  return (
    <div className="personal-container">
      {/* ── MEDIDORES / KPIs REUTILIZABLES DE PERSONAL ── */}
      <MetricGrid columns={4}>
        <MetricCard
          icon={<Users size={22} />}
          label="Total Personal"
          value={kpis.total}
          subtitle="registrados"
          variant="navy"
          onClick={() => setFilterCargo('TODOS')}
          active={filterCargo === 'TODOS'}
        />
        <MetricCard
          icon={<Wrench size={22} />}
          label="Técnicos (Cuadrillas)"
          value={kpis.tecnicos}
          subtitle="cuadrillas 1–6"
          variant="sky"
          onClick={() => setFilterCargo('TECNICO')}
          active={filterCargo === 'TECNICO'}
        />
        <MetricCard
          icon={<Truck size={22} />}
          label="Conductores"
          value={kpis.conductores}
          subtitle="apoyo rotativo"
          variant="emerald"
          onClick={() => setFilterCargo('CONDUCTOR')}
          active={filterCargo === 'CONDUCTOR'}
        />
        <MetricCard
          icon={<Shield size={22} />}
          label="Supervisores"
          value={kpis.supervisores}
          subtitle="control de campo"
          variant="purple"
          onClick={() => setFilterCargo('SUPERVISOR')}
          active={filterCargo === 'SUPERVISOR'}
        />
      </MetricGrid>

      {/* ── BARRA SUPERIOR INTEGRADA (Buscador + Filtros + Acciones) ── */}
      <div className="prog-toolbar">
        {/* Izquierda: Buscador y Filtro por Cargo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', flex: 1 }}>
          <div className="obs-search-box" style={{ maxWidth: '280px' }}>
            <Search size={14} className="obs-search-icon" />
            <input
              type="text"
              className="obs-search-input"
              placeholder="Buscar por nombre, origen, celular..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '0.6rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <select
            className="filter-select"
            value={filterEmpresa}
            onChange={e => setFilterEmpresa(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
          >
            <option value="TODOS">Todas las Empresas ({personal.length})</option>
            <option value="COVEPA">COVEPA ({kpis.covepa})</option>
            <option value="GILAT">GILAT ({kpis.gilat})</option>
          </select>

          <select
            className="filter-select"
            value={filterCargo}
            onChange={e => setFilterCargo(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
          >
            <option value="TODOS">Todos los Cargos</option>
            {cargos.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button className="prog-btn-nav" onClick={loadData} title="Refrescar datos">
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Derecha: Toggle Tarjetas/Lista + Botón Nuevo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div className="prog-views-toggle">
            <button
              className={`prog-view-btn ${viewMode === 'tarjetas' ? 'active' : ''}`}
              onClick={() => setViewMode('tarjetas')}
            >
              <LayoutGrid size={13} />
              Tarjetas
            </button>
            <button
              className={`prog-view-btn ${viewMode === 'lista' ? 'active' : ''}`}
              onClick={() => setViewMode('lista')}
            >
              <List size={13} />
              Lista
            </button>
            <button
              className={`prog-view-btn ${viewMode === 'cuadrillas' ? 'active' : ''}`}
              onClick={() => setViewMode('cuadrillas')}
            >
              <Truck size={13} />
              Cuadrillas
            </button>
          </div>

          {/* Acción exclusiva de Administrador: Cambiar Contraseña */}
          {isAdmin && (
            <button
              type="button"
              className="prog-btn-secondary"
              onClick={() => setPasswordModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                color: '#a5b4fc',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
              title="Acceso exclusivo Administrador: Cambiar mi contraseña de acceso"
            >
              <KeyRound size={14} color="#818cf8" />
              <span>Mi Contraseña</span>
            </button>
          )}

          <button className="prog-btn-create" onClick={handleOpenCreate}>
            <UserPlus size={15} />
            Nuevo Integrante
          </button>
        </div>
      </div>

      {/* ── CONTENIDO: VISTA TARJETAS INDIVIDUALES ── */}
      {viewMode === 'tarjetas' && (
        <div className="personal-grid">
          {filteredPersonal.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No se encontró personal con los filtros aplicados.
            </div>
          ) : (
            filteredPersonal.map(person => {
              const cargoClass = getCargoClass(person.cargo)
              const isTecnico = cargoClass === 'tecnico' || (person.cargo || '').includes('SUPERVISOR')
              const phoneLines = parsePhoneLines(person.telefono, person.operador)

              return (
                <div
                  key={person.id}
                  className="person-card"
                  onClick={() => setSelectedDrawerPerson(person)}
                  title="Click para ver ficha completa del integrante"
                  style={{ cursor: 'pointer' }}
                >
                  {/* Cabecera de la persona */}
                  <div className="person-card-top">
                    <div className="person-identity">
                      <div className={`person-avatar ${cargoClass}`}>
                        {getInitials(person.nombre_completo)}
                      </div>
                      <div className="person-names-box">
                        <span className="person-name">{person.nombre_completo}</span>
                        <div className="person-tags-row">
                          <span className={`role-badge ${cargoClass}`}>
                            {person.cargo}
                          </span>
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              padding: '0.12rem 0.4rem',
                              borderRadius: '4px',
                              background: (person.empresa || 'COVEPA').toUpperCase() === 'GILAT' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                              border: `1px solid ${(person.empresa || 'COVEPA').toUpperCase() === 'GILAT' ? '#38bdf8' : '#818cf8'}`,
                              color: (person.empresa || 'COVEPA').toUpperCase() === 'GILAT' ? '#38bdf8' : '#a5b4fc',
                              textTransform: 'uppercase'
                            }}
                          >
                            {person.empresa || 'COVEPA'}
                          </span>
                          {/* Cuadrilla SOLO para Técnicos de COVEPA */}
                          {isTecnico && person.cuadrilla && (
                            <span className="prog-card-cuadrilla-badge">
                              {person.cuadrilla}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      <ChevronRight size={16} />
                    </div>
                  </div>

                  {/* Origen / Ciudad base */}
                  <div className="person-meta-row">
                    <span>
                      {person.origen ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <MapPin size={13} color="#818cf8" />
                          Base: <strong style={{ color: '#e2e8f0' }}>{person.origen}</strong>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Base no asignada</span>
                      )}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── CONTENIDO: VISTA LISTA GENERAL (TABLA) ── */}
      {viewMode === 'lista' && (
        <div className="table-container">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Integrante</th>
                <th>Cargo</th>
                <th>Cuadrilla (Técnicos)</th>
                <th>Origen / Base</th>
                <th style={{ textAlign: 'center' }}>Ficha</th>
              </tr>
            </thead>
            <tbody>
              {filteredPersonal.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No se encontró personal con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredPersonal.map(person => {
                  const cargoClass = getCargoClass(person.cargo)
                  const isTecnico = cargoClass === 'tecnico' || (person.cargo || '').includes('SUPERVISOR')

                  return (
                    <tr
                      key={person.id}
                      onClick={() => setSelectedDrawerPerson(person)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div className={`person-avatar ${cargoClass}`} style={{ width: '30px', height: '30px', fontSize: '0.75rem' }}>
                            {getInitials(person.nombre_completo)}
                          </div>
                          <span>{person.nombre_completo}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${cargoClass}`}>
                          {person.cargo}
                        </span>
                      </td>
                      <td>
                        {/* Cuadrilla solo visible si es técnico */}
                        {isTecnico && person.cuadrilla ? (
                          <span className="prog-card-cuadrilla-badge">
                            {person.cuadrilla}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        {person.origen ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                            <MapPin size={12} color="#818cf8" />
                            {person.origen}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-secondary-soft"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedDrawerPerson(person)
                          }}
                        >
                          <Eye size={12} />
                          Ver Ficha
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CONTENIDO: VISTA CUADRILLAS PREDEFINIDAS ── */}
      {viewMode === 'cuadrillas' && (
        <VistaCuadrillasPredefinidas
          personal={personal}
          onCuadrillasUpdated={loadData}
        />
      )}

      {/* ── VENTANITA LATERAL (DRAWER) DE DETALLE Y GESTIÓN ── */}
      {selectedDrawerPerson && (
        <DrawerPersonal
          person={selectedDrawerPerson}
          isAdmin={isAdmin}
          onOpenPasswordModal={() => setPasswordModalOpen(true)}
          onClose={() => setSelectedDrawerPerson(null)}
          onEdit={person => handleOpenEdit(person)}
          onDelete={(id, nombre) => handleDelete(id, nombre)}
        />
      )}

      {/* ── MODAL: NUEVO / EDITAR INTEGRANTE ── */}
      {modalOpen && (
        <ModalPersonal
          member={editingMember}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            loadData()
          }}
        />
      )}

      {/* ── MODAL: CAMBIAR CONTRASEÑA (EXCLUSIVO ADMINISTRADOR) ── */}
      {passwordModalOpen && isAdmin && (
        <ModalCambiarPassword
          onClose={() => setPasswordModalOpen(false)}
          onPasswordUpdated={() => {
            // Callback opcional tras actualización
          }}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// SUBCOMPONENTE: Vista de Armado de Cuadrillas Predefinidas
// ────────────────────────────────────────────────────────────
function VistaCuadrillasPredefinidas({ personal = [], onCuadrillasUpdated }) {
  const defaultList = useMemo(() => [
    'CUADRILLA 1', 'CUADRILLA 2', 'CUADRILLA 3',
    'CUADRILLA 4', 'CUADRILLA 5', 'CUADRILLA 6'
  ], [])

  // Candidatos COVEPA para Técnico (técnicos y supervisores de campo)
  const candidatosTecnicos = useMemo(() => {
    return personal.filter(p => {
      if (p.empresa && p.empresa.toUpperCase() === 'GILAT') return false
      const c = (p.cargo || '').toUpperCase()
      return c.includes('TÉCNICO') || c.includes('TECNICO') || c.includes('SUPERVISOR')
    }).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))
  }, [personal])

  // Candidatos COVEPA para Conductor
  const candidatosConductores = useMemo(() => {
    return personal.filter(p => {
      if (p.empresa && p.empresa.toUpperCase() === 'GILAT') return false
      const c = (p.cargo || '').toUpperCase()
      return c.includes('CONDUCTOR')
    }).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))
  }, [personal])

  // Todas las cuadrillas disponibles
  const allCuadrillas = useMemo(() => {
    const set = new Set(defaultList)
    personal.forEach(p => {
      if (p.cuadrilla && (!p.empresa || p.empresa.toUpperCase() === 'COVEPA')) {
        set.add(p.cuadrilla.trim().toUpperCase())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [personal, defaultList])

  // Estado local para edición de cada cuadrilla: { idTecnico, idConductor }
  const [cuadrillasForm, setCuadrillasForm] = useState({})
  const [savingCuadrilla, setSavingCuadrilla] = useState(null)
  const [savedCuadrilla, setSavedCuadrilla] = useState(null)
  const [newCuadrillaName, setNewCuadrillaName] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [customList, setCustomList] = useState([])

  // Sincronizar estado inicial al recibir personal
  useEffect(() => {
    const form = {}
    const fullList = Array.from(new Set([...allCuadrillas, ...customList]))
    fullList.forEach(cName => {
      const tec = personal.find(p => p.cuadrilla === cName && ((p.cargo || '').toUpperCase().includes('TÉCN') || (p.cargo || '').toUpperCase().includes('SUPERVISOR')))
      const cond = personal.find(p => p.cuadrilla === cName && (p.cargo || '').toUpperCase().includes('CONDUCTOR'))
      form[cName] = {
        idTecnico: tec?.id || '',
        idConductor: cond?.id || ''
      }
    })
    setCuadrillasForm(form)
  }, [personal, allCuadrillas, customList])

  const handleSelect = (cName, field, value) => {
    setCuadrillasForm(prev => ({
      ...prev,
      [cName]: {
        ...(prev[cName] || {}),
        [field]: value
      }
    }))
  }

  const handleSave = async (cName) => {
    setSavingCuadrilla(cName)
    try {
      const { idTecnico, idConductor } = cuadrillasForm[cName] || {}
      await updateCuadrillaAssignments(cName, { idTecnico, idConductor })
      setSavedCuadrilla(cName)
      setTimeout(() => setSavedCuadrilla(null), 2500)
      if (onCuadrillasUpdated) onCuadrillasUpdated()
    } catch (err) {
      alert('Error guardando asignación de cuadrilla: ' + err.message)
    } finally {
      setSavingCuadrilla(null)
    }
  }

  const handleCreateCuadrilla = (e) => {
    e.preventDefault()
    const clean = newCuadrillaName.trim().toUpperCase()
    if (!clean) return
    if (!customList.includes(clean) && !allCuadrillas.includes(clean)) {
      setCustomList(prev => [...prev, clean])
    }
    setNewCuadrillaName('')
    setShowAddForm(false)
  }

  const displayCuadrillas = Array.from(new Set([...allCuadrillas, ...customList]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Banner Informativo */}
      <div className="cuadrillas-banner">
        <div className="cuadrillas-banner-icon">
          <Truck size={18} color="#818cf8" />
        </div>
        <div className="cuadrillas-banner-text">
          <strong>Configuración de Cuadrillas Predefinidas:</strong> Asigna el <strong>Técnico</strong> y el <strong>Conductor</strong> para cada cuadrilla. Puedes actualizar estos datos las veces que lo requieras. Al programar en el calendario, podrás seleccionar toda la cuadrilla con <strong>1 solo clic</strong> sin tener que buscar persona por persona.
        </div>
      </div>

      {/* Grid de Tarjetas de Cuadrilla */}
      <div className="cuadrillas-grid">
        {displayCuadrillas.map(cName => {
          const form = cuadrillasForm[cName] || { idTecnico: '', idConductor: '' }
          const tecSelected = candidatosTecnicos.find(t => t.id === form.idTecnico)
          const condSelected = candidatosConductores.find(c => c.id === form.idConductor)

          const isCompleta = !!form.idTecnico && !!form.idConductor
          const isParcial = (!!form.idTecnico && !form.idConductor) || (!form.idTecnico && !!form.idConductor)
          const isSaving = savingCuadrilla === cName
          const isSaved = savedCuadrilla === cName

          return (
            <div key={cName} className="cuadrilla-config-card">
              {/* Encabezado de la Tarjeta */}
              <div className="cuadrilla-card-header">
                <div className="cuadrilla-card-title">
                  <Truck size={17} color="#818cf8" />
                  <span>{cName}</span>
                </div>
                <span className={`cuadrilla-badge-status ${isCompleta ? 'completa' : isParcial ? 'parcial' : 'vacia'}`}>
                  {isCompleta ? '✓ Completa (Téc + Cond)' : isParcial ? '1 Integrante' : 'Sin asignar'}
                </span>
              </div>

              {/* Selector de Técnico */}
              <div className="cuadrilla-field-group">
                <label className="cuadrilla-field-label">
                  <Wrench size={11} color="#818cf8" />
                  <span>Técnico / Supervisor Asignado</span>
                </label>
                <select
                  className="cuadrilla-field-select"
                  value={form.idTecnico || ''}
                  onChange={e => handleSelect(cName, 'idTecnico', e.target.value)}
                >
                  <option value="">-- Sin técnico asignado --</option>
                  {candidatosTecnicos.map(t => {
                    const enOtra = t.cuadrilla && t.cuadrilla !== cName ? ` · (Actualmente en ${t.cuadrilla})` : ''
                    return (
                      <option key={t.id} value={t.id}>
                        {t.nombre_completo} ({t.cargo}){enOtra}
                      </option>
                    )
                  })}
                </select>
                {tecSelected && (
                  <div className="cuadrilla-member-preview">
                    <span>{tecSelected.nombre_completo}</span>
                    <span style={{ color: '#818cf8', fontWeight: 600 }}>{tecSelected.telefono || 'Sin telf.'}</span>
                  </div>
                )}
              </div>

              {/* Selector de Conductor */}
              <div className="cuadrilla-field-group">
                <label className="cuadrilla-field-label">
                  <Truck size={11} color="#38bdf8" />
                  <span>Conductor Asignado</span>
                </label>
                <select
                  className="cuadrilla-field-select"
                  value={form.idConductor || ''}
                  onChange={e => handleSelect(cName, 'idConductor', e.target.value)}
                >
                  <option value="">-- Sin conductor asignado --</option>
                  {candidatosConductores.map(c => {
                    const enOtra = c.cuadrilla && c.cuadrilla !== cName ? ` · (Actualmente en ${c.cuadrilla})` : ''
                    return (
                      <option key={c.id} value={c.id}>
                        {c.nombre_completo}{enOtra}
                      </option>
                    )
                  })}
                </select>
                {condSelected && (
                  <div className="cuadrilla-member-preview">
                    <span>{condSelected.nombre_completo}</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{condSelected.telefono || 'Sin telf.'}</span>
                  </div>
                )}
              </div>

              {/* Botón Guardar Cuadrilla */}
              <button
                type="button"
                className={`cuadrilla-save-btn ${isSaved ? 'saved' : ''}`}
                onClick={() => handleSave(cName)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>Guardando cambios...</>
                ) : isSaved ? (
                  <>
                    <CheckCircle2 size={15} />
                    <span>¡Cuadrilla Actualizada!</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Guardar {cName}</span>
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Botón para añadir otra cuadrilla si se requiere */}
      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {!showAddForm ? (
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
            onClick={() => setShowAddForm(true)}
          >
            + Agregar Otra Cuadrilla
          </button>
        ) : (
          <form onSubmit={handleCreateCuadrilla} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Ej: CUADRILLA 7"
              value={newCuadrillaName}
              onChange={e => setNewCuadrillaName(e.target.value)}
              className="prog-form-control"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', width: '180px' }}
              autoFocus
            />
            <button type="submit" className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
              Crear
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
              onClick={() => setShowAddForm(false)}
            >
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// SUBCOMPONENTE: Ventana Lateral (Drawer) de Revisión y Gestión
// ────────────────────────────────────────────────────────────
function DrawerPersonal({ person, isAdmin, onOpenPasswordModal, onClose, onEdit, onDelete }) {
  if (!person) return null
  const cargoClass = getCargoClass(person.cargo)
  const isTecnico = cargoClass === 'tecnico' || (person.cargo || '').includes('SUPERVISOR')
  const phoneLines = parsePhoneLines(person.telefono, person.operador)

  // Cerrar drawer con tecla Escape
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="obs-drawer-overlay">
      <div className="obs-drawer" style={{ maxWidth: '460px' }}>
        {/* Cabecera del Drawer */}
        <div className="obs-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div className={`person-avatar ${cargoClass}`} style={{ width: '46px', height: '46px', fontSize: '1.1rem' }}>
              {getInitials(person.nombre_completo)}
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>
                {person.nombre_completo}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                <span className={`role-badge ${cargoClass}`}>
                  {person.cargo}
                </span>
                {isTecnico && person.cuadrilla && (
                  <span className="prog-card-cuadrilla-badge">
                    {person.cuadrilla}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="obs-close-btn" onClick={onClose} title="Cerrar ventana">
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Drawer */}
        <div className="obs-drawer-body" style={{ gap: '1.2rem', padding: '1.4rem' }}>
          {/* Bloque de Información General */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Datos del Integrante
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cargo / Rol</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {person.cargo}
                </div>
              </div>

              {isTecnico ? (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cuadrilla Fija</div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#818cf8' }}>
                    {person.cuadrilla || 'Sin asignar'}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Asignación</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Rotativo en campo
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ciudad Base / Origen</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} color="#818cf8" />
                  {person.origen || 'No registrada'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID de Registro</div>
                <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                  {person.id ? person.id.slice(0, 8) + '...' : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Bloque de Contacto y Telefonía */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Canales Telefónicos de Contacto
            </div>

            {phoneLines.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                No tiene números de teléfono registrados.
              </div>
            ) : (
              phoneLines.map((line, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '10px',
                    padding: '0.75rem 0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Phone size={14} color="#818cf8" />
                      <span style={{ fontFamily: 'monospace', fontSize: '0.92rem', fontWeight: 700, color: '#e2e8f0' }}>
                        {line.phone}
                      </span>
                    </div>
                    {line.operator && (
                      <span className={`phone-operator-tag ${getOperatorClass(line.operator)}`}>
                        {line.operator}
                      </span>
                    )}
                  </div>

                  {line.clean && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
                      <a
                        href={`tel:${line.clean}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          color: '#34d399',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          textDecoration: 'none'
                        }}
                      >
                        <PhoneCall size={13} />
                        Llamar
                      </a>
                      <a
                        href={`https://wa.me/51${line.clean}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem',
                          borderRadius: '6px',
                          background: 'rgba(37, 211, 102, 0.15)',
                          border: '1px solid rgba(37, 211, 102, 0.35)',
                          color: '#25d366',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          textDecoration: 'none'
                        }}
                      >
                        <MessageSquare size={13} />
                        WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Seguridad de Acceso (Exclusivo Administrador) */}
          {isAdmin && (
            <div style={{
              background: 'rgba(99, 102, 241, 0.06)',
              border: '1px solid rgba(99, 102, 241, 0.22)',
              borderRadius: '10px',
              padding: '0.75rem 0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.6rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={15} color="#818cf8" />
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c7d2fe' }}>
                    Seguridad y Contraseña
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Exclusivo para tu cuenta Administrador
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenPasswordModal}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid #818cf8',
                  color: '#e0e7ff',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span>Cambiar Mi Clave</span>
              </button>
            </div>
          )}

          {/* Acciones de gestión en el Drawer */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: '0.75rem',
            marginTop: 'auto',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)'
          }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', padding: '0.65rem', fontSize: '0.82rem' }}
              onClick={() => {
                onClose()
                onEdit(person)
              }}
            >
              <Edit2 size={14} color="#818cf8" />
              Editar Integrante
            </button>

            <button
              type="button"
              className="btn-danger-soft"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', padding: '0.65rem', fontSize: '0.82rem' }}
              onClick={() => {
                onDelete(person.id, person.nombre_completo)
              }}
            >
              <Trash2 size={14} />
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// SUBCOMPONENTE: Modal Registrar / Editar Personal
// Soporta 2 líneas telefónicas y asignación de cuadrilla SOLO para técnicos
// ────────────────────────────────────────────────────────────
function ModalPersonal({ member, onClose, onSaved }) {
  const isEditing = !!member
  const [nombre, setNombre] = useState(member?.nombre_completo || '')
  const [email, setEmail] = useState(member?.email || '')
  const [empresa, setEmpresa] = useState(member?.empresa || 'COVEPA')
  const [cargo, setCargo] = useState(member?.cargo || 'TÉCNICO')
  const [cuadrilla, setCuadrilla] = useState(member?.cuadrilla || 'CUADRILLA 1')
  const [origen, setOrigen] = useState(member?.origen || '')

  // Separar líneas telefónicas y operadores existentes
  const initialPhones = (member?.telefono || '').split('/').map(s => s.trim())
  const initialOps = (member?.operador || '').split('/').map(s => s.trim())

  const [tel1, setTel1] = useState(initialPhones[0] || '')
  const [op1, setOp1] = useState(initialOps[0] || 'BITEL')
  const [tel2, setTel2] = useState(initialPhones[1] || '')
  const [op2, setOp2] = useState(initialOps[1] || 'CLARO')

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Cerrar modal con tecla Escape
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const isTecnico = cargo.includes('TÉCNICO') || cargo.includes('SUPERVISOR')
  const isGilat = empresa === 'GILAT'

  const handleSubmit = async e => {
    e.preventDefault()
    setErrorMsg('')

    if (!nombre.trim()) {
      setErrorMsg('El nombre completo es obligatorio.')
      return
    }

    // Construir combinación de teléfonos y operadores
    const phoneParts = []
    const opParts = []
    if (tel1.trim()) {
      phoneParts.push(tel1.trim())
      opParts.push(op1.trim().toUpperCase())
    }
    if (tel2.trim()) {
      phoneParts.push(tel2.trim())
      opParts.push(op2.trim().toUpperCase())
    }

    const combinedTelefono = phoneParts.length > 0 ? phoneParts.join(' / ') : null
    const combinedOperador = opParts.length > 0 ? opParts.join(' / ') : null

    setSaving(true)
    try {
      const payload = {
        nombre_completo: nombre,
        empresa: empresa || 'COVEPA',
        cargo,
        // Solo los técnicos de COVEPA conservan cuadrilla fija
        cuadrilla: (!isGilat && isTecnico) ? (cuadrilla ? cuadrilla.trim().toUpperCase() : null) : null,
        origen,
        email: email ? email.trim().toLowerCase() : null,
        telefono: combinedTelefono,
        operador: combinedOperador,
        activo: true
      }

      if (isEditing) {
        await updatePersonal(member.id, payload)
      } else {
        await createPersonal(payload)
      }
      onSaved()
    } catch (err) {
      setErrorMsg(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="prog-modal-overlay">
      <div className="prog-modal" style={{ maxWidth: '520px' }}>
        <div className="prog-modal-header">
          <h3>
            <Users size={18} color="#818cf8" />
            {isEditing ? 'Editar Integrante' : 'Nuevo Integrante de Personal'}
          </h3>
          <button className="btn-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="prog-modal-body">
            {errorMsg && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                {errorMsg}
              </div>
            )}

            <div className="prog-form-group">
              <label>Nombre Completo *</label>
              <input
                type="text"
                className="prog-form-control"
                placeholder="Ej: JHONATAN FLORES"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
              />
            </div>

            <div className="prog-form-group">
              <label>Correo Electrónico (Opcional - Para vincular acceso web al sistema)</label>
              <input
                type="email"
                className="prog-form-control"
                placeholder="ejemplo@covepa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="prog-form-group">
                <label>Empresa *</label>
                <select
                  className="prog-form-control"
                  value={empresa}
                  onChange={e => {
                    const val = e.target.value
                    setEmpresa(val)
                    if (val === 'GILAT' && cargo === 'TÉCNICO') {
                      setCargo('SUPERVISOR GILAT')
                    }
                  }}
                  required
                >
                  <option value="COVEPA">COVEPA (Operación / Cuadrillas)</option>
                  <option value="GILAT">GILAT (Cliente / Auditor / Validador)</option>
                </select>
              </div>

              <div className="prog-form-group">
                <label>Cargo *</label>
                <select
                  className="prog-form-control"
                  value={cargo}
                  onChange={e => setCargo(e.target.value)}
                  required
                >
                  {isGilat ? (
                    <>
                      <option value="SUPERVISOR GILAT">SUPERVISOR GILAT</option>
                      <option value="AUDITOR GILAT">AUDITOR GILAT</option>
                      <option value="VALIDADOR GILAT">VALIDADOR GILAT</option>
                      <option value="COORDINADOR GILAT">COORDINADOR GILAT</option>
                    </>
                  ) : (
                    <>
                      <option value="TÉCNICO">TÉCNICO</option>
                      <option value="CONDUCTOR">CONDUCTOR</option>
                      <option value="SUPERVISOR / CAMPO">SUPERVISOR / CAMPO</option>
                      <option value="COORDINADOR">COORDINADOR</option>
                      <option value="GESTIÓN DE CALIDAD">GESTIÓN DE CALIDAD</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              {/* Cuadrilla solo para Técnicos de COVEPA */}
              <div className="prog-form-group">
                <label>Cuadrilla Fija {(!isGilat && isTecnico) ? '*' : '(No aplica)'}</label>
                {(!isGilat && isTecnico) ? (
                  <select
                    className="prog-form-control"
                    value={cuadrilla}
                    onChange={e => setCuadrilla(e.target.value)}
                  >
                    <option value="CUADRILLA 1">CUADRILLA 1</option>
                    <option value="CUADRILLA 2">CUADRILLA 2</option>
                    <option value="CUADRILLA 3">CUADRILLA 3</option>
                    <option value="CUADRILLA 4">CUADRILLA 4</option>
                    <option value="CUADRILLA 5">CUADRILLA 5</option>
                    <option value="CUADRILLA 6">CUADRILLA 6</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    className="prog-form-control"
                    value={isGilat ? 'No aplica (Personal GILAT)' : 'Rotativo / Sin cuadrilla fija'}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                )}
              </div>

              <div className="prog-form-group">
                <label>Ciudad Base / Origen</label>
                <input
                  type="text"
                  className="prog-form-control"
                  placeholder="Ej: LIMA, CHACHAPOYAS, BAGUA"
                  value={origen}
                  onChange={e => setOrigen(e.target.value)}
                />
              </div>
            </div>

            {/* Línea Telefónica 1 */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={13} />
                Línea Telefónica Principal
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.6rem' }}>
                <input
                  type="text"
                  className="prog-form-control"
                  placeholder="Número (ej: 929985566)"
                  value={tel1}
                  onChange={e => setTel1(e.target.value)}
                />
                <select
                  className="prog-form-control"
                  value={op1}
                  onChange={e => setOp1(e.target.value)}
                >
                  <option value="BITEL">BITEL</option>
                  <option value="CLARO">CLARO</option>
                  <option value="MOVISTAR">MOVISTAR</option>
                  <option value="ENTEL">ENTEL</option>
                </select>
              </div>
            </div>

            {/* Línea Telefónica 2 (Opcional) */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={13} />
                Segunda Línea Telefónica (Opcional - Otro Operador)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.6rem' }}>
                <input
                  type="text"
                  className="prog-form-control"
                  placeholder="Número 2 (ej: 939507297)"
                  value={tel2}
                  onChange={e => setTel2(e.target.value)}
                />
                <select
                  className="prog-form-control"
                  value={op2}
                  onChange={e => setOp2(e.target.value)}
                >
                  <option value="CLARO">CLARO</option>
                  <option value="BITEL">BITEL</option>
                  <option value="MOVISTAR">MOVISTAR</option>
                  <option value="ENTEL">ENTEL</option>
                </select>
              </div>
            </div>
          </div>

          <div className="prog-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Registrar Integrante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// SUBCOMPONENTE: Modal Cambiar Contraseña (Exclusivo Administrador)
// ────────────────────────────────────────────────────────────
function ModalCambiarPassword({ onClose, onPasswordUpdated }) {
  const { user, updatePassword } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Cerrar modal con tecla Escape
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async e => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden. Por favor verifica ambos campos.')
      return
    }

    setLoading(true)
    try {
      const { error } = await updatePassword(newPassword)
      if (error) throw error

      setSuccessMsg('¡Contraseña actualizada exitosamente en Supabase!')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        if (onPasswordUpdated) onPasswordUpdated()
        onClose()
      }, 1600)
    } catch (err) {
      console.error('Error al cambiar contraseña:', err)
      setErrorMsg(err.message || 'Error al actualizar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="prog-modal-overlay">
      <div className="prog-modal" style={{ maxWidth: '440px' }}>
        <div className="prog-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(99, 102, 241, 0.35)'
            }}>
              <KeyRound size={17} color="#818cf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Seguridad de Administrador</h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cambiar contraseña de acceso</span>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="prog-modal-body" style={{ gap: '1rem', padding: '1.25rem' }}>
            {/* Indicador de cuenta actual */}
            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.68rem', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 700 }}>
                  Cuenta Administradora
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user?.email || 'jcarloscc1101@gmail.com'}
                </span>
              </div>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                Admin
              </span>
            </div>

            {errorMsg && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34d399',
                padding: '0.75rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="prog-form-group">
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Nueva Contraseña *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="prog-form-control"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: '0.6rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="prog-form-group">
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Confirmar Nueva Contraseña *
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                className="prog-form-control"
                placeholder="Repite la nueva contraseña"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="prog-modal-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !newPassword}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'linear-gradient(135deg, #6366f1, #0ea5e9)'
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>Actualizando...</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Actualizar Contraseña</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
