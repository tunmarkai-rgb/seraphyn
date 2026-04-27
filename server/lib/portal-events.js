const axios = require('axios')
const { sendN8nEvent } = require('./n8n')
const { syncEmployerContactById, syncNurseContactById } = require('./ghl-sync')

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

async function dispatchPortalEvent(event, payload = {}, options = {}) {
  const syncResult = options.sync ? await syncEntityForEvent(options.sync) : null
  const enrichedPayload = {
    ...payload,
    ...(syncResult?.contactId ? { ghlContactId: syncResult.contactId } : {})
  }

  const [n8n, ghlWorkflow] = await Promise.all([
    sendN8nEvent(event, enrichedPayload),
    sendGhlWorkflowEvent(event, enrichedPayload)
  ])

  return {
    event,
    payload: enrichedPayload,
    sync: syncResult,
    n8n,
    ghlWorkflow
  }
}

module.exports = {
  dispatchPortalEvent,
  sendGhlWorkflowEvent
}
