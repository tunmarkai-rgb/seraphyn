const { supabase } = require('../config/supabase')
const { evaluateNurseProfileCompletion } = require('./nurse-profile')
const { dispatchPortalEvent } = require('./portal-events')
const { createNotification, notifyAdmins, notifyInternalInbox, getExistingNotification } = require('./notifications')

async function syncNurseCompletionByUserId(userId) {
  const { data: nurse, error } = await supabase
    .from('nurse_profiles')
    .select('id, user_id, first_name, last_name, specialty, license_number, license_state, years_experience, availability, shift_preference, bio, resume_url, license_url')
    .eq('user_id', userId)
    .single()

  if (error || !nurse) {
    throw new Error('Nurse profile not found for completion sync')
  }

  const progress = evaluateNurseProfileCompletion(nurse)
  const metadata = {
    percent: progress.percent,
    completedFields: progress.completedFields,
    missingFields: progress.missingFields
  }

  if (!progress.isComplete) {
    return { nurse, progress, dispatched: false }
  }

  const existing = await getExistingNotification(userId, 'nurse.profile_completed', 'nurse_profile', nurse.id)
  if (existing) {
    return { nurse, progress, dispatched: false, alreadyCompleted: true }
  }

  await createNotification({
    userId,
    type: 'nurse.profile_completed',
    title: 'Profile completed',
    body: 'Your profile, resume, and license are fully submitted.',
    entityType: 'nurse_profile',
    entityId: nurse.id,
    metadata
  })

  await notifyAdmins({
    type: 'nurse.profile_completed',
    title: 'New nurse profile reached 100%',
    body: `${nurse.first_name || 'Nurse'} ${nurse.last_name || ''}`.trim() || 'A nurse profile',
    entityType: 'nurse_profile',
    entityId: nurse.id,
    metadata: {
      specialty: nurse.specialty || null,
      percent: progress.percent
    }
  })

  await notifyInternalInbox({
    subject: 'Seraphyn: nurse profile ready for approval',
    title: 'Nurse profile reached 100%',
    body: `${`${nurse.first_name || 'Nurse'} ${nurse.last_name || ''}`.trim()} is now 100% complete and ready for review.`
  })

  await dispatchPortalEvent('nurse.profile_completed', {
    nurseId: nurse.id,
    nurseUserId: nurse.user_id,
    specialty: nurse.specialty,
    completionPercent: progress.percent
  }, {
    sync: { type: 'nurse', id: nurse.id }
  })

  return { nurse, progress, dispatched: true }
}

module.exports = {
  syncNurseCompletionByUserId
}
