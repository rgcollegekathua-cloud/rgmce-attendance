import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRScanner } from '../components/QRScanner';
import { Alert, PageHeader, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ApiError, markAttendance, registerDevice, subscribeMyAttendance, subscribeMyDay } from '../lib/api';
import { getOrCreateDeviceIdentity } from '../lib/device';
import { formatClock, formatDuration, formatIstLong, istDateKey, nowIstDateKey } from '../lib/time';
export function TeacherDashboard() {
    const { profile, device, deviceLoading } = useAuth();
    const [todayKey] = useState(() => nowIstDateKey());
    const [record, setRecord] = useState(null);
    const [history, setHistory] = useState([]);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [qrToken, setQrToken] = useState(null);
    const [busy, setBusy] = useState(null);
    const [notice, setNotice] = useState(null);
    const [dataError, setDataError] = useState(null);
    const recordId = profile ? `${profile.teacherId}_${todayKey}` : '';
    useEffect(() => {
        if (!profile)
            return undefined;
        const unsubscribeDay = subscribeMyDay(recordId, (value) => setRecord(value), (error) => setDataError(error.message));
        const unsubscribeHistory = subscribeMyAttendance(profile.uid, (values) => setHistory(values), () => undefined);
        return () => {
            unsubscribeDay();
            unsubscribeHistory();
        };
    }, [profile, recordId]);
    const identity = useMemo(() => getOrCreateDeviceIdentity(), []);
    const deviceApproved = device !== null &&
        device.status === 'approved' &&
        device.deviceId === identity.deviceId;
    const handleRegisterDevice = useCallback(async () => {
        if (!profile)
            return;
        setBusy('register');
        setNotice(null);
        try {
            const result = await registerDevice(identity.deviceId, identity.deviceSecret, identity.label);
            if (result.status === 'approved') {
                setNotice({ tone: 'success', text: result.message });
            }
            else {
                setNotice({
                    tone: 'warning',
                    text: result.message
                });
            }
        }
        catch (e) {
            setNotice({
                tone: 'error',
                text: e instanceof ApiError ? e.message : 'Could not register this device.'
            });
        }
        finally {
            setBusy(null);
        }
    }, [profile, identity]);
    const handleScan = useCallback((text) => {
        const token = text.trim();
        if (!token)
            return;
        setQrToken(token);
        setScannerOpen(false);
        setNotice({ tone: 'info', text: 'QR code captured. Choose Arrival or Departure.' });
    }, []);
    const submit = useCallback(async (type) => {
        if (!qrToken) {
            setNotice({ tone: 'error', text: 'Scan the college QR code first.' });
            return;
        }
        setBusy(type);
        setNotice(null);
        try {
            const result = await markAttendance({
                qrToken,
                type,
                deviceId: identity.deviceId,
                deviceSecret: identity.deviceSecret
            });
            setNotice({
                tone: 'success',
                text: `${type === 'arrival' ? 'Arrival' : 'Departure'} recorded at ${result.timeLabel} (server time, IST) on ${result.date}.`
            });
            setQrToken(null);
        }
        catch (e) {
            setNotice({
                tone: 'error',
                text: e instanceof ApiError ? e.message : 'Attendance could not be recorded.'
            });
        }
        finally {
            setBusy(null);
        }
    }, [qrToken, identity]);
    if (!profile)
        return _jsx(Spinner, { label: "Loading your dashboard" });
    const todayStatus = record
        ? {
            arrival: record.arrivalTime ?? formatClock(record.arrivalMs),
            departure: record.departureTime ?? formatClock(record.departureMs),
            late: Boolean(record.isLate),
            early: Boolean(record.earlyDeparture)
        }
        : null;
    const sortedHistory = [...history]
        .filter((item) => item.date !== todayKey)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 7);
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { title: `Welcome, ${profile.name.split(' ')[0]}`, subtitle: formatIstLong(Date.now()) }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "card", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Teacher ID" }), _jsx("p", { className: "mt-1 text-2xl font-bold text-brand-900", children: profile.teacherId }), _jsx("p", { className: "muted mt-1", children: profile.name })] }), _jsxs("div", { className: "card", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Today's status" }), todayStatus ? (_jsxs("div", { className: "mt-1 space-y-1 text-sm", children: [_jsxs("p", { children: ["Arrival:", ' ', _jsx("span", { className: "font-semibold text-slate-800", children: todayStatus.arrival }), todayStatus.late && (_jsx("span", { className: "ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800", children: "Late" }))] }), _jsxs("p", { children: ["Departure:", ' ', _jsx("span", { className: "font-semibold text-slate-800", children: todayStatus.departure }), todayStatus.early && (_jsx("span", { className: "ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800", children: "Early" }))] })] })) : (_jsx("p", { className: "mt-1 text-2xl font-bold text-slate-400", children: "Not marked yet" }))] })] }), dataError && _jsx(Alert, { tone: "warning", children: dataError }), _jsx(Alert, { tone: "info", title: "Working day", children: "Only one Arrival and one Departure are accepted per working day, and Departure is only accepted after Arrival. Times are recorded by the college server in Indian Standard Time." }), deviceLoading ? (_jsx(Spinner, { label: "Checking device" })) : !device ? (_jsxs("div", { className: "card space-y-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-brand-900", children: "Register this phone" }), _jsx("p", { className: "muted", children: "This is the first time you are signing in on this installation. Register it so the administrator can approve it." })] }), _jsx("button", { type: "button", className: "btn-primary w-full sm:w-auto", onClick: handleRegisterDevice, disabled: busy === 'register', children: busy === 'register' ? 'Registering…' : `Register ${identity.label}` })] })) : !deviceApproved ? (_jsx(Alert, { tone: "warning", title: "Device approval pending", children: device.pendingDeviceId && device.pendingDeviceId !== identity.deviceId
                    ? 'A different installation is awaiting administrator approval. Your previously approved phone keeps working until the change is approved.'
                    : 'This installation is waiting for administrator approval. Attendance marking is disabled until it is approved.' })) : null, _jsxs("div", { className: "card space-y-4 no-print", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-brand-900", children: "Mark attendance" }), _jsxs("p", { className: "muted", children: [formatIstLong(Date.now()), " \u00B7 Indian Standard Time"] })] }), _jsx("button", { type: "button", className: "btn-secondary", onClick: () => setScannerOpen((open) => !open), disabled: !deviceApproved, children: scannerOpen ? 'Hide scanner' : 'Scan college QR' })] }), _jsx(QRScanner, { active: scannerOpen, onScan: handleScan, onClose: () => setScannerOpen(false) }), qrToken && (_jsx(Alert, { tone: "success", title: "QR code captured", children: "The college QR token is ready. Choose an action below." })), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx("button", { type: "button", className: "btn-primary min-h-[64px] w-full text-base", onClick: () => submit('arrival'), disabled: !deviceApproved || !qrToken || busy !== null, children: busy === 'arrival' ? 'Recording arrival…' : 'Mark Arrival' }), _jsx("button", { type: "button", className: "btn-primary min-h-[64px] w-full text-base", onClick: () => submit('departure'), disabled: !deviceApproved || !qrToken || busy !== null, children: busy === 'departure' ? 'Recording departure…' : 'Mark Departure' })] }), !deviceApproved && (_jsx("p", { className: "muted text-center", children: "Attendance buttons unlock after device approval." })), deviceApproved && !qrToken && (_jsx("p", { className: "muted text-center", children: "Scan the college QR code to unlock the buttons." })), notice && _jsx(Alert, { tone: notice.tone, children: notice.text })] }), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "mb-3 font-semibold text-brand-900", children: "My recent records" }), sortedHistory.length === 0 ? (_jsx("p", { className: "muted", children: "No earlier attendance records yet." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500", children: [_jsx("th", { className: "py-2 pr-3", children: "Date" }), _jsx("th", { className: "py-2 pr-3", children: "Arrival" }), _jsx("th", { className: "py-2 pr-3", children: "Departure" }), _jsx("th", { className: "py-2 pr-3", children: "Hours" })] }) }), _jsx("tbody", { children: sortedHistory.map((item) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "py-2 pr-3 font-medium text-slate-700", children: item.date }), _jsxs("td", { className: "py-2 pr-3", children: [item.arrivalTime ?? formatClock(item.arrivalMs), item.isLate && _jsx("span", { className: "ml-1 text-xs text-amber-700", children: "late" })] }), _jsxs("td", { className: "py-2 pr-3", children: [item.departureTime ?? formatClock(item.departureMs), item.earlyDeparture && (_jsx("span", { className: "ml-1 text-xs text-amber-700", children: "early" }))] }), _jsx("td", { className: "py-2 pr-3", children: formatDuration(item.workingMinutes) })] }, item.id))) })] }) })), _jsxs("p", { className: "muted mt-3", children: ["Today (", istDateKey(), ") is shown above. Contact the administrator for any correction \u2014 teachers cannot edit attendance."] })] })] }));
}
