import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert, PageHeader, Spinner } from '../../components/ui';
import { fetchAuditLogs } from '../../lib/api';
import { useEffect, useState } from 'react';
function summarise(value) {
    if (value === undefined || value === null)
        return '—';
    try {
        const text = JSON.stringify(value);
        return text.length > 220 ? `${text.slice(0, 220)}…` : text;
    }
    catch {
        return String(value);
    }
}
export function AuditLogPage() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        fetchAuditLogs(300)
            .then((values) => {
            if (!cancelled)
                setEntries(values);
        })
            .catch((e) => {
            if (!cancelled)
                setError(e instanceof Error ? e.message : 'Could not load the audit log.');
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    if (loading)
        return _jsx(Spinner, { label: "Loading audit log" });
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { title: "Audit Log", subtitle: "Every administrative action, device decision and attendance correction is recorded here." }), error && _jsx(Alert, { tone: "error", children: error }), _jsx("div", { className: "card", children: entries.length === 0 ? (_jsx("p", { className: "muted", children: "No audit entries recorded yet." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[760px] text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500", children: [_jsx("th", { className: "py-2 pr-3", children: "When (IST)" }), _jsx("th", { className: "py-2 pr-3", children: "Actor" }), _jsx("th", { className: "py-2 pr-3", children: "Action" }), _jsx("th", { className: "py-2 pr-3", children: "Target" }), _jsx("th", { className: "py-2 pr-3", children: "Reason" }), _jsx("th", { className: "py-2 pr-3", children: "Change" })] }) }), _jsx("tbody", { children: entries.map((entry) => (_jsxs("tr", { className: "border-b border-slate-100 align-top", children: [_jsx("td", { className: "py-2 pr-3 whitespace-nowrap text-slate-600", children: new Date(entry.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }), _jsxs("td", { className: "py-2 pr-3", children: [_jsx("span", { className: "font-medium text-slate-800", children: entry.actorUid }), _jsx("span", { className: "ml-1 text-xs text-slate-500", children: entry.actorRole })] }), _jsx("td", { className: "py-2 pr-3 font-medium text-slate-800", children: entry.action }), _jsx("td", { className: "py-2 pr-3 text-slate-600", children: entry.targetId }), _jsx("td", { className: "py-2 pr-3 text-slate-600", children: entry.reason ?? '—' }), _jsxs("td", { className: "py-2 pr-3 text-xs text-slate-500", children: [_jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "before:" }), " ", summarise(entry.before)] }), _jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "after:" }), " ", summarise(entry.after)] })] })] }, entry.id))) })] }) })) })] }));
}
