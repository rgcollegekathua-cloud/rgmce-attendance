import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';
export function ProtectedRoute({ role, children }) {
    const { loading, profile, error } = useAuth();
    const location = useLocation();
    if (loading)
        return _jsx(Spinner, { label: "Checking your session" });
    if (!profile) {
        return _jsx(Navigate, { to: "/login", replace: true, state: { from: location.pathname, error } });
    }
    if (role && profile.role !== role) {
        return _jsx(Navigate, { to: profile.role === 'admin' ? '/admin/today' : '/teacher', replace: true });
    }
    if (profile.role === 'teacher' && !profile.active) {
        return _jsx(Navigate, { to: "/login", replace: true, state: { error: 'Your account is deactivated.' } });
    }
    return _jsx(_Fragment, { children: children });
}
export function RoleRedirect() {
    const { profile, loading } = useAuth();
    if (loading)
        return _jsx(Spinner, { label: "Opening your dashboard" });
    if (!profile)
        return _jsx(Navigate, { to: "/login", replace: true });
    return (_jsx(Navigate, { to: profile.role === 'admin' ? '/admin/today' : '/teacher', replace: true }));
}
