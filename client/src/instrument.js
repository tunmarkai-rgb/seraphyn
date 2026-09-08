import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
  sendDefaultPii: false,
  tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
  beforeSend(event) {
    if (event.user) event.user = { id: event.user.id }
    if (event.request) {
      event.request = { ...event.request, headers: undefined, cookies: undefined, data: undefined }
    }
    return event
  },
})