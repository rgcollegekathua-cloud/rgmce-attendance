import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AttendanceTable, PrintHeader } from '../../components/AttendanceTable';
import { Alert, PageHeader, Spinner } from '../../components/ui';
import { useAppSettings } from '../../hooks/useAppSettings';
import { buildMonthlySummary, matchesFilter } from '../../lib/attendance';
import { ApiError, correctAttendance, fetchAttendanceRange, subscribeUsers } from '../../lib/api';
import { exportAttendanceCsv } from '../../lib/csv';
import { formatDuration, formatIstLong, formatIstMonth, istDateKey, nowIstDateKey } from '../../lib/time';
function monthBounds(year, monthIndex) {
    const start = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const end = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return [start, end];
}
export function AttendanceHistory() {
    const { settings, loading: settingsLoading } = useAppSettings();
    const todayKey = nowIstDateKey();
    const currentMonth = useMemo(() => {
        const [y, m] = todayKey.split('-').map((part) => Number.parseInt(part, 10));
        return { year: y, month: m - 1 };
    }, [todayKey]);
    const [view, setView] = useState('monthly');
    const [dateValue, setDateValue] = useState(todayKey);
    const [fromValue, setFromValue] = useState(monthBounds(currentMonth.year, currentMonth.month)[0]);
    const [toValue, setToValue] = useState(todayKey);
    const [cursor, setCursor] = useState(currentMonth);
    const [records, setRecords] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [filter, setFilter] = useState({
        search: '',
        status: 'all',
        onlyMissing: false
    });
    const [correction, setCorrection] = useState(null);
    const [correctionBusy, setCorrectionBusy] = useState(false);
    const [correctionError, setCorrectionError] = useState(null);
    const [correctionSuccess, setCorrectionSuccess] = useState(null);
    useEffect(() => {
        const unsubscribe = subscribeUsers((values) => setUsers(values), (err) => setError(err.message));
        return unsubscribe;
    }, []);
    const range = useMemo(() => {
        if (view === 'date')
            return [dateValue, dateValue];
        if (view === 'monthly')
            return monthBounds(cursor.year, cursor.month);
        if (fromValue <= toValue)
            return [fromValue, toValue];
        return [toValue, fromValue];
    }, [view, dateValue, fromValue, toValue, cursor]);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchAttendanceRange(range[0], range[1])
            .then((values) => {
            if (!cancelled)
                setRecords(values);
        })
            .catch((e) => {
            if (!cancelled) {
                setError(e instanceof ApiError ? e.message : 'Could not load attendance history.');
            }
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [range, reloadKey]);
    const nameLookup = useMemo(() => new Map(users.map((user) => [user.uid, user.name])), [users]);
    const activeTeachers = useMemo(() => users.filter((user) => user.role === 'teacher' && user.active), [users]);
    const visible = useMemo(() => [...records]
        .filter((record) => matchesFilter(record, filter, nameLookup))
        .sort((a, b) => (a.date === b.date ? a.teacherId.localeCompare(b.teacherId) : a.date < b.date ? 1 : -1)), [records, filter, nameLookup]);
    const summary = useMemo(() => buildMonthlySummary(visible, activeTeachers, nameLookup), [visible, activeTeachers, nameLookup]);
    const rangeLabel = view === 'monthly'
        ? formatIstMonth(cursor.year, cursor.month)
        : view === 'date'
            ? `Date: ${dateValue}`
            : `${range[0]} to ${range[1]}`;
    const openCorrection = useCallback((record) => {
        setCorrectionError(null);
        setCorrectionSuccess(null);
        setCorrection({
            record,
            arrivalTime: record.arrivalTime ?? '',
            departureTime: record.departureTime ?? '',
            reason: ''
        });
    }, []);
    const submitCorrection = useCallback(async () => {
        if (!correction)
            return;
        if (!correction.reason.trim()) {
            setCorrectionError('A reason is required for every correction.');
            return;
        }
        setCorrectionBusy(true);
        setCorrectionError(null);
        try {
            await correctAttendance({
                teacherId: correction.record.teacherId,
                date: correction.record.date,
                arrivalTime: correction.arrivalTime || null,
                departureTime: correction.departureTime || null,
                reason: correction.reason.trim()
            });
            setCorrectionSuccess(`Correction saved for ${correction.record.teacherId} on ${correction.record.date}. The original record is preserved in the audit log.`);
            setCorrection(null);
            setReloadKey((key) => key + 1);
        }
        catch (e) {
            setCorrectionError(e instanceof ApiError ? e.message : 'The correction could not be saved.');
        }
        finally {
            setCorrectionBusy(false);
        }
    }, [correction]);
    if (!settings || settingsLoading)
        return _jsx(Spinner, { label: "Loading settings" });
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { title: "Attendance History", subtitle: "All times and dates are in Indian Standard Time (Asia/Kolkata)", actions: _jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: () => window.print(), children: "Print report" }), _jsxs("button", { type: "button", className: "btn-primary", disabled: visible.length === 0, onClick: () => exportAttendanceCsv(visible, nameLookup, range[0]), children: ["Export CSV (", visible.length, ")"] })] }) }), _jsxs("div", { className: "card no-print", children: [_jsx("div", { className: "flex flex-wrap gap-2", children: [
                            ['date', 'Single date'],
                            ['range', 'Date range'],
                            ['monthly', 'Monthly summary']
                        ].map(([mode, label]) => (_jsx("button", { type: "button", className: mode === view ? 'btn-primary' : 'btn-secondary', onClick: () => setView(mode), children: label }, mode))) }), _jsxs("div", { className: "mt-4 grid gap-3 md:grid-cols-3", children: [view === 'date' && (_jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "history-date", children: "Date" }), _jsx("input", { id: "history-date", type: "date", className: "input", value: dateValue, max: todayKey, onChange: (e) => setDateValue(e.target.value || todayKey) })] })), view === 'range' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "history-from", children: "From" }), _jsx("input", { id: "history-from", type: "date", className: "input", value: fromValue, onChange: (e) => setFromValue(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "history-to", children: "To" }), _jsx("input", { id: "history-to", type: "date", className: "input", value: toValue, max: todayKey, onChange: (e) => setToValue(e.target.value) })] })] })), view === 'monthly' && (_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "label", children: "Month" }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: () => setCursor((c) => {
                                                    const previous = new Date(Date.UTC(c.year, c.month - 1, 1));
                                                    return { year: previous.getUTCFullYear(), month: previous.getUTCMonth() };
                                                }), children: "\u2190 Previous" }), _jsx("span", { className: "min-w-[160px] text-center font-semibold text-brand-900", children: formatIstMonth(cursor.year, cursor.month) }), _jsx("button", { type: "button", className: "btn-secondary", disabled: cursor.year === currentMonth.year && cursor.month === currentMonth.month, onClick: () => setCursor((c) => {
                                                    const next = new Date(Date.UTC(c.year, c.month + 1, 1));
                                                    return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
                                                }), children: "Next \u2192" })] })] })), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "history-search", children: "Teacher name or ID" }), _jsx("input", { id: "history-search", className: "input", placeholder: "e.g. TCH-102", value: filter.search, onChange: (e) => setFilter({ ...filter, search: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "history-status", children: "Attendance status" }), _jsxs("select", { id: "history-status", className: "input", value: filter.status, onChange: (e) => setFilter({ ...filter, status: e.target.value }), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "present", children: "Complete day" }), _jsx("option", { value: "incomplete", children: "Incomplete punch" }), _jsx("option", { value: "late", children: "Late arrivals" }), _jsx("option", { value: "early", children: "Early departures" }), _jsx("option", { value: "missing", children: "Missing arrival or departure" })] })] }), _jsx("div", { className: "flex items-end", children: _jsxs("label", { className: "flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-slate-700", children: [_jsx("input", { type: "checkbox", className: "h-4 w-4 rounded border-slate-300 text-brand-800 focus:ring-brand-600", checked: filter.onlyMissing, onChange: (e) => setFilter({ ...filter, onlyMissing: e.target.checked }) }), "Only records with a missing punch"] }) })] })] }), error && _jsx(Alert, { tone: "error", children: error }), correctionSuccess && _jsx(Alert, { tone: "success", children: correctionSuccess }), correction && (_jsxs("div", { className: "card border-brand-300 no-print", children: [_jsxs("h2", { className: "font-semibold text-brand-900", children: ["Correct attendance \u00B7 ", correction.record.teacherId, " \u00B7 ", correction.record.date] }), _jsx("p", { className: "muted mt-1", children: "The original record is kept. This action is written to the audit log with your name and reason." }), _jsxs("div", { className: "mt-3 grid gap-3 sm:grid-cols-3", children: [_jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "corr-arrival", children: "Arrival (HH:MM)" }), _jsx("input", { id: "corr-arrival", type: "time", className: "input", value: correction.arrivalTime, onChange: (e) => setCorrection({ ...correction, arrivalTime: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "corr-departure", children: "Departure (HH:MM)" }), _jsx("input", { id: "corr-departure", type: "time", className: "input", value: correction.departureTime, onChange: (e) => setCorrection({ ...correction, departureTime: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "corr-reason", children: "Reason (required)" }), _jsx("input", { id: "corr-reason", className: "input", placeholder: "e.g. punch missed due to faulty scanner", value: correction.reason, onChange: (e) => setCorrection({ ...correction, reason: e.target.value }) })] })] }), correctionError && (_jsx("div", { className: "mt-3", children: _jsx(Alert, { tone: "error", children: correctionError }) })), _jsxs("div", { className: "mt-3 flex gap-2", children: [_jsx("button", { type: "button", className: "btn-primary", onClick: submitCorrection, disabled: correctionBusy, children: correctionBusy ? 'Saving…' : 'Save correction' }), _jsx("button", { type: "button", className: "btn-secondary", onClick: () => setCorrection(null), disabled: correctionBusy, children: "Cancel" })] })] })), loading ? (_jsx(Spinner, { label: "Loading attendance history" })) : (_jsxs(_Fragment, { children: [view === 'monthly' && (_jsxs("div", { className: "card print-area", children: [_jsx(PrintHeader, { title: `Monthly Attendance Summary · ${formatIstMonth(cursor.year, cursor.month)}`, subtitle: `Generated on ${formatIstLong(Date.now())}` }), _jsxs("h2", { className: "mb-3 font-semibold text-brand-900 no-print", children: ["Monthly summary (", summary.length, " teachers)"] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[720px] text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500", children: [_jsx("th", { className: "py-2 pr-3", children: "Teacher" }), _jsx("th", { className: "py-2 pr-3", children: "ID" }), _jsx("th", { className: "py-2 pr-3", children: "Days present" }), _jsx("th", { className: "py-2 pr-3", children: "Incomplete" }), _jsx("th", { className: "py-2 pr-3", children: "Late" }), _jsx("th", { className: "py-2 pr-3", children: "Early" }), _jsx("th", { className: "py-2 pr-3", children: "Total hours" })] }) }), _jsx("tbody", { children: summary.map((row) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "py-2 pr-3 font-medium text-slate-800", children: row.name }), _jsx("td", { className: "py-2 pr-3 text-slate-600", children: row.teacherId }), _jsx("td", { className: "py-2 pr-3", children: row.daysPresent }), _jsx("td", { className: "py-2 pr-3", children: row.daysIncomplete }), _jsx("td", { className: "py-2 pr-3", children: row.lateDays }), _jsx("td", { className: "py-2 pr-3", children: row.earlyDays }), _jsx("td", { className: "py-2 pr-3", children: formatDuration(row.totalMinutes) })] }, row.uid))) })] }) })] })), _jsxs("div", { className: "card print-area", children: [_jsx(PrintHeader, { title: view === 'monthly'
                                    ? `Daily Attendance · ${formatIstMonth(cursor.year, cursor.month)}`
                                    : 'Attendance Report', subtitle: `${rangeLabel} · Generated ${istDateKey()} · Times in IST` }), _jsxs("h2", { className: "mb-3 font-semibold text-brand-900 no-print", children: ["Daily records (", visible.length, ")"] }), _jsx(AttendanceTable, { records: visible, nameLookup: nameLookup, timing: settings, todayKey: todayKey, showDate: view !== 'date', onCorrect: openCorrection, emptyText: "No attendance records found for this selection." })] })] }))] }));
}
