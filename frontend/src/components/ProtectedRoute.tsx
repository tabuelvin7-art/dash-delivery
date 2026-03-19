import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_ROUTE: Record<string, string> = {
  business_owner: '/dashboard',
  customer: '/dashboard',
  admin: '/dashboard',
  agent: '/agent',
};

export default function ProtectedRoute({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const fallback = DEFAULT_ROUTE[user.role] || '/dashboard';
    return <Navigate to={fallback} replace />;
  }
  return children;
}
