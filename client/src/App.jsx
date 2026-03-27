import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Public pages
import HomePage from './pages/HomePage'
import Login from './pages/Login'
import NurseSignup from './pages/NurseSignup'
import EmployerSignup from './pages/EmployerSignup'
import Jobs from './pages/Jobs'
import Nurses from './pages/Nurses'

// Nurse portal
import NurseDashboard from './pages/nurse/Dashboard'
import NurseProfile from './pages/nurse/Profile'
import NurseApplications from './pages/nurse/Applications'

// Employer portal
import EmployerOnboarding from './pages/employer/Onboarding'
import EmployerDashboard from './pages/employer/Dashboard'
import PostJob from './pages/employer/PostJob'

// Shared (authenticated)
import Messages from './pages/Messages'

// Admin
import AdminDashboard from './pages/admin/Dashboard'
import AdminNurses from './pages/admin/Nurses'
import AdminEmployers from './pages/admin/Employers'
import AdminJobs from './pages/admin/Jobs'
import AdminApplications from './pages/admin/Applications'
import AdminPayments from './pages/admin/Payments'
import AdminShifts from './pages/admin/Shifts'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/"               element={<HomePage />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/nurse-signup"   element={<NurseSignup />} />
        <Route path="/employer-signup" element={<EmployerSignup />} />
        <Route path="/jobs"           element={<Jobs />} />
        <Route path="/nurses"         element={<Nurses />} />

        {/* Nurse portal */}
        <Route path="/nurse/dashboard" element={
          <ProtectedRoute allowedRoles={['nurse']}>
            <NurseDashboard />
          </ProtectedRoute>
        } />
        <Route path="/nurse/profile" element={
          <ProtectedRoute allowedRoles={['nurse']}>
            <NurseProfile />
          </ProtectedRoute>
        } />
        <Route path="/nurse/applications" element={
          <ProtectedRoute allowedRoles={['nurse']}>
            <NurseApplications />
          </ProtectedRoute>
        } />

        {/* Employer portal */}
        <Route path="/employer/onboarding" element={
          <ProtectedRoute allowedRoles={['employer']}>
            <EmployerOnboarding />
          </ProtectedRoute>
        } />
        <Route path="/employer/dashboard" element={
          <ProtectedRoute allowedRoles={['employer']}>
            <EmployerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/employer/post-job" element={
          <ProtectedRoute allowedRoles={['employer']}>
            <PostJob />
          </ProtectedRoute>
        } />

        {/* Shared */}
        <Route path="/messages" element={
          <ProtectedRoute allowedRoles={['nurse', 'employer', 'admin']}>
            <Messages />
          </ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/nurses" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminNurses />
          </ProtectedRoute>
        } />
        <Route path="/admin/employers" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminEmployers />
          </ProtectedRoute>
        } />
        <Route path="/admin/jobs" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminJobs />
          </ProtectedRoute>
        } />
        <Route path="/admin/applications" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminApplications />
          </ProtectedRoute>
        } />
        <Route path="/admin/payments" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminPayments />
          </ProtectedRoute>
        } />
        <Route path="/admin/shifts" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminShifts />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
