import { expect, test } from '@playwright/test'
import { addresses, remoteBrowser } from './addresses'

test.use({ connectOptions: remoteBrowser() })

test('what the page does when asked to connect', async ({ page }) => {
  const where = addresses()
  const said: string[] = []

  page.on('console', (message) => said.push(`${message.type()}: ${message.text()}`))
  page.on('pageerror', (error) => said.push(`error: ${error.message}`))
  page.on('requestfailed', (request) => said.push(`failed: ${request.url()} ${request.failure()?.errorText ?? ''}`))

  await page.goto(where.app)
  await page.getByLabel('Server address').fill(where.fhir)
  await page.getByRole('button', { name: 'Connect' }).click()
  await page.waitForTimeout(3000)

  const shown = await page.locator('main').innerText()

  expect({ said, shown, fhir: where.fhir }).toEqual({})
})
