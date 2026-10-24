export default function UnderConstruction({ title, description, icon }) {
  return (
    <div className="under-construction">
      <div className="uc-card">
        <div className="uc-icon-wrapper">
          <div className="uc-icon-bg" />
          <span className="uc-emoji">{icon || '🚧'}</span>
        </div>
        <div className="uc-badge">En desarrollo</div>
        <h2 className="uc-title">{title || 'Módulo en construcción'}</h2>
        <p className="uc-desc">
          {description || 'Este módulo está siendo desarrollado. Pronto estará disponible con todas sus funcionalidades.'}
        </p>
        <div className="uc-progress-bar">
          <div className="uc-progress-fill" />
        </div>
        <div className="uc-features">
          <span className="uc-feature">✦ Diseño en progreso</span>
          <span className="uc-feature">✦ Lógica en construcción</span>
          <span className="uc-feature">✦ Próximamente</span>
        </div>
      </div>
    </div>
  )
}
