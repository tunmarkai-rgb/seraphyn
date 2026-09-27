import { createContext, useContext, useEffect, useState } from 'react'
import { getAppBaseUrl, supabase } from '../lib/supabase'

const AuthContext = createContext({})
const ADMIN_EMAIL_ALLOWLIST = new Set(['kundayiw@gmail.com', 'info@seraphyncare.com'])

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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id, session.user.user_metadata || {}, session.user.email || '')
      }
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id, session.user.user_metadata || {}, session.user.email || '')
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
