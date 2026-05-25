import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { addresses, remoteBrowser } from './addresses'

test.use({ connectOptions: remoteBrowser() })

const SHOTS = 'doc/qa/screenshots'

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}

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
  await expect(page.getByRole('link', { name: 'Types' })).toBeVisible()
}

function idOf(reference: string): string {
  return reference.split('/')[1] ?? ''
}

test('a server that has not been reached yet', async ({ page }) => {
  await page.goto(addresses().app)

  await expect(page.getByLabel('Server address')).toBeVisible()
  await shoot(page, '01-server-before')
})

test('a server that refuses to be explored', async ({ page }) => {
  await page.goto(addresses().app)
  await page.getByLabel('Server address').fill('http://127.0.0.1:1/fhir')
  await page.getByRole('button', { name: 'Connect' }).click()

  await expect(page.getByRole('complementary', { name: 'What went wrong' })).toBeVisible()
  await shoot(page, '02-server-refused')
})

test('a session held against the service', async ({ page }) => {
  await signIn(page)
  await page.getByRole('navigation', { name: 'Server' }).getByRole('link', { name: 'Server' }).click()

  await expect(page.getByText(/Release:/)).toBeVisible()
  await expect(page.getByTestId('session')).toHaveText('Session held')
  await shoot(page, '03-session-held')
})

test('the types the service declares', async ({ page }) => {
  await signIn(page)

  await expect(page.getByRole('link', { name: 'Patient', exact: true })).toBeVisible()
  await shoot(page, '04-types')

  await page.getByLabel('Filter types').fill('obs')
  await expect(page.getByRole('link', { name: 'Observation', exact: true })).toBeVisible()
  await shoot(page, '05-types-filtered')
})

test('a search over simulated patients', async ({ page }) => {
  await signIn(page)
  await page.getByRole('link', { name: 'Patient', exact: true }).click()

  await expect(page.getByText(/Found:/)).toBeVisible()
  await shoot(page, '06-search-all')

  await page.getByLabel('family', { exact: true }).fill('Hopper')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByText(/Grace Hopper/)).toBeVisible()
  await shoot(page, '07-search-family')
})

test('a patient as the service gives it', async ({ page }) => {
  const where = addresses()

  await signIn(page)
  await page.goto(`${where.app}#/type/Patient/${idOf(where.made.ada ?? '')}`)

  await expect(page.getByRole('heading', { name: /Ada Lovelace/ })).toBeVisible()
  await shoot(page, '08-patient')

  await page.getByRole('button', { name: 'Raw' }).click()
  await expect(page.getByTestId('raw')).toBeVisible()
  await shoot(page, '09-patient-raw')
})

test('an observation with its codes and its references', async ({ page }) => {
  const where = addresses()

  await signIn(page)
  await page.goto(`${where.app}#/type/Observation/${idOf(where.made['29463-7-ada'] ?? '')}`)

  await expect(page.getByRole('heading', { name: 'Body weight' })).toBeVisible()
  await shoot(page, '10-observation')
})

test('the graph around a patient', async ({ page }) => {
  const where = addresses()

  await signIn(page)
  await page.goto(`${where.app}#/graph/Patient/${idOf(where.made.ada ?? '')}`)

  await expect(page.getByTestId('size')).not.toHaveText('0')
  await shoot(page, '11-graph-outbound')

  await page.getByText('Pointing here').click()
  await page.getByRole('button', { name: 'Observation', exact: true }).click()
  await expect(page.getByText(/Observation:/).first()).toBeVisible()
  await page.waitForTimeout(1500)
  await shoot(page, '12-graph-inbound')

  await page.getByRole('button', { name: 'Expand' }).first().click()
  await page.waitForTimeout(1500)
  await shoot(page, '13-graph-grown')
})

test('the history of a resource that was changed', async ({ page }) => {
  const where = addresses()

  await signIn(page)
  await page.goto(`${where.app}#/type/Patient/${idOf(where.made.grace ?? '')}/edit`)

  const written = await page.getByLabel('Raw').inputValue()
  const held = JSON.parse(written) as { address?: { city?: string }[]; meta?: { versionId?: string } }
  const before = held.meta?.versionId ?? '1'

  await page
    .getByLabel('Raw')
    .fill(JSON.stringify({ ...held, address: [{ city: `Arlington ${before}`, country: 'GB' }] }, null, 2))
  await page.getByLabel('Raw').evaluate((held) => {
    held.scrollTop = 0
  })
  await shoot(page, '14-edit')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByTestId('version')).not.toContainText(`Version: ${before}`)
  await shoot(page, '15-after-save')

  await page.getByRole('link', { name: 'History' }).click()
  await expect(page.getByRole('link', { name: '1', exact: true })).toBeVisible()
  await shoot(page, '16-history')

  await page.getByRole('link', { name: '1', exact: true }).click()
  await expect(page.getByTestId('raw')).toContainText('"resourceType": "Patient"')
  await shoot(page, '17-version-one')
})

test('the interface in a second language', async ({ page }) => {
  await signIn(page)
  await page.getByLabel('language').selectOption('ru')

  await expect(page.getByRole('heading', { name: 'Типы ресурсов' })).toBeVisible()
  await shoot(page, '18-russian')
})

test('the same interface in the dark', async ({ browser }) => {
  const where = addresses()
  const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  await signIn(page)
  await page.getByRole('link', { name: 'Patient', exact: true }).click()
  await expect(page.getByText(/Found:/)).toBeVisible()
  await shoot(page, '19-dark-search')

  await page.goto(`${where.app}#/graph/Patient/${(where.made.ada ?? '').split('/')[1] ?? ''}`)
  await expect(page.getByTestId('size')).not.toHaveText('0')
  await page.waitForTimeout(1200)
  await shoot(page, '20-dark-graph')

  await context.close()
})

test('the interface at the width of a telephone', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()

  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Resource types' })).toBeVisible()
  await shoot(page, '21-narrow-types')

  await page.getByRole('link', { name: 'Patient', exact: true }).click()
  await expect(page.getByText(/Found:/)).toBeVisible()
  await shoot(page, '22-narrow-search')

  await page.getByRole('link', { name: /Ada/ }).first().click()
  await expect(page.getByRole('heading', { name: /Ada/ })).toBeVisible()
  await shoot(page, '23-narrow-patient')

  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(390)

  await context.close()
})
