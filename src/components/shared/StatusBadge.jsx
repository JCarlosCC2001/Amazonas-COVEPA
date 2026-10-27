import { estadoCovepaBadge } from '../../utils/helpers'

/** Badge de estado COVEPA (Pendiente, En Revisión, Validado, Enviado, Descartado, Rechazado). */
export default function StatusBadge({ estado, fallback = 'Pendiente', className = '' }) {
  return (
    <span className={`estado-badge ${estadoCovepaBadge(estado)} ${className}`.trim()}>
      {estado || fallback}
    </span>
  )
}
