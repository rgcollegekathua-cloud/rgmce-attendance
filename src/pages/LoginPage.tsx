import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Alert } from '../components/ui';
import { useAuth } from '../context/useAuth';
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
  const [error, setError] = useState<string | null>(
    (location.state as { error?: string } | null)?.error ?? null
  );

  if (profile) {
    const destination = (location.state as { from?: string } | null)?.from;
    if (destination && destination !== '/login') {
      return <Navigate to={destination} replace />;
    }
    return <Navigate to={profile.role === 'admin' ? '/admin/today' : '/teacher'} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const email = resolveSignInEmail(identifier);
      await signInWithEmailAndPassword(auth, email, password.trim());
      await refreshProfile();
      const destination = (location.state as { from?: string } | null)?.from;
      navigate(destination ?? '/teacher', { replace: true });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else if (e instanceof Error && /auth\/(invalid-credential|wrong-password|user-not-found)/.test(e.message)) {
        setError('Incorrect ID or password. Check the credentials issued by the administrator.');
      } else if (e instanceof Error && /auth\/too-many-requests/.test(e.message)) {
        setError('Too many failed attempts. Please wait a few minutes and try again.');
      } else if (e instanceof Error && /auth\/network/i.test(e.message)) {
        setError('Network error. Check your internet connection and try again.');
      } else {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-900 text-xl font-bold text-white">
          RG
        </span>
        <h1 className="text-xl font-bold text-brand-900">{collegeName}</h1>
        <p className="mt-1 text-sm text-slate-500">Kathua, Jammu &amp; Kashmir</p>
        <p className="mt-4 text-lg font-semibold text-slate-700">Teacher Attendance Sign-in</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <div>
          <label className="label" htmlFor="identifier">
            Teacher ID
          </label>
          <input
            id="identifier"
            className="input"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="e.g. TCH-102"
            autoComplete="username"
            autoCapitalize="characters"
            required
          />
          <p className="muted mt-1">
            Administrators may enter their full email address instead.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password issued by the administrator"
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="muted text-center">
          Accounts are created by the college administrator only. There is no self-registration.
        </p>
      </form>
    </div>
  );
}
