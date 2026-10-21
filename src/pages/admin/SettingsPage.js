import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Alert, PageHeader, Spinner } from '../../components/ui';
import { useAppSettings } from '../../hooks/useAppSettings';
import { ApiError, fetchSecuritySettings, regenerateQrToken } from '../../lib/api';
import { formatIstLong, nowIstDateKey, timeToMinutes, istTimeKey } from '../../lib/time';
const WEEKDAYS = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
];
export function SettingsPage() {
    const { settings, loading, error, save, saving } = useAppSettings();
    const [draft, setDraft] = useState(null);
    const [security, setSecurity] = useState(null);
    const [message, setMessage] = useState(null);
    const [qrImage, setQrImage] = useState(null);
    const [qrBusy, setQrBusy] = useState(null);
    const [newHoliday, setNewHoliday] = useState('');
    useEffect(() => {
        if (settings && !draft)
            setDraft({ ...settings });
    }, [settings, draft]);
    const loadSecurity = useCallback(async () => {
        try {
            const value = await fetchSecuritySettings();
            setSecurity(value);
        }
        catch {
            setSecurity(null);
        }
    }, []);
    useEffect(() => {
        void loadSecurity();
    }, [loadSecurity]);
    useEffect(() => {
        let cancelled = false;
        if (!security?.token || security.revoked) {
            setQrImage(null);
            return () => undefined;
        }
        QRCode.toDataURL(security.token, {
            margin: 2,
            width: 640,
            errorCorrectionLevel: 'M',
            color: { dark: '#14532d', light: '#ffffff' }
        })
            .then((url) => {
            if (!cancelled)
                setQrImage(url);
        })
            .catch(() => {
            if (!cancelled)
                setQrImage(null);
        });
        return () => {
            cancelled = true;
        };
    }, [security]);
    const handleSave = useCallback(async () => {
        if (!draft)
            return;
        if (timeToMinutes(draft.officialDeparture) <= timeToMinutes(draft.officialArrival)) {
            setMessage({ tone: 'error', text: 'Closing time must be after the official arrival time.' });
            return;
        }
        const result = await save({
            ...draft,
            holidays: [...new Set(draft.holidays)].sort(),
            weekendDays: [...new Set(draft.weekendDays)].sort()
        });
        if (result)
            setMessage({ tone: 'error', text: result });
        else
            setMessage({ tone: 'success', text: 'Settings saved.' });
    }, [draft, save]);
    const handleQr = useCallback(async (mode) => {
        setQrBusy(mode);
        setMessage(null);
        try {
            const result = await regenerateQrToken(mode, 0);
            await loadSecurity();
            setMessage({
                tone: 'success',
                text: mode === 'revoke'
                    ? 'QR token revoked. No attendance can be marked until a new token is generated.'
                    : `New QR token generated${result.expiresAt ? `, valid until ${new Date(result.expiresAt).toLocaleString()}` : ''}. Print the new code and destroy the old one.`
            });
        }
        catch (e) {
            setMessage({
                tone: 'error',
                text: e instanceof ApiError ? e.message : 'The QR action failed.'
            });
        }
        finally {
            setQrBusy(null);
        }
    }, [loadSecurity]);
    if (loading || !draft)
        return _jsx(Spinner, { label: "Loading settings" });
    if (error)
        return _jsx(Alert, { tone: "error", children: error });
    const isExpired = Boolean(security?.expiresAt && security.expiresAt < Date.now());
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { title: "Settings", subtitle: `Configured for Indian Standard Time · ${formatIstLong(Date.now())}` }), message && _jsx(Alert, { tone: message.tone, children: message.text }), _jsxs("section", { className: "card", children: [_jsx("h2", { className: "mb-3 font-semibold text-brand-900", children: "Official timings" }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: [_jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "arrival", children: "Official arrival" }), _jsx("input", { id: "arrival", type: "time", className: "input", value: draft.officialArrival, onChange: (e) => setDraft({ ...draft, officialArrival: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "departure", children: "Closing time" }), _jsx("input", { id: "departure", type: "time", className: "input", value: draft.officialDeparture, onChange: (e) => setDraft({ ...draft, officialDeparture: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "grace", children: "Grace period (minutes)" }), _jsx("input", { id: "grace", type: "number", min: 0, max: 120, className: "input", value: draft.graceMinutes, onChange: (e) => setDraft({ ...draft, graceMinutes: Number.parseInt(e.target.value, 10) || 0 }) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "min-hours", children: "Minimum working minutes" }), _jsx("input", { id: "min-hours", type: "number", min: 0, step: 15, className: "input", value: draft.minimumWorkingMinutes, onChange: (e) => setDraft({
                                            ...draft,
                                            minimumWorkingMinutes: Number.parseInt(e.target.value, 10) || 0
                                        }) })] })] }), _jsx("p", { className: "muted mt-2", children: "An arrival is marked late when it is more than the grace period past the official arrival time. The same grace applies to early departures." })] }), _jsxs("section", { className: "card", children: [_jsx("h2", { className: "mb-3 font-semibold text-brand-900", children: "Working days and holidays" }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("p", { className: "label", children: "Weekly off" }), _jsx("div", { className: "flex flex-wrap gap-2", children: WEEKDAYS.map((day) => {
                                            const checked = draft.weekendDays.includes(day.value);
                                            return (_jsxs("label", { className: `flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked
                                                    ? 'border-brand-700 bg-brand-50 text-brand-900'
                                                    : 'border-slate-300 bg-white text-slate-600'}`, children: [_jsx("input", { type: "checkbox", className: "h-4 w-4 rounded border-slate-300 text-brand-800 focus:ring-brand-600", checked: checked, onChange: (e) => setDraft({
                                                            ...draft,
                                                            weekendDays: e.target.checked
                                                                ? [...draft.weekendDays, day.value]
                                                                : draft.weekendDays.filter((value) => value !== day.value)
                                                        }) }), day.label] }, day.value));
                                        }) }), _jsxs("label", { className: "mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700", children: [_jsx("input", { type: "checkbox", className: "h-4 w-4 rounded border-slate-300 text-brand-800 focus:ring-brand-600", checked: draft.allowWeekendAttendance, onChange: (e) => setDraft({ ...draft, allowWeekendAttendance: e.target.checked }) }), "Allow attendance on weekly-off days (e.g. for duties/exams)"] })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "holiday-date", children: "Add a holiday" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { id: "holiday-date", type: "date", className: "input", value: newHoliday, onChange: (e) => setNewHoliday(e.target.value) }), _jsx("button", { type: "button", className: "btn-secondary", disabled: !newHoliday, onClick: () => setDraft({
                                                    ...draft,
                                                    holidays: [...new Set([...draft.holidays, newHoliday])].sort()
                                                }), children: "Add" })] }), _jsxs("ul", { className: "mt-3 flex flex-wrap gap-2", children: [draft.holidays.length === 0 && (_jsx("li", { className: "muted", children: "No holidays configured." })), draft.holidays.map((holiday) => (_jsxs("li", { className: "flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-sm", children: [holiday, _jsx("button", { type: "button", "aria-label": `Remove holiday ${holiday}`, className: "font-bold text-red-600", onClick: () => setDraft({
                                                            ...draft,
                                                            holidays: draft.holidays.filter((value) => value !== holiday)
                                                        }), children: "\u00D7" })] }, holiday)))] })] })] }), _jsx("div", { className: "mt-4", children: _jsx("button", { type: "button", className: "btn-primary", onClick: handleSave, disabled: saving, children: saving ? 'Saving…' : 'Save settings' }) })] }), _jsxs("section", { className: "card", children: [_jsx("h2", { className: "mb-1 font-semibold text-brand-900", children: "College QR code" }), _jsx("p", { className: "muted mb-3", children: "The QR code carries a random college token \u2014 never a teacher ID or password. Every attendance submission is validated on the server against this token." }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 no-print", children: [_jsx("button", { type: "button", className: "btn-primary", onClick: () => handleQr('regenerate'), disabled: qrBusy !== null, children: qrBusy === 'regenerate' ? 'Generating…' : 'Regenerate token' }), _jsx("button", { type: "button", className: "btn-danger", onClick: () => handleQr('revoke'), disabled: qrBusy !== null || Boolean(security?.revoked), children: qrBusy === 'revoke' ? 'Revoking…' : 'Revoke token' }), _jsx("button", { type: "button", className: "btn-secondary", disabled: !qrImage, onClick: () => window.print(), children: "Print QR code" })] }), _jsxs("div", { className: "mt-4 grid gap-4 md:grid-cols-2", children: [_jsx("div", { className: "print-area", children: _jsx("div", { className: "rounded-lg border border-slate-200 p-4 text-center", children: security?.revoked ? (_jsx("p", { className: "py-10 font-semibold text-red-700", children: "Token revoked \u2014 attendance is disabled." })) : qrImage ? (_jsxs(_Fragment, { children: [_jsx("img", { src: qrImage, alt: "College attendance QR code", className: "mx-auto h-64 w-64" }), _jsx("p", { className: "mt-2 text-xs text-slate-500", children: security?.expiresAt
                                                    ? `Valid until ${new Date(security.expiresAt).toLocaleString()}`
                                                    : 'No expiry configured' })] })) : (_jsx("p", { className: "py-10 text-slate-500", children: "No QR token yet. Generate one to display the college code." })) }) }), _jsxs("div", { className: "space-y-3 text-sm text-slate-700", children: [_jsxs("div", { children: [_jsx("p", { className: "label", children: "Token status" }), _jsx("p", { children: security?.revoked
                                                    ? 'Revoked'
                                                    : security?.expiresAt && isExpired
                                                        ? 'Expired'
                                                        : security
                                                            ? 'Active'
                                                            : 'Not generated' })] }), _jsxs(Alert, { tone: "warning", title: "Honest limitation of a fixed QR code", children: ["A fixed QR code displayed at the college gate can be photographed and scanned from anywhere, so scanning it alone does ", _jsx("strong", { children: "not" }), " prove physical presence. Server-side checks (account status, approved device, duplicate prevention, rate limits) are enforced; for stronger assurance move to a rotating QR refreshed every 30\u201360 seconds, displayed inside the college."] }), _jsx(Alert, { tone: "info", title: "Network and GPS verification", children: "Browser JavaScript cannot reliably identify the college Wi-Fi network. If the college operates its own gateway, the recommended approach is verification at the gateway (or on a server inside the college network) forwarding a signed header to the attendance service. GPS can be added as an extra signal but is not tamper-proof by itself. Both are optional and are not enabled by default." })] })] })] }), _jsxs("section", { className: "card", children: [_jsx("h2", { className: "mb-3 font-semibold text-brand-900", children: "Current configuration" }), _jsxs("ul", { className: "grid gap-2 text-sm text-slate-700 sm:grid-cols-2", children: [_jsxs("li", { children: ["Official arrival: ", _jsx("strong", { children: draft.officialArrival })] }), _jsxs("li", { children: ["Closing time: ", _jsx("strong", { children: draft.officialDeparture })] }), _jsxs("li", { children: ["Grace period: ", _jsxs("strong", { children: [draft.graceMinutes, " minutes"] })] }), _jsxs("li", { children: ["Minimum working time: ", _jsxs("strong", { children: [draft.minimumWorkingMinutes, " minutes"] })] }), _jsxs("li", { children: ["Weekly off:", ' ', _jsx("strong", { children: draft.weekendDays.length === 0
                                            ? 'None'
                                            : draft.weekendDays.map((d) => WEEKDAYS[d].label).join(', ') })] }), _jsxs("li", { children: ["Holidays configured: ", _jsx("strong", { children: draft.holidays.length })] }), _jsxs("li", { className: "sm:col-span-2", children: ["Today in IST: ", _jsxs("strong", { children: [nowIstDateKey(), " \u00B7 ", istTimeKey(Date.now())] })] })] })] })] }));
}
