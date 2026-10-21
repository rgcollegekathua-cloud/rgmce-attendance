import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { AttendanceTable, PrintHeader } from '../../components/AttendanceTable';
import { Alert, PageHeader, Spinner, StatCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../hooks/useAppSettings';
import { computeDayStats, matchesFilter } from '../../lib/attendance';
import { exportAttendanceCsv } from '../../lib/csv';
import { subscribeTodayAttendance, subscribeUsers } from '../../lib/api';
import { formatIstLong, nowIstDateKey } from '../../lib/time';
import { useEffect } from 'react';
export function TodayAttendance() {
    const { profile } = useAuth();
    const { settings, loading: settingsLoading } = useAppSettings();
    const [todayKey] = useState(() => nowIstDateKey());
    const [records, setRecords] = useState([]);
    const [users, setUsers] = useState([]);
    const [loadError, setLoadError] = useState(null);
    const [ready, setReady] = useState(false);
    const [filter, setFilter] = useState({
        search: '',
        status: 'all',
        onlyMissing: false
    });
    useEffect(() => {
        const unsubscribeRecords = subscribeTodayAttendance(todayKey, (values) => {
            setRecords(values);
            setReady(true);
        }, (error) => {
            setLoadError(error.message);
            setReady(true);
        });
        const unsubscribeUsers = subscribeUsers((values) => setUsers(values), (error) => setLoadError(error.message));
        return () => {
            unsubscribeRecords();
            unsubscribeUsers();
        };
    }, [todayKey]);
    const nameLookup = useMemo(() => new Map(users.map((user) => [user.uid, user.name])), [users]);
    const activeTeachers = useMemo(() => users.filter((user) => user.role === 'teacher' && user.active), [users]);
    const sorted = useMemo(() => [...records].sort((a, b) => a.teacherId.localeCompare(b.teacherId)), [records]);
    const stats = useMemo(() => {
        const base = computeDayStats(sorted, activeTeachers.length);
        const withArrival = sorted.filter((record) => record.arrivalMs).length;
        const arrivalWithoutDeparture = sorted.filter((record) => record.arrivalMs && !record.departureMs).length;
        return {
            ...base,
            missingArrival: Math.max(0, activeTeachers.length - withArrival),
            missingDeparture: arrivalWithoutDeparture
        };
    }, [sorted, activeTeachers.length]);
    const visible = useMemo(() => sorted.filter((record) => matchesFilter(record, filter, nameLookup)), [sorted, filter, nameLookup]);
    const missedToday = useMemo(() => {
        const recorded = new Set(sorted.filter((r) => r.arrivalMs || r.departureMs).map((r) => r.uid));
        return activeTeachers.filter((teacher) => !recorded.has(teacher.uid));
    }, [sorted, activeTeachers]);
    if (!settings || settingsLoading || !ready) {
        return _jsx(Spinner, { label: "Loading today's attendance" });
    }
    if (loadError) {
        return _jsx(Alert, { tone: "error", title: "Could not load records", children: loadError });
    }
    const canExport = profile?.role === 'admin';
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { title: "Today's Attendance", subtitle: `${formatIstLong(Date.now())} · Indian Standard Time`, actions: _jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: () => window.print(), children: "Print sheet" }), _jsx("button", { type: "button", className: "btn-primary", disabled: !canExport || visible.length === 0, onClick: () => exportAttendanceCsv(visible, nameLookup, `today-${todayKey}`), children: "Export CSV" })] }) }), _jsxs("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6", children: [_jsx(StatCard, { label: "Active teachers", value: stats.total }), _jsx(StatCard, { label: "Present today", value: stats.present, tone: "good" }), _jsx(StatCard, { label: "Missing arrival", value: stats.missingArrival, tone: stats.missingArrival > 0 ? 'bad' : 'default' }), _jsx(StatCard, { label: "Missing departure", value: stats.missingDeparture, tone: stats.missingDeparture > 0 ? 'warn' : 'default' }), _jsx(StatCard, { label: "Late arrivals", value: stats.late, tone: stats.late > 0 ? 'warn' : 'default' }), _jsx(StatCard, { label: "Early departures", value: stats.early, tone: stats.early > 0 ? 'warn' : 'default' })] }), _jsx("div", { className: "card no-print", children: _jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [_jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "today-search", children: "Search teacher" }), _jsx("input", { id: "today-search", className: "input", placeholder: "Name or teacher ID", value: filter.search, onChange: (e) => setFilter({ ...filter, search: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "today-status", children: "Attendance status" }), _jsxs("select", { id: "today-status", className: "input", value: filter.status, onChange: (e) => setFilter({ ...filter, status: e.target.value }), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "present", children: "Complete (arrival + departure)" }), _jsx("option", { value: "incomplete", children: "Incomplete punch" }), _jsx("option", { value: "late", children: "Late arrivals" }), _jsx("option", { value: "early", children: "Early departures" }), _jsx("option", { value: "missing", children: "Missing arrival or departure" })] })] }), _jsx("div", { className: "flex items-end", children: _jsxs("label", { className: "flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-slate-700", children: [_jsx("input", { type: "checkbox", className: "h-4 w-4 rounded border-slate-300 text-brand-800 focus:ring-brand-600", checked: filter.onlyMissing, onChange: (e) => setFilter({ ...filter, onlyMissing: e.target.checked }) }), "Only missing punches"] }) })] }) }), _jsxs("div", { className: "card print-area", children: [_jsx(PrintHeader, { title: "Daily Attendance Sheet", subtitle: formatIstLong(Date.now()) }), _jsxs("h2", { className: "mb-3 font-semibold text-brand-900 no-print", children: ["Recorded punches (", visible.length, ")"] }), _jsx(AttendanceTable, { records: visible, nameLookup: nameLookup, timing: settings, todayKey: todayKey, emptyText: "No teacher has marked attendance yet today." })] }), _jsxs("div", { className: "card no-print", children: [_jsxs("h2", { className: "mb-3 font-semibold text-brand-900", children: ["No punch recorded yet (", missedToday.length, ")"] }), missedToday.length === 0 ? (_jsx("p", { className: "muted", children: "Every active teacher has at least one punch today." })) : (_jsx("ul", { className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-3", children: missedToday.map((teacher) => (_jsxs("li", { className: "flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm", children: [_jsx("span", { className: "font-medium text-slate-700", children: teacher.name }), _jsx("span", { className: "text-slate-500", children: teacher.teacherId })] }, teacher.uid))) })), _jsx("p", { className: "muted mt-3", children: "A teacher is not marked absent here \u2014 the day may still be in progress." })] })] }));
}
