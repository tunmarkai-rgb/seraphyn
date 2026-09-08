// One definition of "this employer has full portal access".
//
// This check was previously reimplemented inline in four places
// (routes/nurses.js, routes/jobs.js, routes/employers.js, routes/messages.js).
// A fifth copy is how the definitions drift apart, which matters here because
// full access is what gates nurse documents, bill rates and nurse requests.
//
// Full access means the canonical terminal onboarding state from CLAUDE.md:
// onboarding_stage === 'approved' AND an approved_at timestamp.

const { supabase } = require('../config/supabase')

async function getEmployerProfile(userId) {
  if (!userId) return null
  const { data } = await supabase
    .from('employer_profiles')
    .select('id, user_id, org_name, city, state, onboarding_stage, approved_at')
    .eq('user_id', userId)
    .maybeSingle()
  return data || null
}

function profileHasFullAccess(profile) {
  return profile?.onboarding_stage === 'approved' && Boolean(profile?.approved_at)
}

async function employerHasFullAccess(userId) {
  return profileHasFullAccess(await getEmployerProfile(userId))
}

// Resolves the caller's employer profile and asserts full access in one step,
// so routes don't repeat the lookup-then-check dance.
// Returns { profile } on success or { error, status } to hand straight to res.
async function requireFullAccessEmployer(userId, action = 'continue') {
  const profile = await getEmployerProfile(userId)
  if (!profile) {
    return { error: 'Employer profile not found', status: 404 }
  }
  if (!profileHasFullAccess(profile)) {
    return { error: `Complete onboarding before you can ${action}`, status: 403 }
  }
  return { profile }
}

module.exports = {
  getEmployerProfile,
  profileHasFullAccess,
  employerHasFullAccess,
  requireFullAccessEmployer
}
