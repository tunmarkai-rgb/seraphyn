const axios = require('axios')

const GHL_BASE_URL = 'https://services.leadconnectorhq.com'

function getRequiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} environment variable is required`)
  }
  return value
}

function getClient() {
  const apiKey = getRequiredEnv('GHL_API_KEY')

  return axios.create({
    baseURL: GHL_BASE_URL,
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  })
}

function extractDocumentReference(data) {
  return (
    data?.links?.[0]?.referenceId ||
    data?.links?.[0]?.documentId ||
    data?.links?.[0]?._id ||
    data?.id ||
    data?._id ||
    data?.documentId ||
    data?.proposalId ||
    data?.submissionId ||
    data?.document?.id ||
    data?.proposal?.id ||
    data?.data?.id ||
    data?.data?._id ||
    null
  )
}

function extractContactId(data) {
  return (
    data?.contact?.id ||
    data?.contact?._id ||
    data?.id ||
    data?._id ||
    data?.data?.contact?.id ||
    data?.data?.id ||
    null
  )
}

async function sendContractTemplate({ contactId, contractName }) {
  const client = getClient()
  const locationId = getRequiredEnv('GHL_LOCATION_ID')
  const templateId = getRequiredEnv('GHL_DOCUMENT_TEMPLATE_ID')
  const userId = getRequiredEnv('GHL_USER_ID')

  const payload = {
    locationId,
    templateId,
    contactId,
    userId
  }

  const { data } = await client.post('/proposals/templates/send', payload)

  return {
    data,
    referenceId: extractDocumentReference(data)
  }
}

async function upsertContact(contactData) {
  const client = getClient()
  const locationId = getRequiredEnv('GHL_LOCATION_ID')

  const payload = {
    locationId,
    ...contactData
  }

  const { data } = await client.post('/contacts/upsert', payload)

  return {
    data,
    contactId: extractContactId(data),
    isNew: Boolean(data?.new)
  }
}

function normalizeLabel(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function getPipelines() {
  const client = getClient()
  const locationId = getRequiredEnv('GHL_LOCATION_ID')
  const { data } = await client.get('/opportunities/pipelines', {
    params: { locationId }
  })

  return data?.pipelines || data?.data?.pipelines || []
}

function findPipelineByName(pipelines, pipelineName) {
  const target = normalizeLabel(pipelineName)
  return pipelines.find((pipeline) => normalizeLabel(pipeline.name) === target)
    || pipelines.find((pipeline) => normalizeLabel(pipeline.name).includes(target))
    || pipelines.find((pipeline) => target.includes(normalizeLabel(pipeline.name)))
    || null
}

function findStageByName(pipeline, stageName) {
  const target = normalizeLabel(stageName)
  const stages = pipeline?.stages || []

  return stages.find((stage) => normalizeLabel(stage.name) === target)
    || stages.find((stage) => normalizeLabel(stage.name).includes(target))
    || stages.find((stage) => target.includes(normalizeLabel(stage.name)))
    || null
}

async function searchOpportunities({ contactId, pipelineId, status = 'open', limit = 20 }) {
  const client = getClient()
  const locationId = getRequiredEnv('GHL_LOCATION_ID')
  const { data } = await client.get('/opportunities/search', {
    params: {
      location_id: locationId,
      contact_id: contactId,
      pipeline_id: pipelineId,
      status,
      limit
    }
  })

  return data?.opportunities || []
}

async function createOpportunity(opportunityData) {
  const client = getClient()
  const locationId = getRequiredEnv('GHL_LOCATION_ID')
  const { data } = await client.post('/opportunities/', {
    locationId,
    ...opportunityData
  })

  return data?.opportunity || data?.data?.opportunity || data
}

async function getOpportunity(opportunityId) {
  const client = getClient()
  const { data } = await client.get(`/opportunities/${opportunityId}`)
  return data?.opportunity || data?.data?.opportunity || data
}

async function updateOpportunity(opportunityId, updates) {
  const client = getClient()
  const { data } = await client.put(`/opportunities/${opportunityId}`, updates)
  return data?.opportunity || data?.data?.opportunity || data
}

async function syncOpportunityStageByContact({
  contactId,
  pipelineName,
  stageName,
  opportunityId = null,
  name,
  status = 'open',
  assignedTo = null,
  preventRegression = false
}) {
  if (!contactId || !pipelineName || !stageName) {
    return { skipped: true, reason: 'Missing contact or pipeline stage data' }
  }

  const pipelines = await getPipelines()
  const pipeline = findPipelineByName(pipelines, pipelineName)
  if (!pipeline?.id) {
    throw new Error(`GHL pipeline not found: ${pipelineName}`)
  }

  const stage = findStageByName(pipeline, stageName)
  if (!stage?.id) {
    throw new Error(`GHL pipeline stage not found: ${stageName}`)
  }

  if (opportunityId) {
    const existing = await getOpportunity(opportunityId)
    const currentStage = (pipeline.stages || []).find((item) => item.id === existing?.pipelineStageId) || null
    const currentPosition = currentStage?.position ?? -1
    const targetPosition = stage.position ?? -1

    if (preventRegression && currentPosition >= 0 && targetPosition >= 0 && currentPosition >= targetPosition) {
      return {
        success: true,
        opportunity: existing,
        action: 'kept',
        pipeline,
        stage: currentStage || stage
      }
    }

    const updated = await updateOpportunity(opportunityId, {
      pipelineId: pipeline.id,
      pipelineStageId: stage.id,
      ...(name ? { name } : {}),
      ...(status ? { status } : {}),
      ...(assignedTo ? { assignedTo } : {})
    })

    return {
      success: true,
      opportunity: updated,
      action: 'updated',
      pipeline,
      stage
    }
  }

  const opportunities = await searchOpportunities({
    contactId,
    pipelineId: pipeline.id,
    status: 'open',
    limit: 20
  })

  const opportunity = opportunities[0] || null
  if (opportunity?.id) {
    const currentStage = (pipeline.stages || []).find((item) => item.id === opportunity.pipelineStageId) || null
    const currentPosition = currentStage?.position ?? -1
    const targetPosition = stage.position ?? -1

    if (preventRegression && currentPosition >= 0 && targetPosition >= 0 && currentPosition >= targetPosition) {
      return {
        success: true,
        opportunity,
        action: 'kept',
        pipeline,
        stage: currentStage || stage
      }
    }

    const updated = await updateOpportunity(opportunity.id, {
      pipelineId: pipeline.id,
      pipelineStageId: stage.id,
      ...(name ? { name } : {}),
      ...(status ? { status } : {}),
      ...(assignedTo ? { assignedTo } : {})
    })

    return {
      success: true,
      opportunity: updated,
      action: 'updated',
      pipeline,
      stage
    }
  }

  const created = await createOpportunity({
    pipelineId: pipeline.id,
    pipelineStageId: stage.id,
    contactId,
    name: name || `${pipeline.name} - ${stage.name}`,
    status,
    ...(assignedTo ? { assignedTo } : {})
  })

  return {
    success: true,
    opportunity: created,
    action: 'created',
    pipeline,
    stage
  }
}

module.exports = {
  sendContractTemplate,
  extractDocumentReference,
  upsertContact,
  extractContactId,
  getOpportunity,
  getPipelines,
  searchOpportunities,
  createOpportunity,
  updateOpportunity,
  syncOpportunityStageByContact
}
