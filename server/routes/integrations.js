const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { syncEmployerContactById, syncNurseContactById } = require('../lib/ghl-sync')
const { dispatchPortalEvent } = require('../lib/portal-events')
const { syncNurseCompletionByUserId } = require('../lib/nurse-completion')
const { notifyAdmins, notifyInternalInbox } = require('../lib/notifications')
const { normalizeShiftPreference } = require('../lib/user-bootstrap')

router.post('/signup-alert', async (req, res) => {
  const { userId, role, email, fullName, profile = {} } = req.body || {}

  if (!userId || !role || !email || !['nurse', 'employer'].includes(role)) {
    return res.status(400).json({ error: 'userId, role, and email are required' })
  }

  try {
    const now = new Date().toISOString()

    await supabase
      .from('users')
      .upsert({
        id: userId,
        role,
        status: 'pending',
        full_name: fullName || '',
        email,
        updated_at: now,
        created_at: now
      }, { onConflict: 'id' })

    if (role === 'nurse') {
      const { data: nurseProfile } = await supabase
        .from('nurse_profiles')
        .upsert({
          user_id: userId,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          specialty: profile.specialty || '',
          license_state: profile.license_state || '',
          years_experience: profile.years_experience ?? null,
          shift_preference: normalizeShiftPreference(profile.shift_preference || '', null),
          updated_at: now,
          created_at: now
        }, { onConflict: 'user_id' })
        .select('id, specialty')
        .single()

      await notifyAdmins({
        type: 'nurse.signup_pending',
        title: 'New nurse signup',
        body: `${fullName || email} started a nurse signup.`,
        entityType: 'nurse_profile',
        entityId: nurseProfile?.id || null,
        metadata: {
          email,
          specialty: nurseProfile?.specialty || profile.specialty || null
        }
      })

      await notifyInternalInbox({
        subject: 'Seraphyn: new nurse signup',
        title: 'New nurse signup awaiting review',
        body: `${fullName || email} started a nurse signup.`
      })

      return res.json({ ok: true, role, nurseProfileId: nurseProfile?.id || null })
    }

    const { data: employerProfile } = await supabase
      .from('employer_profiles')
      .upsert({
        user_id: userId,
        org_name: profile.org_name || '',
        contact_name: profile.contact_name || fullName || '',
        org_type: profile.org_type || '',
        state: profile.state || '',
        onboarding_stage: profile.onboarding_stage || 'profile',
        updated_at: now,
        created_at: now
      }, { onConflict: 'user_id' })
      .select('id, org_name')
      .single()

    await notifyAdmins({
      type: 'employer.signup_pending',
      title: 'New employer signup',
      body: `${employerProfile?.org_name || fullName || email} started an employer signup.`,
      entityType: 'employer_profile',
      entityId: employerProfile?.id || null,
      metadata: { email }
    })

    await notifyInternalInbox({
      subject: 'Seraphyn: new employer signup',
      title: 'New employer signup awaiting review',
      body: `${employerProfile?.org_name || fullName || email} started an employer signup.`
    })

    return res.json({ ok: true, role, employerProfileId: employerProfile?.id || null })
  } catch (error) {
    console.error('Public signup alert failed:', error.message)
    return res.status(500).json({ error: error.message || 'Failed to record signup' })
  }
})

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

        await notifyInternalInbox({
          subject: 'Seraphyn: new nurse portal signup',
          title: 'New nurse signup awaiting review',
          body: `${req.user.full_name || req.user.email} created a nurse portal account.`
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

      await notifyInternalInbox({
        subject: 'Seraphyn: new employer portal signup',
        title: 'New employer signup awaiting review',
        body: `${employer.org_name || req.user.full_name || req.user.email} created an employer portal account.`
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
