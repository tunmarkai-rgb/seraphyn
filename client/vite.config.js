import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const sentryBuildEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT,
)

const sentryBuildPlugin = sentryBuildEnabled
  ? sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: process.env.SENTRY_RELEASE ? { name: process.env.SENTRY_RELEASE } : undefined,
      sourcemaps: {
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
    })
  : null

export default defineConfig({
  build: {
    sourcemap: sentryBuildEnabled ? 'hidden' : false,
  },
  plugins: [react(), ...(sentryBuildPlugin ? [sentryBuildPlugin] : [])],
})