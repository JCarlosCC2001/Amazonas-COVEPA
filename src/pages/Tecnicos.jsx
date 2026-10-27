import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users, UserPlus, Search, Phone, MessageSquare, Edit2,
  Trash2, Shield, Wrench, Truck, MapPin, RefreshCw, X,
  LayoutGrid, List, PhoneCall, Eye, EyeOff, ChevronRight,
  KeyRound, Lock, CheckCircle2, AlertCircle, ShieldCheck,
  UserCheck, UserX, Mail, Fingerprint, Check, Copy, Sparkles, Building2
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePresentationMode } from '../context/PresentationContext'
import {
  fetchPersonal,
  createPersonal,
  updatePersonal,
  deletePersonal,
  updateCuadrillaAssignments,
  toggleAccesoPersonal,
  assignUserAccount
} from '../services/personalService'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'
import SearchInput from '../components/shared/SearchInput'
import { getInitials, getCargoClass } from '../utils/helpers'

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

export default function Tecnicos() {
  const { user, isAdmin } = useAuth()
  const { presentationMode, togglePresentationMode } = usePresentationMode()
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

  // Lista de empresas oficiales permitidas en el proyecto
  const empresas = useMemo(() => {
    return ['SELNET S.A.C.', 'COVEPA S.A.C.', 'Gilat Networks']
  }, [])

  // Filtrado reactivo con soporte para DNI, nombre, apellido, email, cargo, empresa
  const filteredPersonal = useMemo(() => {
    const q = search.toLowerCase().trim()
    return personal.filter(p => {
      const matchSearch =
        !q ||
        (p.nombre_completo && p.nombre_completo.toLowerCase().includes(q)) ||
        (p.nombre && p.nombre.toLowerCase().includes(q)) ||
        (p.apellido && p.apellido.toLowerCase().includes(q)) ||
        (p.dni && p.dni.includes(q)) ||
        (p.documento_identidad && p.documento_identidad.includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.telefono && p.telefono.includes(q)) ||
        (p.contacto_1 && p.contacto_1.includes(q)) ||
        (p.contacto_2 && p.contacto_2.includes(q)) ||
        (p.cargo && p.cargo.toLowerCase().includes(q)) ||
        (p.empresa && p.empresa.toLowerCase().includes(q))

      const matchCargo = filterCargo === 'TODOS' || (p.cargo || '').toUpperCase() === filterCargo.toUpperCase()
      const matchEmpresa = filterEmpresa === 'TODOS' || (p.empresa || '').toUpperCase() === filterEmpresa.toUpperCase()

      return matchSearch && matchCargo && matchEmpresa
    })
  }, [personal, search, filterCargo, filterEmpresa])

  // KPIs
  const kpis = useMemo(() => {
    const total = personal.length
    const conCuenta = personal.filter(p => !!p.cuenta_usuario).length
    const conAcceso = personal.filter(p => p.activo).length
    const tecnicos = personal.filter(p => (p.cargo || '').toUpperCase().includes('TÉCN') || (p.cargo || '').toUpperCase().includes('TECN')).length
    const supervisores = personal.filter(p => (p.cargo || '').toUpperCase().includes('SUPERVIS')).length
    const conductores = personal.filter(p => (p.cargo || '').toUpperCase().includes('CONDUCTOR')).length
    return { total, conCuenta, conAcceso, tecnicos, supervisores, conductores }
  }, [personal])

  const handleToggleAccess = async (person) => {
    try {
      const newStatus = !person.activo
      await toggleAccesoPersonal(person.id, newStatus, person.email, person.cargo)
      setPersonal(prev => prev.map(p => p.id === person.id ? { ...p, activo: newStatus } : p))
      setSelectedDrawerPerson(prev => prev ? { ...prev, activo: newStatus } : null)
    } catch (err) {
      alert('Error al actualizar acceso: ' + err.message)
    }
  }

  const handleAssignAccount = async (personId, { email, rol, activo }) => {
    try {
      const updatedProf = await assignUserAccount({
        id_personal: personId,
        email,
        rol,
        activo
      })
      setPersonal(prev => prev.map(p => {
        if (p.id === personId) {
          return {
            ...p,
            email,
            cuenta_usuario: {
              id: updatedProf?.id || p.cuenta_usuario?.id,
              email,
              rol,
              activo
            }
          }
        }
        return p
      }))
      setSelectedDrawerPerson(prev => {
        if (prev && prev.id === personId) {
          return {
            ...prev,
            email,
            cuenta_usuario: {
              id: updatedProf?.id || prev.cuenta_usuario?.id,
              email,
              rol,
              activo
            }
          }
        }
        return prev
      })
      return true
    } catch (err) {
      alert('Error al vincular cuenta en BD local: ' + err.message)
      throw err
    }
  }

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

  // Si está activo el Modo Secreto / Presentación, bloquear acceso a la vista de Personal
  if (presentationMode) {
    return (
      <div className="personal-restricted-wrapper">
        <div className="personal-restricted-card">
          <div className="personal-restricted-icon-box">
            <Lock size={38} color="#003060" />
          </div>
          <h2 className="personal-restricted-title">Apartado Restringido</h2>
          <p className="personal-restricted-msg">
            Este apartado solo está disponible para la vista de administrador libre.
          </p>
          <div className="personal-restricted-banner">
            <ShieldCheck size={16} color="#b45309" />
            <span>El Modo Secreto / Presentación está activo para proteger la privacidad de los integrantes y sus números telefónicos.</span>
          </div>
          <button
            type="button"
            className="personal-restricted-btn"
            onClick={togglePresentationMode}
          >
            <Eye size={16} />
            <span>Desactivar Modo Secreto</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="personal-container">
      {/* ── MEDIDORES / KPIs REUTILIZABLES DE PERSONAL ── */}
      <MetricGrid columns={4}>
        <MetricCard
          icon={<Users size={22} />}
          label="Total Personal"
          value={kpis.total}
          subtitle={`${kpis.conCuenta} con cuenta vinculada`}
          variant="navy"
          onClick={() => setFilterCargo('TODOS')}
          active={filterCargo === 'TODOS'}
          title="Ver todos los integrantes registrados en BD externa"
        />
        <MetricCard
          icon={<Shield size={22} />}
          label="Supervisores"
          value={kpis.supervisores}
          subtitle="Supervisión y control"
          variant="purple"
          onClick={() => setFilterCargo(prev => prev === 'SUPERVISOR' ? 'TODOS' : 'SUPERVISOR')}
          active={filterCargo === 'SUPERVISOR'}
          title="Filtrar supervisores"
        />
        <MetricCard
          icon={<Wrench size={22} />}
          label="Técnicos"
          value={kpis.tecnicos}
          subtitle="Personal operativo de campo"
          variant="sky"
          onClick={() => setFilterCargo(prev => prev === 'TECNICO' ? 'TODOS' : 'TECNICO')}
          active={filterCargo === 'TECNICO'}
          title="Filtrar técnicos de campo"
        />
        <MetricCard
          icon={<Truck size={22} />}
          label="Conductores"
          value={kpis.conductores}
          subtitle="Logística y movilidad"
          variant="emerald"
          onClick={() => setFilterCargo(prev => prev === 'CONDUCTOR' ? 'TODOS' : 'CONDUCTOR')}
          active={filterCargo === 'CONDUCTOR'}
          title="Filtrar conductores"
        />
      </MetricGrid>

      {/* ── BARRA SUPERIOR INTEGRADA (Buscador + Filtros + Acciones) ── */}
      <div className="prog-toolbar">
        {/* Izquierda: Buscador y Filtro por Cargo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', flex: 1 }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre, DNI, empresa..."
            style={{ maxWidth: '280px' }}
            iconSize={14}
          />

          <select
            className="filter-select"
            value={filterEmpresa}
            onChange={e => setFilterEmpresa(e.target.value)}
            style={{ fontSize: 'var(--text-sm)', padding: '0.4rem 0.6rem' }}
          >
            <option value="TODOS">Todas las Empresas ({personal.length})</option>
            {empresas.map(emp => (
              <option key={emp} value={emp}>{emp}</option>
            ))}
          </select>

          <select
            className="filter-select"
            value={filterCargo}
            onChange={e => setFilterCargo(e.target.value)}
            style={{ fontSize: 'var(--text-sm)', padding: '0.4rem 0.6rem' }}
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
                fontWeight: 'var(--fw-semibold)',
                fontSize: 'var(--text-sm)',
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

      {/* ── CONTENIDO: VISTA TARJETAS INDIVIDUALES REDISEÑADA ── */}
      {viewMode === 'tarjetas' && (
        <div className="personal-grid">
          {filteredPersonal.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3.5rem 1rem', background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <Users size={40} style={{ opacity: 0.3, margin: '0 auto 0.75rem auto' }} />
              <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-base)', color: '#003060' }}>No se encontró personal con los filtros aplicados</div>
              <div style={{ fontSize: 'var(--text-sm)', marginTop: '0.25rem' }}>Prueba ajustando el término de búsqueda o seleccionando otro cargo</div>
            </div>
          ) : (
            filteredPersonal.map(person => {
              const cargoClass = getCargoClass(person.cargo)
              const isTecnico = cargoClass === 'tecnico' || (person.cargo || '').includes('SUPERVISOR')
              const phoneLines = parsePhoneLines(person.telefono, person.operador)
              const firstPhone = phoneLines[0]
              const isGilat = (person.empresa || '').toUpperCase().includes('GILAT')
              const isCarlos = (person.nombre_completo || '').includes('CARLOS CONDOR')

              return (
                <div
                  key={person.id}
                  className="person-card"
                  onClick={() => setSelectedDrawerPerson(person)}
                  title="Clic para ver ficha completa y permisos de acceso"
                  style={{ cursor: 'pointer' }}
                >
                  {/* Cabecera de la persona */}
                  <div className="person-card-top">
                    <div className="person-identity">
                      <div className={`person-avatar ${cargoClass}`}>
                        {getInitials(person.nombre_completo)}
                      </div>
                      <div className="person-names-box">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span className="person-name">{person.nombre_completo}</span>
                          {isCarlos && (
                            <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-black)', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(0, 48, 96, 0.08)', color: '#003060', border: '1px solid rgba(0, 48, 96, 0.2)' }}>
                              SUPERVISOR COVEPA
                            </span>
                          )}
                        </div>

                        <div className="person-tags-row">
                          {person.documento_identidad ? (
                            <span className="person-dni-badge" title="Documento Nacional de Identidad">
                              DNI {person.documento_identidad}
                            </span>
                          ) : (
                            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                              Sin DNI
                            </span>
                          )}

                          <span className={`role-badge ${cargoClass}`}>
                            {person.cargo}
                          </span>

                          <span
                            style={{
                              fontSize: 'var(--text-2xs)',
                              fontWeight: 'var(--fw-bold)',
                              padding: '0.1rem 0.38rem',
                              borderRadius: '4px',
                              background: isGilat ? '#e0f2fe' : 'rgba(0, 48, 96, 0.07)',
                              border: `1px solid ${isGilat ? '#7dd3fc' : 'rgba(0, 48, 96, 0.2)'}`,
                              color: isGilat ? '#0369a1' : '#003060',
                              textTransform: 'uppercase'
                            }}
                          >
                            {person.empresa || 'SELNET S.A.C.'}
                          </span>

                          {isTecnico && person.cuadrilla && (
                            <span className="prog-card-cuadrilla-badge">
                              {person.cuadrilla}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                      {person.cuenta_usuario ? (
                        <>
                          <span className={`role-tag-covepa ${person.cuenta_usuario.rol}`}>
                            {person.cuenta_usuario.rol}
                          </span>
                          <span className={`covepa-access-badge ${person.cuenta_usuario.activo ? 'active' : 'inactive'}`} title={person.cuenta_usuario.activo ? 'Cuenta COVEPA habilitada' : 'Cuenta COVEPA deshabilitada'}>
                            {person.cuenta_usuario.activo ? <ShieldCheck size={11} /> : <Lock size={11} />}
                            {person.cuenta_usuario.activo ? 'Habilitado' : 'Bloqueado'}
                          </span>
                        </>
                      ) : (
                        <span className="covepa-access-badge inactive" title="Sin cuenta de acceso asignada en este proyecto">
                          <Lock size={11} /> Sin Cuenta
                        </span>
                      )}
                      <ChevronRight size={15} color="var(--text-muted)" />
                    </div>
                  </div>

                  {/* Datos de contacto y ubicación */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.35rem' }}>
                    {/* Fila Ciudad Base y Correo */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                        <MapPin size={13} color="#0284c7" />
                        Base: <strong style={{ color: '#003060' }}>{person.origen || 'Por asignar'}</strong>
                      </span>
                      {person.email && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }} title={person.email}>
                          <Mail size={12} color="#0284c7" />
                          {person.email.length > 20 ? person.email.slice(0, 18) + '…' : person.email}
                        </span>
                      )}
                    </div>

                    {/* Fila Teléfono directo con botones de llamada y WhatsApp */}
                    {firstPhone ? (
                      <div className="phone-line-card" style={{ marginTop: '0.15rem' }}>
                        <div className="phone-left">
                          <Phone size={13} color="#003060" />
                          <span className="phone-number">{firstPhone.phone}</span>
                          {firstPhone.operator && (
                            <span className={`phone-operator-tag ${getOperatorClass(firstPhone.operator)}`}>
                              {firstPhone.operator}
                            </span>
                          )}
                        </div>
                        {firstPhone.clean && (
                          <div className="phone-actions" onClick={e => e.stopPropagation()}>
                            <a
                              href={`tel:${firstPhone.clean}`}
                              className="action-btn-circle call"
                              title={`Llamar a ${firstPhone.phone}`}
                            >
                              <PhoneCall size={12} />
                            </a>
                            <a
                              href={`https://wa.me/51${firstPhone.clean}`}
                              target="_blank"
                              rel="noreferrer"
                              className="action-btn-circle wa"
                              title={`Abrir WhatsApp con ${firstPhone.phone}`}
                            >
                              <MessageSquare size={12} />
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.2rem 0' }}>
                        Sin teléfono registrado
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── CONTENIDO: VISTA LISTA GENERAL (TABLA) REDISEÑADA ── */}
      {viewMode === 'lista' && (
        <div className="table-container" style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Integrante</th>
                <th>DNI / Documento</th>
                <th>Cargo</th>
                <th>Empresa</th>
                <th>Contacto Directo</th>
                <th>Estado BD Externa</th>
                <th>Cuenta y Rol COVEPA</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPersonal.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No se encontró personal con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredPersonal.map(person => {
                  const cargoClass = getCargoClass(person.cargo)
                  const phoneLines = parsePhoneLines(person.telefono, person.operador)
                  const firstPhone = phoneLines[0]

                  return (
                    <tr
                      key={person.id}
                      onClick={() => setSelectedDrawerPerson(person)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div className={`person-avatar ${cargoClass}`} style={{ width: '32px', height: '32px', fontSize: 'var(--text-sm)' }}>
                            {getInitials(person.nombre_completo)}
                          </div>
                          <div>
                            <div style={{ color: '#003060', fontWeight: 'var(--fw-bold)' }}>{person.nombre_completo}</div>
                            {person.email && (
                              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{person.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {person.documento_identidad ? (
                          <span className="person-dni-badge">
                            {person.documento_identidad}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`role-badge ${cargoClass}`}>
                          {person.cargo}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 'var(--text-xs)',
                            fontWeight: 'var(--fw-bold)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: person.empresa?.toUpperCase().includes('GILAT') ? '#e0f2fe' : 'rgba(0, 48, 96, 0.07)',
                            border: `1px solid ${person.empresa?.toUpperCase().includes('GILAT') ? '#7dd3fc' : 'rgba(0, 48, 96, 0.2)'}`,
                            color: person.empresa?.toUpperCase().includes('GILAT') ? '#0369a1' : '#003060'
                          }}
                        >
                          {person.empresa || 'SELNET S.A.C.'}
                        </span>
                      </td>
                      <td>
                        {firstPhone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}>{firstPhone.phone}</span>
                            {firstPhone.operator && (
                              <span className={`phone-operator-tag ${getOperatorClass(firstPhone.operator)}`} style={{ fontSize: 'var(--text-2xs)', padding: '0.05rem 0.3rem' }}>
                                {firstPhone.operator}
                              </span>
                            )}
                            <div style={{ display: 'flex', gap: '3px', marginLeft: '2px' }} onClick={e => e.stopPropagation()}>
                              <a href={`tel:${firstPhone.clean}`} className="action-btn-circle call" title="Llamar">
                                <PhoneCall size={11} />
                              </a>
                              <a href={`https://wa.me/51${firstPhone.clean}`} target="_blank" rel="noreferrer" className="action-btn-circle wa" title="WhatsApp">
                                <MessageSquare size={11} />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {person.activo ? (
                          <span className="covepa-access-badge active" title="Estado activo en la base de datos externa">
                            <ShieldCheck size={11} /> Activo
                          </span>
                        ) : (
                          <span className="covepa-access-badge inactive" title="Estado inactivo en la base de datos externa">
                            <Lock size={11} /> Inactivo
                          </span>
                        )}
                      </td>
                      <td>
                        {person.cuenta_usuario ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span className={`role-tag-covepa ${person.cuenta_usuario.rol}`}>
                              {person.cuenta_usuario.rol}
                            </span>
                            <span className={`covepa-access-badge ${person.cuenta_usuario.activo ? 'active' : 'inactive'}`} style={{ fontSize: 'var(--text-2xs)', padding: '0.1rem 0.35rem' }}>
                              {person.cuenta_usuario.activo ? 'Habilitado' : 'Bloqueado'}
                            </span>
                          </div>
                        ) : (
                          <span className="covepa-access-badge inactive" style={{ fontSize: 'var(--text-2xs)', opacity: 0.75 }}>
                            <Lock size={10} /> Sin Cuenta
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-secondary-soft"
                          style={{ padding: '0.35rem 0.75rem', fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedDrawerPerson(person)
                          }}
                        >
                          <Eye size={13} />
                          Ficha
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
          onToggleAccess={handleToggleAccess}
          onAssignAccount={handleAssignAccount}
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
                    <span style={{ color: '#818cf8', fontWeight: 'var(--fw-semibold)' }}>{tecSelected.telefono || 'Sin telf.'}</span>
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
                    <span style={{ color: '#38bdf8', fontWeight: 'var(--fw-semibold)' }}>{condSelected.telefono || 'Sin telf.'}</span>
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
            style={{ fontSize: 'var(--text-sm)', padding: '0.45rem 0.85rem' }}
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
              style={{ padding: '0.35rem 0.65rem', fontSize: 'var(--text-sm)', width: '180px' }}
              autoFocus
            />
            <button type="submit" className="btn-primary" style={{ fontSize: 'var(--text-sm)', padding: '0.4rem 0.75rem' }}>
              Crear
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: 'var(--text-sm)', padding: '0.4rem 0.65rem' }}
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
function DrawerPersonal({ person, isAdmin, onToggleAccess, onAssignAccount, onOpenPasswordModal, onClose, onEdit, onDelete }) {
  // M1: Hooks antes del guard — persona nula se maneja en el JSX con un guard al final
  // NO hay early return aquí para cumplir con las reglas de hooks de React
  const cargoClass = getCargoClass(person?.cargo)
  const isTecnico = cargoClass === 'tecnico' || (person?.cargo || '').includes('SUPERVISOR')
  const phoneLines = parsePhoneLines(person?.telefono, person?.operador)
  const [copiedDni, setCopiedDni] = useState(false)
  const [togglingAccess, setTogglingAccess] = useState(false)

  // Estado para asignación de cuenta y rol en la base de datos de este proyecto
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [accountEmail, setAccountEmail] = useState(person.cuenta_usuario?.email || person.email || '')
  const [accountRol, setAccountRol] = useState(person.cuenta_usuario?.rol || (person.cargo?.toUpperCase().includes('SUPERVISOR') ? 'supervisor' : 'tecnico'))
  const [accountActivo, setAccountActivo] = useState(person.cuenta_usuario ? person.cuenta_usuario.activo : true)
  const [savingAccount, setSavingAccount] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Cerrar drawer con tecla Escape
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Mantener actualizado el formulario al cambiar de integrante
  useEffect(() => {
    setAccountEmail(person.cuenta_usuario?.email || person.email || '')
    setAccountRol(person.cuenta_usuario?.rol || (person.cargo?.toUpperCase().includes('SUPERVISOR') ? 'supervisor' : 'tecnico'))
    setAccountActivo(person.cuenta_usuario ? person.cuenta_usuario.activo : true)
    setShowAssignForm(false)
    setSavedSuccess(false)
  }, [person])

  const handleCopyDni = (e) => {
    e.stopPropagation()
    const doc = person.dni || person.documento_identidad
    if (!doc) return
    navigator.clipboard.writeText(doc)
    setCopiedDni(true)
    setTimeout(() => setCopiedDni(false), 2000)
  }

  const handleToggle = async () => {
    setTogglingAccess(true)
    try {
      if (onToggleAccess) {
        await onToggleAccess(person)
      }
    } finally {
      setTogglingAccess(false)
    }
  }

  const handleSaveAccount = async (e) => {
    e.preventDefault()
    if (!accountEmail.trim()) {
      alert('Ingresa un correo electrónico para asignar la cuenta.')
      return
    }
    setSavingAccount(true)
    try {
      if (onAssignAccount) {
        await onAssignAccount(person.id, {
          email: accountEmail.trim(),
          rol: accountRol,
          activo: accountActivo
        })
      }
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
      setShowAssignForm(false)
    } catch {
      // alert gestionado por callback
    } finally {
      setSavingAccount(false)
    }
  }

  const isCarlos = (person.nombre_completo || '').includes('CARLOS CONDOR')
  const hasAccount = !!person.cuenta_usuario

  // Guard después de todos los hooks — cumple reglas de hooks
  if (!person) return null
  return (
    <div className="obs-drawer-overlay">
      <div className="obs-drawer" style={{ maxWidth: '480px' }}>
        {/* Cabecera del Drawer */}
        <div className="obs-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div className={`person-avatar ${cargoClass}`} style={{ width: '48px', height: '48px', fontSize: 'var(--text-lg)' }}>
              {getInitials(person.nombre_completo)}
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--text-lg)', margin: 0, color: '#003060', fontWeight: 'var(--fw-bold)' }}>
                {person.nombre_completo}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                <span className={`role-badge ${cargoClass}`}>
                  {person.cargo}
                </span>
                <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', padding: '0.12rem 0.4rem', borderRadius: '4px', background: 'rgba(0, 48, 96, 0.08)', color: '#003060', border: '1px solid rgba(0, 48, 96, 0.2)' }}>
                  {person.empresa || 'SELNET S.A.C.'}
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
        <div className="obs-drawer-body" style={{ gap: '1.1rem', padding: '1.25rem' }}>

          {/* ── SECCIÓN 1: ASIGNACIÓN DE CUENTA Y ROL EN ESTE PROYECTO (COVEPA) ── */}
          <div className={`drawer-access-metric-card ${hasAccount && person.cuenta_usuario.activo ? 'is-active' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {hasAccount && person.cuenta_usuario.activo ? (
                  <ShieldCheck size={20} color="#059669" />
                ) : (
                  <Lock size={20} color="#64748b" />
                )}
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-black)', color: '#003060', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Cuenta y Rol en este Proyecto
                </span>
              </div>

              {hasAccount ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span className={`role-tag-covepa ${person.cuenta_usuario.rol}`}>
                    {person.cuenta_usuario.rol}
                  </span>
                  <span className={`covepa-access-badge ${person.cuenta_usuario.activo ? 'active' : 'inactive'}`}>
                    {person.cuenta_usuario.activo ? 'Habilitada' : 'Bloqueada'}
                  </span>
                </div>
              ) : (
                <span className="covepa-access-badge inactive">
                  <AlertCircle size={11} /> Sin Cuenta en COVEPA
                </span>
              )}
            </div>

            <div style={{ fontSize: 'var(--text-sm)', color: hasAccount ? 'var(--text-secondary)' : 'var(--text-muted)', lineHeight: 1.45 }}>
              {hasAccount
                ? `Este integrante tiene una cuenta configurada con el rol de ${person.cuenta_usuario.rol.toUpperCase()} en esta base de datos.`
                : 'Este integrante proviene de la base de datos externa y aún no tiene una cuenta ni rol asignado en este proyecto. Puedes asignárselo a continuación.'}
            </div>

            {/* Si el formulario de asignación está abierto */}
            {showAssignForm ? (
              <form onSubmit={handleSaveAccount} className="account-form-box">
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: '#003060', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={13} color="#0284c7" />
                  Asignar / Modificar Cuenta y Rol
                </div>

                <div className="prog-form-group" style={{ marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: 'var(--text-xs)', color: '#003060', fontWeight: 'var(--fw-semibold)' }}>Correo Electrónico de Ingreso *</label>
                  <input
                    type="email"
                    className="prog-form-control"
                    placeholder="usuario@covepa.com"
                    value={accountEmail}
                    onChange={e => setAccountEmail(e.target.value)}
                    required
                    style={{ fontSize: 'var(--text-sm)', padding: '0.4rem 0.6rem' }}
                  />
                </div>

                <div className="prog-form-group" style={{ marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: 'var(--text-xs)', color: '#003060', fontWeight: 'var(--fw-semibold)' }}>Rol en este Programa *</label>
                  <select
                    className="prog-form-control"
                    value={accountRol}
                    onChange={e => setAccountRol(e.target.value)}
                    style={{ fontSize: 'var(--text-sm)', padding: '0.4rem 0.6rem' }}
                  >
                    <option value="admin">Administrador General (Acceso Total)</option>
                    <option value="supervisor">Supervisor (Operación y Validación)</option>
                    <option value="coordinador">Coordinador (Programación y Reportes)</option>
                    <option value="tecnico">Técnico (Consulta y Campo)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: '#003060', fontWeight: 'var(--fw-semibold)' }}>Habilitar Inicio de Sesión</span>
                  <input
                    type="checkbox"
                    checked={accountActivo}
                    onChange={e => setAccountActivo(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#003060' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.3rem' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={savingAccount}
                    style={{ fontSize: 'var(--text-sm)', padding: '0.45rem', justifyContent: 'center' }}
                  >
                    {savingAccount ? 'Guardando...' : 'Guardar Cuenta'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAssignForm(false)}
                    disabled={savingAccount}
                    style={{ fontSize: 'var(--text-sm)', padding: '0.45rem', justifyContent: 'center' }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Resumen de credenciales */}
                <div style={{ background: '#f8fbfe', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Identificador / DNI</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                      {person.dni || person.documento_identidad || 'Sin DNI'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Rol Asignado</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)', color: '#0284c7' }}>
                      {hasAccount ? (
                        <span className={`role-tag-covepa ${person.cuenta_usuario.rol}`}>
                          {person.cuenta_usuario.rol}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Sin asignar</span>
                      )}
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Correo Electrónico de Ingreso</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: (person.cuenta_usuario?.email || person.email) ? '#003060' : 'var(--text-muted)' }}>
                      {person.cuenta_usuario?.email || person.email || 'Sin correo asociado'}
                    </div>
                  </div>
                </div>

                {savedSuccess && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#059669', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle2 size={14} /> ¡Cuenta y rol asignados exitosamente en la BD del proyecto!
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAssignForm(true)}
                    style={{ fontSize: 'var(--text-sm)', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <KeyRound size={14} color="#003060" />
                    <span>{hasAccount ? 'Modificar Cuenta y Rol en COVEPA' : 'Asignar Cuenta y Rol a este Personal'}</span>
                  </button>

                  {hasAccount && (
                    <button
                      type="button"
                      className={`btn-access-toggle ${person.cuenta_usuario.activo ? 'disable' : 'enable'}`}
                      onClick={handleToggle}
                      disabled={togglingAccess}
                    >
                      {togglingAccess ? (
                        <RefreshCw size={14} className="spin" />
                      ) : person.cuenta_usuario.activo ? (
                        <>
                          <Lock size={14} />
                          <span>Deshabilitar Cuenta de Acceso</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} />
                          <span>Habilitar Cuenta de Acceso</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── SECCIÓN 2: IDENTIFICACIÓN Y DATOS PERSONALES ── */}
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: '#003060', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Identificación Oficial
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>DNI / Documento</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span className="person-dni-badge" style={{ fontSize: 'var(--text-sm)' }}>
                    {person.documento_identidad || 'Sin DNI'}
                  </span>
                  {person.documento_identidad && (
                    <button
                      type="button"
                      onClick={handleCopyDni}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedDni ? '#10b981' : '#0284c7', display: 'flex', alignItems: 'center' }}
                      title="Copiar DNI"
                    >
                      {copiedDni ? <Check size={14} /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Cargo Oficial</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                  {person.cargo}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Empresa Contratante</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: '#003060' }}>
                  {person.empresa || 'SELNET S.A.C.'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>Ciudad Base / Origen</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: '#003060', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} color="#0284c7" />
                  {person.origen || 'No registrada'}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECCIÓN 3: CANALES TELEFÓNICOS DE CONTACTO ── */}
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: '#003060', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Canales Telefónicos y WhatsApp
            </div>

            {phoneLines.length === 0 ? (
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                No tiene números de teléfono registrados.
              </div>
            ) : (
              phoneLines.map((line, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#f8fbfe',
                    border: '1px solid var(--border-light)',
                    borderRadius: '10px',
                    padding: '0.75rem 0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Phone size={14} color="#003060" />
                      <span style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--text-base)', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
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
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#059669',
                          fontSize: 'var(--text-sm)',
                          fontWeight: 'var(--fw-semibold)',
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
                          background: 'rgba(37, 211, 102, 0.12)',
                          border: '1px solid rgba(37, 211, 102, 0.3)',
                          color: '#15803d',
                          fontSize: 'var(--text-sm)',
                          fontWeight: 'var(--fw-semibold)',
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

          {/* Seguridad de Acceso (Exclusivo Administrador para cambiar clave) */}
          {isAdmin && (
            <div style={{
              background: 'rgba(0, 48, 96, 0.04)',
              border: '1px solid rgba(0, 48, 96, 0.15)',
              borderRadius: '10px',
              padding: '0.75rem 0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.6rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={15} color="#003060" />
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)', color: '#003060' }}>
                    Seguridad y Contraseña
                  </div>
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                    Acceso de Administrador Principal
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
                  background: '#003060',
                  border: '1px solid #003060',
                  color: '#ffffff',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--fw-semibold)',
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', padding: '0.65rem', fontSize: 'var(--text-sm)' }}
              onClick={() => {
                onClose()
                onEdit(person)
              }}
            >
              <Edit2 size={14} color="#003060" />
              Editar Integrante
            </button>

            <button
              type="button"
              className="btn-danger-soft"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', padding: '0.65rem', fontSize: 'var(--text-sm)' }}
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
  const [nombre, setNombre] = useState(member?.nombre || (member?.nombre_completo ? member.nombre_completo.split(' ')[0] : ''))
  const [apellido, setApellido] = useState(member?.apellido || (member?.nombre_completo ? member.nombre_completo.split(' ').slice(1).join(' ') : ''))
  const [dni, setDni] = useState(member?.dni || member?.documento_identidad || '')
  const [email, setEmail] = useState(member?.email || '')
  const [cargo, setCargo] = useState(member?.cargo || 'Tecnico')
  const [empresa, setEmpresa] = useState(() => {
    if (!member?.empresa) return 'SELNET S.A.C.'
    const emp = member.empresa.toUpperCase()
    if (emp.includes('COVEPA')) return 'COVEPA S.A.C.'
    if (emp.includes('GILAT')) return 'Gilat Networks'
    return 'SELNET S.A.C.'
  })
  const [estado, setEstado] = useState(member?.estado || 'Activo')
  const [ciudadOrigen, setCiudadOrigen] = useState(member?.ciudad_origen || member?.origen || '')

  const initialPhones = (member?.telefono || '').split('/').map(s => s.trim())
  const initialOps = (member?.operador || '').split('/').map(s => s.trim())

  const [tel1, setTel1] = useState(member?.contacto_1 || initialPhones[0] || '')
  const [op1, setOp1] = useState(member?.operador_1 || initialOps[0] || 'Claro')
  const [tel2, setTel2] = useState(member?.contacto_2 || initialPhones[1] || '')
  const [op2, setOp2] = useState(member?.operador_2 || initialOps[1] || 'Movistar')

  // Asignación de cuenta en la base de datos de este proyecto (COVEPA)
  const [asignarCuenta, setAsignarCuenta] = useState(!!member?.cuenta_usuario || !!member?.email)
  const [rolCuenta, setRolCuenta] = useState(member?.cuenta_usuario?.rol || (member?.cargo?.toUpperCase().includes('SUPERVISOR') ? 'supervisor' : 'tecnico'))
  const [cuentaActiva, setCuentaActiva] = useState(member?.cuenta_usuario ? member.cuenta_usuario.activo : true)

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

  const handleSubmit = async e => {
    e.preventDefault()
    setErrorMsg('')

    if (!nombre.trim()) {
      setErrorMsg('El nombre es obligatorio.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        nombre: nombre.trim(),
        apellido: apellido.trim() || null,
        dni: dni.trim() || null,
        empresa: empresa || 'SELNET S.A.C.',
        cargo: cargo.trim() || 'Tecnico',
        contacto_1: tel1.trim() || null,
        operador_1: tel1.trim() ? op1 : null,
        contacto_2: tel2.trim() || null,
        operador_2: tel2.trim() ? op2 : null,
        email: email ? email.trim().toLowerCase() : null,
        estado: estado || 'Activo',
        activo: estado === 'Activo',
        ciudad_origen: ciudadOrigen.trim() || null,
        // Cuenta de acceso en BD local del proyecto
        rol_cuenta: asignarCuenta ? rolCuenta : null,
        cuenta_activa: asignarCuenta ? cuentaActiva : false,
        asignar_cuenta: asignarCuenta
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
      <div className="prog-modal" style={{ maxWidth: '540px' }}>
        <div className="prog-modal-header">
          <h3>
            <Users size={18} color="#003060" />
            {isEditing ? 'Editar Integrante de Personal' : 'Nuevo Integrante de Personal'}
          </h3>
          <button className="btn-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="prog-modal-body">
            {errorMsg && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#dc2626',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                fontSize: 'var(--text-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                {errorMsg}
              </div>
            )}

            {/* Fila 1: Nombre y Apellido */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="prog-form-group">
                <label>Nombres *</label>
                <input
                  type="text"
                  className="prog-form-control"
                  placeholder="Ej: Carlos"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  required
                />
              </div>

              <div className="prog-form-group">
                <label>Apellidos</label>
                <input
                  type="text"
                  className="prog-form-control"
                  placeholder="Ej: Cóndor"
                  value={apellido}
                  onChange={e => setApellido(e.target.value)}
                />
              </div>
            </div>

            {/* Fila 2: DNI y Correo Electrónico */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="prog-form-group">
                <label>DNI / Documento (8 dígitos)</label>
                <input
                  type="text"
                  className="prog-form-control"
                  placeholder="Ej: 73144613"
                  maxLength={8}
                  value={dni}
                  onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <div className="prog-form-group">
                <label>Correo Electrónico</label>
                <input
                  type="email"
                  className="prog-form-control"
                  placeholder="ejemplo@covepa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Fila 3: Empresa y Cargo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="prog-form-group">
                <label>Empresa *</label>
                <select
                  className="prog-form-control"
                  value={empresa}
                  onChange={e => setEmpresa(e.target.value)}
                  required
                >
                  <option value="SELNET S.A.C.">SELNET S.A.C.</option>
                  <option value="COVEPA S.A.C.">COVEPA S.A.C.</option>
                  <option value="Gilat Networks">Gilat Networks</option>
                </select>
              </div>

              <div className="prog-form-group">
                <label>Cargo *</label>
                <input
                  type="text"
                  className="prog-form-control"
                  list="cargos-list"
                  placeholder="Supervisor, Tecnico..."
                  value={cargo}
                  onChange={e => setCargo(e.target.value)}
                  required
                />
                <datalist id="cargos-list">
                  <option value="Supervisor" />
                  <option value="Tecnico" />
                  <option value="Documentador" />
                  <option value="Conductor" />
                  <option value="Logistica" />
                  <option value="NOC" />
                  <option value="Supervisor de Campo" />
                </datalist>
              </div>
            </div>

            {/* Fila 4: Estado en Base Externa y Ciudad de Origen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="prog-form-group">
                <label>Estado en BD Externa *</label>
                <select
                  className="prog-form-control"
                  value={estado}
                  onChange={e => setEstado(e.target.value)}
                  required
                >
                  <option value="Activo">Activo (Disponible en operación)</option>
                  <option value="Inactivo">Inactivo (Deshabilitado)</option>
                </select>
              </div>

              <div className="prog-form-group">
                <label>Ciudad de Origen / Base</label>
                <input
                  type="text"
                  className="prog-form-control"
                  placeholder="ej: CHACHAPOYAS, BAGUA..."
                  value={ciudadOrigen}
                  onChange={e => setCiudadOrigen(e.target.value)}
                />
              </div>
            </div>

            {/* Fila 5: Teléfono 1 y Operador */}
            <div style={{
              background: '#f8fbfe',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: '#003060', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={13} />
                Línea Telefónica Principal (contacto_1)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.6rem' }}>
                <input
                  type="text"
                  className="prog-form-control"
                  placeholder="Número (ej: 958086874)"
                  value={tel1}
                  onChange={e => setTel1(e.target.value)}
                />
                <select
                  className="prog-form-control"
                  value={op1}
                  onChange={e => setOp1(e.target.value)}
                >
                  <option value="Claro">Claro</option>
                  <option value="Movistar">Movistar</option>
                  <option value="Entel">Entel</option>
                  <option value="Bitel">Bitel</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            {/* Fila 6: Teléfono 2 y Operador */}
            <div style={{
              background: '#f8fbfe',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={13} />
                Segunda Línea Telefónica (contacto_2)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.6rem' }}>
                <input
                  type="text"
                  className="prog-form-control"
                  placeholder="Número 2 (opcional)"
                  value={tel2}
                  onChange={e => setTel2(e.target.value)}
                />
                <select
                  className="prog-form-control"
                  value={op2}
                  onChange={e => setOp2(e.target.value)}
                >
                  <option value="Movistar">Movistar</option>
                  <option value="Claro">Claro</option>
                  <option value="Entel">Entel</option>
                  <option value="Bitel">Bitel</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            {/* SECCIÓN ESPECIAL: Asignar Cuenta y Rol en ESTE PROYECTO (COVEPA) */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              marginTop: '0.3rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)', color: '#166534', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ShieldCheck size={16} color="#16a34a" />
                  Asignar Cuenta y Rol en este Proyecto (COVEPA)
                </div>
                <input
                  type="checkbox"
                  checked={asignarCuenta}
                  onChange={e => setAsignarCuenta(e.target.checked)}
                  style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#16a34a' }}
                />
              </div>

              {asignarCuenta && (
                <>
                  <div style={{ fontSize: 'var(--text-xs)', color: '#15803d' }}>
                    Se vinculará este personal en <code>perfiles_usuario</code> de esta base de datos local con el rol seleccionado.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <div className="prog-form-group">
                      <label style={{ color: '#166534', fontWeight: 'var(--fw-semibold)' }}>Rol Asignado *</label>
                      <select
                        className="prog-form-control"
                        value={rolCuenta}
                        onChange={e => setRolCuenta(e.target.value)}
                        style={{ borderColor: '#86efac' }}
                      >
                        <option value="admin">Administrador (admin)</option>
                        <option value="supervisor">Supervisor (supervisor)</option>
                        <option value="coordinador">Coordinador (coordinador)</option>
                        <option value="tecnico">Técnico (tecnico)</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <label style={{ fontSize: 'var(--text-xs)', color: '#166534', fontWeight: 'var(--fw-semibold)', marginBottom: '0.3rem' }}>
                        Permiso de Acceso
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-sm)', color: '#14532d', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={cuentaActiva}
                          onChange={e => setCuentaActiva(e.target.checked)}
                          style={{ accentColor: '#16a34a' }}
                        />
                        Inicio de sesión habilitado
                      </label>
                    </div>
                  </div>
                </>
              )}
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
              <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)' }}>Seguridad de Administrador</h3>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Cambiar contraseña de acceso</span>
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
                <span style={{ fontSize: 'var(--text-2xs)', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 'var(--fw-bold)' }}>
                  Cuenta Administradora
                </span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)' }}>
                  {user?.email || 'jcarloscc1101@gmail.com'}
                </span>
              </div>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                fontSize: 'var(--text-2xs)',
                fontWeight: 'var(--fw-bold)',
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
                fontSize: 'var(--text-sm)',
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
                fontSize: 'var(--text-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="prog-form-group">
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-secondary)' }}>
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
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-secondary)' }}>
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
