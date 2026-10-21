import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute, RoleRedirect } from './components/ProtectedRoute';
import { Alert } from './components/ui';
import { AuthProvider } from './context/AuthContext';
import { isFirebaseConfigured } from './lib/config';
import { LoginPage } from './pages/LoginPage';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { AttendanceHistory } from './pages/admin/AttendanceHistory';
import { AuditLogPage } from './pages/admin/AuditLog';
import { SettingsPage } from './pages/admin/SettingsPage';
import { TeacherManagement } from './pages/admin/TeacherManagement';
import { TodayAttendance } from './pages/admin/TodayAttendance';

function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-900 text-xl font-bold text-white">
          RG
        </span>
        <h1 className="text-xl font-bold text-brand-900">
          Rajiv Gandhi Memorial College of Education
        </h1>
        <p className="mt-1 text-sm text-slate-500">Kathua, Jammu &amp; Kashmir</p>
      </div>
      <Alert tone="warning" title="Firebase is not configured yet">
        <p>
          Copy <code className="rounded bg-white px-1">.env.example</code> to{' '}
          <code className="rounded bg-white px-1">.env</code> and fill in the Firebase web
          configuration of your project.
        </p>
        <p className="mt-2">
          Then deploy the security rules and Cloud Functions as described in{' '}
          <code className="rounded bg-white px-1">README.md</code>.
        </p>
      </Alert>
    </div>
  );
}

export default function App() {
  if (!isFirebaseConfigured) {
    return <SetupNotice />;
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleRedirect />} />
            <Route path="teacher" element={<TeacherDashboard />} />
            <Route path="admin" element={<Navigate to="/admin/today" replace />} />
            <Route
              path="admin/today"
              element={
                <ProtectedRoute role="admin">
                  <TodayAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/history"
              element={
                <ProtectedRoute role="admin">
                  <AttendanceHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/teachers"
              element={
                <ProtectedRoute role="admin">
                  <TeacherManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/settings"
              element={
                <ProtectedRoute role="admin">
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/audit"
              element={
                <ProtectedRoute role="admin">
                  <AuditLogPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
