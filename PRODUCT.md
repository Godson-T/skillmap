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
- Target role (optional): autocomplete over 29 preset roles, or a short custom role (≤60 chars, sanitized).
- Location (US / India / EU / UK / Remote) — shapes salary and market context.

## Outputs (sections, in reading order)
1. Your next three tickets: the next skills to learn, measured picks from real postings
   first, then AI suggestions; each can be punched when learned (saved in the browser).
   Beside it, the ticket wallet: how many of the route's skills the user already holds.
2. Your timetable: 2–3 tabbed career paths as timetables (stop, role, arrival, via
   skills, upside†).
3. What real job postings ask for: measured skill counts from live Greenhouse/Lever
   postings, with sample size, scope and source.
4. Where demand is heading: rising and fading skills (AI estimate).
5. Route map: skill topology as a rail diagram (held / bridge / target).
6. Quick wins: high-yield micro-skills with course searches, plus YouTube searches for
   every route skill (not curated).

† marks every AI estimate; measured figures carry their sample size and source.

## Technical context
- React 18 + Vite 8 frontend; plain CSS design system in src/index.css ("Platform Timetable" world), Barlow, Barlow Semi Condensed and Barlow Condensed via Fontsource.
- LLM: Groq (`openai/gpt-oss-120b` by default, override with `GROQ_MODEL`), JSON mode + zod-validated output.
- One shared handler (`server/handler.js`) for Vercel and the Vite dev server; prompt in `server/prompt.js`.
- API key kept server-side (Vercel `api/analyze.js` + Vite dev proxy).
- Deployed on Vercel.

## Open questions
- Monetization: currently free. Subscription / usage limits not decided.
- Whether to persist saved profiles or add auth — not built.