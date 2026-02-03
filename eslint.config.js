import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import solid from 'eslint-plugin-solid/configs/typescript'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['dist', 'coverage', 'scratch', 'references']),
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
  }
)
