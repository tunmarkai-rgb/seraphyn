const axios = require('axios')

async function sendN8nEvent(event, payload = {}) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET

  if (!webhookUrl) {
    return { skipped: true, reason: 'N8N_WEBHOOK_URL not configured' }
  }

  try {
    await axios.post(
      webhookUrl,
      {
        event,
        payload,
        source: 'seraphyn-portal',
        sentAt: new Date().toISOString()
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          ...(webhookSecret ? { 'x-seraphyn-secret': webhookSecret } : {})
        }
      }
    )

    return { success: true }
  } catch (error) {
    console.error(`[n8n] Failed to send event "${event}":`, error.response?.data || error.message)
    return { success: false, error: error.message }
  }
}

module.exports = { sendN8nEvent }
