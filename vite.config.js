import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { verifyGuildMembershipServer } from './server/verifyGuild.mjs'

/** Dev: mesma rota /api/verify-guild que no Vercel (sem CORS). */
function verifyGuildApiPlugin() {
  return {
    name: 'verify-guild-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/verify-guild')) {
          next()
          return
        }

        const url = new URL(req.url, 'http://localhost')
        const nickname = url.searchParams.get('nickname') || ''
        const result = await verifyGuildMembershipServer(nickname)

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify(result))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), verifyGuildApiPlugin()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/store': path.resolve(__dirname, './src/store'),
    },
  },
})
