require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 5000

function captureRawBody(req, res, buffer) {
  if (buffer?.length) {
    req.rawBody = buffer.toString('utf8')
  }
}

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json({ verify: captureRawBody }))
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const { supabase } = require('./config/supabase')
    const { data, error } = await supabase.from('users').select('count').limit(1)
    if (error) throw error
    res.json({ status: 'ok', message: 'Seraphyn server is running', database: 'connected', timestamp: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message })
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
})
