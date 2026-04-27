const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { syncEmployerContactById, syncNurseContactById } = require('../lib/ghl-sync')
const { dispatchPortalEvent } = require('../lib/portal-events')

router.post('/ghl/sync-self', requireAuth, requireRole('nurse', 'employer'), async (req, res) => {
  try {
    if (req.user.role === 'employer') {
      const { data: employer } = await supabase
        .from('employer_profiles')
        .select('id')
        .eq('user_id', req.user.id)
        .single()

      if (!employer?.id) {
        return res.status(404).json({ error: 'Employer profile not found' })
      }

      const result = await syncEmployerContactById(employer.id)
      return res.json({ role: 'employer', ...result })
    }

    const { data: nurse } = await supabase
      .from('nurse_profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .single()

    if (!nurse?.id) {
      return res.status(404).json({ error: 'Nurse profile not found' })
    }

    const result = await syncNurseContactById(nurse.id)
    return res.json({ role: 'nurse', ...result })
  } catch (error) {
    console.error('Self GHL sync failed:', error.response?.data || error.message)
    return res.status(502).json({
      error: 'Failed to sync contact with GHL',
      details: error.response?.data || error.message
    })
  }
})

router.post('/events/self', requireAuth, requireRole('nurse', 'employer'), async (req, res) => {
  const { event, payload = {} } = req.body || {}

  const allowedEventsByRole = {
    nurse: new Set(['nurse.signup_confirmed', 'nurse.document_uploaded']),
    employer: new Set(['employer.signup_confirmed'])
  }

  if (!event || !allowedEventsByRole[req.user.role]?.has(event)) {
    return res.status(400).json({ error: 'Unsupported event for current role' })
  }

  try {
    if (req.user.role === 'nurse') {
      const { data: nurse } = await supabase
        .from('nurse_profiles')
        .select('id, specialty, license_state')
        .eq('user_id', req.user.id)
        .single()

      if (!nurse?.id) {
        return res.status(404).json({ error: 'Nurse profile not found' })
      }

      await dispatchPortalEvent(event, {
        nurseId: nurse.id,
        nurseUserId: req.user.id,
        email: req.user.email,
        fullName: req.user.full_name,
        specialty: nurse.specialty,
        licenseState: nurse.license_state,
        ...payload
      }, {
        sync: { type: 'nurse', id: nurse.id }
      })

      return res.json({ message: 'Event forwarded to n8n', event })
    }

    const { data: employer } = await supabase
      .from('employer_profiles')
      .select('id, org_name, onboarding_stage')
      .eq('user_id', req.user.id)
      .single()

    if (!employer?.id) {
      return res.status(404).json({ error: 'Employer profile not found' })
    }

    await dispatchPortalEvent(event, {
      employerId: employer.id,
      employerUserId: req.user.id,
      email: req.user.email,
      fullName: req.user.full_name,
      orgName: employer.org_name,
      onboardingStage: employer.onboarding_stage,
      ...payload
    }, {
      sync: { type: 'employer', id: employer.id }
    })

    return res.json({ message: 'Event forwarded to n8n', event })
  } catch (error) {
    console.error('Failed to forward self event to n8n:', error.response?.data || error.message)
    return res.status(502).json({
      error: 'Failed to forward event to n8n',
      details: error.response?.data || error.message
    })
  }
})

module.exports = router
