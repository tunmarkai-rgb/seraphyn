const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { syncEmployerContactById, syncNurseContactById, syncContactForUser } = require('../lib/ghl-sync')
const { dispatchPortalEvent } = require('../lib/portal-events')
const { syncNurseCompletionByUserId } = require('../lib/nurse-completion')
const { notifyAdmins, notifyInternalInbox } = require('../lib/notifications')
const { ensureEmployerProfileRow, ensureNurseProfileRow, ensurePublicUserForAuthUser } = require('../lib/user-bootstrap')
const { claimLeadForAuthUser } = require('../lib/leads')

const SIGNUP_ALERT_WINDOW_MS = 24 * 60 * 60 * 1000

// Called by the signup page straight after supabase.auth.signUp, before the
// user has a session. The body is untrusted, so the account is re-read from
// Supabase Auth and must match on id, email and role, and be freshly created.
router.post('/signup-alert', async (req, res) => {
  const { userId, role, email } = req.body || {}

  if (!userId || !role || !email || !['nurse', 'employer'].includes(role)) {
    return res.status(400).json({ error: 'userId, role, and email are required' })
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
    const authUser = authData?.user
    const isFresh = authUser && Date.now() - new Date(authUser.created_at).getTime() < SIGNUP_ALERT_WINDOW_MS

    if (
      authError ||
      !authUser ||
      String(authUser.email || '').toLowerCase() !== String(email).toLowerCase() ||
      authUser.user_metadata?.role !== role ||
      !isFresh
    ) {
      return res.status(404).json({ error: 'Signup not found' })
    }

    await ensurePublicUserForAuthUser(authUser, role)
    const metadata = authUser.user_metadata || {}
    const fullName = metadata.full_name || [metadata.first_name, metadata.last_name].filter(Boolean).join(' ')

    if (role === 'nurse') {
      const nurseProfile = await ensureNurseProfileRow(authUser.id, {
        first_name: metadata.first_name || '',
        last_name: metadata.last_name || ''
      }, { fillEmptyOnly: true })

      await notifyAdmins({
        type: 'nurse.signup_pending',
        title: 'New nurse signup',
        body: `${fullName || email} started a nurse signup.`,
        entityType: 'nurse_profile',
        entityId: nurseProfile?.id || null,
        metadata: { email }
      })

      await notifyInternalInbox({
        subject: 'Seraphyn: new nurse signup',
        title: 'New nurse signup awaiting review',
        body: `${fullName || email} started a nurse signup.`
      })

      // Portal-first signups reach GHL now rather than only after confirmation.
      void syncContactForUser(authUser.id, 'nurse')

      return res.json({ ok: true, role, nurseProfileId: nurseProfile?.id || null })
    }

    const employerProfile = await ensureEmployerProfileRow(authUser.id, {
      contact_name: fullName || ''
    }, { fillEmptyOnly: true })

    await notifyAdmins({
      type: 'employer.signup_pending',
      title: 'New employer signup',
      body: `${fullName || email} started an employer signup.`,
      entityType: 'employer_profile',
      entityId: employerProfile?.id || null,
      metadata: { email }
    })

    await notifyInternalInbox({
      subject: 'Seraphyn: new employer signup',
      title: 'New employer signup awaiting review',
      body: `${fullName || email} started an employer signup.`
    })

    void syncContactForUser(authUser.id, 'employer')

    return res.json({ ok: true, role, employerProfileId: employerProfile?.id || null })
  } catch (error) {
    console.error('Public signup alert failed:', error.message)
    return res.status(500).json({ error: 'Failed to record signup' })
  }
})

// Called by /auth/confirm right after the email is confirmed, and by the
// employer onboarding page. Applies any GHL lead for this email first, so the
// contact pushed to GHL already carries the form answers.
router.post('/ghl/sync-self', requireAuth, requireRole('nurse', 'employer'), async (req, res) => {
  try {
    const leadClaim = await claimLeadForAuthUser(req.user, req.user.role)

    if (req.user.role === 'employer') {
      const employer = await ensureEmployerProfileRow(req.user.id, {}, { fillEmptyOnly: true })
      const result = await syncEmployerContactById(employer.id)
      return res.json({ role: 'employer', leadClaimed: Boolean(leadClaim), ...result })
    }

    const nurse = await ensureNurseProfileRow(req.user.id, {}, { fillEmptyOnly: true })
    const result = await syncNurseContactById(nurse.id)
    return res.json({ role: 'nurse', leadClaimed: Boolean(leadClaim), ...result })
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
    // The profile page saves straight to Supabase and then calls this, so it
    // is the one place a nurse profile edit is visible to the server.
    void syncContactForUser(req.user.id, 'nurse')
    res.json(result)
  } catch (error) {
    console.error('Failed to sync nurse profile completion:', error.message)
    res.status(500).json({ error: 'Failed to sync nurse profile completion' })
  }
})

module.exports = router
