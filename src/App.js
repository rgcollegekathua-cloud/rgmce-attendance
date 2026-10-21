import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    return (_jsxs("div", { className: "mx-auto max-w-xl px-4 py-16", children: [_jsxs("div", { className: "mb-6 text-center", children: [_jsx("span", { className: "mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-900 text-xl font-bold text-white", children: "RG" }), _jsx("h1", { className: "text-xl font-bold text-brand-900", children: "Rajiv Gandhi Memorial College of Education" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Kathua, Jammu & Kashmir" })] }), _jsxs(Alert, { tone: "warning", title: "Firebase is not configured yet", children: [_jsxs("p", { children: ["Copy ", _jsx("code", { className: "rounded bg-white px-1", children: ".env.example" }), " to", ' ', _jsx("code", { className: "rounded bg-white px-1", children: ".env" }), " and fill in the Firebase web configuration of your project."] }), _jsxs("p", { className: "mt-2", children: ["Then deploy the security rules and Cloud Functions as described in", ' ', _jsx("code", { className: "rounded bg-white px-1", children: "README.md" }), "."] })] })] }));
}
export default function App() {
    if (!isFirebaseConfigured) {
        return _jsx(SetupNotice, {});
    }
    return (_jsx(AuthProvider, { children: _jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsxs(Route, { path: "/", element: _jsx(ProtectedRoute, { children: _jsx(AppShell, {}) }), children: [_jsx(Route, { index: true, element: _jsx(RoleRedirect, {}) }), _jsx(Route, { path: "teacher", element: _jsx(TeacherDashboard, {}) }), _jsx(Route, { path: "admin", element: _jsx(Navigate, { to: "/admin/today", replace: true }) }), _jsx(Route, { path: "admin/today", element: _jsx(ProtectedRoute, { role: "admin", children: _jsx(TodayAttendance, {}) }) }), _jsx(Route, { path: "admin/history", element: _jsx(ProtectedRoute, { role: "admin", children: _jsx(AttendanceHistory, {}) }) }), _jsx(Route, { path: "admin/teachers", element: _jsx(ProtectedRoute, { role: "admin", children: _jsx(TeacherManagement, {}) }) }), _jsx(Route, { path: "admin/settings", element: _jsx(ProtectedRoute, { role: "admin", children: _jsx(SettingsPage, {}) }) }), _jsx(Route, { path: "admin/audit", element: _jsx(ProtectedRoute, { role: "admin", children: _jsx(AuditLogPage, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] })] }) }) }));
}
