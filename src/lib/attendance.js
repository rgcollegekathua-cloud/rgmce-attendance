import { formatClock, formatDuration, istMinutesOfDay, timeToMinutes } from './time';
export function recordId(teacherId, date) {
    return `${teacherId}_${date}`;
}
export function isWeekendDate(dateKey, timing) {
    const [y, m, d] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return timing.weekendDays.includes(weekday);
}
export function isHolidayDate(dateKey, timing) {
    return timing.holidays.includes(dateKey);
}
export function deriveDayStatus(record, timing, todayKey) {
    const dateKey = record?.date ?? todayKey;
    const hasArrival = Boolean(record?.arrivalMs);
    const hasDeparture = Boolean(record?.departureMs);
    if (hasArrival || hasDeparture) {
        return 'present';
    }
    if (!record) {
        if (isHolidayDate(dateKey, timing))
            return 'holiday';
        if (isWeekendDate(dateKey, timing))
            return 'weekend';
        if (dateKey === todayKey)
            return 'upcoming';
        return 'none';
    }
    return 'incomplete';
}
export function isIncomplete(record) {
    if (!record)
        return false;
    return Boolean(record.arrivalMs) !== Boolean(record.departureMs);
}
export function hasNoRecord(record) {
    return !record || (!record.arrivalMs && !record.departureMs);
}
export function computeDayStats(records, totalTeachers) {
    const stats = {
        total: totalTeachers,
        present: 0,
        missingArrival: 0,
        missingDeparture: 0,
        noRecord: 0,
        late: 0,
        early: 0
    };
    for (const record of records) {
        if (record.arrivalMs)
            stats.present += 1;
        if (record.arrivalMs && !record.departureMs)
            stats.missingDeparture += 1;
        if (!record.arrivalMs && record.departureMs)
            stats.missingArrival += 1;
        if (record.isLate)
            stats.late += 1;
        if (record.earlyDeparture)
            stats.early += 1;
        if (!record.arrivalMs && !record.departureMs)
            stats.noRecord += 1;
    }
    const withPunch = records.filter((record) => record.arrivalMs || record.departureMs).length;
    stats.noRecord = Math.max(0, totalTeachers - withPunch);
    return stats;
}
export function matchesFilter(record, filter, nameLookup) {
    const name = nameLookup.get(record.uid) ?? record.teacherName ?? '';
    if (filter.search) {
        const needle = filter.search.trim().toLowerCase();
        const haystack = `${record.teacherId} ${name}`.toLowerCase();
        if (!haystack.includes(needle))
            return false;
    }
    if (filter.onlyMissing && !isIncomplete(record))
        return false;
    switch (filter.status) {
        case 'present':
            if (!(record.arrivalMs && record.departureMs))
                return false;
            break;
        case 'incomplete':
            if (!isIncomplete(record))
                return false;
            break;
        case 'late':
            if (!record.isLate)
                return false;
            break;
        case 'early':
            if (!record.earlyDeparture)
                return false;
            break;
        case 'missing':
            if (!(!record.arrivalMs || !record.departureMs))
                return false;
            break;
        default:
            break;
    }
    return true;
}
export function buildMonthlySummary(records, teachers, nameLookup) {
    const rows = new Map();
    const ensure = (uid, teacherId) => {
        const existing = rows.get(uid);
        if (existing)
            return existing;
        const row = {
            uid,
            teacherId,
            name: nameLookup.get(uid) ?? teacherId,
            daysPresent: 0,
            daysIncomplete: 0,
            lateDays: 0,
            earlyDays: 0,
            totalMinutes: 0
        };
        rows.set(uid, row);
        return row;
    };
    for (const teacher of teachers) {
        ensure(teacher.uid, teacher.teacherId);
    }
    for (const record of records) {
        if (!record.arrivalMs && !record.departureMs)
            continue;
        const row = ensure(record.uid, record.teacherId);
        if (record.arrivalMs && record.departureMs)
            row.daysPresent += 1;
        else
            row.daysIncomplete += 1;
        if (record.isLate)
            row.lateDays += 1;
        if (record.earlyDeparture)
            row.earlyDays += 1;
        row.totalMinutes += record.workingMinutes ?? 0;
    }
    return [...rows.values()].sort((a, b) => a.teacherId.localeCompare(b.teacherId));
}
/** Recomputes display flags from stored times (used when settings change). */
export function computeFlags(record, timing) {
    const arrivalMinutes = record.arrivalMs ? istMinutesOfDay(record.arrivalMs) : null;
    const departureMinutes = record.departureMs ? istMinutesOfDay(record.departureMs) : null;
    const officialArrival = timeToMinutes(timing.officialArrival);
    const officialDeparture = timeToMinutes(timing.officialDeparture);
    const lateMinutes = arrivalMinutes === null ? 0 : Math.max(0, arrivalMinutes - officialArrival);
    const earlyMinutes = departureMinutes === null ? 0 : Math.max(0, officialDeparture - departureMinutes);
    return {
        isLate: lateMinutes > timing.graceMinutes,
        lateMinutes,
        earlyDeparture: earlyMinutes > timing.graceMinutes,
        earlyMinutes,
        workingMinutes: record.arrivalMs && record.departureMs
            ? Math.round((record.departureMs - record.arrivalMs) / 60000)
            : 0
    };
}
export function todayRowSummary(record) {
    return [
        `Arrival ${record.arrivalTime ?? formatClock(record.arrivalMs)}`,
        `Departure ${record.departureTime ?? formatClock(record.departureMs)}`,
        record.workingMinutes ? formatDuration(record.workingMinutes) : ''
    ]
        .filter(Boolean)
        .join(' · ');
}
