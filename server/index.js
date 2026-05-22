const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const express = require('express')
const cors = require('cors')
const { getAllowedOrigins, getMissingRequiredEnv } = require('./lib/env')

// Load env deterministically before any config/routes import. This avoids
// PM2/runtime differences when dotenv's automatic file resolution gets noisy.
const rootEnvPath = path.resolve(__dirname, '..', '.env')
const serverEnvPath = path.resolve(__dirname, '.env')
const envPath = fs.existsSync(rootEnvPath) ? rootEnvPath : serverEnvPath

if (fs.existsSync(envPath)) {
  const parsedEnv = dotenv.parse(fs.readFileSync(envPath))

  for (const [key, value] of Object.entries(parsedEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

const app = express()
const PORT = process.env.PORT || 5000
const allowedOrigins = getAllowedOrigins()

function captureRawBody(req, res, buffer) {
  if (buffer?.length) {
    req.rawBody = buffer.toString('utf8')
  }
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`))
  },
  credentials: true
}))
app.use(express.json({ verify: captureRawBody }))
app.use(express.urlencoded({ extended: true }))

function getRuntimeSummary() {
  return {
    status: 'ok',
    service: 'seraphyn-api',
    allowedOrigins,
    timestamp: new Date().toISOString()
  }
}

app.get('/healthz', (req, res) => {
  res.json(getRuntimeSummary())
})

app.get('/api/ready', (req, res) => {
  const missingEnv = getMissingRequiredEnv()

  if (missingEnv.length) {
    return res.status(503).json({
      status: 'error',
      message: 'Missing required environment variables',
      missingEnv
    })
  }

  return res.json({
    ...getRuntimeSummary(),
    message: 'Required environment variables present'
  })
})

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const { supabase } = require('./config/supabase')
    const { data, error } = await supabase.from('users').select('count').limit(1)
    if (error) throw error
    res.json({
      ...getRuntimeSummary(),
      message: 'Seraphyn server is running',
      database: 'connected'
    })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      service: 'seraphyn-api',
      message: err.message,
      database: 'disconnected',
      timestamp: new Date().toISOString()
    })
  }
})

// Routes
app.use('/api/auth',      require('./routes/auth'))
app.use('/api/nurses',    require('./routes/nurses'))
app.use('/api/employers', require('./routes/employers'))
app.use('/api/jobs',      require('./routes/jobs'))
app.use('/api/admin',     require('./routes/admin'))
app.use('/api/integrations', require('./routes/integrations'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/leads', require('./routes/leads'))
app.use('/api/messages', require('./routes/messages'))
app.use('/api/payments',  require('./routes/payments'))
app.use('/api/contracts', require('./routes/contracts'))
app.use('/api/webhooks',  require('./routes/webhooks'))

app.listen(PORT, () => {
  console.log(`Seraphyn server running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
  console.log(`Readiness check: http://localhost:${PORT}/api/ready`)
  console.log(`Allowed client origins: ${allowedOrigins.join(', ')}`)
})
