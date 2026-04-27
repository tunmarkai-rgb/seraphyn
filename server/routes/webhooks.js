const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const crypto = require('crypto')
const { dispatchPortalEvent } = require('../lib/portal-events')

const GHL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`

const GHL_LEGACY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function verifyGhlWebhook(req) {
  const rawBody = req.rawBody || JSON.stringify(req.body || {})
  const officialSignature = req.headers['x-ghl-signature']
  if (officialSignature && officialSignature !== 'N/A') {
    try {
      const payloadBuffer = Buffer.from(rawBody, 'utf8')
      const signatureBuffer = Buffer.from(String(officialSignature), 'base64')
      return crypto.verify(null, payloadBuffer, GHL_PUBLIC_KEY, signatureBuffer)
    } catch {
      return false
    }
  }

  const legacySignature = req.headers['x-wh-signature']
  if (legacySignature && legacySignature !== 'N/A') {
    try {
      const verifier = crypto.createVerify('SHA256')
      verifier.update(rawBody)
      verifier.end()
      return verifier.verify(GHL_LEGACY_PUBLIC_KEY, String(legacySignature), 'base64')
    } catch {
      return false
    }
  }

  const configuredSecret = process.env.GHL_WEBHOOK_SECRET
  if (!configuredSecret) return true

  const sharedSecret = (
    req.headers['x-ghl-webhook-secret'] ||
    req.headers['x-webhook-secret'] ||
    req.headers['x-seraphyn-secret'] ||
    req.query.secret
  )

  if (sharedSecret && timingSafeEqual(sharedSecret, configuredSecret)) {
    return true
  }

  const signature = req.headers['x-signature']
  if (!signature) return false

  const expectedHex = crypto.createHmac('sha256', configuredSecret).update(rawBody).digest('hex')
  const expectedBase64 = crypto.createHmac('sha256', configuredSecret).update(rawBody).digest('base64')

  return timingSafeEqual(signature, expectedHex) || timingSafeEqual(signature, expectedBase64)
}

function extractEventType(body) {
  return body?.type || body?.eventType || body?.event || body?.name || ''
}

function extractSignedUrl(body) {
  return (
    body?.data?.document?.url ||
    body?.data?.signedDocumentUrl ||
    body?.document?.url ||
    body?.documentUrl ||
    body?.signedUrl ||
    null
  )
}

function extractReferenceId(body) {
  return (
    body?.data?.document?.id ||
    body?.data?.submissionId ||
    body?.data?.documentId ||
    body?.document?.id ||
    body?.submissionId ||
    body?.documentId ||
    body?.proposalId ||
    null
  )
}

function extractEmail(body) {
  return (
    body?.data?.contact?.email ||
    body?.data?.email ||
    body?.contact?.email ||
    body?.contactEmail ||
    body?.email ||
    null
  )
}

// POST /api/webhooks/ghl — GoHighLevel webhook (Contract 2)
router.post('/ghl', async (req, res) => {
  if (!verifyGhlWebhook(req)) {
    return res.status(401).json({ error: 'Invalid GHL webhook signature' })
  }

  const eventType = extractEventType(req.body)

  try {
    if (eventType !== 'DocumentSigned') {
      return res.json({ received: true, ignored: true, eventType })
    }

    const referenceId = extractReferenceId(req.body)
    const signedUrl = extractSignedUrl(req.body)
    const email = extractEmail(req.body)

    let employerQuery = supabase
      .from('employer_profiles')
      .select('id, user_id, org_name, users!inner(email)')

    if (referenceId) {
      const { data: contract } = await supabase
        .from('contracts')
        .select('id, employer_id')
        .eq('docuseal_submission_id', referenceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (contract?.employer_id) {
        employerQuery = employerQuery.eq('id', contract.employer_id)
      } else if (email) {
        employerQuery = employerQuery.eq('users.email', email)
      }
    } else if (email) {
      employerQuery = employerQuery.eq('users.email', email)
    } else {
      return res.status(400).json({ error: 'Unable to match signed contract to employer' })
    }

    const { data: employer, error: employerError } = await employerQuery.single()
    if (employerError || !employer) {
      return res.status(404).json({ error: 'Employer not found for signed contract' })
    }

    const now = new Date().toISOString()
    const contractPayload = {
      employer_id: employer.id,
      status: 'signed',
      signed_at: now,
      ...(signedUrl ? { signed_url: signedUrl } : {}),
      ...(referenceId ? { docuseal_submission_id: referenceId } : {})
    }

    const { data: existingContract } = await supabase
      .from('contracts')
      .select('id')
      .eq('employer_id', employer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingContract?.id) {
      await supabase
        .from('contracts')
        .update(contractPayload)
        .eq('id', existingContract.id)
    } else {
      await supabase
        .from('contracts')
        .insert(contractPayload)
    }

    await supabase
      .from('employer_profiles')
      .update({
        contract_signed: true,
        contract_signed_at: now,
        updated_at: now
      })
      .eq('id', employer.id)

    void dispatchPortalEvent('employer.contract_signed', {
      employerId: employer.id,
      employerUserId: employer.user_id,
      orgName: employer.org_name,
      signedUrl,
      referenceId
    }, {
      sync: { type: 'employer', id: employer.id }
    })

    res.json({ received: true, eventType, employerId: employer.id })
  } catch (err) {
    console.error('GHL webhook handler error:', err.response?.data || err.message)
    res.status(500).json({ error: 'GHL webhook processing failed' })
  }
})

module.exports = router
