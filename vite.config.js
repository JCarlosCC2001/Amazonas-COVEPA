import { spawn } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'kmz-sync-endpoint',
      configureServer(server) {
        server.middlewares.use('/api/sync-kmz', (req, res) => {
          if (req.method === 'POST') {
            const py = spawn('python', ['tools/kmz/generar_kmz.py'], { cwd: process.cwd() })
            py.on('close', (code) => {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: code === 0, code }))
            })
          } else {
            res.statusCode = 405
            res.end()
          }
        })

        // Middleware local para /api/despachar-reporte en entorno de desarrollo (npm run dev)
        server.middlewares.use('/api/despachar-reporte', (req, res) => {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200
            res.end()
            return
          }
          if (req.method !== 'POST' && req.method !== 'GET') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Método no permitido' }))
            return
          }

          let rawBody = ''
          req.on('data', chunk => { rawBody += chunk })
          req.on('end', async () => {
            try {
              const parsedBody = rawBody ? JSON.parse(rawBody) : {}
              const cronKey = req.headers['x-cron-key'] || 'covepa_cron_7f8a9b2c3d4e5f'
              const tipoReporte = parsedBody.tipo_reporte || req.headers['x-tipo-reporte'] || 'diario'
              const destinatarioPrueba = parsedBody.destinatario_prueba || req.headers['x-destinatario-prueba'] || ''
              const forzar = parsedBody.forzar !== undefined ? parsedBody.forzar : (req.headers['x-forzar'] === 'true')

              // Reenviar de servidor a servidor al endpoint Serverless de producción en Vercel
              const upstreamRes = await fetch('https://amazonas-covepa.vercel.app/api/despachar-reporte', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-cron-key': cronKey,
                  'x-forzar': forzar ? 'true' : 'false',
                  'x-tipo-reporte': String(tipoReporte),
                  'x-destinatario-prueba': String(destinatarioPrueba)
                },
                body: JSON.stringify({
                  forzar: Boolean(forzar),
                  tipo_reporte: tipoReporte,
                  destinatario_prueba: destinatarioPrueba
                })
              })

              const text = await upstreamRes.text()
              res.statusCode = upstreamRes.status
              res.setHeader('Content-Type', 'application/json')
              res.end(text)
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Error reenviando despacho: ' + err.message }))
            }
          })
        })
      }
    }
  ],

  build: {
    // M4: Separar vendors grandes en chunks independientes para mejor caché
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) requiere manualChunks como función
        manualChunks(id) {
          if (id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react/') || id.includes('/node_modules/react-router')) {
            return 'vendor-react'
          }
          if (id.includes('/node_modules/@supabase/')) {
            return 'vendor-supabase'
          }
          if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/d3-')) {
            return 'vendor-recharts'
          }
          if (id.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons'
          }
        },
      },
    },
    // Subir el límite de advertencia (los chunks individuales serán menores)
    chunkSizeWarningLimit: 600,
  },
})
