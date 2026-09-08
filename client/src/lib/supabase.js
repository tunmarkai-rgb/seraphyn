import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
const configuredAppUrl = import.meta.env.VITE_APP_URL

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables')
}

export function getAppBaseUrl() {
  if (configuredAppUrl) {
    return configuredAppUrl.replace(/\/+$/, '')
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return ''
}

// Supabase surfaces transport failures as a bare "Failed to fetch"
// (AuthRetryableFetchError), which reads to users like a rejected password.
// Distinguish "we never reached the server" from a real auth rejection.
export function isNetworkError(error) {
  if (!error) return false
  if (error.name === 'AuthRetryableFetchError') return true
  if (error.status === 0) return true
  return /failed to fetch|networkerror|load failed|network request failed/i.test(
    error.message || '',
  )
}

export function describeAuthError(error) {
  if (!error) return ''
  if (isNetworkError(error)) {
    return `Cannot reach the authentication server (${supabaseUrl}). Check your connection, then confirm the Supabase project is active and not paused.`
  }
  return error.message || 'Something went wrong. Please try again.'
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
