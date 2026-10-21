import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/useAuth';
import { Spinner } from './ui';
import type { Role } from '../lib/types';

export function ProtectedRoute({
  role,
  children
}: {
  role?: Role;
  children: ReactNode;
}) {
  const { loading, profile, error } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session" />;

  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname, error }} />;
  }

  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'admin' ? '/admin/today' : '/teacher'} replace />;
  }

  if (profile.role === 'teacher' && !profile.active) {
    return <Navigate to="/login" replace state={{ error: 'Your account is deactivated.' }} />;
  }

  return <>{children}</>;
}

export function RoleRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <Spinner label="Opening your dashboard" />;
  if (!profile) return <Navigate to="/login" replace />;
  return (
    <Navigate to={profile.role === 'admin' ? '/admin/today' : '/teacher'} replace />
  );
}
