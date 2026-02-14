import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import posthog from '@posthog/rollup-plugin'

const config = defineConfig(({ command, mode }) => {
  let posthogRollupPlugins: Array<ReturnType<typeof posthog>> = []

  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), '') as Partial<
      Record<string, string>
    >
    const posthogApiKey = env.POSTHOG_API_KEY?.trim()
    const posthogEnvIdRaw = env.POSTHOG_ENV_ID?.trim()
    const posthogEnvId =
      posthogEnvIdRaw && /^\d+$/.test(posthogEnvIdRaw)
        ? posthogEnvIdRaw
        : undefined
    const posthogHost = env.POSTHOG_HOST || env.VITE_PUBLIC_POSTHOG_HOST

    if (posthogApiKey && posthogEnvIdRaw && !posthogEnvId) {
      console.warn(
        'Skipping PostHog source map upload: POSTHOG_ENV_ID must be numeric.',
      )
    }

    if (posthogApiKey && posthogEnvId) {
      posthogRollupPlugins = [
        posthog({
          personalApiKey: posthogApiKey,
          envId: posthogEnvId,
          host: posthogHost,
        }),
      ]
    }
  }

  return {
    build: {
      sourcemap: 'hidden',
      rollupOptions: {
        plugins: posthogRollupPlugins,
      },
    },
    plugins: [
      tanstackStart(),
      devtools(),
      nitro(),
      // this is the plugin that enables path aliases
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      viteReact({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
    ],
  }
})

export default config
