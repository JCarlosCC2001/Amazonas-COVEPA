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
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '1.6rem 2rem',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <div style={{
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: '10px',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Globe size={24} color="#818cf8" />
              </div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Descarga de Archivos KMZ y KML
              </h1>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0, maxWidth: '780px' }}>
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
              background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              color: '#ffffff',
              border: '1px solid rgba(129, 140, 248, 0.4)',
              borderRadius: '10px',
              padding: '0.75rem 1.25rem',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(79, 70, 229, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <FileArchive size={18} />
            <span>{downloadingId === 'zip-bundle' ? 'Descargando...' : 'Descargar los 7 KMZ (.ZIP)'}</span>
          </button>
        </div>

        {/* Badges de resumen */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MapPin size={12} color="#818cf8" /> <strong>156</strong> Sitios Georreferenciados
          </span>
          <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Layers size={12} color="#34d399" /> <strong>6</strong> Grupos Operativos
          </span>
          <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Smartphone size={12} color="#38bdf8" /> Compatible con Celular (Offline)
          </span>
          <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ShieldCheck size={12} color="#fbbf24" /> Fichas y Acuerdos de Subsanación
          </span>
        </div>
      </div>

      {/* ── 0. TARJETA ENLACE EN TIEMPO REAL (NETWORKLINK) ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(14, 165, 233, 0.35)',
        borderRadius: '14px',
        padding: '1.3rem 1.6rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.2rem',
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <span style={{
              background: '#0ea5e9',
              color: '#ffffff',
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
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              border: '1px solid rgba(52, 211, 153, 0.3)'
            }}>
              ● Auto-recarga cada 60s
            </span>
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.3rem 0' }}>
            Amazonas COVEPA - Enlace de Red en Vivo (Google Earth PC)
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.84rem', margin: '0 0 0.4rem 0', lineHeight: 1.4, maxWidth: '750px' }}>
            <strong>Ábrelo una sola vez en Google Earth de tu oficina.</strong> Este archivo especial (NetworkLink) se queda permanentemente vinculado y <strong>actualiza automáticamente las 4,116 observaciones cada 60 segundos</strong>. Nunca más tendrás que volver a descargar ni arrastrar archivos a Google Earth.
          </p>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
            Ideal para: <strong style={{ color: '#38bdf8' }}>Supervisores y Oficina</strong> · Formato: <strong style={{ color: '#e2e8f0' }}>.KML NetworkLink (2 KB)</strong>
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
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              color: '#ffffff',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '10px',
              padding: '0.75rem 1.3rem',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(14, 165, 233, 0.35)',
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
              background: syncSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              color: syncSuccess ? '#34d399' : '#e2e8f0',
              border: `1px solid ${syncSuccess ? 'rgba(52, 211, 153, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
              borderRadius: '10px',
              padding: '0.65rem 1.1rem',
              fontSize: '0.82rem',
              fontWeight: 600,
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
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(30, 41, 59, 0.7) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: '14px',
        padding: '1.4rem 1.8rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.2rem',
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <span style={{
              background: '#4f46e5',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
              letterSpacing: '0.4px'
            }}>
              MAPA COMPLETO
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
              {generalFile.title}
            </h2>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '0.84rem', margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
            {generalFile.description}
          </p>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Zonas: <strong style={{ color: '#e2e8f0' }}>{generalFile.zonas}</strong> · Tamaño: <strong style={{ color: '#e2e8f0' }}>{generalFile.kmzSize}</strong>
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
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.65rem 1.25rem',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
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
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#94a3b8',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '0.65rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 600,
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
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              Archivos KMZ por Grupo Operativo (1 al 6)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
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
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.1rem 1.3rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.85rem',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Folder size={16} color="#818cf8" />
                    {gf.title}
                  </h4>
                  <span style={{
                    background: `${gf.badgeColor}22`,
                    border: `1px solid ${gf.badgeColor}55`,
                    color: gf.badgeColor,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px'
                  }}>
                    {gf.badge}
                  </span>
                </div>

                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>
                  {gf.description}
                </p>

                <div style={{ marginTop: '0.55rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Zonas: <strong style={{ color: '#cbd5e1' }}>{gf.zonas}</strong> · Peso: <strong style={{ color: '#cbd5e1' }}>{gf.kmzSize}</strong>
                </div>
              </div>

              {/* Botones de Descarga */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <button
                  type="button"
                  onClick={() => handleDownload(gf, 'kmz')}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    background: 'rgba(99, 102, 241, 0.16)',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    color: '#c7d2fe',
                    borderRadius: '6px',
                    padding: '0.5rem 0.8rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Download size={14} color="#818cf8" />
                  <span>{downloadingId === `${gf.id}-kmz` ? 'Descargando...' : 'Descargar KMZ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(gf, 'kml')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.76rem',
                    fontWeight: 600,
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
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div
          onClick={() => setShowGuide(prev => !prev)}
          style={{
            padding: '1rem 1.4rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <HelpCircle size={18} color="#818cf8" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>
              Guía de Uso: ¿Cómo abrir estos archivos en Google Earth y en el Celular sin internet?
            </span>
          </div>
          {showGuide ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
        </div>

        {showGuide && (
          <div style={{ padding: '1.2rem 1.6rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
            
            <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <h5 style={{ fontSize: '0.85rem', color: '#818cf8', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                💻 En Computadora (PC / Laptop)
              </h5>
              <ol style={{ fontSize: '0.78rem', color: '#94a3b8', paddingLeft: '1.2rem', margin: 0, lineHeight: 1.5 }}>
                <li>Descarga el archivo <strong>.KMZ</strong> deseado.</li>
                <li>Haz doble clic sobre el archivo descargado.</li>
                <li>Se abrirá automáticamente en <strong>Google Earth Pro</strong>.</li>
                <li>En el panel lateral izquierdo verás la lista de carpetas por grupo y sitios.</li>
              </ol>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <h5 style={{ fontSize: '0.85rem', color: '#34d399', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                ☁️ En Celular vía Google Drive
              </h5>
              <ol style={{ fontSize: '0.78rem', color: '#94a3b8', paddingLeft: '1.2rem', margin: 0, lineHeight: 1.5 }}>
                <li>Sube el archivo KMZ a tu carpeta compartida de Google Drive.</li>
                <li>En el celular, abre la app <strong>Google Earth</strong>.</li>
                <li>Toca en <strong>Proyectos ➔ Abrir ➔ Abrir desde Google Drive</strong>.</li>
                <li>Selecciona el KMZ y se cargarán todos los sitios en 3D.</li>
              </ol>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <h5 style={{ fontSize: '0.85rem', color: '#f59e0b', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                🌲 En Campo Sin Internet (Offline)
              </h5>
              <ol style={{ fontSize: '0.78rem', color: '#94a3b8', paddingLeft: '1.2rem', margin: 0, lineHeight: 1.5 }}>
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
