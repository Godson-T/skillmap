import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Failure paths. Specs marked "real server" hit the actual API middleware in
// `vite preview` (same handlers as the Vercel functions) with no Groq key set.
const report = JSON.parse(readFileSync(new URL('../tests/fixtures/report.json', import.meta.url), 'utf8'))
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const skillsBox = (page) => page.getByRole('combobox', { name: /your skills/i })

test.describe('real server', () => {
  test.skip(Boolean(process.env.GROQ_API_KEY), 'needs a server without GROQ_API_KEY')

  test('analyze without a provider key shows a friendly 503 and keeps the inputs', async ({ page }) => {
    await page.route('**/api/market', (r) => r.fulfill(json({ market: null }, 200))) // keep this spec offline
    await page.goto('/')
    await skillsBox(page).fill('Python')
    await skillsBox(page).press('Enter')
    await page.getByRole('button', { name: /Plan my route/ }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('temporarily unavailable')
    await expect(alert).not.toContainText(/groq|GROQ_API_KEY|api key/i) // no provider details leak
    await expect(page.getByRole('button', { name: 'Remove Python' })).toBeVisible()
  })

  test('invalid input returns a structured 400', async ({ request }) => {
    const res = await request.post('/api/analyze', { data: { skills: [], location: 'Mars' } })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.requestId).toBeTruthy()
    expect(body.error).toMatchObject({ code: 'INVALID_INPUT', retryable: false })
    expect(body.error.issues.length).toBeGreaterThan(0)
  })

  test('rejects a cross-origin browser request', async ({ request }) => {
    const res = await request.post('/api/analyze', { data: { skills: ['Go'] }, headers: { Origin: 'https://evil.example' } })
    expect(res.status()).toBe(403)
    expect((await res.json()).error.code).toBe('ORIGIN_NOT_ALLOWED')
  })

  test('only POST is accepted', async ({ request }) => {
    const res = await request.get('/api/market')
    expect(res.status()).toBe(405)
  })

  test('an oversized body is refused with 413', async ({ request }) => {
    const res = await request.post('/api/analyze', { data: { skills: 'x'.repeat(20_000) } })
    expect(res.status()).toBe(413)
  })
})

test('market failure leaves the AI report intact and says what failed', async ({ page }) => {
  await page.route('**/api/analyze', (r) => r.fulfill(json({ report, meta: {} })))
  await page.route('**/api/market', (r) => r.fulfill(json({ error: { code: 'UPSTREAM_ERROR', message: 'The job boards had a hiccup.', retryable: true } }, 502)))
  await page.goto('/')
  await skillsBox(page).fill('React')
  await skillsBox(page).press('Enter')
  await page.getByRole('combobox', { name: /target role/i }).fill('Backend Engineer')
  await page.getByRole('button', { name: /Plan my route/ }).click()
  await expect(page.getByRole('heading', { name: 'Your timetable' })).toBeVisible()
  await expect(page.getByText(/job boards had a hiccup/)).toBeVisible()
})

test('without a target role the market call is skipped and the slip explains why', async ({ page }) => {
  let marketCalls = 0
  await page.route('**/api/market', (r) => { marketCalls += 1; return r.fulfill(json({})) })
  await page.route('**/api/analyze', (r) => r.fulfill(json({ report, meta: {} })))
  await page.goto('/')
  await skillsBox(page).fill('React')
  await skillsBox(page).press('Enter')
  await page.getByRole('button', { name: /Plan my route/ }).click()
  await expect(page.getByRole('heading', { name: 'Your timetable' })).toBeVisible()
  await expect(page.getByText(/Add a target role to the slip/)).toBeVisible()
  expect(marketCalls).toBe(0)
})

test('no horizontal scrolling on the results page', async ({ page }) => {
  await page.route('**/api/analyze', (r) => r.fulfill(json({ report, meta: {} })))
  await page.route('**/api/market', (r) => r.fulfill(json({})))
  await page.goto('/')
  await skillsBox(page).fill('React')
  await skillsBox(page).press('Enter')
  await page.getByRole('button', { name: /Plan my route/ }).click()
  await expect(page.getByRole('heading', { name: 'Your timetable' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
