require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check — confirms server and Supabase connection
app.get('/api/health', async (req, res) => {
  try {
    const { supabase } = require('./config/supabase')
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    if (error) throw error
    res.json({
      status: 'ok',
      message: 'Seraphyn server is running',
      database: 'connected',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    })
  }
})

// Routes (we add these one by one)
// app.use('/api/auth', require('./routes/auth'))
// app.use('/api/nurses', require('./routes/nurses'))
// app.use('/api/employers', require('./routes/employers'))
// app.use('/api/jobs', require('./routes/jobs'))
// app.use('/api/admin', require('./routes/admin'))

app.listen(PORT, () => {
  console.log(`Seraphyn server running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
})