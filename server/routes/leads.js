const express = require('express')
const router = express.Router()
const { getLeadSecrets, signPayload, verifyPayload } = require('../lib/lead-bridge')

function buildLeadPayload(source = {}) {
  return {
    firstName: source.firstName || source.first_name || '',
    lastName: source.lastName || source.last_name || '',
    email: source.email || '',
    phone: source.phone || '',
    licenseState: source.licenseState || source.license_state || source.state || '',
    specialty: source.specialty || '',
    yearsExperience: source.yearsExperience || source.years_experience || '',
    shiftPreference: source.shiftPreference || source.shift_preference || '',
    source: source.source || 'ghl-form',
    ghlContactId: source.ghlContactId || source.ghl_contact_id || null,
    ghlOpportunityId: source.ghlOpportunityId || source.ghl_opportunity_id || null
  }
}

function hasValidSecret(req) {
  const configured = getLeadSecrets()
  if (!configured.length) return false

  const candidates = [
    req.headers['x-webhook-secret'],
    req.headers['x-seraphyn-secret'],
    req.query.secret,
    req.body?.secret,
    req.body?.xSeraphynSecret,
    req.body?.x_seraphyn_secret,
    req.body?.xWebhookSecret,
    req.body?.x_webhook_secret
  ]
    .flat()
    .map((value) => String(value || '').trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)

  return configured.some((value) => {
    const normalized = String(value || '').trim()
    return candidates.includes(normalized)
  })
}

router.post('/nurse-prefill', async (req, res) => {
  if (!hasValidSecret(req)) {
    return res.status(401).json({ error: 'Invalid lead bridge secret' })
  }

  try {
    const payload = buildLeadPayload(req.body || {})

    const token = signPayload(payload)
    const portalBase = (process.env.CLIENT_URL || process.env.VITE_APP_URL || '').replace(/\/+$/, '')
    const redirectUrl = `${portalBase}/nurse-signup?lead=${encodeURIComponent(token)}`

    res.json({ token, redirectUrl, payload })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/nurse-continue', async (req, res) => {
  try {
    const payload = buildLeadPayload(req.query || {})
    const token = signPayload(payload)
    const portalBase = (process.env.CLIENT_URL || process.env.VITE_APP_URL || '').replace(/\/+$/, '')
    const redirectUrl = `${portalBase}/nurse-signup?lead=${encodeURIComponent(token)}`
    return res.redirect(302, redirectUrl)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

router.get('/nurse-prefill', async (req, res) => {
  try {
    const payload = verifyPayload(req.query.token)
    res.json({ lead: payload })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

module.exports = router
