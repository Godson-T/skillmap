# SkillMap — Verification Report

**Baseline:** `main` @ `ad6f246` ("first commit"), checked 2026-11-19.
**Source of truth:** the public repo `Godson-T/skillmap`. The local copy at
`C:\Users\kanna\OneDrive\Desktop\Skillmap\skillmap` matches it exactly once CRLF line
endings are normalized: every tracked file's content hash is the same as `HEAD`.
`git status` lists every file as modified only because of Windows line endings. The
local copy has no extra commits, branches or untracked source.

The brief describes the repo as having no tests, no data layer, no shareable-report
route and no SSRF protection. That is **confirmed**. None of these exist, and the server
makes no outbound fetch based on user input, so SSRF does not apply today.

Line numbers refer to the baseline commit.

| # | Suspected issue | Verdict |
|---|---|---|
| 1 | Model mismatch / invalid model ID | **Partly confirmed.** There is a mismatch, but the ID is valid |
| 2 | Prompt duplicated three times and drifted | **Confirmed** |
| 3 | CORS `*`, no rate limit / auth / abuse control | **Confirmed** |
| 4 | No input validation; prompt-injection surface | **Confirmed.** Worse than described: goal is free text too |
| 5 | Fence-strip-only parsing, no schema / retry / JSON mode; raw Groq response returned | **Confirmed** |
| 6 | Error handling leaks provider details; no 4xx/5xx/timeout/429 distinction | **Confirmed** |
| 7 | Model-invented "sourced" stats | **Confirmed** |
| 8 | `Math.random()` graph layout | **Confirmed** |
| 9 | First-word substring skill-gap matching | **Confirmed** |
| 10 | Copy / naming mismatches | **Confirmed**, with one correction |
| 11 | Stale YouTube query; search URLs presented as courses | **Confirmed** |
| 12 | No tests / CI / `.env.example` | **Confirmed.** The lint gate is also red |

---

### 1. Model mismatch: partly confirmed

- `api/analyze.js:50` and `vite.config.js:65` both call `model: 'qwen/qwen3.8-27b'`.
- `README.md` does **not** mention `llama-3.3-70b-versatile`. It is the stock Vite
  template (`README.md:1`). The llama reference is in `PRODUCT.md:46`.
- **Validity (checked against Groq's Supported Models page, 2026-11-19):**
  `qwen/qwen3.8-27b` *is* a valid ID. It is listed under **Preview** models, priced at
  $0.80 input / $4.00 output per 1M tokens. Groq states that Preview models are for
  evaluation only and may be discontinued at short notice.
  `llama-3.3-70b-versatile` was deprecated with a 2026-08-16 shutdown for self-serve
  tiers. It now shows "Contact Sales", so it is not usable on a normal key.
- **Decision:** default to `openai/gpt-oss-120b`. It is a Production model at
  $0.15 / $0.60 per 1M tokens and supports JSON-object and JSON-schema modes. The
  model can be overridden with the `GROQ_MODEL` env var.

### 2. Duplicated, drifted system prompt: confirmed

- Copy A is `src/App.jsx:10-30`. It is **dead code**: lint reports `'SYSTEM_PROMPT' is
  assigned a value but never used`. It is still shipped in the client bundle.
- Copy B is `api/analyze.js:1-23`, the production prompt.
- Copy C is `vite.config.js:36-56`, the dev prompt.
- Drift:
  - `api/analyze.js:21` says "3-5 dyingSkills", while `vite.config.js:56` and
    `src/App.jsx:30` say "2-3".
  - The "sourced market stats" clause (`api/analyze.js:22`) and the "50%+ of job
    postings" clause (`api/analyze.js:23`) exist only in the production copy.
  - The result is that dev and prod produce different reports.
- The user message is also duplicated, at `api/analyze.js:40` and
  `vite.config.js:28`.

### 3. Open CORS and no abuse control: confirmed

- `api/analyze.js:27` sets `Access-Control-Allow-Origin: *`.
- There is no auth, rate limit or daily cap anywhere in `api/` or `vite.config.js`.
- Every POST spends the Groq key (`api/analyze.js:37,47`).
- Note: CORS only constrains browsers. A script with `curl` ignores it. Rate limiting
  and a daily budget cap are the real controls.

### 4. No input validation: confirmed

- `api/analyze.js:35` only checks that `skills` is truthy. It applies no type, length
  or count limit. An object or a 4 MB string would be accepted and forwarded.
- `goal` and `location` are interpolated raw into the prompt at `api/analyze.js:40`
  (and the same at `vite.config.js:28`).
- **Worse than described:**
  - `location` is a `<select>` in the UI (`src/App.jsx:429-435`), but the API accepts
    any string.
  - `goal` is **free text** with autocomplete (`src/App.jsx:319-321`), not a dropdown.
    `PRODUCT.md:31` says "dropdown of 30 roles". It is actually 29
    (`src/App.jsx:226-235`), and users can type anything.
- In dev, `vite.config.js:22-23` buffers the request body with no size limit. A
  malformed body throws at `vite.config.js:26` and returns a 500 that includes the
  parser message.

### 5. Weak output parsing: confirmed

- `safeParseJSON` (`src/App.jsx:34-37`) only strips a leading and trailing code fence.
- There is no `response_format` (`api/analyze.js:49-57`) and no schema validation.
- There is no retry. `max_tokens: 2500` (`api/analyze.js:55`) can truncate the JSON
  mid-object.
- `api/analyze.js:60-61` returns the **raw Groq completion**, including `usage`,
  `x_groq` and model metadata, to the browser. The client then parses
  `choices[0].message.content` itself (`src/App.jsx:280-281`).
- If the model omits any array, the render code crashes. For example
  `data.dyingSkills.map` at `src/App.jsx:538` has no optional chaining.

### 6. Error handling leaks details: confirmed

- `api/analyze.js:61` passes Groq's status and error body straight through, for
  example `invalid_api_key` or `model_decommissioned`.
- `api/analyze.js:63` returns `err.message` from any exception.
- `api/analyze.js:38` tells the public which env var is missing.
- `src/App.jsx:276` displays `err.error.message` verbatim. `src/App.jsx:458` tells end
  users to "Check your API key in the server".
- There is no distinction between upstream 429, 4xx, 5xx, timeouts (there is no
  timeout at all, so a hung upstream holds the function until the platform kills it)
  and invalid output.

### 7. Hallucinated "sourced" statistics: confirmed

- `api/analyze.js:22` instructs the model to "Include specific data points, real
  percentages, and sourced market stats (SO Survey 2024, GitHub Octoverse 2024,
  LinkedIn Economic Graph)".
- No retrieval happens. Nothing is fetched, so any cited figure is generated text.
- `api/analyze.js:23` adds "skills appearing in 50%+ of relevant job postings", which
  is again unverified.
- The UI presents this as fact:
  - `src/App.jsx:510`: "Skills with growing job posting volume through 2025–2026"
  - `src/App.jsx:535`: "market demand is shrinking"
  - The loader at `src/App.jsx:184` says "Querying market data", which never happens.
  - `PRODUCT.md:37` says "sourced market reasons".
- `demandScore` (`src/App.jsx:518-521`) is a model-invented 60–100 number rendered as
  a measured bar.

### 8. Non-deterministic graph: confirmed

- `src/App.jsx:69-70` seeds node x/y with `Math.random()`. The same report lays out
  differently on every render.
- Related: the `requestAnimationFrame` loop (`src/App.jsx:150-152`) never stops. It
  burns CPU for as long as the results are on screen.

### 9. Naive skill-gap math: confirmed

- `src/App.jsx:254` keeps only the first word of each needed skill:
  `sk.toLowerCase().split(' ')[0]`.
- `src/App.jsx:256` matches by bidirectional substring.
- Failure examples:
  - "Machine Learning" becomes "machine".
  - "Spring Boot" becomes "spring", so it matches anything containing "spring".
  - A user skill "C" would match every needed skill containing the letter c, because
    `sk.includes(m)`.
  - "JS" never matches "JavaScript".
  - "Node.js" vs "NodeJS" do not match.
  - "AWS Lambda" and "AWS IAM" both collapse to "aws", which shrinks the denominator.

### 10. Copy and naming mismatches: confirmed, with one correction

- `index.html:11` says "powered by Claude AI". The backend is Groq.
- `README.md:1-8` is the unmodified Vite template.
- `package.json:2` has the name `skillstocareer`.
- Correction: the README never names a model (see #1). The stale model name is in
  `PRODUCT.md:46`.

### 11. Learning links: confirmed

- `src/App.jsx:709` builds YouTube searches as `skill + ' tutorial 2024'`. The hard-coded
  year is stale.
- `src/App.jsx:668-670` builds Udemy, Coursera and freeCodeCamp **search** URLs, but the
  section copy implies courses.
- `src/App.jsx:703` calls the YouTube block "Curated YouTube searches", but
  nothing is curated.

### 12. Tests, CI and env docs: confirmed

- There are no test files, no test runner and no `.github/`.
- There is no `.env.example`, although `.gitignore:27-29` ignores `.env*` correctly.
- **The lint gate is already red.** `npx eslint .` reports **16 errors** at baseline:
  - `process` is undefined in `api/analyze.js` and `vite.config.js`, because the
    config uses browser globals only.
  - There are unused `React`, `Database` and `SYSTEM_PROMPT` in `src/App.jsx`.
  - There are 11 `react/prop-types` errors and one unescaped `'` at `src/App.jsx:471`.
- `npm run build` passes at baseline.

### Additional findings (not in the brief)

- **A1.** `src/App.jsx:61`: `canvas.getContext('2d')` is not null-checked. This
  crashes under jsdom and in some privacy-hardened browsers.
- **A2.** `vercel.json:5-7`: the `/api/(.*)` to `/api/$1` rewrite is a no-op.
  `maxDuration` is not set for the function.
- **A3.** `max_tokens: 2500` combined with a reasoning model can return truncated or
  empty JSON. Reasoning tokens count against the completion budget.
- **A4. Skills input dropped earlier skills (real bug, now fixed).**
  - The input shows only the in-progress word, but `handleSkillChange`
    (`src/App.jsx:293-296`) overwrote the entire `form.skills` string with it.
  - Result: after adding "React", typing "P" replaced the list with "P", so earlier
    tags vanished.
  - A regression test in `tests/app.test.jsx` fails on the old code and passes on
    the fix.

