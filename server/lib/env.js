const DEFAULT_CLIENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]

function splitCsv(value = '') {
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function getAllowedOrigins() {
  const configured = new Set([
    ...DEFAULT_CLIENT_ORIGINS,
    ...splitCsv(process.env.CLIENT_URL),
    ...splitCsv(process.env.CLIENT_URLS),
    ...splitCsv(process.env.CORS_ORIGINS),
    ...splitCsv(process.env.VERCEL_FRONTEND_URL)
  ])

  return Array.from(configured)
}

function getMissingRequiredEnv() {
  const missing = []

  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_KEY) {
    missing.push('SUPABASE_SECRET_KEY')
  }

  return missing
}

module.exports = {
  getAllowedOrigins,
  getMissingRequiredEnv
}
