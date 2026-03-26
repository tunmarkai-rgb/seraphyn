import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Public pages
import HomePage from './pages/HomePage'
import Login from './pages/Login'
import NurseSignup from './pages/NurseSignup'
import EmployerSignup from './pages/EmployerSignup'

// Protected pages (we build these next)
// import NurseDashboard from './pages/nurse/Dashboard'
// import EmployerDashboard from './pages/employer/Dashboard'
// import AdminDashboard from './pages/admin/Dashboard'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/nurse-signup" element={<NurseSignup />} />
        <Route path="/employer-signup" element={<EmployerSignup />} />

        {/* Protected routes — uncomment as we build each one */}
        {/*
        <Route path="/nurse/dashboard" element={
          <ProtectedRoute allowedRoles={['nurse']}>
            <NurseDashboard />
          </ProtectedRoute>
        } />
        <Route path="/employer/dashboard" element={
          <ProtectedRoute allowedRoles={['employer']}>
            <EmployerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App