import { createContext, useContext, useEffect, useState } from 'react'
import { getAppBaseUrl, supabase } from '../lib/supabase'

const AuthContext = createContext({})
const ADMIN_EMAIL_ALLOWLIST = new Set(['kundayiw@gmail.com', 'info@seraphyncare.com'])

function hasValue(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function normalizeShiftPreference(value, fallback = null) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return fallback
  if (raw === 'per diem') return 'Per Diem'
  if (raw === 'contract travel') return 'Contract Travel'
  if (raw === 'permanent') return 'Permanent'
  return fallback
}

async function inferRoleFromProfileTables(userId, email = '') {
  if (!userId) return ''

  const [{ data: nurseProfile }, { data: employerProfile }] = await Promise.all([
    supabase.from('nurse_profiles').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('employer_profiles').select('user_id').eq('user_id', userId).maybeSingle()
  ])

  if (nurseProfile?.user_id) return 'nurse'
  if (employerProfile?.user_id) return 'employer'
  if (ADMIN_EMAIL_ALLOWLIST.has(String(email || '').toLowerCase())) return 'admin'
  return ''
}

async function resolveProfileState(userId, metadata = {}, email = '') {
  if (!userId) return null

  const normalizedEmail = String(email || metadata.email || '').toLowerCase()
  const [{ data: nurseProfile }, { data: employerProfile }] = await Promise.all([
    supabase
      .from('nurse_profiles')
      .select('user_id, first_name, last_name, approved_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('employer_profiles')
      .select('user_id, org_name, contact_name, onboarding_stage, approved_at, contract_signed')
      .eq('user_id', userId)
      .maybeSingle()
  ])

  if (nurseProfile?.user_id) {
    const fullName = [nurseProfile.first_name, nurseProfile.last_name].filter(Boolean).join(' ').trim()
    return {
      id: userId,
      role: 'nurse',
      status: nurseProfile.approved_at ? 'approved' : (metadata.status || 'pending'),
      full_name: fullName || metadata.full_name || ''
    }
  }

  if (employerProfile?.user_id) {
    return {
      id: userId,
      role: 'employer',
      status: employerProfile.approved_at || employerProfile.onboarding_stage === 'approved' ? 'approved' : (metadata.status || 'pending'),
      full_name: employerProfile.contact_name || metadata.full_name || '',
      onboarding_stage: employerProfile.onboarding_stage || metadata.onboarding_stage || 'profile',
      contract_signed: Boolean(employerProfile.contract_signed)
    }
  }

  if (ADMIN_EMAIL_ALLOWLIST.has(normalizedEmail)) {
    return {
      id: userId,
      role: 'admin',
      status: 'approved',
      full_name: metadata.full_name || ''
    }
  }

  if (metadata.role) {
    return {
      id: userId,
      role: metadata.role,
      status: metadata.status || (metadata.role === 'admin' ? 'approved' : 'pending'),
      full_name: metadata.full_name || ''
    }
  }

  return null
}

async function bootstrapNurseProfileFromMetadata(user) {
  if (!user?.id) return

  const metadata = user.user_metadata || {}
  const inferredRole = metadata.role || await inferRoleFromProfileTables(user.id, user.email)
  if (inferredRole !== 'nurse') return

  const profileSeed = {
    user_id: user.id,
    first_name: metadata.first_name || '',
    last_name: metadata.last_name || '',
    specialty: metadata.specialty || '',
    license_state: metadata.license_state || '',
    years_experience: hasValue(metadata.years_experience) ? Number(metadata.years_experience) : null,
    shift_preference: normalizeShiftPreference(metadata.shift_preference, null)
  }

  const seedFields = Object.entries(profileSeed).filter(([key, value]) => key !== 'user_id' && hasValue(value))
  if (seedFields.length === 0) return

  const { data: existing, error: existingError } = await supabase
    .from('nurse_profiles')
    .select('id, user_id, first_name, last_name, specialty, license_state, years_experience, shift_preference')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) {
    console.error('Failed to inspect nurse profile bootstrap state:', existingError.message)
  }

  const mergedProfile = existing
    ? {
        ...existing,
        first_name: hasValue(existing.first_name) ? existing.first_name : profileSeed.first_name,
        last_name: hasValue(existing.last_name) ? existing.last_name : profileSeed.last_name,
        specialty: hasValue(existing.specialty) ? existing.specialty : profileSeed.specialty,
        license_state: hasValue(existing.license_state) ? existing.license_state : profileSeed.license_state,
        years_experience: hasValue(existing.years_experience) ? existing.years_experience : profileSeed.years_experience,
        shift_preference: hasValue(existing.shift_preference) ? existing.shift_preference : profileSeed.shift_preference
      }
    : profileSeed

  const { error: upsertError } = await supabase
    .from('nurse_profiles')
    .upsert(mergedProfile, { onConflict: 'user_id' })

  if (upsertError) {
    console.error('Failed to bootstrap nurse profile from signup metadata:', upsertError.message)
  }
}

async function bootstrapEmployerProfileFromMetadata(user) {
  if (!user?.id) return

  const metadata = user.user_metadata || {}
  const inferredRole = metadata.role || await inferRoleFromProfileTables(user.id, user.email)
  if (inferredRole !== 'employer') return

  const profileSeed = {
    user_id: user.id,
    org_name: metadata.org_name || '',
    contact_name: metadata.contact_name || metadata.full_name || '',
    org_type: metadata.org_type || '',
    state: metadata.state || '',
    onboarding_stage: metadata.onboarding_stage || 'profile'
  }

  const seedFields = Object.entries(profileSeed).filter(([key, value]) => key !== 'user_id' && hasValue(value))
  if (seedFields.length === 0) return

  const { data: existing, error: existingError } = await supabase
    .from('employer_profiles')
    .select('id, user_id, org_name, contact_name, org_type, state, onboarding_stage')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) {
    console.error('Failed to inspect employer profile bootstrap state:', existingError.message)
  }

  const mergedProfile = existing
    ? {
        ...existing,
        org_name: hasValue(existing.org_name) ? existing.org_name : profileSeed.org_name,
        contact_name: hasValue(existing.contact_name) ? existing.contact_name : profileSeed.contact_name,
        org_type: hasValue(existing.org_type) ? existing.org_type : profileSeed.org_type,
        state: hasValue(existing.state) ? existing.state : profileSeed.state,
        onboarding_stage: hasValue(existing.onboarding_stage) ? existing.onboarding_stage : profileSeed.onboarding_stage
      }
    : profileSeed

  const { error: upsertError } = await supabase
    .from('employer_profiles')
    .upsert(mergedProfile, { onConflict: 'user_id' })

  if (upsertError) {
    console.error('Failed to bootstrap employer profile from signup metadata:', upsertError.message)
  }
}

async function bootstrapProfileFromMetadata(user) {
  await Promise.all([
    bootstrapNurseProfileFromMetadata(user),
    bootstrapEmployerProfileFromMetadata(user)
  ])
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        bootstrapProfileFromMetadata(session.user)
          .finally(() => fetchProfile(session.user.id, session.user.user_metadata || {}, session.user.email || ''))
      }
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          bootstrapProfileFromMetadata(session.user)
            .finally(() => fetchProfile(session.user.id, session.user.user_metadata || {}, session.user.email || ''))
        }
        else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId, metadata = {}, email = '') => {
    try {
      const resolvedProfile = await resolveProfileState(userId, metadata, email)
      if (resolvedProfile) {
        setProfile(resolvedProfile)
        return
      }
      setProfile(null)
    } catch (err) {
      console.error('Error fetching profile:', err.message)
      setProfile(metadata?.role ? {
        id: userId,
        role: metadata.role,
        status: metadata.status || (metadata.role === 'admin' ? 'approved' : 'pending'),
        full_name: metadata.full_name || ''
      } : null)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email, password, role, fullName, options = {}) => {
    const { data: extraData = {}, ...restOptions } = options
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...restOptions,
        data: {
          full_name: fullName,
          role,
          ...extraData
        }
      }
    })
    return { data, error }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  const requestPasswordReset = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppBaseUrl()}/auth/reset-password`
    })
    return { data, error }
  }

  const updatePassword = async (password) => {
    const { data, error } = await supabase.auth.updateUser({ password })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    requestPasswordReset,
    updatePassword,
    signOut,
    isNurse: profile?.role === 'nurse',
    isEmployer: profile?.role === 'employer',
    isAdmin: profile?.role === 'admin',
    isApproved: profile?.status === 'approved'
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
