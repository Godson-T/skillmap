import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (no prefix filter) — non-VITE_ vars stay server-side only
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'groq-proxy',
        configureServer(server) {
          server.middlewares.use('/api/analyze', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end('Method Not Allowed')
              return
            }

            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', async () => {
              try {
                const { skills, goal, location } = JSON.parse(body)
                const key = env.GROQ_API_KEY
                const userMsg = `Skills: ${skills}.${goal ? ` Target role: ${goal}.` : ''} Location: ${location || 'US'}. Goal: maximize career growth and salary in the ${location || 'US'} market.`

                if (!key) {
                  res.statusCode = 500
                  res.end(JSON.stringify({ error: 'GROQ_API_KEY not set in .env' }))
                  return
                }

                const SYSTEM_PROMPT = `You are a senior career analyst with deep expertise in 2024-2026 job market trends.
Analyze the user's skill profile and return ONLY a valid JSON object — no markdown, no commentary.

JSON schema (follow exactly):
{
  "risingSkills":   [{ "skill": string, "demandScore": number (60-100), "trend": "rising"|"stable"|"declining" }],
  "knowledgeGraph": {
    "nodes": [{ "id": string, "label": string, "type": "current"|"bridge"|"target", "level": number (1-3) }],
    "edges": [{ "from": string, "to": string, "label": string }]
  },
  "careerPaths": [{
    "pathName": string,
    "steps": [{ "role": string, "timeMonths": number, "skillsNeeded": [string], "roi": string }],
    "totalTime": string,
    "difficulty": "Easy"|"Medium"|"Hard"
  }],
  "dyingSkills":    [{ "skill": string, "reason": string }],
  "topMicroSkills": [{ "skill": string, "learnTime": string, "impact": "High"|"Medium"|"Low" }]
}

Rules: 5-6 risingSkills · 2-3 dyingSkills · 6-8 topMicroSkills · 2-3 careerPaths · 7-10 graph nodes.`

                const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`,
                  },
                  body: JSON.stringify({
                    model: 'qwen/qwen3.8-27b',
                    messages: [
                      { role: 'system', content: SYSTEM_PROMPT },
                      { role: 'user', content: userMsg },
                    ],
                    max_tokens: 2500,
                    temperature: 0.7,
                  }),
                })

                const data = await groqRes.json()
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = groqRes.status
                res.end(JSON.stringify(data))
              } catch (err) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: err.message }))
              }
            })
          })
        },
      },
    ],
  }
})
