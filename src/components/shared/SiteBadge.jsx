/**
 * Código de sitio acompañado SIEMPRE de su localidad (regla inmutable):
 *   AM-0038-A01 · PEDRO RUIZ GALLO
 */
export default function SiteBadge({ codigo, localidad, className = '' }) {
  return (
    <span className={`site-badge ${className}`.trim()}>
      <span className="site-badge-code t-code">{codigo}</span>
      {localidad ? <span className="site-badge-loc"> · {localidad}</span> : null}
    </span>
  )
}
