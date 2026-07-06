import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { addresses, remoteBrowser } from './addresses'

test.use({ connectOptions: remoteBrowser() })

const SHOTS = 'doc/qa/screenshots'

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}

async function signIn(page: Page): Promise<void> {
  const where = addresses()

  await page.goto(where.app)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByLabel('Server address').fill(where.fhir)
    await page.getByRole('button', { name: 'Connect' }).click()

    try {
      await expect(page.getByTestId('standing')).toHaveText('Answering', { timeout: 10_000 })
      break
    } catch {
      await page.waitForTimeout(500)
    }
  }

  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByLabel('Username or email').fill(where.user)
  await page.getByLabel('Password', { exact: true }).fill(where.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('link', { name: 'Types' })).toBeVisible()
}

function populated(): { readonly patients: number; readonly sites: number } {
  const many = addresses().many

  if (many === undefined) {
    throw new Error('the server was not populated')
  }

  return { patients: many.patients ?? 0, sites: many.sites ?? 0 }
}

test.describe('a server holding a whole practice', () => {
  test.skip(() => addresses().many === undefined, 'the server was not populated')

  test('says how many patients it holds, and shows the first of them', async ({ page }) => {
    const held = populated()

    await signIn(page)

    const began = Date.now()

    await page.goto(`${addresses().app}#/type/Patient`)
    await expect(page.getByText(/^Found: /)).toBeVisible({ timeout: 30_000 })

    const said = await page.getByText(/^Found: /).textContent()
    const took = Date.now() - began

    await shoot(page, '24-many-patients')

    const found = Number((said ?? '').replace(/[^0-9]/g, ''))

    expect(found).toBeGreaterThanOrEqual(held.patients)
    expect(await page.getByRole('row').count()).toBeLessThan(100)
    process.stdout.write(`  patients found: ${String(found)} in ${String(took)}ms\n`)
  })

  test('walks page after page by the links the server gives', async ({ page }) => {
    await signIn(page)
    await page.goto(`${addresses().app}#/type/Patient`)
    await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible({ timeout: 30_000 })

    const first = await page.getByRole('table').textContent()

    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByRole('table')).not.toHaveText(first ?? '', { timeout: 30_000 })

    const second = await page.getByRole('table').textContent()

    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByRole('table')).not.toHaveText(second ?? '', { timeout: 30_000 })
    await shoot(page, '25-third-page')

    await expect(page.getByRole('button', { name: 'Previous page' })).toBeVisible()
  })

  test('narrows thousands to a few by a declared parameter', async ({ page }) => {
    await signIn(page)
    await page.goto(`${addresses().app}#/type/Patient`)
    await expect(page.getByText(/^Found: /)).toBeVisible({ timeout: 30_000 })

    const before = Number((await page.getByText(/^Found: /).textContent())?.replace(/[^0-9]/g, '') ?? '0')

    await page.getByLabel('family').fill('Nakamura')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page.getByTestId('asked')).toContainText('family=Nakamura', { timeout: 30_000 })
    await page.waitForTimeout(1500)
    await shoot(page, '26-narrowed')

    const after = Number((await page.getByText(/^Found: /).textContent())?.replace(/[^0-9]/g, '') ?? '0')

    expect(after).toBeLessThan(before)
    expect(after).toBeGreaterThan(0)
  })

  test('shows the sites a practice holds', async ({ page }) => {
    const held = populated()

    await signIn(page)
    await page.goto(`${addresses().app}#/type/Organization`)
    await expect(page.getByText(/^Found: /)).toBeVisible({ timeout: 30_000 })

    const found = Number((await page.getByText(/^Found: /).textContent())?.replace(/[^0-9]/g, '') ?? '0')

    await shoot(page, '27-many-sites')

    expect(found).toBeGreaterThanOrEqual(held.sites)
  })

  test('draws the graph around a patient of a busy practice', async ({ page }) => {
    await signIn(page)
    await page.goto(`${addresses().app}#/type/Patient`)
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30_000 })

    await page.getByRole('table').getByRole('link').first().click()
    await expect(page.getByRole('link', { name: 'Open in the graph' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('link', { name: 'Open in the graph' }).click()

    await expect(page.getByTestId('size')).not.toHaveText('0', { timeout: 30_000 })
    await page.waitForTimeout(2000)
    await shoot(page, '28-graph-busy')
  })
})
