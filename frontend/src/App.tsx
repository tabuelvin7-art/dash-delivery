import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Loading from './components/Loading';

function RoleRedirect() {
  const { user } = useAuth();
  if (user?.role === 'agent') return <Navigate to="/agent" replace />;
  return <Navigate to="/dashboard" replace />;
}

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PackagesPage = lazy(() => import('./pages/PackagesPage'));
const PackageDetailPage = lazy(() => import('./pages/PackageDetailPage'));
const CreatePackagePage = lazy(() => import('./pages/CreatePackagePage'));
const AgentDashboardPage = lazy(() => import('./pages/AgentDashboardPage'));
const AgentShelvesPage = lazy(() => import('./pages/AgentShelvesPage'));
const AgentReportsPage = lazy(() => import('./pages/AgentReportsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ShelvesPage = lazy(() => import('./pages/ShelvesPage'));
const AdminAgentsPage = lazy(() => import('./pages/AdminAgentsPage'));
const AdminPackagesPage = lazy(() => import('./pages/AdminPackagesPage'));
const VerifyPhonePage = lazy(() => import('./pages/VerifyPhonePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const TrackPackagePage = lazy(() => import('./pages/TrackPackagePage'));

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="pb-12">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Loading fullScreen />}>
          <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-phone" element={<VerifyPhonePage />} />
          <Route path="/track" element={<TrackPackagePage />} />

          {/* Business owner routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute roles={['business_owner', 'customer', 'admin']}>
              <Layout><DashboardPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/packages" element={
            <ProtectedRoute roles={['business_owner', 'admin', 'agent', 'customer']}>
              <Layout><PackagesPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/packages/new" element={
            <ProtectedRoute roles={['business_owner']}>
              <Layout><CreatePackagePage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/packages/:id" element={
            <ProtectedRoute roles={['business_owner', 'customer', 'admin', 'agent']}>
              <Layout><PackageDetailPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/shelves" element={
            <ProtectedRoute roles={['business_owner']}>
              <Layout><ShelvesPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute roles={['business_owner', 'admin']}>
              <Layout><ReportsPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Agent routes */}
          <Route path="/agent" element={
            <ProtectedRoute roles={['agent']}>
              <Layout><AgentDashboardPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/agent/shelves" element={
            <ProtectedRoute roles={['agent']}>
              <Layout><AgentShelvesPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/agent/reports" element={
            <ProtectedRoute roles={['agent']}>
              <Layout><AgentReportsPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Admin routes */}
          <Route path="/admin/agents" element={
            <ProtectedRoute roles={['admin']}>
              <Layout><AdminAgentsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/admin/packages" element={
            <ProtectedRoute roles={['admin']}>
              <Layout><AdminPackagesPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Notifications — all authenticated roles */}
          <Route path="/notifications" element={
            <ProtectedRoute>
              <Layout><NotificationsPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Profile — all authenticated roles */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <Layout><ProfilePage /></Layout>
            </ProtectedRoute>
          } />

          {/* Default redirect */}
          <Route path="/" element={
            <ProtectedRoute>
              <RoleRedirect />
            </ProtectedRoute>
          } />
          <Route path="*" element={
            <ProtectedRoute>
              <RoleRedirect />
            </ProtectedRoute>
          } />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
