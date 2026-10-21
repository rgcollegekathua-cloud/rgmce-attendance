import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, PageHeader, Spinner } from '../../components/ui';
import { ApiError, approveDevice, createTeacher, resetTeacherPassword, setTeacherStatus, subscribeDevices, subscribeUsers } from '../../lib/api';
import { generatePassword } from '../../lib/password';
import { formatPasswordRules, passwordProblem, validateTeacherId } from '../../lib/teachers';
import { validateName } from '../../lib/teacherId';
export function TeacherManagement() {
    const [users, setUsers] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [name, setName] = useState('');
    const [teacherId, setTeacherId] = useState('');
    const [password, setPassword] = useState('');
    const [creating, setCreating] = useState(false);
    const [formError, setFormError] = useState(null);
    const [issued, setIssued] = useState(null);
    const [search, setSearch] = useState('');
    useEffect(() => {
        const unsubscribeUsers = subscribeUsers((values) => {
            setUsers(values);
            setLoading(false);
        }, (err) => {
            setError(err.message);
            setLoading(false);
        });
        const unsubscribeDevices = subscribeDevices((values) => setDevices(values), () => undefined);
        return () => {
            unsubscribeUsers();
            unsubscribeDevices();
        };
    }, []);
    const deviceByUid = useMemo(() => new Map(devices.map((device) => [device.uid, device])), [devices]);
    const teachers = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return users
            .filter((user) => user.role === 'teacher')
            .filter((user) => !needle ||
            user.name.toLowerCase().includes(needle) ||
            user.teacherId.toLowerCase().includes(needle))
            .sort((a, b) => a.teacherId.localeCompare(b.teacherId));
    }, [users, search]);
    const pendingDevices = useMemo(() => devices.filter((device) => device.pendingDeviceId && device.pendingDeviceId !== device.deviceId), [devices]);
    const runAction = useCallback(async (action, successMessage) => {
        setNotice(null);
        setError(null);
        try {
            await action();
            setNotice(successMessage);
        }
        catch (e) {
            setError(e instanceof ApiError ? e.message : 'The action failed.');
        }
    }, []);
    const handleCreate = useCallback(async (event) => {
        event.preventDefault();
        setFormError(null);
        const idProblem = validateTeacherId(teacherId);
        if (idProblem)
            return setFormError(idProblem);
        const nameProblem = validateName(name);
        if (nameProblem)
            return setFormError(nameProblem);
        const effectivePassword = password || generatePassword();
        const passwordProblemText = passwordProblem(effectivePassword);
        if (passwordProblemText)
            return setFormError(passwordProblemText);
        setCreating(true);
        try {
            const result = await createTeacher({
                teacherId: teacherId.trim(),
                name: name.trim(),
                initialPassword: effectivePassword
            });
            setIssued({ id: teacherId.trim().toUpperCase(), password: result.temporaryPassword });
            setName('');
            setTeacherId('');
            setPassword('');
            setNotice(`Teacher account ${teacherId.trim().toUpperCase()} created.`);
        }
        catch (e) {
            setFormError(e instanceof ApiError ? e.message : 'Could not create the teacher account.');
        }
        finally {
            setCreating(false);
        }
    }, [name, teacherId, password]);
    if (loading)
        return _jsx(Spinner, { label: "Loading teachers" });
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { title: "Teacher Management", subtitle: "Accounts are created by the administrator only. There is no public registration." }), error && _jsx(Alert, { tone: "error", children: error }), notice && _jsx(Alert, { tone: "success", children: notice }), issued && (_jsxs(Alert, { tone: "warning", title: "Initial credentials \u2014 shown only once", children: [_jsxs("p", { children: ["Teacher ID ", _jsx("strong", { children: issued.id }), " \u00B7 Password", ' ', _jsx("code", { className: "rounded bg-white px-1 py-0.5 font-mono", children: issued.password })] }), _jsx("p", { className: "mt-1", children: "Share these details with the teacher personally. The system does not store readable passwords and will not show this again." }), _jsx("button", { type: "button", className: "btn-secondary mt-2", onClick: () => {
                            void navigator.clipboard?.writeText(`${issued.id}: ${issued.password}`);
                            setNotice('Credentials copied to the clipboard.');
                        }, children: "Copy credentials" })] })), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "mb-3 font-semibold text-brand-900", children: "Create a teacher account" }), _jsxs("form", { onSubmit: handleCreate, className: "grid gap-3 md:grid-cols-3", noValidate: true, children: [_jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "teacher-name", children: "Teacher name" }), _jsx("input", { id: "teacher-name", className: "input", value: name, onChange: (e) => setName(e.target.value), placeholder: "Full name", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "teacher-id", children: "Teacher ID" }), _jsx("input", { id: "teacher-id", className: "input", value: teacherId, onChange: (e) => setTeacherId(e.target.value), placeholder: "e.g. TCH-102", autoCapitalize: "characters", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "label", htmlFor: "teacher-password", children: "Initial password (optional)" }), _jsx("input", { id: "teacher-password", className: "input", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Leave blank to generate", autoComplete: "new-password" }), _jsx("p", { className: "muted mt-1", children: formatPasswordRules() })] }), formError && (_jsx("div", { className: "md:col-span-3", children: _jsx(Alert, { tone: "error", children: formError }) })), _jsx("div", { className: "md:col-span-3", children: _jsx("button", { type: "submit", className: "btn-primary", disabled: creating, children: creating ? 'Creating…' : 'Create teacher account' }) })] })] }), pendingDevices.length > 0 && (_jsxs("div", { className: "card border-amber-300", children: [_jsxs("h2", { className: "mb-3 font-semibold text-amber-800", children: ["Device change requests (", pendingDevices.length, ")"] }), _jsx("ul", { className: "space-y-3", children: pendingDevices.map((device) => (_jsxs("li", { className: "flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsxs("p", { className: "font-semibold text-slate-800", children: [users.find((u) => u.uid === device.uid)?.name ?? device.teacherId, " (", device.teacherId, ")"] }), _jsxs("p", { className: "text-sm text-slate-600", children: ["New installation: ", _jsx("strong", { children: device.pendingDeviceLabel ?? device.pendingDeviceId })] }), _jsxs("p", { className: "text-xs text-slate-500", children: ["Currently approved: ", device.deviceLabel, " \u00B7", ' ', device.requestedAt ? new Date(device.requestedAt).toLocaleString() : ''] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", className: "btn-primary", onClick: () => runAction(() => approveDevice(device.uid, true, 'Device change approved by admin'), 'Device approved. The previous device is now rejected.'), children: "Approve" }), _jsx("button", { type: "button", className: "btn-secondary", onClick: () => runAction(() => approveDevice(device.uid, false, 'Device change rejected by admin'), 'Device change rejected. The current phone keeps working.'), children: "Reject" })] })] }, device.uid))) })] })), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("h2", { className: "font-semibold text-brand-900", children: ["Teachers (", teachers.length, ")"] }), _jsx("input", { className: "input sm:max-w-xs", placeholder: "Search by name or ID", value: search, onChange: (e) => setSearch(e.target.value), "aria-label": "Search teachers" })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[760px] text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500", children: [_jsx("th", { className: "py-2 pr-3", children: "Name" }), _jsx("th", { className: "py-2 pr-3", children: "Teacher ID" }), _jsx("th", { className: "py-2 pr-3", children: "Account" }), _jsx("th", { className: "py-2 pr-3", children: "Device" }), _jsx("th", { className: "py-2 pr-3", children: "Actions" })] }) }), _jsx("tbody", { children: teachers.map((teacher) => {
                                        const device = deviceByUid.get(teacher.uid);
                                        const deviceApproved = device?.status === 'approved' &&
                                            (!device.pendingDeviceId || device.pendingDeviceId === device.deviceId);
                                        const pending = device?.pendingDeviceId && device.pendingDeviceId !== device.deviceId;
                                        return (_jsxs("tr", { className: "border-b border-slate-100 align-top", children: [_jsx("td", { className: "py-2 pr-3 font-medium text-slate-800", children: teacher.name }), _jsx("td", { className: "py-2 pr-3 text-slate-600", children: teacher.teacherId }), _jsx("td", { className: "py-2 pr-3", children: _jsx("span", { className: `rounded px-2 py-0.5 text-xs font-semibold ${teacher.active
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'}`, children: teacher.active ? 'Active' : 'Deactivated' }) }), _jsx("td", { className: "py-2 pr-3", children: device ? (_jsx("span", { className: `rounded px-2 py-0.5 text-xs font-semibold ${pending
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : deviceApproved
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-slate-100 text-slate-600'}`, children: pending ? 'Change pending' : deviceApproved ? 'Approved' : device.status })) : (_jsx("span", { className: "text-xs text-slate-500", children: "Not registered" })) }), _jsx("td", { className: "py-2 pr-3", children: _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { type: "button", className: teacher.active ? 'btn-danger' : 'btn-primary', onClick: () => runAction(() => setTeacherStatus(teacher.uid, !teacher.active, teacher.active
                                                                    ? 'Deactivated by administrator'
                                                                    : 'Reactivated by administrator'), `${teacher.name} ${teacher.active ? 'deactivated' : 'activated'}.`), children: teacher.active ? 'Deactivate' : 'Activate' }), _jsx("button", { type: "button", className: "btn-secondary", onClick: () => {
                                                                    const next = generatePassword();
                                                                    void runAction(async () => {
                                                                        const result = await resetTeacherPassword(teacher.uid, next);
                                                                        setIssued({ id: teacher.teacherId, password: result.temporaryPassword });
                                                                        setNotice(`Password reset for ${teacher.name}.`);
                                                                    }, `Password reset for ${teacher.name}.`);
                                                                }, children: "Reset password" })] }) })] }, teacher.uid));
                                    }) })] }) })] })] }));
}
