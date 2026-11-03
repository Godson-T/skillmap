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

Rules: 5-6 risingSkills · 3-5 dyingSkills · 6-8 topMicroSkills · 2-3 careerPaths · 7-10 graph nodes.
For dyingSkills.reason: Include specific data points, real percentages, and sourced market stats (SO Survey 2024, GitHub Octoverse 2024, LinkedIn Economic Graph).
For topMicroSkills: Focus on skills appearing in 50%+ of relevant job postings in 2024-2025.`;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { skills, goal, location } = req.body || {};
  if (!skills) return res.status(400).json({ error: 'skills field is required' });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'GROQ_API_KEY is not configured in environment variables' });

  const userMsg = `Skills: ${skills}.${goal ? ` Target role: ${goal}.` : ''} Location: ${location || 'US'}. Goal: maximize career growth and salary in the ${location || 'US'} market.`;

  try {
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
    });

    const data = await groqRes.json();
    return res.status(groqRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
