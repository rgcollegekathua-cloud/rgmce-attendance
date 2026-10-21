import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Alert } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { ApiError } from '../lib/api';
import { resolveSignInEmail } from '../lib/teachers';
const collegeName = 'Rajiv Gandhi Memorial College of Education';
export function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { profile, refreshProfile } = useAuth();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(location.state?.error ?? null);
    if (profile) {
        const destination = location.state?.from;
        if (destination && destination !== '/login') {
            return _jsx(Navigate, { to: destination, replace: true });
        }
        return _jsx(Navigate, { to: profile.role === 'admin' ? '/admin/today' : '/teacher', replace: true });
    }
    const handleSubmit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const email = resolveSignInEmail(identifier);
            await signInWithEmailAndPassword(auth, email, password.trim());
            await refreshProfile();
            const destination = location.state?.from;
            navigate(destination ?? '/teacher', { replace: true });
        }
        catch (e) {
            if (e instanceof ApiError) {
                setError(e.message);
            }
            else if (e instanceof Error && /auth\/(invalid-credential|wrong-password|user-not-found)/.test(e.message)) {
                setError('Incorrect ID or password. Check the credentials issued by the administrator.');
            }
            else if (e instanceof Error && /auth\/too-many-requests/.test(e.message)) {
                setError('Too many failed attempts. Please wait a few minutes and try again.');
            }
            else if (e instanceof Error && /auth\/network/i.test(e.message)) {
                setError('Network error. Check your internet connection and try again.');
            }
            else {
                setError('Sign-in failed. Please try again.');
            }
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8", children: [_jsxs("div", { className: "mb-6 text-center", children: [_jsx("span", { className: "mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-900 text-xl font-bold text-white", children: "RG" }), _jsx("h1", { className: "text-xl font-bold text-brand-900", children: collegeName }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Kathua, Jammu & Kashmir" }), _jsx("p", { className: "mt-4 text-lg font-semibold text-slate-700", children: "Teacher Attendance Sign-in" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "card space-y-4", noValidate: true, children: [error && _jsx(Alert, { tone: "error", children: error }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "identifier", children: "Teacher ID" }), _jsx("input", { id: "identifier", className: "input", value: identifier, onChange: (e) => setIdentifier(e.target.value), placeholder: "e.g. TCH-102", autoComplete: "username", autoCapitalize: "characters", required: true }), _jsx("p", { className: "muted mt-1", children: "Administrators may enter their full email address instead." })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "password", children: "Password" }), _jsx("input", { id: "password", type: "password", className: "input", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Password issued by the administrator", autoComplete: "current-password", required: true })] }), _jsx("button", { type: "submit", className: "btn-primary w-full", disabled: busy, children: busy ? 'Signing in…' : 'Sign in' }), _jsx("p", { className: "muted text-center", children: "Accounts are created by the college administrator only. There is no self-registration." })] })] }));
}
