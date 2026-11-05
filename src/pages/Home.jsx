import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Users,
  MapPin,
  Download,
  FileBarChart,
  Zap,
  ShieldCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const PORTAL_PAGES = [
  {
    key: 'programacion',
    title: 'Programación de Cuadrillas',
    path: '/programacion',
    icon: Calendar,
    badge: 'Operación Diaria',
    description: 'Cronograma semanal y diario de salidas, asignación de cuadrillas y avance de campo.',
    colorTheme: 'blue'
  },
  {
    key: 'observaciones',
    title: 'Observaciones Técnicas',
    path: '/observaciones',
    icon: FileText,
    badge: 'Auditoría COVEPA',
    description: 'Gestión y dictamen de estados de observaciones, comentarios, justificación de demoras y revisión.',
    colorTheme: 'amber'
  },
  {
    key: 'dashboard',
    title: 'Dashboard General',
    path: '/dashboard',
    icon: LayoutDashboard,
    badge: 'Métricas y KPIs',
    description: 'Monitoreo consolidado de avance, distribución por zonas, gráficos y desempeño de Gilat.',
    colorTheme: 'indigo'
  },
  {
    key: 'sitios',
    title: 'Sitios y Nodos',
    path: '/sitios',
    icon: MapPin,
    badge: '156 Nodos',
    description: 'Catálogo georreferenciado de nodos, estados de avance por sitio y zonas operativas.',
    colorTheme: 'emerald'
  },
  {
    key: 'tecnicos',
    title: 'Personal y Cuadrillas',
    path: '/tecnicos',
    icon: Users,
    badge: 'Directorio',
    description: 'Directorio de personal operativo, cuadrillas conformadas y administración de credenciales.',
    colorTheme: 'cyan'
  },
  {
    key: 'kmz',
    title: 'Centro de Descargas',
    path: '/kmz',
    icon: Download,
    badge: 'Google Earth & Excel',
    description: 'Paquetes KMZ satelitales en vivo por grupos, consolidado general y exportaciones oficiales.',
    colorTheme: 'purple'
  },
  {
    key: 'reportes',
    title: 'Reportes Automáticos',
    path: '/reportes',
    icon: FileBarChart,
    badge: 'Despacho por Correo',
    description: 'Configuración y monitoreo de reportes diarios y semanales despachados por correo electrónico.',
    colorTheme: 'rose'
  },
  {
    key: 'eficiencia',
    title: 'Eficiencia Operativa',
    path: '/eficiencia',
    icon: Zap,
    badge: 'Rendimiento',
    description: 'Análisis de productividad y tiempos de respuesta por cuadrilla y técnico.',
    colorTheme: 'orange'
  }
]

export default function Home() {
  const { user, profile, personalMember, isAdmin, canAccessRoute } = useAuth()

  // Nombre a mostrar preferente
  const displayName = useMemo(() => {
    if (personalMember?.nombre_completo) return personalMember.nombre_completo
    if (personalMember?.nombre) return `${personalMember.nombre} ${personalMember.apellido || ''}`.trim()
    if (profile?.email) {
      const prefix = profile.email.split('@')[0]
      return prefix.charAt(0).toUpperCase() + prefix.slice(1)
    }
    if (user?.email) {
      const prefix = user.email.split('@')[0]
      return prefix.charAt(0).toUpperCase() + prefix.slice(1)
    }
    return 'Colaborador COVEPA'
  }, [personalMember, profile, user])

  // Rol formateado
  const roleName = useMemo(() => {
    if (isAdmin) return 'Administrador General'
    const r = (profile?.rol || '').toLowerCase().trim()
    if (r === 'asistente_calidad') return 'Asistente de Calidad'
    if (r === 'supervisor') return 'Supervisor'
    if (r === 'coordinador') return 'Coordinador'
    if (r === 'invitado') return 'Invitado (Solo Lectura)'
    return 'Técnico de Campo'
  }, [isAdmin, profile])

  // Filtrar páginas permitidas según perfil
  const allowedPages = useMemo(() => {
    return PORTAL_PAGES.filter(p => (canAccessRoute ? canAccessRoute(p.path) : true))
  }, [canAccessRoute])

  return (
    <div className="home-portal-container">
      {/* Banner de Bienvenida sin carga pesada */}
      <section className="home-hero-banner">
        <div className="home-hero-content">
          <div className="home-hero-badge">
            <Sparkles size={14} className="home-hero-badge-icon" />
            <span className="t-badge">Sistema Amazonas · COVEPA</span>
          </div>

          <h1 className="home-hero-title t-title-page">
            ¡Bienvenido(a), <span className="home-hero-name">{displayName}</span>!
          </h1>

          <p className="home-hero-subtitle t-body">
            Selecciona el módulo con el que deseas trabajar hoy. Este portal de acceso rápido evita
            descargas pesadas innecesarias al iniciar tu sesión.
          </p>

          <div className="home-hero-meta">
            <div className="home-role-chip">
              <ShieldCheck size={14} />
              <span className="t-meta">Perfil: <strong>{roleName}</strong></span>
            </div>
            {personalMember?.cargo && (
              <div className="home-cargo-chip">
                <span className="t-meta">Cargo: {personalMember.cargo}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Grid de Módulos Disponibles */}
      <section className="home-modules-section">
        <div className="home-section-header">
          <div>
            <h2 className="t-title-section">Módulos del Sistema</h2>
            <p className="t-meta home-section-sub">
              Tienes acceso a {allowedPages.length} áreas operativas según tus permisos.
            </p>
          </div>
        </div>

        <div className="home-modules-grid">
          {allowedPages.map(page => {
            const IconComponent = page.icon
            return (
              <Link
                key={page.key}
                to={page.path}
                className={`home-module-card theme-${page.colorTheme}`}
              >
                <div className="home-module-header">
                  <div className={`home-module-icon-wrap theme-${page.colorTheme}`}>
                    <IconComponent size={22} />
                  </div>
                  <span className="home-module-badge t-badge">{page.badge}</span>
                </div>

                <div className="home-module-body">
                  <h3 className="home-module-title t-name">{page.title}</h3>
                  <p className="home-module-desc t-body">{page.description}</p>
                </div>

                <div className="home-module-footer">
                  <span className="home-module-cta t-meta">
                    Ingresar <ArrowRight size={14} className="home-module-arrow" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
