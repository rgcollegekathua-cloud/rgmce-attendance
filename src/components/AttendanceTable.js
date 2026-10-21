import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatClock, formatDuration } from '../lib/time';
import { deriveDayStatus, isIncomplete } from '../lib/attendance';
const statusLabels = {
    present: 'Present',
    incomplete: 'Incomplete',
    late: 'Late',
    early: 'Early',
    holiday: 'Holiday',
    weekend: 'Weekend',
    upcoming: 'Not marked yet',
    none: 'No record'
};
export function AttendanceTable({ records, nameLookup, timing, todayKey, showDate = false, onCorrect, emptyText = 'No attendance records match this selection.' }) {
    if (records.length === 0) {
        return _jsx("p", { className: "muted py-6 text-center", children: emptyText });
    }
    return (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[720px] text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500", children: [showDate && _jsx("th", { className: "py-2 pr-3", children: "Date" }), _jsx("th", { className: "py-2 pr-3", children: "Teacher" }), _jsx("th", { className: "py-2 pr-3", children: "ID" }), _jsx("th", { className: "py-2 pr-3", children: "Arrival" }), _jsx("th", { className: "py-2 pr-3", children: "Departure" }), _jsx("th", { className: "py-2 pr-3", children: "Hours" }), _jsx("th", { className: "py-2 pr-3", children: "Status" }), onCorrect && _jsx("th", { className: "py-2 pr-3 no-print", children: "Action" })] }) }), _jsx("tbody", { children: records.map((record) => {
                        const status = deriveDayStatus(record, timing, todayKey);
                        const flags = [];
                        if (record.isLate)
                            flags.push(`late ${record.lateMinutes ?? 0}m`);
                        if (record.earlyDeparture)
                            flags.push(`early ${record.earlyMinutes ?? 0}m`);
                        if (isIncomplete(record))
                            flags.push('missing punch');
                        return (_jsxs("tr", { className: "border-b border-slate-100 align-top", children: [showDate && (_jsx("td", { className: "py-2 pr-3 font-medium text-slate-700", children: record.date })), _jsxs("td", { className: "py-2 pr-3 font-medium text-slate-800", children: [nameLookup.get(record.uid) ?? record.teacherName, record.corrected && (_jsx("span", { className: "ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800", children: "corrected" }))] }), _jsx("td", { className: "py-2 pr-3 text-slate-600", children: record.teacherId }), _jsx("td", { className: "py-2 pr-3 font-medium text-slate-800", children: record.arrivalTime ?? formatClock(record.arrivalMs) }), _jsx("td", { className: "py-2 pr-3 font-medium text-slate-800", children: record.departureTime ?? formatClock(record.departureMs) }), _jsx("td", { className: "py-2 pr-3 text-slate-600", children: formatDuration(record.workingMinutes) }), _jsxs("td", { className: "py-2 pr-3", children: [_jsx("span", { className: `rounded px-2 py-0.5 text-xs font-semibold ${status === 'present' && !record.isLate && !record.earlyDeparture
                                                ? 'bg-green-100 text-green-800'
                                                : status === 'incomplete'
                                                    ? 'bg-red-100 text-red-800'
                                                    : status === 'upcoming'
                                                        ? 'bg-slate-100 text-slate-600'
                                                        : 'bg-amber-100 text-amber-800'}`, children: statusLabels[status] }), flags.length > 0 && (_jsx("span", { className: "ml-2 text-xs text-amber-700", children: flags.join(', ') }))] }), onCorrect && (_jsx("td", { className: "py-2 pr-3 no-print", children: _jsx("button", { type: "button", className: "text-xs font-semibold text-brand-800 underline underline-offset-2", onClick: () => onCorrect(record), children: "Correct" }) }))] }, record.id));
                    }) })] }) }));
}
export function PrintHeader({ title, subtitle }) {
    return (_jsxs("div", { className: "print-header mb-3 hidden border-b-2 border-black pb-2 text-black", children: [_jsx("p", { className: "text-base font-bold", children: "Rajiv Gandhi Memorial College of Education, Kathua" }), _jsx("p", { className: "text-sm font-semibold", children: title }), _jsx("p", { className: "text-xs", children: subtitle })] }));
}
