import React, { useState, useMemo } from 'react'
import {
  Mail, Clock, Users, Send, Eye, History, Save,
  Plus, X, CheckCircle2, AlertCircle, Sparkles, Power,
  ChevronDown, ChevronUp
} from 'lucide-react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Catálogo de opciones de hora exacta cada 15 minutos (00:00 a 23:45)
const OPCIONES_HORA_EXACTA = []
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    const h24 = String(h).padStart(2, '0')
    const min = String(m).padStart(2, '0')
    const val = `${h24}:${min}:00`
    OPCIONES_HORA_EXACTA.push({
      value: val,
      key: `${h24}:${min}`,
      label: `${h24}:${min} hrs`
    })
  }
}

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
  titulo = 'Configuración de Correo Automático',
  subtitulo = 'Programación y despacho automático del reporte oficial'
}) {
  const [desplegado, setDesplegado] = useState(false)
  const [nuevoPara, setNuevoPara] = useState('')
  const [nuevoCC, setNuevoCC] = useState('')
  const [errorInput, setErrorInput] = useState(null)

  const isActivo = Boolean(config?.activo)

  // Extraer hora y minuto actuales para el selector de hora exacta
  const horaEnvioRaw = config?.hora_envio || '21:00:00'
  const [horaParte = '21', minutoParte = '00'] = horaEnvioRaw.slice(0, 5).split(':')
  const horaActualDisplay = `${horaParte.padStart(2, '0')}:${minutoParte.padStart(2, '0')}`
  const horaActualVal = `${horaActualDisplay}:00`

  const hNum = Number(horaParte)
  const h12Num = isNaN(hNum) ? 12 : (hNum === 0 ? 12 : (hNum > 12 ? hNum - 12 : hNum))
  const ampmDisplay = isNaN(hNum) ? 'PM' : (hNum >= 12 ? 'PM' : 'AM')

  const handleManualTimeChange = (newVal) => {
    if (!newVal) return
    const [h = '21', m = '00'] = newVal.split(':')
    const formatted = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`
    onChangeConfig({
      ...config,
      hora_envio: formatted
    })
  }

  // Asegurar que si la hora configurada no coincide exactamente con un intervalo de 15m, aparezca en la lista
  const opcionesHoras = useMemo(() => {
    const existe = OPCIONES_HORA_EXACTA.some(opt => opt.key === horaActualDisplay)
    if (!existe) {
      return [
        {
          value: horaActualVal,
          key: horaActualDisplay,
          label: `${horaActualDisplay} hrs (${h12Num}:${minutoParte} ${ampmDisplay})`
        },
        ...OPCIONES_HORA_EXACTA
      ].sort((a, b) => a.key.localeCompare(b.key))
    }
    return OPCIONES_HORA_EXACTA
  }, [horaActualDisplay, horaActualVal, h12Num, minutoParte, ampmDisplay])

  const handleToggleActivo = () => {
    onChangeConfig({
      ...config,
      activo: !isActivo
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
  // CASO 1: VISTA COMPRIMIDA POR DEFECTO (ACORDEÓN PLEGADO)
  // ============================================================
  if (!desplegado) {
    return (
      <div
        style={{
          background: isActivo ? '#ffffff' : '#f8fafc',
          border: isActivo ? '1px solid #bfdbfe' : '1.5px dashed #cbd5e1',
          borderRadius: '12px',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: isActivo ? 'var(--shadow-sm)' : 'none',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onClick={() => setDesplegado(true)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '260px', flex: '1 1 320px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: isActivo ? '#e0f2fe' : '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isActivo ? '#003060' : '#64748b',
              flexShrink: 0
            }}
          >
            <Mail size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h4 className="t-name" style={{ margin: 0, color: '#003060' }}>
                {titulo}
              </h4>
              <span
                className="t-badge"
                style={{
                  background: isActivo ? '#f0fdf4' : '#f1f5f9',
                  border: `1px solid ${isActivo ? '#86efac' : '#cbd5e1'}`,
                  color: isActivo ? '#15803d' : '#64748b',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isActivo ? '#22c55e' : '#94a3b8'
                  }}
                />
                <span>{isActivo ? `PROGRAMADO: ${horaActualDisplay} hrs` : 'ENVÍO DESACTIVADO'}</span>
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
          {isActivo && (
            <>
              {onOpenPreview && (
                <button
                  type="button"
                  onClick={onOpenPreview}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '0.35rem 0.65rem'
                  }}
                  title="Vista Previa del Correo"
                  aria-label="Vista Previa"
                >
                  <Eye size={14} />
                  <span>Vista Previa</span>
                </button>
              )}

              {onSendTest && (
                <button
                  type="button"
                  onClick={onSendTest}
                  disabled={sendingTest}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '0.35rem 0.65rem'
                  }}
                  title="Enviar Correo de Prueba"
                  aria-label="Enviar Prueba"
                >
                  <Send size={14} />
                  <span>{sendingTest ? 'Enviando...' : 'Enviar Prueba'}</span>
                </button>
              )}

              {onOpenHistorial && (
                <button
                  type="button"
                  onClick={onOpenHistorial}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '0.35rem 0.65rem'
                  }}
                  title="Historial de Envíos"
                  aria-label="Historial"
                >
                  <History size={14} />
                  <span>Historial</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setDesplegado(true)}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              padding: 0,
              borderRadius: '8px',
              backgroundColor: '#003060'
            }}
            title="Desplegar Configuración"
            aria-label="Desplegar Configuración"
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>
    )
  }

  // ============================================================
  // CASO 2: VISTA DESPLEGADA AL PRESIONAR (FORMULARIO COMPLETO)
  // ============================================================

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
      {/* Cabecera de la tarjeta con Botón Comprimir */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid #edf4fb', paddingBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mail size={18} color="#003060" />
          <h4 className="t-name" style={{ margin: 0, color: '#003060' }}>
            {titulo}
          </h4>
          <span
            className="t-badge"
            style={{
              background: isActivo ? '#f0fdf4' : '#f1f5f9',
              border: `1px solid ${isActivo ? '#86efac' : '#cbd5e1'}`,
              color: isActivo ? '#15803d' : '#64748b',
              padding: '2px 8px',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isActivo ? '#22c55e' : '#94a3b8' }} />
            <span>{isActivo ? 'ENVÍO PROGRAMADO ACTIVO' : 'ENVÍO DESACTIVADO'}</span>
          </span>
        </div>

        {/* Acciones de Cabecera: Botones de Envío / Prueba / Historial (cuando activo) + Botón Comprimir */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {isActivo && (
            <>
              {onOpenPreview && (
                <button
                  type="button"
                  onClick={onOpenPreview}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '0.35rem 0.65rem'
                  }}
                  title="Vista Previa del Correo"
                  aria-label="Vista Previa"
                >
                  <Eye size={14} />
                  <span>Vista Previa</span>
                </button>
              )}

              {onSendTest && (
                <button
                  type="button"
                  onClick={onSendTest}
                  disabled={sendingTest}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '0.35rem 0.65rem'
                  }}
                  title="Enviar Correo de Prueba"
                  aria-label="Enviar Prueba"
                >
                  <Send size={14} />
                  <span>{sendingTest ? 'Enviando...' : 'Enviar Prueba'}</span>
                </button>
              )}

              {onOpenHistorial && (
                <button
                  type="button"
                  onClick={onOpenHistorial}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '0.35rem 0.65rem'
                  }}
                  title="Historial de Envíos"
                  aria-label="Historial"
                >
                  <History size={14} />
                  <span>Historial</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setDesplegado(false)}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              padding: 0,
              borderRadius: '8px'
            }}
            title="Comprimir panel de configuración"
            aria-label="Comprimir"
          >
            <ChevronUp size={18} />
          </button>
        </div>
      </div>

      {/* 1. ACTIVAR O DESACTIVAR CORREO AUTOMÁTICO (PRIMER BLOQUE DESTACADO) */}
      <div
        style={{
          background: isActivo ? '#f0fdf4' : '#f8fafc',
          border: `1.5px solid ${isActivo ? '#86efac' : '#cbd5e1'}`,
          borderRadius: '10px',
          padding: '0.85rem 1.15rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: isActivo ? '#dcfce7' : '#e2e8f0',
              color: isActivo ? '#16a34a' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Power size={18} />
          </div>
          <div>
            <div className="t-name" style={{ color: isActivo ? '#166534' : '#334155', margin: 0 }}>
              {isActivo ? 'Envío Automático Activado' : 'Envío Automático Desactivado'}
            </div>
            <span className="t-meta" style={{ color: isActivo ? '#15803d' : '#64748b' }}>
              {isActivo
                ? `El reporte se enviará de forma automática a las ${horaActualDisplay} hrs.`
                : 'El envío automático está pausado. No se despacharán correos.'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleActivo}
          className="t-badge"
          style={{
            padding: '0.45rem 1.15rem',
            borderRadius: '20px',
            border: `1.5px solid ${isActivo ? '#16a34a' : '#94a3b8'}`,
            background: isActivo ? '#16a34a' : '#ffffff',
            color: isActivo ? '#ffffff' : '#475569',
            fontWeight: 'var(--fw-bold)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: isActivo ? '0 2px 6px rgba(22, 163, 74, 0.25)' : 'none',
            transition: 'all 0.18s ease'
          }}
          title={isActivo ? 'Hacer clic para pausar el envío automático' : 'Hacer clic para activar el envío automático'}
        >
          <Power size={14} />
          <span>{isActivo ? 'DESACTIVAR ENVÍO' : 'ACTIVAR ENVÍO'}</span>
        </button>
      </div>

      {/* 2. CONFIGURACIÓN DE HORA DE DESPACHO (MANUAL + LISTA DESPLEGABLE + ATAJOS) */}
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
            <Clock size={15} color="#003060" /> Hora de Despacho del Reporte (Hora Perú UTC-5):
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
            Hora fijada: {horaActualDisplay} hrs ({h12Num}:{minutoParte} {ampmDisplay})
          </div>
        </div>

        {/* Fila con Ingreso Manual y Selector de Lista */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: '0.75rem', alignItems: 'flex-end' }}>
          {/* Ingreso Manual de Hora */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span className="t-meta" style={{ color: '#003060', fontWeight: 'var(--fw-semibold)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ✍️ Ingresar Hora Manualmente:
            </span>
            <input
              type="time"
              value={horaActualDisplay}
              onChange={e => handleManualTimeChange(e.target.value)}
              className="t-body"
              style={{
                padding: '0.55rem 0.85rem',
                border: '1.5px solid #0284c7',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#003060',
                fontWeight: 'var(--fw-bold)',
                fontVariantNumeric: 'tabular-nums',
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 0 2px rgba(2, 132, 199, 0.08)'
              }}
              title="Escribe o selecciona manualmente la hora y minutos deseados"
            />
          </div>

          {/* Selector de Lista de Opciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span className="t-meta" style={{ color: '#64748b' }}>
              O seleccionar de la lista:
            </span>
            <select
              value={horaActualVal}
              onChange={e => onChangeConfig({ ...config, hora_envio: e.target.value })}
              className="t-body"
              style={{
                padding: '0.55rem 0.85rem',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 'var(--fw-medium)',
                outline: 'none',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              {opcionesHoras.map(opt => (
                <option key={opt.key} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Atajos de acceso rápido */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
          <span className="t-meta" style={{ color: '#64748b' }}>Atajos frecuentes:</span>
          {[
            { label: '1:00 PM', value: '13:00:00' },
            { label: '7:00 PM', value: '19:00:00' },
            { label: '9:00 PM', value: '21:00:00' },
            { label: '9:30 PM', value: '21:30:00' },
            { label: '10:00 PM', value: '22:00:00' }
          ].map(h => {
            const isSelected = (config.hora_envio || '').startsWith(h.value.slice(0, 5))
            return (
              <button
                key={h.value}
                type="button"
                onClick={() => onChangeConfig({ ...config, hora_envio: h.value })}
                className="t-badge"
                style={{
                  padding: '0.25rem 0.6rem',
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderTop: '1px solid #edf4fb', paddingTop: '0.85rem' }}>
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
