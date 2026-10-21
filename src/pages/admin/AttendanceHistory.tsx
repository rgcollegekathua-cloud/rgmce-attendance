import { useCallback, useEffect, useMemo, useState } from 'react';
import { AttendanceTable, PrintHeader } from '../../components/AttendanceTable';
import { Alert, PageHeader, Spinner } from '../../components/ui';
import { useAppSettings } from '../../hooks/useAppSettings';
import {
  buildMonthlySummary,
  matchesFilter,
  type HistoryFilter
} from '../../lib/attendance';
import { ApiError, correctAttendance, fetchAttendanceRange, subscribeUsers } from '../../lib/api';
import { exportAttendanceCsv } from '../../lib/csv';
import {
  formatDuration,
  formatIstLong,
  formatIstMonth,
  istDateKey,
  nowIstDateKey
} from '../../lib/time';
import type { DailyAttendance, UserProfile } from '../../lib/types';

type ViewMode = 'date' | 'range' | 'monthly';

function monthBounds(year: number, monthIndex: number): [string, string] {
  const start = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const end = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return [start, end];
}

interface CorrectionState {
  record: DailyAttendance;
  arrivalTime: string;
  departureTime: string;
  reason: string;
}

export function AttendanceHistory() {
  const { settings, loading: settingsLoading } = useAppSettings();
  const todayKey = nowIstDateKey();
  const currentMonth = useMemo(() => {
    const [y, m] = todayKey.split('-').map((part) => Number.parseInt(part, 10));
    return { year: y, month: m - 1 };
  }, [todayKey]);

  const [view, setView] = useState<ViewMode>('monthly');
  const [dateValue, setDateValue] = useState(todayKey);
  const [fromValue, setFromValue] = useState(monthBounds(currentMonth.year, currentMonth.month)[0]);
  const [toValue, setToValue] = useState(todayKey);
  const [cursor, setCursor] = useState(currentMonth);

  const [records, setRecords] = useState<DailyAttendance[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<HistoryFilter>({
    search: '',
    status: 'all',
    onlyMissing: false
  });
  const [correction, setCorrection] = useState<CorrectionState | null>(null);
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeUsers(
      (values) => setUsers(values),
      (err) => setError(err.message)
    );
    return unsubscribe;
  }, []);

  const range = useMemo<[string, string]>(() => {
    if (view === 'date') return [dateValue, dateValue];
    if (view === 'monthly') return monthBounds(cursor.year, cursor.month);
    if (fromValue <= toValue) return [fromValue, toValue];
    return [toValue, fromValue];
  }, [view, dateValue, fromValue, toValue, cursor]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAttendanceRange(range[0], range[1])
      .then((values) => {
        if (!cancelled) setRecords(values);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Could not load attendance history.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, reloadKey]);

  const nameLookup = useMemo(
    () => new Map(users.map((user) => [user.uid, user.name])),
    [users]
  );
  const activeTeachers = useMemo(
    () => users.filter((user) => user.role === 'teacher' && user.active),
    [users]
  );

  const visible = useMemo(
    () =>
      [...records]
        .filter((record) => matchesFilter(record, filter, nameLookup))
        .sort((a, b) => (a.date === b.date ? a.teacherId.localeCompare(b.teacherId) : a.date < b.date ? 1 : -1)),
    [records, filter, nameLookup]
  );

  const summary = useMemo(
    () => buildMonthlySummary(visible, activeTeachers, nameLookup),
    [visible, activeTeachers, nameLookup]
  );

  const rangeLabel =
    view === 'monthly'
      ? formatIstMonth(cursor.year, cursor.month)
      : view === 'date'
        ? `Date: ${dateValue}`
        : `${range[0]} to ${range[1]}`;

  const openCorrection = useCallback((record: DailyAttendance) => {
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
    if (!correction) return;
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
      setCorrectionSuccess(
        `Correction saved for ${correction.record.teacherId} on ${correction.record.date}. The original record is preserved in the audit log.`
      );
      setCorrection(null);
      setReloadKey((key) => key + 1);
    } catch (e) {
      setCorrectionError(
        e instanceof ApiError ? e.message : 'The correction could not be saved.'
      );
    } finally {
      setCorrectionBusy(false);
    }
  }, [correction]);

  if (!settings || settingsLoading) return <Spinner label="Loading settings" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance History"
        subtitle="All times and dates are in Indian Standard Time (Asia/Kolkata)"
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              Print report
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={visible.length === 0}
              onClick={() => exportAttendanceCsv(visible, nameLookup, range[0])}
            >
              Export CSV ({visible.length})
            </button>
          </>
        }
      />

      <div className="card no-print">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['date', 'Single date'],
              ['range', 'Date range'],
              ['monthly', 'Monthly summary']
            ] as [ViewMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={mode === view ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setView(mode)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {view === 'date' && (
            <div>
              <label className="label" htmlFor="history-date">
                Date
              </label>
              <input
                id="history-date"
                type="date"
                className="input"
                value={dateValue}
                max={todayKey}
                onChange={(e) => setDateValue(e.target.value || todayKey)}
              />
            </div>
          )}

          {view === 'range' && (
            <>
              <div>
                <label className="label" htmlFor="history-from">
                  From
                </label>
                <input
                  id="history-from"
                  type="date"
                  className="input"
                  value={fromValue}
                  onChange={(e) => setFromValue(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="history-to">
                  To
                </label>
                <input
                  id="history-to"
                  type="date"
                  className="input"
                  value={toValue}
                  max={todayKey}
                  onChange={(e) => setToValue(e.target.value)}
                />
              </div>
            </>
          )}

          {view === 'monthly' && (
            <div className="md:col-span-2">
              <label className="label">Month</label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setCursor((c) => {
                      const previous = new Date(Date.UTC(c.year, c.month - 1, 1));
                      return { year: previous.getUTCFullYear(), month: previous.getUTCMonth() };
                    })
                  }
                >
                  ← Previous
                </button>
                <span className="min-w-[160px] text-center font-semibold text-brand-900">
                  {formatIstMonth(cursor.year, cursor.month)}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={
                    cursor.year === currentMonth.year && cursor.month === currentMonth.month
                  }
                  onClick={() =>
                    setCursor((c) => {
                      const next = new Date(Date.UTC(c.year, c.month + 1, 1));
                      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
                    })
                  }
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="label" htmlFor="history-search">
              Teacher name or ID
            </label>
            <input
              id="history-search"
              className="input"
              placeholder="e.g. TCH-102"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="history-status">
              Attendance status
            </label>
            <select
              id="history-status"
              className="input"
              value={filter.status}
              onChange={(e) =>
                setFilter({ ...filter, status: e.target.value as HistoryFilter['status'] })
              }
            >
              <option value="all">All</option>
              <option value="present">Complete day</option>
              <option value="incomplete">Incomplete punch</option>
              <option value="late">Late arrivals</option>
              <option value="early">Early departures</option>
              <option value="missing">Missing arrival or departure</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-800 focus:ring-brand-600"
                checked={filter.onlyMissing}
                onChange={(e) => setFilter({ ...filter, onlyMissing: e.target.checked })}
              />
              Only records with a missing punch
            </label>
          </div>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {correctionSuccess && <Alert tone="success">{correctionSuccess}</Alert>}

      {correction && (
        <div className="card border-brand-300 no-print">
          <h2 className="font-semibold text-brand-900">
            Correct attendance · {correction.record.teacherId} · {correction.record.date}
          </h2>
          <p className="muted mt-1">
            The original record is kept. This action is written to the audit log with your name
            and reason.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="corr-arrival">
                Arrival (HH:MM)
              </label>
              <input
                id="corr-arrival"
                type="time"
                className="input"
                value={correction.arrivalTime}
                onChange={(e) =>
                  setCorrection({ ...correction, arrivalTime: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="corr-departure">
                Departure (HH:MM)
              </label>
              <input
                id="corr-departure"
                type="time"
                className="input"
                value={correction.departureTime}
                onChange={(e) =>
                  setCorrection({ ...correction, departureTime: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="corr-reason">
                Reason (required)
              </label>
              <input
                id="corr-reason"
                className="input"
                placeholder="e.g. punch missed due to faulty scanner"
                value={correction.reason}
                onChange={(e) => setCorrection({ ...correction, reason: e.target.value })}
              />
            </div>
          </div>
          {correctionError && (
            <div className="mt-3">
              <Alert tone="error">{correctionError}</Alert>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={submitCorrection}
              disabled={correctionBusy}
            >
              {correctionBusy ? 'Saving…' : 'Save correction'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCorrection(null)}
              disabled={correctionBusy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading attendance history" />
      ) : (
        <>
          {view === 'monthly' && (
            <div className="card print-area">
              <PrintHeader
                title={`Monthly Attendance Summary · ${formatIstMonth(cursor.year, cursor.month)}`}
                subtitle={`Generated on ${formatIstLong(Date.now())}`}
              />
              <h2 className="mb-3 font-semibold text-brand-900 no-print">
                Monthly summary ({summary.length} teachers)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Teacher</th>
                      <th className="py-2 pr-3">ID</th>
                      <th className="py-2 pr-3">Days present</th>
                      <th className="py-2 pr-3">Incomplete</th>
                      <th className="py-2 pr-3">Late</th>
                      <th className="py-2 pr-3">Early</th>
                      <th className="py-2 pr-3">Total hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row) => (
                      <tr key={row.uid} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-800">{row.name}</td>
                        <td className="py-2 pr-3 text-slate-600">{row.teacherId}</td>
                        <td className="py-2 pr-3">{row.daysPresent}</td>
                        <td className="py-2 pr-3">{row.daysIncomplete}</td>
                        <td className="py-2 pr-3">{row.lateDays}</td>
                        <td className="py-2 pr-3">{row.earlyDays}</td>
                        <td className="py-2 pr-3">{formatDuration(row.totalMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card print-area">
            <PrintHeader
              title={
                view === 'monthly'
                  ? `Daily Attendance · ${formatIstMonth(cursor.year, cursor.month)}`
                  : 'Attendance Report'
              }
              subtitle={`${rangeLabel} · Generated ${istDateKey()} · Times in IST`}
            />
            <h2 className="mb-3 font-semibold text-brand-900 no-print">
              Daily records ({visible.length})
            </h2>
            <AttendanceTable
              records={visible}
              nameLookup={nameLookup}
              timing={settings}
              todayKey={todayKey}
              showDate={view !== 'date'}
              onCorrect={openCorrection}
              emptyText="No attendance records found for this selection."
            />
          </div>
        </>
      )}
    </div>
  );
}
