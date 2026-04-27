require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { getAllowedOrigins, getMissingRequiredEnv } = require('./lib/env')

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
app.use('/api/payments',  require('./routes/payments'))
app.use('/api/webhooks',  require('./routes/webhooks'))

app.listen(PORT, () => {
  console.log(`Seraphyn server running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
  console.log(`Readiness check: http://localhost:${PORT}/api/ready`)
  console.log(`Allowed client origins: ${allowedOrigins.join(', ')}`)
})
