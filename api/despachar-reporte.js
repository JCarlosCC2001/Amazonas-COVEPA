/**
 * Endpoint Serverless de Despacho Inmediato de Reportes
 * Proyecto: Amazonas - COVEPA
 * Protegido mediante clave secreta (?key=... o header x-cron-key)
 * para evitar ejecuciones no autorizadas de terceros o bots.
 */

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-key')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido. Use POST o GET.' })
  }

  // 1. Validación de Seguridad (Clave Secreta)
  const expectedSecret = (process.env.CRON_SECRET || 'covepa_cron_7f8a9b2c3d4e5f').trim()
  let providedKey = ''

  try {
    const urlObj = new URL(req.url, `https://${req.headers.host || 'localhost'}`)
    providedKey = urlObj.searchParams.get('key') || ''
  } catch (_) {}

  if (!providedKey) {
    providedKey = (req.query?.key ||
                   req.headers['x-cron-key'] ||
                   (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || '').trim()
  }

  if (!providedKey || providedKey !== expectedSecret) {
    return res.status(401).json({
      error: 'No autorizado. Se requiere una clave de seguridad válida (?key=...).'
    })
  }

  // 2. Token de GitHub Actions
  const token = (process.env.GITHUB_DISPATCH_TOKEN ||
                 process.env.VITE_GITHUB_DISPATCH_TOKEN || '').trim()

  if (!token) {
    return res.status(500).json({
      error: 'Falta configurar la variable de entorno GITHUB_DISPATCH_TOKEN en el servidor.'
    })
  }

  const repo = 'JCarlosCC2001/Amazonas-COVEPA'
  const url = `https://api.github.com/repos/${repo}/actions/workflows/reporte-diario.yml/dispatches`

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
          manual_run: 'true'
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
