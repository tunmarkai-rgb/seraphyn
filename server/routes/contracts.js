const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole, requireSessionUser } = require('../middleware/auth')
const { CONTRACT_DEFINITIONS, getContractDownloadUrl } = require('../lib/contracts')

function isEmployerOrAdmin(req) {
  return req.user?.role === 'admin'
    || req.user?.role === 'employer'
    || req.authUser?.user_metadata?.role === 'employer'
}

router.get('/templates/:documentType', requireSessionUser, async (req, res) => {
  try {
    if (!isEmployerOrAdmin(req)) {
      return res.status(403).json({ error: 'Employer or admin access required' })
    }

    const contract = CONTRACT_DEFINITIONS.find((entry) => entry.documentType === req.params.documentType)
    if (!contract) {
      return res.status(404).json({ error: 'Agreement template not found' })
    }

    res.status(410).json({
      error: 'Legacy PDF templates are no longer served. Agreements are rendered and signed from portal-native templates.'
    })
  } catch (error) {
    console.error('Agreement template delivery failed:', error.message)
    res.status(500).json({ error: 'Failed to load agreement template' })
  }
})

router.get('/:id/download', requireAuth, requireRole('admin', 'employer'), async (req, res) => {
  try {
    const { data: contract, error } = await supabase
      .from('contracts')
      .select('id, employer_id, signed_storage_path, signed_url')
      .eq('id', req.params.id)
      .single()

    if (error || !contract) {
      return res.status(404).json({ error: 'Contract not found' })
    }

    if (req.user.role === 'employer') {
      const { data: employer } = await supabase
        .from('employer_profiles')
        .select('id')
        .eq('user_id', req.user.id)
        .single()

      if (!employer?.id || employer.id !== contract.employer_id) {
        return res.status(403).json({ error: 'Not authorized to access this contract' })
      }
    }

    const storagePath = contract.signed_storage_path || contract.signed_url
    if (!storagePath) {
      return res.status(404).json({ error: 'Signed contract file not found' })
    }

    const signedUrl = await getContractDownloadUrl(storagePath)
    res.json({ url: signedUrl })
  } catch (error) {
    console.error('Contract download failed:', error.message)
    res.status(500).json({ error: 'Failed to prepare contract download' })
  }
})

module.exports = router
