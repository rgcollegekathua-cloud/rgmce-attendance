import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const collegeName = 'Rajiv Gandhi Memorial College of Education';
const collegePlace = 'Kathua, Jammu & Kashmir';
function Mark() {
    return (_jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-800 text-sm font-bold text-white", children: "RG" }));
}
export function AppShell() {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const handleSignOut = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };
    return (_jsxs("div", { className: "mx-auto flex min-h-screen max-w-6xl flex-col px-3 pb-8 sm:px-6", children: [_jsxs("header", { className: "sticky top-0 z-20 -mx-3 mb-4 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [_jsx(Mark, {}), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-bold text-brand-900 sm:text-base", children: collegeName }), _jsx("p", { className: "truncate text-xs text-slate-500", children: collegePlace })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [profile && (_jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-sm font-semibold text-slate-800", children: profile.name }), _jsx("p", { className: "text-xs text-slate-500", children: profile.role === 'admin'
                                                    ? 'Administrator'
                                                    : `Teacher · ${profile.teacherId}` })] })), _jsx("button", { type: "button", className: "btn-secondary", onClick: handleSignOut, children: "Sign out" })] })] }), profile?.role === 'admin' && (_jsx("nav", { className: "mt-3 flex flex-wrap gap-1 overflow-x-auto no-print", children: [
                            { to: '/admin/today', label: "Today's Attendance" },
                            { to: '/admin/history', label: 'Attendance History' },
                            { to: '/admin/teachers', label: 'Teachers' },
                            { to: '/admin/settings', label: 'Settings' },
                            { to: '/admin/audit', label: 'Audit Log' }
                        ].map((item) => (_jsx(NavLink, { to: item.to, className: ({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${isActive
                                ? 'bg-brand-900 text-white'
                                : 'text-slate-600 hover:bg-slate-100'}`, children: item.label }, item.to))) }))] }), _jsx("main", { className: "flex-1", children: _jsx(Outlet, {}) }), _jsxs("footer", { className: "mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400 no-print", children: [collegeName, " \u00B7 Attendance System \u00B7 Times shown in Indian Standard Time (Asia/Kolkata)"] })] }));
}
