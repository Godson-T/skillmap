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

  await page.goto('/')
  await expect(page).toHaveTitle('SkillMap')

  const skills = page.getByLabel('Current skills')
  await skills.fill('Java')
  await page.getByRole('button', { name: 'JavaScript', exact: true }).dispatchEvent('mousedown')
  await skills.fill('React,')
  await page.getByLabel('Target role').fill('Full Stack Developer')
  await page.locator('select').selectOption('India')
  await page.getByRole('button', { name: /Analyze My Career/ }).click()

  await expect(page.getByRole('heading', { name: 'Skill Topology Map' })).toBeVisible()
  await expect(page.getByText('E2E disclaimer.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Career Trajectories' })).toBeVisible()
  await expect(page.getByText('Skill Readiness:')).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()

  expect(sent.goal).toBe('Full Stack Developer')
  expect(sent.location).toBe('India')
  expect(sent.skills.split(',').map(s => s.trim()).filter(Boolean)).toEqual(['JavaScript', 'React'])
})
