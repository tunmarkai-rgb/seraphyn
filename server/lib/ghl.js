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

module.exports = { sendContractTemplate, extractDocumentReference, upsertContact, extractContactId }
