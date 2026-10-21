import { formatClock, formatDuration, istDateKey } from './time';
function escapeCell(value) {
    const text = value === undefined || value === null ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}
/** Build a CSV string with a UTF-8 BOM so Excel opens Indian text correctly. */
export function buildCsv(headers, rows) {
    const lines = [headers.map(escapeCell).join(',')];
    for (const row of rows) {
        lines.push(row.map(escapeCell).join(','));
    }
    return `\uFEFF${lines.join('\r\n')}\r\n`;
}
export function downloadTextFile(filename, content, mime = 'text/csv;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function attendanceRows(records, lookup) {
    return records.map((record) => [
        record.date,
        record.teacherId,
        lookup.get(record.uid) ?? record.teacherName ?? '',
        record.arrivalTime ?? formatClock(record.arrivalMs),
        record.departureTime ?? formatClock(record.departureMs),
        record.missingArrival ? 'Missing Arrival' : '',
        record.missingDeparture ? 'Missing Departure' : '',
        record.isLate ? `Yes (${record.lateMinutes ?? 0}m)` : 'No',
        record.earlyDeparture ? `Yes (${record.earlyMinutes ?? 0}m)` : 'No',
        record.workingMinutes ? formatDuration(record.workingMinutes) : '',
        record.corrected ? 'Corrected' : ''
    ]);
}
export function exportAttendanceCsv(records, lookup, label) {
    const headers = [
        'Date',
        'Teacher ID',
        'Teacher Name',
        'Arrival',
        'Departure',
        'Missing Arrival',
        'Missing Departure',
        'Late Arrival',
        'Early Departure',
        'Working Hours',
        'Corrected'
    ];
    const csv = buildCsv(headers, attendanceRows(records, lookup));
    downloadTextFile(`rgmce-attendance-${label}-${istDateKey()}.csv`, csv);
}
