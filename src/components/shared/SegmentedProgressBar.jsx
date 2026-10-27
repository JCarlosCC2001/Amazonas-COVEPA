/** Barra de distribución segmentada por estado (Subsanadas / En Revisión / Descartadas / Rechazadas / Pendientes). */
export default function SegmentedProgressBar({ total = 0, subsanadas = 0, enRevision = 0, descartadas = 0, rechazadas = 0, pendientes = 0 }) {
  const pctSub = total > 0 ? (subsanadas / total) * 100 : 0
  const pctRev = total > 0 ? (enRevision / total) * 100 : 0
  const pctDesc = total > 0 ? (descartadas / total) * 100 : 0
  const pctRech = total > 0 ? (rechazadas / total) * 100 : 0
  const pctPend = Math.max(0, 100 - (pctSub + pctRev + pctDesc + pctRech))

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        height: '14px',
        width: '100%',
        borderRadius: '7px',
        background: 'rgba(0, 48, 96, 0.06)',
        display: 'flex',
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
      }}>
        {pctSub > 0 && (
          <div
            style={{ width: `${pctSub}%`, background: '#10b981', transition: 'width 0.8s ease' }}
            title={`Subsanadas: ${subsanadas} (${pctSub.toFixed(1)}%)`}
          />
        )}
        {pctRev > 0 && (
          <div
            style={{ width: `${pctRev}%`, background: '#38bdf8', transition: 'width 0.8s ease' }}
            title={`En Revisión: ${enRevision} (${pctRev.toFixed(1)}%)`}
          />
        )}
        {pctDesc > 0 && (
          <div
            style={{ width: `${pctDesc}%`, background: '#8b5cf6', transition: 'width 0.8s ease' }}
            title={`Descartadas: ${descartadas} (${pctDesc.toFixed(1)}%)`}
          />
        )}
        {pctRech > 0 && (
          <div
            style={{ width: `${pctRech}%`, background: '#ef4444', transition: 'width 0.8s ease' }}
            title={`Rechazadas: ${rechazadas} (${pctRech.toFixed(1)}%)`}
          />
        )}
        {pctPend > 0 && (
          <div
            style={{ width: `${pctPend}%`, background: '#f59e0b', transition: 'width 0.8s ease' }}
            title={`Pendientes: ${pendientes} (${pctPend.toFixed(1)}%)`}
          />
        )}
      </div>

      {/* Leyenda interactiva */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.6rem',
        marginTop: '0.75rem',
        fontSize: 'var(--text-xs)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Subsanadas:</span>
          <strong style={{ color: '#10b981' }}>{subsanadas.toLocaleString()}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8' }} />
          <span style={{ color: 'var(--text-secondary)' }}>En Revisión:</span>
          <strong style={{ color: '#0284c7' }}>{enRevision.toLocaleString()}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#8b5cf6' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Descartadas:</span>
          <strong style={{ color: '#8b5cf6' }}>{descartadas.toLocaleString()}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Rechazadas:</span>
          <strong style={{ color: '#ef4444' }}>{rechazadas.toLocaleString()}</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Pendientes:</span>
          <strong style={{ color: '#d97706' }}>{pendientes.toLocaleString()}</strong>
        </div>
      </div>
    </div>
  )
}
