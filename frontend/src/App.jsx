import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import NotFound from './pages/NotFound'
import DashboardLayout from './components/DashboardLayout'
import Spinner from './components/_Spinner'
import useAuthStore from './store/auth'

// Lazy-load every dashboard page for route-level code splitting.
// The auth pages stay eager because they're tiny and on the critical path.
const Home = lazy(() => import(/* webpackChunkName: "home" */ './pages/Home'))
const Team = lazy(() => import(/* webpackChunkName: "team" */ './pages/Team'))
const Attendance = lazy(() => import(/* webpackChunkName: "attendance" */ './pages/Attendance'))
const Ratings = lazy(() => import(/* webpackChunkName: "ratings" */ './pages/Ratings'))
const Tasks = lazy(() => import(/* webpackChunkName: "tasks" */ './pages/Tasks'))
const Meetings = lazy(() => import(/* webpackChunkName: "meetings" */ './pages/Meetings'))
const Notifications = lazy(() => import(/* webpackChunkName: "notifications" */ './pages/Notifications'))
const Profile = lazy(() => import(/* webpackChunkName: "profile" */ './pages/Profile'))
const Sessions = lazy(() => import(/* webpackChunkName: "sessions" */ './pages/Sessions'))
const Projects = lazy(() => import(/* webpackChunkName: "projects" */ './pages/Projects'))
const Assistant = lazy(() => import(/* webpackChunkName: "assistant" */ './pages/Assistant'))
const Reports = lazy(() => import(/* webpackChunkName: "admin-reports" */ './pages/admin/Reports'))
const Analytics = lazy(() => import(/* webpackChunkName: "admin-analytics" */ './pages/admin/Analytics'))
const AdminDashboard = lazy(() => import(/* webpackChunkName: "admin-users" */ './pages/admin/AdminDashboard'))
const AuditLog = lazy(() => import(/* webpackChunkName: "admin-audit" */ './pages/admin/AuditLog'))
const Exports = lazy(() => import(/* webpackChunkName: "admin-exports" */ './pages/admin/Exports'))
const Departments = lazy(() => import(/* webpackChunkName: "admin-departments" */ './pages/admin/Departments'))

// Auth gate. Redirects to /login when there's no access token.
function Private({ children }) {
  const token = useAuthStore((s) => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <Suspense fallback={<Spinner />}>{children}</Suspense>
}

// ALL dashboard routes render inside this shell, so the sidebar + topbar
// are always present. There is no other layout for authenticated pages.
function AppShell() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<Home />} />
        <Route path="team" element={<Team />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<Projects />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="ratings" element={<Ratings />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="profile" element={<Profile />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="reports" element={<Reports />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="departments" element={<Departments />} />
        <Route path="audit" element={<AuditLog />} />
        <Route path="exports" element={<Exports />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DashboardLayout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Catch-all for authenticated app — every route renders in AppShell. */}
      <Route path="/*" element={<Private><AppShell /></Private>} />
    </Routes>
  )
}
