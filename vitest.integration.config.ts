import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['integration/**/*.test.ts'],
    globalSetup: ['integration/setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 300_000,
    fileParallelism: false
  }
})
