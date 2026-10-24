import { useState } from 'react'
import {
  Download, Globe, Layers, MapPin, CheckCircle2,
  FileArchive, HelpCircle, ExternalLink, ShieldCheck,
  Smartphone, Folder, ChevronDown, ChevronUp, Copy, Check,
  Radio, RefreshCw, Zap
} from 'lucide-react'

// Metadata de los 7 archivos KMZ y KML
const KMZ_FILES = [
  {
    id: 'general',
    name: 'Amazonas_COVEPA_GENERAL_Todas_Observaciones',
    title: 'General - Todas las Observaciones',
    badge: 'Completo (156 Sitios)',
    badgeColor: '#6366f1',
    sitiosCount: 156,
    zonas: 'ZONA 2 y ZONA 7 (Todos los Grupos)',
    description: 'Contiene los 156 sitios del proyecto organizados en carpetas por grupo. Incluye la tabla limpia de observaciones con código, detalle, comentario inicial, acuerdo y estado.',
    kmzSize: '240 KB',
    kmlSize: '3.6 MB',
    kmzPath: '/kmz/Amazonas_COVEPA_GENERAL_Todas_Observaciones.kmz',
    kmlPath: '/kmz/Amazonas_COVEPA_GENERAL_Todas_Observaciones.kml',
    isGeneral: true
  },
  {
    id: 'grupo-1',
    name: 'Amazonas_COVEPA_Grupo_1',
    title: 'Grupo 1',
    badge: '29 Sitios',
    badgeColor: '#0ea5e9',
    sitiosCount: 29,
    zonas: 'ZONA 2 y ZONA 7',
    description: 'Sitios del Grupo 1 con tabla de observaciones (código, detalle, comentario inicial, acuerdo y estado).',
    kmzSize: '40 KB',
    kmlSize: '620 KB',
    kmzPath: '/kmz/Amazonas_COVEPA_Grupo_1.kmz',
    kmlPath: '/kmz/Amazonas_COVEPA_Grupo_1.kml'
  },
  {
    id: 'grupo-2',
    name: 'Amazonas_COVEPA_Grupo_2',
    title: 'Grupo 2',
    badge: '29 Sitios',
    badgeColor: '#0ea5e9',
    sitiosCount: 29,
    zonas: 'ZONA 2 y ZONA 7',
    description: 'Sitios del Grupo 2 con tabla de observaciones (código, detalle, comentario inicial, acuerdo y estado).',
    kmzSize: '44 KB',
    kmlSize: '680 KB',
    kmzPath: '/kmz/Amazonas_COVEPA_Grupo_2.kmz',
    kmlPath: '/kmz/Amazonas_COVEPA_Grupo_2.kml'
  },
  {
    id: 'grupo-3',
    name: 'Amazonas_COVEPA_Grupo_3',
    title: 'Grupo 3',
    badge: '22 Sitios',
    badgeColor: '#10b981',
    sitiosCount: 22,
    zonas: 'ZONA 7',
    description: 'Sitios del Grupo 3 con tabla de observaciones (código, detalle, comentario inicial, acuerdo y estado).',
    kmzSize: '41 KB',
    kmlSize: '640 KB',
    kmzPath: '/kmz/Amazonas_COVEPA_Grupo_3.kmz',
    kmlPath: '/kmz/Amazonas_COVEPA_Grupo_3.kml'
  },
  {
    id: 'grupo-4',
    name: 'Amazonas_COVEPA_Grupo_4',
    title: 'Grupo 4',
    badge: '22 Sitios',
    badgeColor: '#10b981',
    sitiosCount: 22,
    zonas: 'ZONA 7',
    description: 'Sitios del Grupo 4 con tabla de observaciones (código, detalle, comentario inicial, acuerdo y estado).',
    kmzSize: '40 KB',
    kmlSize: '620 KB',
    kmzPath: '/kmz/Amazonas_COVEPA_Grupo_4.kmz',
    kmlPath: '/kmz/Amazonas_COVEPA_Grupo_4.kml'
  },
  {
    id: 'grupo-5',
    name: 'Amazonas_COVEPA_Grupo_5',
    title: 'Grupo 5',
    badge: '39 Sitios',
    badgeColor: '#f59e0b',
    sitiosCount: 39,
    zonas: 'ZONA 7',
    description: 'Sitios del Grupo 5 con tabla de observaciones (código, detalle, comentario inicial, acuerdo y estado).',
    kmzSize: '55 KB',
    kmlSize: '890 KB',
    kmzPath: '/kmz/Amazonas_COVEPA_Grupo_5.kmz',
    kmlPath: '/kmz/Amazonas_COVEPA_Grupo_5.kml'
  },
  {
    id: 'grupo-6',
    name: 'Amazonas_COVEPA_Grupo_6',
    title: 'Grupo 6',
    badge: '15 Sitios',
    badgeColor: '#a855f7',
    sitiosCount: 15,
    zonas: 'ZONA 7',
    description: 'Sitios del Grupo 6 con tabla de observaciones (código, detalle, comentario inicial, acuerdo y estado).',
    kmzSize: '26 KB',
    kmlSize: '410 KB',
    kmzPath: '/kmz/Amazonas_COVEPA_Grupo_6.kmz',
    kmlPath: '/kmz/Amazonas_COVEPA_Grupo_6.kml'
  }
]

export default function KMZ() {
  const [downloadingId, setDownloadingId] = useState(null)
  const [showGuide, setShowGuide] = useState(false)
  const [copiedLink, setCopiedLink] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)

  const handleSyncKMZ = async () => {
    setIsSyncing(true)
    setSyncSuccess(false)
    try {
      const res = await fetch('/api/sync-kmz', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSyncSuccess(true)
        setTimeout(() => setSyncSuccess(false), 4000)
      } else {
        alert('Error al sincronizar con la base de datos.')
      }
    } catch (err) {
      console.error(err)
      alert('Error de conexión al sincronizar.')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDownload = (file, format = 'kmz') => {
    const filePath = format === 'kmz' ? file.kmzPath : file.kmlPath
    const fileName = `${file.name}.${format}`
    setDownloadingId(`${file.id}-${format}`)

    const link = document.createElement('a')
    link.href = filePath
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      setDownloadingId(null)
    }, 1500)
  }

  const handleDownloadZipBundle = () => {
    setDownloadingId('zip-bundle')
    const link = document.createElement('a')
    link.href = '/kmz/Amazonas_COVEPA_7_Grupos_KMZ.zip'
    link.download = 'Amazonas_COVEPA_7_Grupos_KMZ.zip'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      setDownloadingId(null)
    }, 1500)
  }

  const handleDownloadLiveNetworkLink = () => {
    setDownloadingId('live-networklink')
    const link = document.createElement('a')
    link.href = '/kmz/Amazonas_COVEPA_EN_VIVO.kml'
    link.download = 'Amazonas_COVEPA_EN_VIVO.kml'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      setDownloadingId(null)
    }, 1500)
  }

  const generalFile = KMZ_FILES[0]
  const groupFiles = KMZ_FILES.slice(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2.5rem' }}>
      
      {/* ── BANNER HERO PRINCIPAL ── */}
      <div style={{
        background: 'linear-gradient(135deg, #003060 0%, #004b8d 100%)',
        border: '1px solid rgba(0, 48, 96, 0.2)',
        borderRadius: '16px',
        padding: '1.8rem 2rem',
        boxShadow: '0 8px 24px rgba(0, 48, 96, 0.18)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2rem',
        color: '#ffffff'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.45rem' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '10px',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Globe size={24} color="#ffffff" />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Descarga de Archivos KMZ y KML
              </h1>
            </div>
            <p style={{ color: '#e0f2fe', fontSize: '0.9rem', margin: 0, maxWidth: '780px', lineHeight: 1.45 }}>
              Mapas satelitales con las <strong>4,116 observaciones georreferenciadas</strong>, coordenadas exactas de los 156 nodos y fichas técnicas completas listas para abrir en <strong>Google Earth (PC y Celular)</strong> o Google Drive.
            </p>
          </div>

          {/* Botón Descargar Paquete Completo ZIP */}
          <button
            type="button"
            onClick={handleDownloadZipBundle}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: '#ffffff',
              color: '#003060',
              border: 'none',
              borderRadius: '10px',
              padding: '0.8rem 1.35rem',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.2s ease'
            }}
          >
            <FileArchive size={18} color="#003060" />
            <span>{downloadingId === 'zip-bundle' ? 'Descargando...' : 'Descargar los 7 KMZ (.ZIP)'}</span>
          </button>
        </div>

        {/* Badges de resumen */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255, 255, 255, 0.15)' }}>
          <span style={{ background: 'rgba(255, 255, 255, 0.12)', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <MapPin size={13} color="#7dd3fc" /> <strong>156</strong> Sitios Georreferenciados
          </span>
          <span style={{ background: 'rgba(255, 255, 255, 0.12)', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <Layers size={13} color="#86efac" /> <strong>6</strong> Grupos Operativos
          </span>
          <span style={{ background: 'rgba(255, 255, 255, 0.12)', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <Smartphone size={13} color="#bae6fd" /> Compatible con Celular (Offline)
          </span>
          <span style={{ background: 'rgba(255, 255, 255, 0.12)', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <ShieldCheck size={13} color="#fde047" /> Fichas y Acuerdos de Subsanación
          </span>
        </div>
      </div>

      {/* ── 0. TARJETA ENLACE EN TIEMPO REAL (NETWORKLINK) ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #bae6fd',
        borderLeft: '5px solid #0284c7',
        borderRadius: '14px',
        padding: '1.4rem 1.8rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.2rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{
              background: '#e0f2fe',
              color: '#0284c7',
              border: '1px solid #bae6fd',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              letterSpacing: '0.4px'
            }}>
              <Radio size={12} /> ENLACE EN VIVO (TIEMPO REAL)
            </span>
            <span style={{
              background: '#dcfce7',
              color: '#166534',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              border: '1px solid #86efac'
            }}>
              ● Auto-recarga cada 60s
            </span>
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#003060', margin: '0 0 0.35rem 0' }}>
            Amazonas COVEPA - Enlace de Red en Vivo (Google Earth PC)
          </h2>
          <p style={{ color: '#334e68', fontSize: '0.85rem', margin: '0 0 0.45rem 0', lineHeight: 1.45, maxWidth: '750px' }}>
            <strong>Ábrelo una sola vez en Google Earth de tu oficina.</strong> Este archivo especial (NetworkLink) se queda permanentemente vinculado y <strong>actualiza automáticamente las 4,116 observaciones cada 60 segundos</strong>. Nunca más tendrás que volver a descargar ni arrastrar archivos a Google Earth.
          </p>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Ideal para: <strong style={{ color: '#003060' }}>Supervisores y Oficina</strong> · Formato: <strong style={{ color: '#0284c7' }}>.KML NetworkLink (2 KB)</strong>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '220px' }}>
          <button
            type="button"
            onClick={handleDownloadLiveNetworkLink}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.3rem',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={17} />
            <span>{downloadingId === 'live-networklink' ? 'Descargando...' : 'Descargar Enlace en Vivo (.KML)'}</span>
          </button>

          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncKMZ}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              background: syncSuccess ? '#dcfce7' : '#f0f6fc',
              color: syncSuccess ? '#166534' : '#003060',
              border: `1px solid ${syncSuccess ? '#86efac' : '#d8e5f1'}`,
              borderRadius: '8px',
              padding: '0.65rem 1.1rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <RefreshCw size={15} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isSyncing ? 'Sincronizando con BD...' : syncSuccess ? '✅ ¡KMZs Actualizados!' : '⚡ Sincronizar KMZs Ahora'}</span>
          </button>
        </div>
      </div>

      {/* ── 1. TARJETA DESTACADA: KMZ GENERAL (TODOS LOS GRUPOS) ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #d8e5f1',
        borderLeft: '5px solid #003060',
        borderRadius: '14px',
        padding: '1.4rem 1.8rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.2rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{
              background: '#003060',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
              letterSpacing: '0.4px'
            }}>
              MAPA COMPLETO
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#003060', margin: 0 }}>
              {generalFile.title}
            </h2>
          </div>
          <p style={{ color: '#334e68', fontSize: '0.85rem', margin: '0 0 0.5rem 0', lineHeight: 1.45 }}>
            {generalFile.description}
          </p>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Zonas: <strong style={{ color: '#003060' }}>{generalFile.zonas}</strong> · Tamaño: <strong style={{ color: '#003060' }}>{generalFile.kmzSize}</strong>
          </div>
        </div>

        {/* Botones de Descarga General */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleDownload(generalFile, 'kmz')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.7rem 1.3rem',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={16} />
            <span>{downloadingId === `${generalFile.id}-kmz` ? 'Descargando...' : 'Descargar KMZ (354 KB)'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownload(generalFile, 'kml')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#f8fbfe',
              color: '#334e68',
              border: '1px solid #d8e5f1',
              borderRadius: '8px',
              padding: '0.7rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Descargar en formato KML plano (sin comprimir)"
          >
            <span>KML</span>
          </button>
        </div>
      </div>

      {/* ── 2. SECCIÓN: ARCHIVOS POR CADA GRUPO (6 GRUPOS) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#003060', margin: 0 }}>
              Archivos KMZ por Grupo Operativo (1 al 6)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Descarga individual por cuadrilla o zona asignada (archivos ultraligeros de 40 a 80 KB para celular)
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem'
        }}>
          {groupFiles.map(gf => (
            <div
              key={gf.id}
              style={{
                background: '#ffffff',
                border: '1px solid #d8e5f1',
                borderRadius: '12px',
                padding: '1.2rem 1.4rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.9rem',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#003060', margin: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Folder size={17} color="#0284c7" />
                    {gf.title}
                  </h4>
                  <span style={{
                    background: '#e0f2fe',
                    border: '1px solid #bae6fd',
                    color: '#0284c7',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '6px'
                  }}>
                    {gf.badge}
                  </span>
                </div>

                <p style={{ color: '#475569', fontSize: '0.82rem', margin: 0, lineHeight: 1.45 }}>
                  {gf.description}
                </p>

                <div style={{ marginTop: '0.6rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Zonas: <strong style={{ color: '#0f2438' }}>{gf.zonas}</strong> · Peso: <strong style={{ color: '#0f2438' }}>{gf.kmzSize}</strong>
                </div>
              </div>

              {/* Botones de Descarga */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #edf4fb' }}>
                <button
                  type="button"
                  onClick={() => handleDownload(gf, 'kmz')}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    background: '#003060',
                    border: '1px solid #003060',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Download size={14} color="#ffffff" />
                  <span>{downloadingId === `${gf.id}-kmz` ? 'Descargando...' : 'Descargar KMZ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(gf, 'kml')}
                  style={{
                    background: '#f8fbfe',
                    border: '1px solid #d8e5f1',
                    color: '#475569',
                    borderRadius: '6px',
                    padding: '0.55rem 0.8rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Descargar versión KML"
                >
                  KML
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. GUÍA INTERACTIVA: CÓMO USAR EN GOOGLE EARTH Y CELULAR ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #d8e5f1',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div
          onClick={() => setShowGuide(prev => !prev)}
          style={{
            padding: '1.1rem 1.4rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fbfe'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <HelpCircle size={18} color="#003060" />
            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#003060' }}>
              Guía de Uso: ¿Cómo abrir estos archivos en Google Earth y en el Celular sin internet?
            </span>
          </div>
          {showGuide ? <ChevronUp size={18} color="#003060" /> : <ChevronDown size={18} color="#003060" />}
        </div>

        {showGuide && (
          <div style={{ padding: '1.4rem 1.6rem', borderTop: '1px solid #edf4fb', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
            
            <div style={{ background: '#f8fbfe', padding: '1.1rem', borderRadius: '8px', border: '1px solid #d8e5f1' }}>
              <h5 style={{ fontSize: '0.86rem', color: '#003060', fontWeight: 800, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                💻 En Computadora (PC / Laptop)
              </h5>
              <ol style={{ fontSize: '0.8rem', color: '#334e68', paddingLeft: '1.2rem', margin: 0, lineHeight: 1.55 }}>
                <li>Descarga el archivo <strong>.KMZ</strong> deseado.</li>
                <li>Haz doble clic sobre el archivo descargado.</li>
                <li>Se abrirá automáticamente en <strong>Google Earth Pro</strong>.</li>
                <li>En el panel lateral izquierdo verás la lista de carpetas por grupo y sitios.</li>
              </ol>
            </div>

            <div style={{ background: '#f8fbfe', padding: '1.1rem', borderRadius: '8px', border: '1px solid #d8e5f1' }}>
              <h5 style={{ fontSize: '0.86rem', color: '#059669', fontWeight: 800, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ☁️ En Celular vía Google Drive
              </h5>
              <ol style={{ fontSize: '0.8rem', color: '#334e68', paddingLeft: '1.2rem', margin: 0, lineHeight: 1.55 }}>
                <li>Sube el archivo KMZ a tu carpeta compartida de Google Drive.</li>
                <li>En el celular, abre la app <strong>Google Earth</strong>.</li>
                <li>Toca en <strong>Proyectos ➔ Abrir ➔ Abrir desde Google Drive</strong>.</li>
                <li>Selecciona el KMZ y se cargarán todos los sitios en 3D.</li>
              </ol>
            </div>

            <div style={{ background: '#f8fbfe', padding: '1.1rem', borderRadius: '8px', border: '1px solid #d8e5f1' }}>
              <h5 style={{ fontSize: '0.86rem', color: '#d97706', fontWeight: 800, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🌲 En Campo Sin Internet (Offline)
              </h5>
              <ol style={{ fontSize: '0.8rem', color: '#334e68', paddingLeft: '1.2rem', margin: 0, lineHeight: 1.55 }}>
                <li>En la app de Google Drive del celular, toca los 3 puntos del archivo y activa <strong>"Permitir acceso sin conexión"</strong>.</li>
                <li>También puedes abrir el KMZ directamente en apps como <strong>Organic Maps</strong> o <strong>Locus Map</strong>.</li>
                <li>El GPS satelital del teléfono te guiará en ruta sin consumir datos.</li>
              </ol>
            </div>

          </div>
        )}
      </div>

    </div>
  )
}
