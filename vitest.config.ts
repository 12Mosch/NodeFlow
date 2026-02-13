import { defineConfig } from 'vitest/config'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'convex',
          environment: 'edge-runtime',
          include: ['convex/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          include: ['src/**/*.test.ts'],
        },
      },
    ],
    server: { deps: { inline: ['convex-test'] } },
  },
})
