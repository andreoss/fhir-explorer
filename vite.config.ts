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
    include: ['src/**/*.test.{ts,tsx}', 'packages/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'packages/*/src/**/*.test.ts',
        'packages/stub/**',
        'src/test/**',
        'src/main.tsx'
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 85
      }
    }
  }
}))
