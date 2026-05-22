import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import BrandLogo from './components/BrandLogo'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'

const HomePage = lazy(() => import('./pages/HomePage'))
const Login = lazy(() => import('./pages/Login'))
const AuthConfirm = lazy(() => import('./pages/AuthConfirm'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const NurseSignup = lazy(() => import('./pages/NurseSignup'))
const EmployerSignup = lazy(() => import('./pages/EmployerSignup'))
const Jobs = lazy(() => import('./pages/Jobs'))
const Nurses = lazy(() => import('./pages/Nurses'))
const NurseDetail = lazy(() => import('./pages/NurseDetail'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))

const NurseDashboard = lazy(() => import('./pages/nurse/Dashboard'))
const NurseProfile = lazy(() => import('./pages/nurse/Profile'))
const NurseApplications = lazy(() => import('./pages/nurse/Applications'))

const EmployerOnboarding = lazy(() => import('./pages/employer/Onboarding'))
const EmployerDashboard = lazy(() => import('./pages/employer/Dashboard'))
const PostJob = lazy(() => import('./pages/employer/PostJob'))

const Messages = lazy(() => import('./pages/Messages'))

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminNurses = lazy(() => import('./pages/admin/Nurses'))
const AdminEmployers = lazy(() => import('./pages/admin/Employers'))
const AdminJobs = lazy(() => import('./pages/admin/Jobs'))
const AdminApplications = lazy(() => import('./pages/admin/Applications'))
const AdminPayments = lazy(() => import('./pages/admin/Payments'))
const AdminShifts = lazy(() => import('./pages/admin/Shifts'))

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--warm-white)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '12px' }}>
          <BrandLogo tone="dark" size={32} align="center" />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '0.08em' }}>
          LOADING...
        </p>
      </div>
    </div>
  )
}

function HomeRoute() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <RouteFallback />
  }

  const resolvedRole = profile?.role || user?.user_metadata?.role
  if (user && resolvedRole === 'nurse') {
    return <Navigate to="/nurse/dashboard" replace />
  }

  if (user && resolvedRole === 'employer') {
    return <Navigate to="/employer/dashboard" replace />
  }

  if (user && resolvedRole === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return <HomePage />
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/nurse-signup" element={<NurseSignup />} />
          <Route path="/employer-signup" element={<EmployerSignup />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/nurses" element={<Nurses />} />
          <Route path="/nurses/:id" element={<NurseDetail />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          <Route
            path="/nurse/dashboard"
            element={
              <ProtectedRoute allowedRoles={['nurse']}>
                <NurseDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/nurse/profile"
            element={
              <ProtectedRoute allowedRoles={['nurse']}>
                <NurseProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/nurse/applications"
            element={
              <ProtectedRoute allowedRoles={['nurse']}>
                <NurseApplications />
              </ProtectedRoute>
            }
          />

          <Route
            path="/employer/onboarding"
            element={
              <ProtectedRoute allowedRoles={['employer']}>
                <EmployerOnboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/dashboard"
            element={
              <ProtectedRoute allowedRoles={['employer']}>
                <EmployerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/post-job"
            element={
              <ProtectedRoute allowedRoles={['employer']}>
                <PostJob />
              </ProtectedRoute>
            }
          />

          <Route
            path="/messages"
            element={
              <ProtectedRoute allowedRoles={['nurse', 'employer', 'admin']}>
                <Messages />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/nurses"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminNurses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employers"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminEmployers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/jobs"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminJobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/applications"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminApplications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/shifts"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminShifts />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

export default App
