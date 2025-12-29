// @ts-check

import reactHooks from 'eslint-plugin-react-hooks'
import { tanstackConfig } from '@tanstack/eslint-config'
import { defineConfig } from 'eslint/config'
import prettierConfig from 'eslint-config-prettier/flat'
import pluginQuery from '@tanstack/eslint-plugin-query'
import pluginRouter from '@tanstack/eslint-plugin-router'
import vitest from 'eslint-plugin-vitest'

export default defineConfig([
  {
    ignores: [
      'convex/_generated/**',
      '.output/**',
      'src/routeTree.gen.ts',
      'eslint.config.js',
      'prettier.config.js',
    ],
  },
  ...tanstackConfig,
  ...pluginQuery.configs['flat/recommended'],
  ...pluginRouter.configs['flat/recommended'],
  reactHooks.configs.flat.recommended,
  vitest.configs.recommended,
  prettierConfig,
])
