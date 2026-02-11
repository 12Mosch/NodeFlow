import { PostHogProvider } from '@posthog/react'
import type { PostHogConfig } from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST
const IS_PRODUCTION = import.meta.env.PROD

const options = {
  api_host: POSTHOG_HOST,
  defaults: '2026-01-30',
  capture_pageview: 'history_change',
  capture_pageleave: true,
  // Session Replay is intentionally enabled only for production builds.
  disable_session_recording: !IS_PRODUCTION,
  session_recording: {
    // Keep balanced defaults and support explicit masking at the component level.
    maskTextSelector: '[data-ph-mask]',
    blockSelector: '[data-ph-no-capture]',
  },
} satisfies Partial<PostHogConfig>

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
