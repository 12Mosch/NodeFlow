import * as Sentry from '@sentry/tanstackstart-react'
Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
})
