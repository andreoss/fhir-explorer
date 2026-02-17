import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import solid from 'eslint-plugin-solid/configs/typescript'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['dist', 'coverage', 'scratch', 'references', 'test-results', 'playwright-report']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  solid,
  {
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type']
    },
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js']
        }
      }
    }
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    files: ['integration/**/*.ts', 'e2e/**/*.ts', 'tools/**/*.ts'],
    languageOptions: {
      globals: globals.node
    }
  }
)
