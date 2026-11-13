import React, { useState } from 'react'
import {
  Mail, Clock, Users, Send, Eye, History, Save,
  Plus, X, CheckCircle2, AlertCircle, Sparkles, Power,
  ChevronDown, ChevronUp
} from 'lucide-react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Catálogo de las 24 horas del día con formato militar y 12 horas AM/PM
const OPCIONES_24_HORAS = Array.from({ length: 24 }, (_, i) => {
  const h24 = String(i).padStart(2, '0')
  const h12Num = i === 0 ? 12 : (i > 12 ? i - 12 : i)
  const ampm = i >= 12 ? 'PM' : 'AM'
  const periodo = i < 6 ? 'Madrugada' : (i < 12 ? 'Mañana' : (i < 19 ? 'Tarde' : 'Noche'))
  return {
    value: h24,
    label: `${h24}:00 hrs · (${h12Num}:00 ${ampm}) - ${periodo}`
  }
})

const OPCIONES_MINUTOS = [
  { value: '00', label: ':00 en punto' },
  { value: '15', label: ':15 minutos' },
  { value: '30', label: ':30 y media' },
  { value: '45', label: ':45 minutos' }
]

const HORARIOS_RAPIDOS = [
  { label: '1:00 PM', value: '13:00:00' },
  { label: '7:00 PM', value: '19:00:00' },
  { label: '9:00 PM', value: '21:00:00' },
  { label: '9:30 PM', value: '21:30:00' },
  { label: '10:00 PM', value: '22:00:00' }
]

export default function CardAutomatizacionCorreo({
  config,
  onChangeConfig,
  onSave,
  saving = false,
  onOpenPreview,
  onSendTest,
  sendingTest = false,
  onOpenHistorial,
  onOpenPersonalSelector,
  titulo = 'Programación de Envío Automático por Correo',
  subtitulo = 'Configura el despacho automático del reporte oficial'
}) {
  const [nuevoPara, setNuevoPara] = useState('')
  const [nuevoCC, setNuevoCC] = useState('')
  const [errorInput, setErrorInput] = useState(null)

  const isActivo = Boolean(config?.activo)

  // Extraer hora y minuto actuales para los selectores de 24 horas
  const horaEnvioRaw = config?.hora_envio || '21:00:00'
  const [horaParte = '21', minutoParte = '00'] = horaEnvioRaw.slice(0, 5).split(':')
  const horaActualDisplay = `${horaParte}:${minutoParte}`

  const handleToggleActivo = () => {
    onChangeConfig({
      ...config,
      activo: !isActivo
    })
  }

  const handleSelectHora24 = (h) => {
    const nuevoHorario = `${h}:${minutoParte}:00`
    onChangeConfig({
      ...config,
      hora_envio: nuevoHorario
    })
  }

  const handleSelectMinuto = (m) => {
    const nuevoHorario = `${horaParte}:${m}:00`
    onChangeConfig({
      ...config,
      hora_envio: nuevoHorario
    })
  }

  const handleSelectRapido = (val) => {
    onChangeConfig({
      ...config,
      hora_envio: val
    })
  }

  const handleAddPara = () => {
    const email = nuevoPara.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_REGEX.test(email)) {
      setErrorInput('El formato del correo ingresado no es válido')
      return
    }
    setErrorInput(null)
    const current = config.destinatarios || []
    if (current.includes(email)) {
      setNuevoPara('')
      return
    }
    // Si estaba en CC, retirarlo de CC (exclusividad mutua)
    const currentCC = (config.destinatarios_cc || []).filter(e => e !== email)
    onChangeConfig({
      ...config,
      destinatarios: [...current, email],
      destinatarios_cc: currentCC
    })
    setNuevoPara('')
  }

  const handleRemovePara = (email) => {
    const current = (config.destinatarios || []).filter(e => e !== email)
    onChangeConfig({ ...config, destinatarios: current })
  }

  const handleAddCC = () => {
    const email = nuevoCC.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_REGEX.test(email)) {
      setErrorInput('El formato del correo ingresado no es válido')
      return
    }
    setErrorInput(null)
    const currentCC = config.destinatarios_cc || []
    if (currentCC.includes(email)) {
      setNuevoCC('')
      return
    }
    // Si estaba en Para, retirarlo de Para (exclusividad mutua)
    const currentPara = (config.destinatarios || []).filter(e => e !== email)
    onChangeConfig({
      ...config,
      destinatarios_cc: [...currentCC, email],
      destinatarios: currentPara
    })
    setNuevoCC('')
  }

  const handleRemoveCC = (email) => {
    const currentCC = (config.destinatarios_cc || []).filter(e => e !== email)
    onChangeConfig({ ...config, destinatarios_cc: currentCC })
  }

  // ============================================================
  // CASO 1: VISTA PLEGADA / COLAPSADA CUANDO ESTÁ DESACTIVADO
  // ============================================================
  if (!isActivo) {
    return (
      <div
        style={{
          background: '#f8fafc',
          border: '1.5px dashed #cbd5e1',
          borderRadius: '12px',
          padding: '1.1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '260px', flex: '1 1 300px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              flexShrink: 0
            }}
          >
            <Mail size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h4 className="t-name" style={{ margin: 0, color: '#334155' }}>
                {titulo}
              </h4>
              <span
                className="t-badge"
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#64748b',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
                <span>ENVÍO DESACTIVADO</span>
              </span>
            </div>
            <p className="t-meta" style={{ margin: '0.2rem 0 0 0', color: '#64748b' }}>
              El despacho automático está apagado para este informe. Actívalo para desplegar y configurar horario y destinatarios.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onOpenHistorial && (
            <button
              type="button"
              onClick={onOpenHistorial}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.85rem' }}
              title="Consultar envíos previos"
            >
              <History size={14} />
              <span>Historial</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleActivo}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 1rem',
              backgroundColor: '#003060'
            }}
          >
            <Power size={14} />
            <span>Activar Envío por Correo</span>
          </button>
        </div>
      </div>
    )
  }

  // ============================================================
  // CASO 2: VISTA DESPLEGADA COMPLETA CUANDO ESTÁ ACTIVADO
  // ============================================================
  const hora12Num = Number(horaParte) === 0 ? 12 : (Number(horaParte) > 12 ? Number(horaParte) - 12 : Number(horaParte))
  const ampmDisplay = Number(horaParte) >= 12 ? 'PM' : 'AM'

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #bfdbfe',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: '0 4px 6px -1px rgba(0, 48, 96, 0.06), 0 2px 4px -2px rgba(0, 48, 96, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Cabecera de la tarjeta con Switch de desactivación */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid #edf4fb', paddingBottom: '0.85rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={18} color="#003060" />
            <h4 className="t-name" style={{ margin: 0, color: '#003060' }}>
              {titulo}
            </h4>
            <span
              className="t-badge"
              style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                color: '#15803d',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
              <span>ENVÍO PROGRAMADO ACTIVO</span>
            </span>
          </div>
          <p className="t-meta" style={{ margin: '0.2rem 0 0 0', color: '#64748b' }}>
            {subtitulo}
          </p>
        </div>

        {/* Botón para Desactivar / Pausar */}
        <button
          type="button"
          onClick={handleToggleActivo}
          className="t-badge"
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: '20px',
            border: '1.5px solid #cbd5e1',
            background: '#ffffff',
            color: '#64748b',
            fontWeight: 'var(--fw-semibold)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
          title="Hacer clic para pausar el envío automático"
        >
          <Power size={13} color="#dc2626" />
          <span>Pausar Envío</span>
        </button>
      </div>

      {/* SELECTOR DE HORA DEL DÍA (LAS 24 HORAS COMPLETAS + MINUTOS) */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '0.9rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label className="t-badge" style={{ color: '#003060', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'var(--fw-bold)' }}>
            <Clock size={15} color="#003060" /> Hora de Despacho del Reporte (Las 24 Horas del Día · Hora Perú UTC-5):
          </label>
          <div
            className="t-badge"
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              padding: '0.25rem 0.65rem',
              borderRadius: '6px',
              fontWeight: 'var(--fw-bold)'
            }}
          >
            Hora fijada: {horaActualDisplay} hrs ({hora12Num}:{minutoParte} {ampmDisplay})
          </div>
        </div>

        {/* Fila con los 2 selectores principales: Hora (24h) y Minutos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(140px, 180px) auto', gap: '0.75rem', alignItems: 'center' }}>
          {/* Selector de las 24 horas del día */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="t-meta" style={{ color: '#475569', fontWeight: 'var(--fw-semibold)' }}>
              1. Seleccionar Hora del Día (00:00 a 23:00):
            </span>
            <select
              value={horaParte}
              onChange={e => handleSelectHora24(e.target.value)}
              className="t-body"
              style={{
                padding: '0.5rem 0.75rem',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#003060',
                fontWeight: 'var(--fw-semibold)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {OPCIONES_24_HORAS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Minutos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="t-meta" style={{ color: '#475569', fontWeight: 'var(--fw-semibold)' }}>
              2. Minutos:
            </span>
            <select
              value={minutoParte}
              onChange={e => handleSelectMinuto(e.target.value)}
              className="t-body"
              style={{
                padding: '0.5rem 0.75rem',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#003060',
                fontWeight: 'var(--fw-semibold)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {OPCIONES_MINUTOS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Input Time libre alternativo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="t-meta" style={{ color: '#64748b' }}>
              O escribir exacta:
            </span>
            <input
              type="time"
              value={horaActualDisplay}
              onChange={e => onChangeConfig({ ...config, hora_envio: `${e.target.value}:00` })}
              className="t-body"
              style={{
                padding: '0.45rem 0.65rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                color: '#003060',
                fontWeight: 'var(--fw-semibold)',
                background: '#ffffff'
              }}
            />
          </div>
        </div>

        {/* Atajos de acceso rápido a horas frecuentes */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
          <span className="t-meta" style={{ color: '#64748b' }}>Atajos frecuentes:</span>
          {HORARIOS_RAPIDOS.map(h => {
            const isSelected = (config.hora_envio || '').startsWith(h.value.slice(0, 5))
            return (
              <button
                key={h.value}
                type="button"
                onClick={() => handleSelectRapido(h.value)}
                className="t-badge"
                style={{
                  padding: '0.25rem 0.55rem',
                  borderRadius: '6px',
                  border: isSelected ? '1.5px solid #003060' : '1px solid #cbd5e1',
                  background: isSelected ? '#003060' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  fontWeight: isSelected ? 'var(--fw-bold)' : 'var(--fw-normal)',
                  transition: 'all 0.15s ease'
                }}
              >
                {h.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Asunto del Correo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label className="t-badge" style={{ color: '#003060', fontWeight: 'var(--fw-semibold)' }}>
          Asunto del Correo (soporta etiqueta {'{fecha}'}):
        </label>
        <input
          type="text"
          value={config.asunto || ''}
          onChange={e => onChangeConfig({ ...config, asunto: e.target.value })}
          className="t-body"
          placeholder="Ej: Reporte Diario de Levantamiento de Observaciones - {fecha}"
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            outline: 'none',
            color: '#0f172a'
          }}
        />
      </div>

      {/* Recuadro de Destinatarios (Para y CC) */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
          <span className="t-badge" style={{ color: '#003060', fontWeight: 'var(--fw-bold)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Users size={14} /> Gestión de Destinatarios
          </span>
          {onOpenPersonalSelector && (
            <button
              type="button"
              onClick={onOpenPersonalSelector}
              className="t-badge"
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>👥</span> Seleccionar desde Personal
            </button>
          )}
        </div>

        {errorInput && (
          <div style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }} className="t-meta">
            <AlertCircle size={13} /> {errorInput}
          </div>
        )}

        {/* Fila PARA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="t-badge" style={{ color: '#0369a1', fontWeight: 'var(--fw-semibold)' }}>Para: (Destinatarios Principales)</span>
            <span className="t-meta" style={{ color: '#64748b' }}>{(config.destinatarios || []).length} asignado(s)</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', minHeight: '34px', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.4rem' }}>
            {(config.destinatarios || []).map(email => (
              <span
                key={email}
                className="t-badge"
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePara(email)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1d4ed8', padding: 0, display: 'flex' }}
                  title="Eliminar destinatario"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: '180px' }}>
              <input
                type="email"
                placeholder="Añadir correo y presionar Enter..."
                value={nuevoPara}
                onChange={e => setNuevoPara(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPara() } }}
                className="t-meta"
                style={{ border: 'none', outline: 'none', width: '100%', padding: '0.2rem' }}
              />
              <button
                type="button"
                onClick={handleAddPara}
                className="t-badge"
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', color: '#475569' }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Fila CC */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="t-badge" style={{ color: '#475569', fontWeight: 'var(--fw-semibold)' }}>CC: (Con Copia)</span>
            <span className="t-meta" style={{ color: '#64748b' }}>{(config.destinatarios_cc || []).length} asignado(s)</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', minHeight: '34px', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.4rem' }}>
            {(config.destinatarios_cc || []).map(email => (
              <span
                key={email}
                className="t-badge"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCC(email)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0, display: 'flex' }}
                  title="Eliminar copia"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: '180px' }}>
              <input
                type="email"
                placeholder="Añadir CC y presionar Enter..."
                value={nuevoCC}
                onChange={e => setNuevoCC(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCC() } }}
                className="t-meta"
                style={{ border: 'none', outline: 'none', width: '100%', padding: '0.2rem' }}
              />
              <button
                type="button"
                onClick={handleAddCC}
                className="t-badge"
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', color: '#475569' }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notas operativas de la jornada */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label className="t-badge" style={{ color: '#003060', fontWeight: 'var(--fw-semibold)' }}>
          Notas Operativas de la Jornada (Opcional, se adjuntan en el correo):
        </label>
        <textarea
          rows={2}
          value={config.notas_jornada || ''}
          onChange={e => onChangeConfig({ ...config, notas_jornada: e.target.value })}
          placeholder="Escribe comentarios, incidencias o acuerdos de la jornada..."
          className="t-body"
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            outline: 'none',
            color: '#334155',
            resize: 'vertical',
            lineHeight: '1.4'
          }}
        />
      </div>

      {/* Botonera de Acciones Integradas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', borderTop: '1px solid #edf4fb', paddingTop: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onOpenPreview && (
            <button
              type="button"
              onClick={onOpenPreview}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.85rem' }}
            >
              <Eye size={14} />
              <span>Vista Previa Correo</span>
            </button>
          )}

          {onSendTest && (
            <button
              type="button"
              onClick={onSendTest}
              disabled={sendingTest}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.85rem' }}
            >
              <Send size={14} />
              <span>{sendingTest ? 'Despachando...' : 'Enviar Prueba'}</span>
            </button>
          )}

          {onOpenHistorial && (
            <button
              type="button"
              onClick={onOpenHistorial}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.85rem' }}
            >
              <History size={14} />
              <span>Historial de Envíos</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.45rem 1.1rem' }}
        >
          <Save size={15} />
          <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
        </button>
      </div>
    </div>
  )
}
