# Product — SkillMap AI

## What it is
SkillMap AI is an AI-powered career intelligence platform. A user enters their current
skills (plus an optional target role and location) and receives a structured report:
rising and declining skills, a force-directed knowledge graph of how their skills
connect to their target, AI-mapped career roadpaths with per-phase ROI, and a short
list of high-yield micro-skills with learning links.

## Audience
Broad — the tool is deliberately not persona-locked:
- **Job seekers** who want a concrete roadmap to a target role.
- **Career switchers** pivoting into tech from a non-tech background.
- **Upskilling engineers** deciding what to learn next to grow.

## Core value
Turn a flat list of skills into an actionable, prioritized career plan — fast, and
free of career-advice boilerplate. The product is the report itself.

## User goal
Walk away with a *decision*: which skills to learn, in what order, to reach a
higher-value role, and how long it should take.

## Brand personality
**Warm and encouraging** — not a cold data terminal. Coaching-adjacent, human,
optimistic. The tone should feel like a supportive mentor who has done the market
research for you, not a spreadsheet.

## Inputs
- Current skills (free text + smart autocomplete from a ~90-skill taxonomy).
- Target role (optional, dropdown of 30 roles).
- Location (US / India / EU / UK / Remote) — shapes salary and market context.

## Outputs (sections)
1. Skill Topology Map — force-directed canvas graph (current / bridge / target nodes).
2. High-Demand Skills — rising skills with demand scores and trend direction.
3. Declining Skills — skills to deprioritize, with sourced market reasons.
4. Career Trajectories — 2–3 tabbed roadpaths, each with phased roles, timelines,
   skills to acquire, and ROI.
5. High-Yield Micro-Skills — quick wins sorted by impact, with Udemy / Coursera /
   freeCodeCamp learning links.
6. YouTube Learning Resources — curated tutorial searches per required skill.

## Technical context
- React 18 + Vite 5 frontend, Tailwind CSS 3.4 styling.
- LLM: Groq (`llama-3.3-70b-versatile`), strict JSON-schema system prompt.
- API key kept server-side (Vercel `api/analyze.js` + Vite dev proxy).
- Deployed on Vercel.

## Open questions
- Monetization: currently free. Subscription / usage limits not decided.
- Whether to persist saved profiles or add auth — not built.