import { formatClock, formatDuration } from '../lib/time';
import type { DailyAttendance, TimingSettings } from '../lib/types';
import { deriveDayStatus, isIncomplete } from '../lib/attendance';

interface Props {
  records: DailyAttendance[];
  nameLookup: Map<string, string>;
  timing: TimingSettings;
  todayKey: string;
  showDate?: boolean;
  onCorrect?: (record: DailyAttendance) => void;
  emptyText?: string;
}

const statusLabels: Record<string, string> = {
  present: 'Present',
  incomplete: 'Incomplete',
  late: 'Late',
  early: 'Early',
  holiday: 'Holiday',
  weekend: 'Weekend',
  upcoming: 'Not marked yet',
  none: 'No record'
};

export function AttendanceTable({
  records,
  nameLookup,
  timing,
  todayKey,
  showDate = false,
  onCorrect,
  emptyText = 'No attendance records match this selection.'
}: Props) {
  if (records.length === 0) {
    return <p className="muted py-6 text-center">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
            {showDate && <th className="py-2 pr-3">Date</th>}
            <th className="py-2 pr-3">Teacher</th>
            <th className="py-2 pr-3">ID</th>
            <th className="py-2 pr-3">Arrival</th>
            <th className="py-2 pr-3">Departure</th>
            <th className="py-2 pr-3">Hours</th>
            <th className="py-2 pr-3">Status</th>
            {onCorrect && <th className="py-2 pr-3 no-print">Action</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const status = deriveDayStatus(record, timing, todayKey);
            const flags: string[] = [];
            if (record.isLate) flags.push(`late ${record.lateMinutes ?? 0}m`);
            if (record.earlyDeparture) flags.push(`early ${record.earlyMinutes ?? 0}m`);
            if (isIncomplete(record)) flags.push('missing punch');
            return (
              <tr key={record.id} className="border-b border-slate-100 align-top">
                {showDate && (
                  <td className="py-2 pr-3 font-medium text-slate-700">{record.date}</td>
                )}
                <td className="py-2 pr-3 font-medium text-slate-800">
                  {nameLookup.get(record.uid) ?? record.teacherName}
                  {record.corrected && (
                    <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800">
                      corrected
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-slate-600">{record.teacherId}</td>
                <td className="py-2 pr-3 font-medium text-slate-800">
                  {record.arrivalTime ?? formatClock(record.arrivalMs)}
                </td>
                <td className="py-2 pr-3 font-medium text-slate-800">
                  {record.departureTime ?? formatClock(record.departureMs)}
                </td>
                <td className="py-2 pr-3 text-slate-600">
                  {formatDuration(record.workingMinutes)}
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      status === 'present' && !record.isLate && !record.earlyDeparture
                        ? 'bg-green-100 text-green-800'
                        : status === 'incomplete'
                          ? 'bg-red-100 text-red-800'
                          : status === 'upcoming'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {statusLabels[status]}
                  </span>
                  {flags.length > 0 && (
                    <span className="ml-2 text-xs text-amber-700">{flags.join(', ')}</span>
                  )}
                </td>
                {onCorrect && (
                  <td className="py-2 pr-3 no-print">
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-800 underline underline-offset-2"
                      onClick={() => onCorrect(record)}
                    >
                      Correct
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PrintHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="print-header mb-3 hidden border-b-2 border-black pb-2 text-black">
      <p className="text-base font-bold">Rajiv Gandhi Memorial College of Education, Kathua</p>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs">{subtitle}</p>
    </div>
  );
}
