import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createDeps, handleAnalyze, handleMarket } from './server/handler.js'
import { clientIp, normalizeHeaders, readBody, send } from './server/http.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (no prefix filter) — non-VITE_ vars stay server-side only.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }

  // Dev/preview-only mirror of api/analyze.js. Same handler, prompt and schema.
  const deps = createDeps(env)
  const route = (handler) => async (req, res) => {
    const headers = normalizeHeaders(req.headers)
    const raw = req.method === 'POST' ? await readBody(req) : ''
    const out = await handler({
      method: req.method,
      headers,
      body: raw ?? '',
      bodyTooLarge: raw === null,
      ip: clientIp(headers, req.socket, env),
    }, deps)
    send(res, out)
  }
  const mountApi = (server) => {
    server.middlewares.use('/api/analyze', route(handleAnalyze))
    server.middlewares.use('/api/market', route(handleMarket))
  }

  return {
    plugins: [
      react(),
      {
        name: 'skillmap-api',
        configureServer: mountApi,
        configurePreviewServer: mountApi,
      },
    ],
    test: {
      environment: 'node',
      include: ['tests/**/*.test.{js,jsx}'],
    },
  }
})
