// Shared secrets a GHL workflow may present to POST /api/leads/ghl.
// LEAD_BRIDGE_SECRET is the dedicated one; the others are accepted so an
// existing GHL workflow keeps working while it is moved over.
function getLeadSecrets() {
  return [
    process.env.LEAD_BRIDGE_SECRET,
    process.env.GHL_WORKFLOW_WEBHOOK_SECRET,
    process.env.N8N_WEBHOOK_SECRET
  ].filter(Boolean)
}

module.exports = {
  getLeadSecrets
}
