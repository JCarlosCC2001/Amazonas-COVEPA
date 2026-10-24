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
            const py = spawn('python', ['generar_kmz.py'], { cwd: process.cwd() })
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
})
