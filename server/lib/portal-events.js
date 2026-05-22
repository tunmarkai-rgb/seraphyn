const axios = require('axios')
const { sendN8nEvent } = require('./n8n')
const { syncEmployerContactById, syncNurseContactById } = require('./ghl-sync')
const { syncOpportunityStageByContact } = require('./ghl')

function toEnvSuffix(event) {
  return String(event || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
}

function getGhlWorkflowWebhookUrl(event) {
  const eventKey = `GHL_WORKFLOW_WEBHOOK_URL_${toEnvSuffix(event)}`
  return process.env[eventKey] || process.env.GHL_WORKFLOW_WEBHOOK_URL || ''
}

async function sendGhlWorkflowEvent(event, payload = {}) {
  const webhookUrl = getGhlWorkflowWebhookUrl(event)
  const webhookSecret = process.env.GHL_WORKFLOW_WEBHOOK_SECRET

  if (!webhookUrl) {
    return { skipped: true, reason: 'GHL workflow webhook URL not configured' }
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
          ...(webhookSecret ? {
            'x-webhook-secret': webhookSecret,
            'x-seraphyn-secret': webhookSecret
          } : {})
        }
      }
    )

    return { success: true }
  } catch (error) {
    console.error(`[ghl-workflow] Failed to send event "${event}":`, error.response?.data || error.message)
    return { success: false, error: error.message }
  }
}

async function syncEntityForEvent(sync) {
  if (!sync?.type || !sync?.id) {
    return { skipped: true, reason: 'No sync target provided' }
  }

  try {
    if (sync.type === 'employer') {
      return await syncEmployerContactById(sync.id)
    }

    if (sync.type === 'nurse') {
      return await syncNurseContactById(sync.id)
    }

    return { skipped: true, reason: `Unsupported sync type: ${sync.type}` }
  } catch (error) {
    console.error(`[portal-events] Failed to sync ${sync.type} ${sync.id}:`, error.response?.data || error.message)
    return { success: false, error: error.message }
  }
}

function getNurseOpportunityTarget(event) {
  switch (event) {
    case 'nurse.signup_confirmed':
      return { pipelineName: 'Seraphyn - Nurse Talent Pipeline', stageName: 'Application Review', preventRegression: true }
    case 'nurse.profile_completed':
      return { pipelineName: 'Seraphyn - Nurse Talent Pipeline', stageName: 'Application Review', preventRegression: true }
    case 'nurse.document_uploaded':
      return { pipelineName: 'Seraphyn - Nurse Talent Pipeline', stageName: 'Credentialing In Progress', preventRegression: true }
    case 'nurse.job_matched':
      return { pipelineName: 'Seraphyn - Nurse Talent Pipeline', stageName: 'Job Matched', preventRegression: true }
    case 'application.interview_scheduled':
      return { pipelineName: 'Seraphyn - Nurse Talent Pipeline', stageName: 'Interview Scheduled', preventRegression: true }
    case 'application.hired':
      return { pipelineName: 'Seraphyn - Nurse Talent Pipeline', stageName: 'Placed', preventRegression: true }
    default:
      return null
  }
}

async function syncOpportunityForEvent(event, payload = {}) {
  const target = getNurseOpportunityTarget(event)
  if (!target || !payload.ghlContactId) {
    return { skipped: true, reason: 'No opportunity stage sync target for event' }
  }

  const fallbackName = [
    payload.fullName,
    payload.email,
    payload.orgName,
    payload.specialty && `Nurse - ${payload.specialty}`
  ].filter(Boolean)[0] || `Seraphyn Nurse Candidate`

  try {
    return await syncOpportunityStageByContact({
      contactId: payload.ghlContactId,
      pipelineName: target.pipelineName,
      stageName: target.stageName,
      preventRegression: target.preventRegression,
      opportunityId: payload.ghlOpportunityId || null,
      name: fallbackName
    })
  } catch (error) {
    console.error(`[ghl-opportunity] Failed to sync stage for "${event}":`, error.response?.data || error.message)
    return { success: false, error: error.message }
  }
}

async function dispatchPortalEvent(event, payload = {}, options = {}) {
  const syncResult = options.sync ? await syncEntityForEvent(options.sync) : null
  const enrichedPayload = {
    ...payload,
    ...(syncResult?.contactId ? { ghlContactId: syncResult.contactId } : {})
  }

  const [n8n, ghlWorkflow, ghlOpportunity] = await Promise.all([
    sendN8nEvent(event, enrichedPayload),
    sendGhlWorkflowEvent(event, enrichedPayload),
    syncOpportunityForEvent(event, enrichedPayload)
  ])

  return {
    event,
    payload: enrichedPayload,
    sync: syncResult,
    n8n,
    ghlWorkflow,
    ghlOpportunity
  }
}

module.exports = {
  dispatchPortalEvent,
  sendGhlWorkflowEvent
}
