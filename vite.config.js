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
