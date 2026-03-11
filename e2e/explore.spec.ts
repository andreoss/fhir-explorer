import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { addresses, remoteBrowser } from './addresses'

test.use({ connectOptions: remoteBrowser() })

async function signIn(page: Page): Promise<void> {
  const where = addresses()

  await page.goto(where.app)
  await expect
    .poll(
      async () => {
        await page.getByLabel('Server address').fill(where.fhir)
        await page.getByRole('button', { name: 'Connect' }).click()

        return page.getByTestId('standing').textContent()
      },
      { timeout: 30_000 }
    )
    .toBe('Answering')

  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByLabel('Username or email').fill(where.user)
  await page.getByLabel('Password', { exact: true }).fill(where.password)
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page.getByTestId('session')).toHaveText('Session held')
}

async function findAPatient(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Types' }).click()
  await page.getByRole('link', { name: 'Patient', exact: true }).click()
  await page.getByLabel('name', { exact: true }).fill('Ada')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByRole('link', { name: 'patient-0' })).toBeVisible()
}

test('a session is obtained from the issuer the server names', async ({ page }) => {
  await signIn(page)

  await expect(page.getByTestId('standing')).toHaveText('Answering')
})

test('the types a server declares can be browsed and searched', async ({ page }) => {
  await signIn(page)
  await findAPatient(page)

  await expect(page.getByText(/Ada/).first()).toBeVisible()
})

test('a resource shows the version it came from and its raw form', async ({ page }) => {
  await signIn(page)
  await findAPatient(page)

  await page.getByRole('link', { name: 'patient-0' }).click()

  await expect(page.getByRole('heading', { name: /Ada/ })).toBeVisible()
  await expect(page.getByTestId('version')).toContainText('Version:')

  await page.getByRole('button', { name: 'Raw' }).click()
  await expect(page.getByTestId('raw')).toContainText('"resourceType": "Patient"')
})

test('the graph grows from a resource to what points at it', async ({ page }) => {
  await signIn(page)
  await findAPatient(page)
  await page.getByRole('link', { name: 'patient-0' }).click()

  await page.getByRole('link', { name: 'Open in the graph' }).click()

  await expect(page.getByTestId('focus')).toHaveText('Patient/patient-0')

  await page.getByText('Pointing here').click()
  await page.getByRole('button', { name: 'Observation', exact: true }).click()

  await expect(page.getByText(/Observation:/).first()).toBeVisible()
  await expect(page.getByTestId('size')).not.toHaveText('1')
})

test('a reference in a resource is somewhere to go', async ({ page }) => {
  await signIn(page)
  await findAPatient(page)
  await page.getByRole('link', { name: 'patient-0' }).click()
  await page.getByRole('link', { name: 'Open in the graph' }).click()
  await page.getByText('Pointing here').click()
  await page.getByRole('button', { name: 'Observation', exact: true }).click()
  await expect(page.getByText(/Observation:/).first()).toBeVisible()

  await page.getByRole('button', { name: 'Expand' }).first().click()
  await page.getByRole('link', { name: 'Rendered' }).click()

  await expect(page.getByRole('link', { name: 'Patient/patient-0' }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Patient/patient-0' }).first().click()

  await expect(page.getByRole('heading', { name: /Ada/ })).toBeVisible()
})
