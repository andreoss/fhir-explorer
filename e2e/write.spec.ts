import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { addresses, remoteBrowser } from './addresses'

test.use({ connectOptions: remoteBrowser() })

async function connectTo(page: Page): Promise<void> {
  const where = addresses()

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByLabel('Server address').fill(where.fhir)
    await page.getByRole('button', { name: 'Connect' }).click()

    try {
      await expect(page.getByTestId('standing')).toHaveText('Answering', { timeout: 10_000 })
      return
    } catch {
      await page.waitForTimeout(500)
    }
  }

  throw new Error('the interface never reached the server')
}

async function signIn(page: Page): Promise<void> {
  const where = addresses()

  await page.goto(where.app)
  await connectTo(page)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByLabel('Username or email').fill(where.user)
  await page.getByLabel('Password', { exact: true }).fill(where.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByTestId('session')).toHaveText('Session held')
  await expect(page.getByRole('link', { name: 'Types' })).toBeVisible()
}

test('a resource can be created, changed and removed', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept())

  await signIn(page)
  await page.getByRole('link', { name: 'Types' }).click()
  await page.getByRole('link', { name: 'Patient', exact: true }).click()
  await page.getByRole('link', { name: 'Create' }).click()

  await page
    .getByLabel('Raw')
    .fill(JSON.stringify({ resourceType: 'Patient', name: [{ family: 'Written', given: ['By a test'] }] }, null, 2))
  await page.getByRole('button', { name: 'Create' }).click()

  await expect(page.getByRole('heading', { name: /Written/ })).toBeVisible()
  await expect(page.getByTestId('version')).toContainText('Version: 1')

  await page.getByRole('link', { name: 'Edit' }).click()
  const written = await page.getByLabel('Raw').inputValue()
  await page.getByLabel('Raw').fill(written.replace('Written', 'Rewritten'))
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('heading', { name: /Rewritten/ })).toBeVisible()
  await expect(page.getByTestId('version')).toContainText('Version: 2')

  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByRole('heading', { name: 'Patient' })).toBeVisible()
})
