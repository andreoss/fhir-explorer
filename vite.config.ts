import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  plugins: [solid({ hot: mode !== 'test' })],
  build: {
    target: 'es2022'
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}']
  }
}))
