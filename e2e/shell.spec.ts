import { expect, test } from '@playwright/test'
import { addresses } from './addresses'

test('the app answers where it was started', async ({ page }) => {
  const where = addresses()

  const answer = await page.goto(where.app)

  expect(answer?.status()).toBe(200)
  await expect(page.locator('main')).toBeAttached()
})

test('the server behind it advertises how to obtain a session', async ({ request }) => {
  const where = addresses()

  const answer = await request.get(`${where.fhir}/.well-known/smart-configuration`)

  expect(answer.status()).toBe(200)
  expect(await answer.json()).toHaveProperty('authorization_endpoint')
})
