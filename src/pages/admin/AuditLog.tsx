import { Alert, PageHeader, Spinner } from '../../components/ui';
import { fetchAuditLogs } from '../../lib/api';
import { useEffect, useState } from 'react';
import type { AuditLogEntry } from '../../lib/types';

function summarise(value: unknown): string {
  if (value === undefined || value === null) return '—';
  try {
    const text = JSON.stringify(value);
    return text.length > 220 ? `${text.slice(0, 220)}…` : text;
  } catch {
    return String(value);
  }
}

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAuditLogs(300)
      .then((values) => {
        if (!cancelled) setEntries(values);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the audit log.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner label="Loading audit log" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Log"
        subtitle="Every administrative action, device decision and attendance correction is recorded here."
      />

      {error && <Alert tone="error">{error}</Alert>}

      <div className="card">
        {entries.length === 0 ? (
          <p className="muted">No audit entries recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">When (IST)</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2 pr-3">Change</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-600">
                      {new Date(entry.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-medium text-slate-800">{entry.actorUid}</span>
                      <span className="ml-1 text-xs text-slate-500">{entry.actorRole}</span>
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-800">{entry.action}</td>
                    <td className="py-2 pr-3 text-slate-600">{entry.targetId}</td>
                    <td className="py-2 pr-3 text-slate-600">{entry.reason ?? '—'}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">
                      <div>
                        <span className="font-semibold">before:</span> {summarise(entry.before)}
                      </div>
                      <div>
                        <span className="font-semibold">after:</span> {summarise(entry.after)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
