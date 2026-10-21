import { useMemo, useState } from 'react';
import { AttendanceTable, PrintHeader } from '../../components/AttendanceTable';
import { Alert, PageHeader, Spinner, StatCard } from '../../components/ui';
import { useAuth } from '../../context/useAuth';
import { useAppSettings } from '../../hooks/useAppSettings';
import { computeDayStats, matchesFilter, type HistoryFilter } from '../../lib/attendance';
import { exportAttendanceCsv } from '../../lib/csv';
import { subscribeTodayAttendance, subscribeUsers } from '../../lib/api';
import { formatIstLong, nowIstDateKey } from '../../lib/time';
import type { DailyAttendance, UserProfile } from '../../lib/types';
import { useEffect } from 'react';

export function TodayAttendance() {
  const { profile } = useAuth();
  const { settings, loading: settingsLoading } = useAppSettings();
  const [todayKey] = useState(() => nowIstDateKey());
  const [records, setRecords] = useState<DailyAttendance[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>({
    search: '',
    status: 'all',
    onlyMissing: false
  });

  useEffect(() => {
    const unsubscribeRecords = subscribeTodayAttendance(
      todayKey,
      (values) => {
        setRecords(values);
        setReady(true);
      },
      (error) => {
        setLoadError(error.message);
        setReady(true);
      }
    );
    const unsubscribeUsers = subscribeUsers(
      (values) => setUsers(values),
      (error) => setLoadError(error.message)
    );
    return () => {
      unsubscribeRecords();
      unsubscribeUsers();
    };
  }, [todayKey]);

  const nameLookup = useMemo(
    () => new Map(users.map((user) => [user.uid, user.name])),
    [users]
  );

  const activeTeachers = useMemo(() => users.filter((user) => user.role === 'teacher' && user.active), [users]);

  const sorted = useMemo(
    () => [...records].sort((a, b) => a.teacherId.localeCompare(b.teacherId)),
    [records]
  );

  const stats = useMemo(() => {
    const base = computeDayStats(sorted, activeTeachers.length);
    const withArrival = sorted.filter((record) => record.arrivalMs).length;
    const arrivalWithoutDeparture = sorted.filter(
      (record) => record.arrivalMs && !record.departureMs
    ).length;
    return {
      ...base,
      missingArrival: Math.max(0, activeTeachers.length - withArrival),
      missingDeparture: arrivalWithoutDeparture
    };
  }, [sorted, activeTeachers.length]);

  const visible = useMemo(
    () =>
      sorted.filter((record) => matchesFilter(record, filter, nameLookup)),
    [sorted, filter, nameLookup]
  );

  const missedToday = useMemo(() => {
    const recorded = new Set(sorted.filter((r) => r.arrivalMs || r.departureMs).map((r) => r.uid));
    return activeTeachers.filter((teacher) => !recorded.has(teacher.uid));
  }, [sorted, activeTeachers]);

  if (!settings || settingsLoading || !ready) {
    return <Spinner label="Loading today's attendance" />;
  }

  if (loadError) {
    return <Alert tone="error" title="Could not load records">{loadError}</Alert>;
  }

  const canExport = profile?.role === 'admin';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Today's Attendance"
        subtitle={`${formatIstLong(Date.now())} · Indian Standard Time`}
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => window.print()}
            >
              Print sheet
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!canExport || visible.length === 0}
              onClick={() =>
                exportAttendanceCsv(visible, nameLookup, `today-${todayKey}`)
              }
            >
              Export CSV
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active teachers" value={stats.total} />
        <StatCard label="Present today" value={stats.present} tone="good" />
        <StatCard
          label="Missing arrival"
          value={stats.missingArrival}
          tone={stats.missingArrival > 0 ? 'bad' : 'default'}
        />
        <StatCard
          label="Missing departure"
          value={stats.missingDeparture}
          tone={stats.missingDeparture > 0 ? 'warn' : 'default'}
        />
        <StatCard label="Late arrivals" value={stats.late} tone={stats.late > 0 ? 'warn' : 'default'} />
        <StatCard
          label="Early departures"
          value={stats.early}
          tone={stats.early > 0 ? 'warn' : 'default'}
        />
      </div>

      <div className="card no-print">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="today-search">
              Search teacher
            </label>
            <input
              id="today-search"
              className="input"
              placeholder="Name or teacher ID"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="today-status">
              Attendance status
            </label>
            <select
              id="today-status"
              className="input"
              value={filter.status}
              onChange={(e) =>
                setFilter({ ...filter, status: e.target.value as HistoryFilter['status'] })
              }
            >
              <option value="all">All</option>
              <option value="present">Complete (arrival + departure)</option>
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
              Only missing punches
            </label>
          </div>
        </div>
      </div>

      <div className="card print-area">
        <PrintHeader title="Daily Attendance Sheet" subtitle={formatIstLong(Date.now())} />
        <h2 className="mb-3 font-semibold text-brand-900 no-print">
          Recorded punches ({visible.length})
        </h2>
        <AttendanceTable
          records={visible}
          nameLookup={nameLookup}
          timing={settings}
          todayKey={todayKey}
          emptyText="No teacher has marked attendance yet today."
        />
      </div>

      <div className="card no-print">
        <h2 className="mb-3 font-semibold text-brand-900">
          No punch recorded yet ({missedToday.length})
        </h2>
        {missedToday.length === 0 ? (
          <p className="muted">Every active teacher has at least one punch today.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {missedToday.map((teacher) => (
              <li
                key={teacher.uid}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-700">{teacher.name}</span>
                <span className="text-slate-500">{teacher.teacherId}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted mt-3">
          A teacher is not marked absent here — the day may still be in progress.
        </p>
      </div>
    </div>
  );
}
