/**
 * Endpoint Serverless de Despacho Inmediato de Reportes
 * Proyecto: Amazonas - COVEPA
 * 
 * SEGURIDAD Y CONTROL DE DISPARO:
 * - Solo acepta peticiones POST (bloquea visitas de navegadores).
 * - Exige autenticación vía cabecera HTTP oculta (x-cron-key).
 * - Control de duplicados: Máximo 1 correo por día (a menos que se envíe forzar=true).
 */

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-key, x-forzar')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // 1. Bloqueo estricto de navegadores: Solo se permite POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método no permitido. Este endpoint es un webhook que solo admite solicitudes POST automatizadas.'
    })
  }

  // 2. Validación de Seguridad mediante Cabecera Oculta (Header)
  const expectedSecret = (process.env.CRON_SECRET || 'covepa_cron_7f8a9b2c3d4e5f').trim()
  const providedKey = (req.headers['x-cron-key'] ||
                       (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || '').trim()

  if (!providedKey || providedKey !== expectedSecret) {
    return res.status(401).json({
      error: 'No autorizado. Se requiere la cabecera x-cron-key válida.'
    })
  }

  // 3. Token de GitHub Actions
  const token = (process.env.GITHUB_DISPATCH_TOKEN ||
                 process.env.VITE_GITHUB_DISPATCH_TOKEN || '').trim()

  if (!token) {
    return res.status(500).json({
      error: 'Falta configurar la variable de entorno GITHUB_DISPATCH_TOKEN en el servidor.'
    })
  }

  const repo = 'JCarlosCC2001/Amazonas-COVEPA'
  const url = `https://api.github.com/repos/${repo}/actions/workflows/reporte-diario.yml/dispatches`

  // Si la petición viene con forzar=true (ej: botón prueba en la app web), fuerza el reenvío
  const forzarParam = (req.headers['x-forzar'] === 'true' ||
                       (req.body && req.body.forzar === true))

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Covepa-App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          forzar: forzarParam ? 'true' : 'false'
        }
      })
    })

    if (response.status === 204 || response.ok) {
      return res.status(200).json({
        ok: true,
        message: '¡Reporte diario despachado con éxito! El correo llegará en unos 20 segundos.'
      })
    }

    const errText = await response.text()
    console.error('[API-DESPACHAR] Error de GitHub:', response.status, errText)
    return res.status(response.status).json({
      error: `Error de GitHub (${response.status}): ${errText}`
    })
  } catch (error) {
    console.error('[API-DESPACHAR] Error interno:', error)
    return res.status(500).json({
      error: 'Error al conectar con GitHub Actions: ' + error.message
    })
  }
}
