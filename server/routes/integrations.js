const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { syncEmployerContactById, syncNurseContactById } = require('../lib/ghl-sync')
const { dispatchPortalEvent } = require('../lib/portal-events')
const { syncNurseCompletionByUserId } = require('../lib/nurse-completion')
const { notifyAdmins } = require('../lib/notifications')

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
        .select('id, specialty, license_state, ghl_contact_id')
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
        ghlContactId: nurse.ghl_contact_id || null,
        ...payload
      }, {
        sync: { type: 'nurse', id: nurse.id }
      })

      if (event === 'nurse.signup_confirmed') {
        await notifyAdmins({
          type: 'nurse.signup_confirmed',
          title: 'New nurse signup',
          body: `${req.user.full_name || req.user.email} created a portal account.`,
          entityType: 'nurse_profile',
          entityId: nurse.id,
          metadata: {
            specialty: nurse.specialty || null
          }
        })
      }

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

    if (event === 'employer.signup_confirmed') {
      await notifyAdmins({
        type: 'employer.signup_confirmed',
        title: 'New employer signup',
        body: `${employer.org_name || req.user.full_name || req.user.email} created a portal account.`,
        entityType: 'employer_profile',
        entityId: employer.id
      })
    }

    return res.json({ message: 'Event forwarded to n8n', event })
  } catch (error) {
    console.error('Failed to forward self event to n8n:', error.response?.data || error.message)
    return res.status(502).json({
      error: 'Failed to forward event to n8n',
      details: error.response?.data || error.message
    })
  }
})

router.post('/nurse/profile-completion', requireAuth, requireRole('nurse'), async (req, res) => {
  try {
    const result = await syncNurseCompletionByUserId(req.user.id)
    res.json(result)
  } catch (error) {
    console.error('Failed to sync nurse profile completion:', error.message)
    res.status(500).json({ error: 'Failed to sync nurse profile completion' })
  }
})

module.exports = router
