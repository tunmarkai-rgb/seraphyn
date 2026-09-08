const Sentry = require('@sentry/node')

const dsn = process.env.SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE || undefined,
  sendDefaultPii: false,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  beforeSend(event) {
    if (event.user) event.user = { id: event.user.id }
    if (event.request) {
      event.request = { ...event.request, headers: undefined, cookies: undefined, data: undefined }
    }
    return event
  },
})

module.exports = Sentry