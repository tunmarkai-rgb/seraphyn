const crypto = require('crypto')
const express = require('express')
const router = express.Router()
const { getLeadSecrets } = require('../lib/lead-bridge')
const { ingestGhlLead } = require('../lib/leads')

function secretMatches(candidate, configured) {
  const left = Buffer.from(String(candidate))
  const right = Buffer.from(String(configured))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

// GHL workflow webhook actions can only send static headers or body values, so
// the secret is accepted from either. The query string is not accepted: URLs
// end up in logs.
function hasValidSecret(req) {
  const configured = getLeadSecrets().map((value) => String(value).trim()).filter(Boolean)
  if (!configured.length) return false

  const candidates = [
    req.headers['x-seraphyn-secret'],
    req.headers['x-webhook-secret'],
    req.body?.secret,
    req.body?.customData?.secret
  ]
    .flat()
    .map((value) => String(value || '').trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)

  return candidates.some((candidate) => configured.some((value) => secretMatches(candidate, value)))
}

// POST /api/leads/ghl -- a GHL nurse or employer form submission, forwarded by
// a GHL workflow "Webhook" action. Stores the lead, merges it into an existing
// confirmed account, or emails the person a link to create their login.
router.post('/ghl', async (req, res) => {
  if (!hasValidSecret(req)) {
    return res.status(401).json({ error: 'Invalid lead intake secret' })
  }

  try {
    const { lead, signupUrl, status } = await ingestGhlLead(req.body || {})
    res.json({ ok: true, leadId: lead.id, role: lead.role, status, signupUrl })
  } catch (error) {
    console.error('GHL lead intake failed:', error.message)
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to record lead' })
  }
})

// The signed-token nurse bridge this replaces. /nurse-continue minted a token
// for anyone who called it, and the token never reached the browser anyway.
router.all(['/nurse-prefill', '/nurse-continue'], (req, res) => {
  res.status(410).json({ error: 'Retired. GHL forms now post to /api/leads/ghl.' })
})

module.exports = router
