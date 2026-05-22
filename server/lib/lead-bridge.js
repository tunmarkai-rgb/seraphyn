const crypto = require('crypto')

function getLeadSecrets() {
  return [
    process.env.LEAD_BRIDGE_SECRET,
    process.env.GHL_WORKFLOW_WEBHOOK_SECRET,
    process.env.N8N_WEBHOOK_SECRET
  ].filter(Boolean)
}

function getLeadSecret() {
  return getLeadSecrets()[0] || ''
}

function base64UrlEncode(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(value) {
  const normalized = String(value)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
  return Buffer.from(padded, 'base64').toString('utf8')
}

function signPayload(payload) {
  const secret = getLeadSecret()
  if (!secret) {
    throw new Error('LEAD_BRIDGE_SECRET is required for nurse lead tokens')
  }

  const body = {
    ...payload,
    exp: payload.exp || (Date.now() + (60 * 60 * 1000))
  }

  const encoded = base64UrlEncode(JSON.stringify(body))
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

  return `${encoded}.${signature}`
}

function verifyPayload(token) {
  const secret = getLeadSecret()
  if (!secret) {
    throw new Error('LEAD_BRIDGE_SECRET is required for nurse lead tokens')
  }

  const [encoded, signature] = String(token || '').split('.')
  if (!encoded || !signature) {
    throw new Error('Invalid lead token format')
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error('Invalid lead token signature')
  }

  const payload = JSON.parse(base64UrlDecode(encoded))
  if (!payload.exp || Number(payload.exp) < Date.now()) {
    throw new Error('Lead token expired')
  }

  return payload
}

module.exports = {
  getLeadSecrets,
  signPayload,
  verifyPayload
}
