import { PostHogProvider } from '@posthog/react'

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST

const options = {
  api_host: POSTHOG_HOST,
} as const

let hasWarnedMissingPostHogConfig = false

function warnMissingPostHogConfig() {
  if (hasWarnedMissingPostHogConfig) {
    return
  }

  hasWarnedMissingPostHogConfig = true
  console.warn(
    'PostHog is disabled. Set VITE_PUBLIC_POSTHOG_KEY and VITE_PUBLIC_POSTHOG_HOST in .env.local to enable analytics.',
  )
}

export default function AppPostHogProvider({
  children,
}: {
  children: React.ReactNode
}) {
  if (!POSTHOG_KEY || !POSTHOG_HOST) {
    warnMissingPostHogConfig()
    return <>{children}</>
  }

  return (
    <PostHogProvider apiKey={POSTHOG_KEY} options={options}>
      {children}
    </PostHogProvider>
  )
}
