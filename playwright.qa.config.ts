import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'qa',
  globalSetup: 'qa/setup.ts',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 900 }
  }
})
