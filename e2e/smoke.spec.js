import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const report = JSON.parse(readFileSync(new URL('../tests/fixtures/report.json', import.meta.url), 'utf8'))

test('form → results smoke', async ({ page }) => {
  let sent
  await page.route('**/api/analyze', async (route) => {
    sent = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ requestId: 'e2e', report, meta: { estimate: true, disclaimer: 'E2E disclaimer.' } }),
    })
  })

  await page.route('**/api/market', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ requestId: 'm', market: {
      source: 'Public Greenhouse and Lever job boards', fetchedAt: new Date().toISOString(), role: 'Full Stack Developer',
      location: 'India', scope: 'global', localMatches: 3, sampleSize: 25, lowSample: true, companies: ['Acme'],
      boards: { queried: 20, ok: 19 }, skills: [{ skill: 'React', count: 20, share: 80 }], postings: [],
    } }),
  }))

  await page.goto('/')
  await expect(page).toHaveTitle(/^SkillMap/)

  const skills = page.getByLabel('Current skills')
  await skills.fill('Java')
  await page.getByRole('option', { name: 'JavaScript', exact: true }).dispatchEvent('mousedown')
  await skills.fill('React')
  await skills.press('Enter')
  await page.getByLabel('Target role').fill('Full Stack Developer')
  await page.getByLabel('Region').selectOption('India')
  await page.getByRole('button', { name: /Plan my route/ }).click()

  await expect(page.getByRole('heading', { name: 'Your next three tickets' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your timetable' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Full Stack Track' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'What real job postings ask for' })).toBeVisible()
  await expect(page.getByText('Only 3 matching postings in India')).toBeVisible()
  await expect(page.getByText('Your ticket wallet')).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  await page.getByRole('button', { name: /Punch when learned/ }).first().click()
  await expect(page.getByRole('button', { name: /^Learned$/ })).toBeVisible()

  expect(sent.goal).toBe('Full Stack Developer')
  expect(sent.location).toBe('India')
  expect(sent.skills).toEqual(['JavaScript', 'React'])
})
