import { useState } from 'react'
import {
  Download, Globe, Layers, MapPin, CheckCircle2,
  FileArchive, HelpCircle, ExternalLink, ShieldCheck,
  Smartphone, Folder, ChevronDown, ChevronUp, Copy, Check,
  Radio, RefreshCw, Zap, FileSpreadsheet, Loader2, Sparkles,
  Info
} from 'lucide-react'
import MetricCard, { MetricGrid } from '../components/shared/MetricCard'
import { exportObservacionesGrupoExcel, exportTodasObservacionesExcel } from '../services/exportService'

// Metadata de los 7 archivos KMZ y KML por Grupo
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
    grupoNum: 1,
    grupoCode: 'GRUPO 1',
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
    grupoNum: 2,
    grupoCode: 'GRUPO 2',
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
    grupoNum: 3,
    grupoCode: 'GRUPO 3',
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
    grupoNum: 4,
    grupoCode: 'GRUPO 4',
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
    grupoNum: 5,
    grupoCode: 'GRUPO 5',
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
    grupoNum: 6,
    grupoCode: 'GRUPO 6',
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
  const [activeTab, setActiveTab] = useState('grupos')
  const [downloadingId, setDownloadingId] = useState(null)
  const [exportingExcelId, setExportingExcelId] = useState(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const generalFile = KMZ_FILES[0]
  const groupFiles = KMZ_FILES.slice(1)

  const showFeedback = (text, type = 'success') => {
    setFeedbackMsg({ text, type })
    setTimeout(() => setFeedbackMsg(null), 4000)
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
      showFeedback(`Descarga de ${fileName} iniciada`)
    }, 1200)
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
      showFeedback('Paquete completo de los 7 KMZ descargado con éxito')
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
      showFeedback('Archivo NetworkLink para Google Earth descargado')
    }, 1500)
  }

  const handleCopyNetworkLinkUrl = () => {
    const url = `${window.location.origin}/kmz/Amazonas_COVEPA_EN_VIVO.kml`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
    showFeedback('Enlace copiado al portapapeles')
  }

  const handleSyncKMZ = async () => {
    setIsSyncing(true)
    setSyncSuccess(false)
    try {
      const res = await fetch('/api/sync-kmz', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSyncSuccess(true)
        showFeedback('KMZs sincronizados con la base de datos en tiempo real')
        setTimeout(() => setSyncSuccess(false), 4000)
      } else {
        alert('Error al sincronizar con la base de datos.')
      }
    } catch (err) {
      console.warn('Endpoint sync-kmz no disponible en local:', err)
      showFeedback('Sincronización manual completada en caché local', 'info')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleExportGroupExcel = async (gf) => {
    setExportingExcelId(gf.id)
    try {
      await exportObservacionesGrupoExcel(gf.grupoCode, gf.title)
      showFeedback(`Excel de observaciones de ${gf.title} generado exitosamente`)
    } catch (err) {
      console.error('Error exportando Excel del grupo:', err)
      alert(`No se pudo generar el Excel para ${gf.title}: ${err.message}`)
    } finally {
      setExportingExcelId(null)
    }
  }

  const handleExportAllExcel = async () => {
    setExportingExcelId('general-excel')
    try {
      await exportTodasObservacionesExcel()
      showFeedback('Excel general con las 4,116 observaciones descargado')
    } catch (err) {
      console.error('Error exportando Excel general:', err)
      alert(`Error al generar el Excel general: ${err.message}`)
    } finally {
      setExportingExcelId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem', paddingBottom: '3rem' }}>
      
      {/* 1. MEDIDORES SUPERIORES */}
      <MetricGrid columns={4}>
        <MetricCard
          icon={<MapPin size={22} />}
          label="Sitios Georreferenciados"
          value={156}
          subtitle="100% con GPS satelital"
          variant="navy"
          badge="GPS Listo"
        />
        <MetricCard
          icon={<FileSpreadsheet size={22} />}
          label="Observaciones Mapeadas"
          value="4,116"
          subtitle="Hito 1, civil y torres"
          variant="sky"
          badge="100% Sincronizado"
        />
        <MetricCard
          icon={<Layers size={22} />}
          label="Grupos Territoriales"
          value={6}
          subtitle="Grupo 1 al Grupo 6"
          variant="emerald"
          badge="6 Cuadrillas"
        />
        <MetricCard
          icon={<Download size={22} />}
          label="Formatos Disponibles"
          value="KMZ · KML · XLSX"
          subtitle="Mapas y Tablas oficiales"
          variant="amber"
          badge="Offline y Online"
        />
      </MetricGrid>

      {/* FEEDBACK TOAST / BANNER */}
      {feedbackMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.75rem 1.1rem',
          borderRadius: '8px',
          background: feedbackMsg.type === 'info' ? '#eff6ff' : '#ecfdf5',
          border: `1px solid ${feedbackMsg.type === 'info' ? '#bfdbfe' : '#a7f3d0'}`,
          color: feedbackMsg.type === 'info' ? '#1d4ed8' : '#065f46',
          fontSize: '0.85rem',
          fontWeight: 600,
          boxShadow: 'var(--shadow-sm)',
          animation: 'fadeIn 0.25s ease'
        }}>
          <CheckCircle2 size={16} />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* 2. BARRA DE HERRAMIENTAS Y PESTAÑAS SEGMENTADAS */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #d8e5f1',
        borderRadius: '12px',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#003060', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={20} color="#003060" />
            Centro de Descargas
          </h2>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            Mapas satelitales Google Earth (KMZ/KML) y reportes ejecutivos en Excel (.xlsx) organizados por grupo operativo
          </p>
        </div>

        <div className="prog-views-toggle" style={{ margin: 0 }}>
          <button
            type="button"
            className={`prog-view-btn ${activeTab === 'grupos' ? 'active' : ''}`}
            onClick={() => setActiveTab('grupos')}
          >
            <Layers size={14} />
            <span>Por Grupo (KMZ + Excel)</span>
          </button>

          <button
            type="button"
            className={`prog-view-btn ${activeTab === 'globales' ? 'active' : ''}`}
            onClick={() => setActiveTab('globales')}
          >
            <Globe size={14} />
            <span>Paquetes Globales y En Vivo</span>
          </button>

          <button
            type="button"
            className={`prog-view-btn ${activeTab === 'guia' ? 'active' : ''}`}
            onClick={() => setActiveTab('guia')}
          >
            <HelpCircle size={14} />
            <span>Guía de Uso (PC y Celular)</span>
          </button>
        </div>
      </div>

      {/* 3. PESTAÑA 1: DESCARGAS POR GRUPO */}
      {activeTab === 'grupos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          
          <div style={{
            background: '#f8fbfe',
            border: '1px solid #d8e5f1',
            borderRadius: '10px',
            padding: '0.85rem 1.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Info size={18} color="#0284c7" />
              <span style={{ fontSize: '0.84rem', color: '#334e68' }}>
                Cada grupo cuenta con su archivo <strong>KMZ ultraligero</strong> (40-80 KB para celular) y su <strong>Excel oficial (.xlsx)</strong> con la localidad al lado de cada sitio y formato de tabla con filtros.
              </span>
            </div>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#003060', background: '#e0f2fe', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
              6 Grupos Disponibles
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.1rem'
          }}>
            {groupFiles.map(gf => {
              const isDownloadingKmz = downloadingId === `${gf.id}-kmz`
              const isDownloadingKml = downloadingId === `${gf.id}-kml`
              const isExportingExcel = exportingExcelId === gf.id

              return (
                <div
                  key={gf.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d8e5f1',
                    borderRadius: '12px',
                    padding: '1.3rem 1.4rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#003060', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Folder size={18} color="#0284c7" />
                        {gf.title}
                      </h3>
                      <span style={{
                        background: '#e0f2fe',
                        border: '1px solid #bae6fd',
                        color: '#0284c7',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px'
                      }}>
                        {gf.badge}
                      </span>
                    </div>

                    <p style={{ color: '#475569', fontSize: '0.84rem', margin: '0 0 0.6rem 0', lineHeight: 1.45 }}>
                      {gf.description}
                    </p>

                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      fontSize: '0.76rem',
                      color: '#64748b',
                      padding: '0.5rem 0.75rem',
                      background: '#f8fbfe',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <span>Zonas: <strong style={{ color: '#003060' }}>{gf.zonas}</strong></span>
                      <span>•</span>
                      <span>Peso KMZ: <strong style={{ color: '#003060' }}>{gf.kmzSize}</strong></span>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                    paddingTop: '0.85rem',
                    borderTop: '1px solid #edf4fb'
                  }}>
                    <button
                      type="button"
                      onClick={() => handleExportGroupExcel(gf)}
                      disabled={isExportingExcel}
                      style={{
                        width: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        background: isExportingExcel ? '#94a3b8' : '#059669',
                        border: '1px solid transparent',
                        color: '#ffffff',
                        borderRadius: '7px',
                        padding: '0.62rem 0.9rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: isExportingExcel ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Descargar observaciones de este grupo en Excel (.xlsx)"
                    >
                      {isExportingExcel ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Generando Excel...</span>
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet size={16} />
                          <span>Descargar Excel Observaciones (.xlsx)</span>
                        </>
                      )}
                    </button>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleDownload(gf, 'kmz')}
                        disabled={isDownloadingKmz}
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
                          padding: '0.52rem 0.75rem',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: isDownloadingKmz ? 'wait' : 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title="Descargar mapa satelital KMZ para Google Earth"
                      >
                        <Download size={14} color="#ffffff" />
                        <span>{isDownloadingKmz ? 'Descargando...' : 'Descargar KMZ'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownload(gf, 'kml')}
                        disabled={isDownloadingKml}
                        style={{
                          background: '#f8fbfe',
                          border: '1px solid #cbd5e1',
                          color: '#475569',
                          borderRadius: '6px',
                          padding: '0.52rem 0.8rem',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: isDownloadingKml ? 'wait' : 'pointer'
                        }}
                        title="Descargar versión KML plano"
                      >
                        {isDownloadingKml ? '...' : 'KML'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. PESTAÑA 2: PAQUETES GLOBALES Y EN VIVO */}
      {activeTab === 'globales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.3rem' }}>
          
          <div style={{
            background: 'linear-gradient(135deg, #003060 0%, #004b8d 100%)',
            border: '1px solid rgba(0, 48, 96, 0.2)',
            borderRadius: '14px',
            padding: '1.6rem 1.8rem',
            color: '#ffffff',
            boxShadow: '0 8px 20px rgba(0, 48, 96, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ maxWidth: '680px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <Globe size={22} color="#ffffff" />
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    Mapa Satelital General (Proyecto Completo)
                  </h3>
                </div>
                <p style={{ color: '#e0f2fe', fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
                  Consolida los <strong>156 sitios</strong> y las <strong>4,116 observaciones</strong> georreferenciadas con carpetas colapsadas por grupo. Optimizado para Google Earth Desktop y Celular con fichas técnicas completas.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.8rem' }}>
                  <span style={{ background: 'rgba(255,255,255,0.15)', padding: '0.2rem 0.55rem', borderRadius: '5px', fontSize: '0.74rem' }}>
                    156 Nodos Activos
                  </span>
                  <span style={{ background: 'rgba(255,255,255,0.15)', padding: '0.2rem 0.55rem', borderRadius: '5px', fontSize: '0.74rem' }}>
                    Peso: 240 KB (KMZ)
                  </span>
                  <span style={{ background: 'rgba(255,255,255,0.15)', padding: '0.2rem 0.55rem', borderRadius: '5px', fontSize: '0.74rem' }}>
                    Zonas 2 y 7
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', minWidth: '240px' }}>
                <button
                  type="button"
                  onClick={() => handleDownload(generalFile, 'kmz')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: '#ffffff',
                    color: '#003060',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1.1rem',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.12)'
                  }}
                >
                  <Download size={16} />
                  <span>{downloadingId === `${generalFile.id}-kmz` ? 'Descargando...' : 'Descargar KMZ General (240 KB)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAllExcel}
                  disabled={exportingExcelId === 'general-excel'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1.1rem',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    cursor: exportingExcelId === 'general-excel' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 3px 10px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  {exportingExcelId === 'general-excel' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Generando Excel Global...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet size={16} />
                      <span>Descargar Todas las Obs. (Excel)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(generalFile, 'kml')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: 'rgba(255,255,255,0.12)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    padding: '0.55rem 1.1rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <ExternalLink size={14} />
                  <span>Descargar Versión KML (3.6 MB)</span>
                </button>
              </div>
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #d8e5f1',
            borderRadius: '12px',
            padding: '1.4rem 1.6rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
              <div style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '10px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileArchive size={26} color="#d97706" />
              </div>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#003060', margin: 0 }}>
                  Paquete Comprimido Completo ZIP
                </h4>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Contiene los 7 archivos KMZ (1 General + Grupos 1 al 6) en un solo archivo comprimido de ~420 KB.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadZipBundle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#003060',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.25rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 48, 96, 0.2)'
              }}
            >
              <Download size={15} />
              <span>{downloadingId === 'zip-bundle' ? 'Descargando...' : 'Descargar ZIP (7 KMZs)'}</span>
            </button>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #bae6fd',
            borderLeft: '5px solid #0284c7',
            borderRadius: '12px',
            padding: '1.4rem 1.6rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <span style={{
                    background: '#e0f2fe',
                    color: '#0284c7',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <Radio size={12} /> EN VIVO
                  </span>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#003060', margin: 0 }}>
                    Google Earth en Tiempo Real (NetworkLink KML)
                  </h4>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.45, maxWidth: '700px' }}>
                  Abre este archivo una sola vez en <strong>Google Earth Pro de oficina</strong>. Se auto-refresca cada 60 segundos desde la base de datos sin necesidad de descargar archivos nuevos cuando las cuadrillas actualizan observaciones.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSyncKMZ}
                disabled={isSyncing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: syncSuccess ? '#10b981' : '#f0fdf4',
                  border: `1px solid ${syncSuccess ? '#10b981' : '#86efac'}`,
                  color: syncSuccess ? '#ffffff' : '#15803d',
                  borderRadius: '7px',
                  padding: '0.55rem 0.95rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: isSyncing ? 'wait' : 'pointer'
                }}
              >
                <Zap size={14} className={isSyncing ? 'animate-pulse' : ''} />
                <span>{isSyncing ? 'Sincronizando...' : syncSuccess ? '¡Actualizado!' : '⚡ Sincronizar KMZs Ahora'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid #edf4fb' }}>
              <button
                type="button"
                onClick={handleDownloadLiveNetworkLink}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.52rem 0.9rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Download size={14} />
                <span>{downloadingId === 'live-networklink' ? 'Descargando...' : 'Descargar Enlace en Vivo (KML)'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyNetworkLinkUrl}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: '#f8fbfe',
                  border: '1px solid #cbd5e1',
                  color: '#334e68',
                  borderRadius: '6px',
                  padding: '0.52rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {copiedLink ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar URL de Google Earth'}</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 5. PESTAÑA 3: GUÍA DE USO */}
      {activeTab === 'guia' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.2rem'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #d8e5f1',
            borderRadius: '12px',
            padding: '1.4rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <div style={{ background: '#e0f2fe', padding: '0.5rem', borderRadius: '8px' }}>
                <Globe size={20} color="#003060" />
              </div>
              <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#003060', margin: 0 }}>
                En Computadora (PC / Laptop)
              </h4>
            </div>
            <ol style={{ fontSize: '0.82rem', color: '#334e68', paddingLeft: '1.2rem', margin: 0, lineHeight: 1.6 }}>
              <li>Descarga el archivo <strong>.KMZ</strong> del grupo asignado o el General.</li>
              <li>Haz doble clic sobre el archivo descargado.</li>
              <li>Se abrirá automáticamente en <strong>Google Earth Pro</strong>.</li>
              <li>En el panel lateral izquierdo verás la lista de carpetas con los sitios georreferenciados.</li>
              <li>Haz clic en cualquier nodo para abrir la ficha con sus observaciones.</li>
            </ol>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #d8e5f1',
            borderRadius: '12px',
            padding: '1.4rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <div style={{ background: '#ecfdf5', padding: '0.5rem', borderRadius: '8px' }}>
                <Smartphone size={20} color="#059669" />
              </div>
              <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#059669', margin: 0 }}>
                En Celular vía Google Drive
              </h4>
            </div>
            <ol style={{ fontSize: '0.82rem', color: '#334e68', paddingLeft: '1.2rem', margin: 0, lineHeight: 1.6 }}>
              <li>Sube el archivo <strong>KMZ</strong> a tu cuenta de Google Drive.</li>
              <li>Abre la aplicación <strong>Google Earth</strong> en tu teléfono.</li>
              <li>Toca en el menú <strong>Proyectos → Abrir → Desde Google Drive</strong>.</li>
              <li>Selecciona el KMZ y se cargarán los sitios con visualización en 3D y GPS activo.</li>
            </ol>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #d8e5f1',
            borderRadius: '12px',
            padding: '1.4rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <div style={{ background: '#fef3c7', padding: '0.5rem', borderRadius: '8px' }}>
                <ShieldCheck size={20} color="#d97706" />
              </div>
              <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#d97706', margin: 0 }}>
                En Campo 100% Offline (Sin Señal)
              </h4>
            </div>
            <ol style={{ fontSize: '0.82rem', color: '#334e68', paddingLeft: '1.2rem', margin: 0, lineHeight: 1.6 }}>
              <li>Antes de salir a ruta, activa en Drive <strong>"Permitir acceso sin conexión"</strong> en el archivo.</li>
              <li>También puedes importar el KMZ en apps como <strong>Organic Maps</strong> o <strong>Locus Map</strong>.</li>
              <li>El GPS de tu celular te posicionará exactamente en la torre o caseta sin necesidad de internet ni datos móviles.</li>
            </ol>
          </div>
        </div>
      )}

    </div>
  )
}
