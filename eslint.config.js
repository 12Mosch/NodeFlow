//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
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
]
