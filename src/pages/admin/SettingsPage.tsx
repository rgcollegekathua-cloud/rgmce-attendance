import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Alert, PageHeader, Spinner } from '../../components/ui';
import { useAppSettings } from '../../hooks/useAppSettings';
import { ApiError, fetchSecuritySettings, regenerateQrToken } from '../../lib/api';
import { formatIstLong, nowIstDateKey, timeToMinutes, istTimeKey } from '../../lib/time';
import type { AppSettings, SecuritySettings } from '../../lib/types';

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
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState<'regenerate' | 'revoke' | null>(null);
  const [newHoliday, setNewHoliday] = useState('');

  useEffect(() => {
    if (settings && !draft) setDraft({ ...settings });
  }, [settings, draft]);

  const loadSecurity = useCallback(async () => {
    try {
      const value = await fetchSecuritySettings();
      setSecurity(value);
    } catch {
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
        if (!cancelled) setQrImage(url);
      })
      .catch(() => {
        if (!cancelled) setQrImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [security]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    if (timeToMinutes(draft.officialDeparture) <= timeToMinutes(draft.officialArrival)) {
      setMessage({ tone: 'error', text: 'Closing time must be after the official arrival time.' });
      return;
    }
    const result = await save({
      ...draft,
      holidays: [...new Set(draft.holidays)].sort(),
      weekendDays: [...new Set(draft.weekendDays)].sort()
    });
    if (result) setMessage({ tone: 'error', text: result });
    else setMessage({ tone: 'success', text: 'Settings saved.' });
  }, [draft, save]);

  const handleQr = useCallback(
    async (mode: 'regenerate' | 'revoke') => {
      setQrBusy(mode);
      setMessage(null);
      try {
        const result = await regenerateQrToken(mode, 0);
        await loadSecurity();
        setMessage({
          tone: 'success',
          text:
            mode === 'revoke'
              ? 'QR token revoked. No attendance can be marked until a new token is generated.'
              : `New QR token generated${result.expiresAt ? `, valid until ${new Date(result.expiresAt).toLocaleString()}` : ''}. Print the new code and destroy the old one.`
        });
      } catch (e) {
        setMessage({
          tone: 'error',
          text: e instanceof ApiError ? e.message : 'The QR action failed.'
        });
      } finally {
        setQrBusy(null);
      }
    },
    [loadSecurity]
  );

  if (loading || !draft) return <Spinner label="Loading settings" />;
  if (error) return <Alert tone="error">{error}</Alert>;

  const isExpired = Boolean(security?.expiresAt && security.expiresAt < Date.now());

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle={`Configured for Indian Standard Time · ${formatIstLong(Date.now())}`}
      />

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <section className="card">
        <h2 className="mb-3 font-semibold text-brand-900">Official timings</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="arrival">
              Official arrival
            </label>
            <input
              id="arrival"
              type="time"
              className="input"
              value={draft.officialArrival}
              onChange={(e) => setDraft({ ...draft, officialArrival: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="departure">
              Closing time
            </label>
            <input
              id="departure"
              type="time"
              className="input"
              value={draft.officialDeparture}
              onChange={(e) => setDraft({ ...draft, officialDeparture: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="grace">
              Grace period (minutes)
            </label>
            <input
              id="grace"
              type="number"
              min={0}
              max={120}
              className="input"
              value={draft.graceMinutes}
              onChange={(e) =>
                setDraft({ ...draft, graceMinutes: Number.parseInt(e.target.value, 10) || 0 })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="min-hours">
              Minimum working minutes
            </label>
            <input
              id="min-hours"
              type="number"
              min={0}
              step={15}
              className="input"
              value={draft.minimumWorkingMinutes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  minimumWorkingMinutes: Number.parseInt(e.target.value, 10) || 0
                })
              }
            />
          </div>
        </div>
        <p className="muted mt-2">
          An arrival is marked late when it is more than the grace period past the official
          arrival time. The same grace applies to early departures.
        </p>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold text-brand-900">Working days and holidays</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="label">Weekly off</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const checked = draft.weekendDays.includes(day.value);
                return (
                  <label
                    key={day.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      checked
                        ? 'border-brand-700 bg-brand-50 text-brand-900'
                        : 'border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-800 focus:ring-brand-600"
                      checked={checked}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          weekendDays: e.target.checked
                            ? [...draft.weekendDays, day.value]
                            : draft.weekendDays.filter((value) => value !== day.value)
                        })
                      }
                    />
                    {day.label}
                  </label>
                );
              })}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-800 focus:ring-brand-600"
                checked={draft.allowWeekendAttendance}
                onChange={(e) =>
                  setDraft({ ...draft, allowWeekendAttendance: e.target.checked })
                }
              />
              Allow attendance on weekly-off days (e.g. for duties/exams)
            </label>
          </div>

          <div>
            <label className="label" htmlFor="holiday-date">
              Add a holiday
            </label>
            <div className="flex gap-2">
              <input
                id="holiday-date"
                type="date"
                className="input"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={!newHoliday}
                onClick={() =>
                  setDraft({
                    ...draft,
                    holidays: [...new Set([...draft.holidays, newHoliday])].sort()
                  })
                }
              >
                Add
              </button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {draft.holidays.length === 0 && (
                <li className="muted">No holidays configured.</li>
              )}
              {draft.holidays.map((holiday) => (
                <li
                  key={holiday}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                >
                  {holiday}
                  <button
                    type="button"
                    aria-label={`Remove holiday ${holiday}`}
                    className="font-bold text-red-600"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        holidays: draft.holidays.filter((value) => value !== holiday)
                      })
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4">
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold text-brand-900">College QR code</h2>
        <p className="muted mb-3">
          The QR code carries a random college token — never a teacher ID or password. Every
          attendance submission is validated on the server against this token.
        </p>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleQr('regenerate')}
            disabled={qrBusy !== null}
          >
            {qrBusy === 'regenerate' ? 'Generating…' : 'Regenerate token'}
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => handleQr('revoke')}
            disabled={qrBusy !== null || Boolean(security?.revoked)}
          >
            {qrBusy === 'revoke' ? 'Revoking…' : 'Revoke token'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!qrImage}
            onClick={() => window.print()}
          >
            Print QR code
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="print-area">
            <div className="rounded-lg border border-slate-200 p-4 text-center">
              {security?.revoked ? (
                <p className="py-10 font-semibold text-red-700">
                  Token revoked — attendance is disabled.
                </p>
              ) : qrImage ? (
                <>
                  <img
                    src={qrImage}
                    alt="College attendance QR code"
                    className="mx-auto h-64 w-64"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {security?.expiresAt
                      ? `Valid until ${new Date(security.expiresAt).toLocaleString()}`
                      : 'No expiry configured'}
                  </p>
                </>
              ) : (
                <p className="py-10 text-slate-500">
                  No QR token yet. Generate one to display the college code.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <p className="label">Token status</p>
              <p>
                {security?.revoked
                  ? 'Revoked'
                  : security?.expiresAt && isExpired
                    ? 'Expired'
                    : security
                      ? 'Active'
                      : 'Not generated'}
              </p>
            </div>
            <Alert tone="warning" title="Honest limitation of a fixed QR code">
              A fixed QR code displayed at the college gate can be photographed and scanned from
              anywhere, so scanning it alone does <strong>not</strong> prove physical presence.
              Server-side checks (account status, approved device, duplicate prevention, rate
              limits) are enforced; for stronger assurance move to a rotating QR refreshed every
              30–60 seconds, displayed inside the college.
            </Alert>
            <Alert tone="info" title="Network and GPS verification">
              Browser JavaScript cannot reliably identify the college Wi-Fi network. If the
              college operates its own gateway, the recommended approach is verification at the
              gateway (or on a server inside the college network) forwarding a signed header to
              the attendance service. GPS can be added as an extra signal but is not tamper-proof
              by itself. Both are optional and are not enabled by default.
            </Alert>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold text-brand-900">Current configuration</h2>
        <ul className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li>
            Official arrival: <strong>{draft.officialArrival}</strong>
          </li>
          <li>
            Closing time: <strong>{draft.officialDeparture}</strong>
          </li>
          <li>
            Grace period: <strong>{draft.graceMinutes} minutes</strong>
          </li>
          <li>
            Minimum working time: <strong>{draft.minimumWorkingMinutes} minutes</strong>
          </li>
          <li>
            Weekly off:{' '}
            <strong>
              {draft.weekendDays.length === 0
                ? 'None'
                : draft.weekendDays.map((d) => WEEKDAYS[d].label).join(', ')}
            </strong>
          </li>
          <li>
            Holidays configured: <strong>{draft.holidays.length}</strong>
          </li>
          <li className="sm:col-span-2">
            Today in IST: <strong>{nowIstDateKey()} · {istTimeKey(Date.now())}</strong>
          </li>
        </ul>
      </section>
    </div>
  );
}
