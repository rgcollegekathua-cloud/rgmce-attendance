import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Alert, PageHeader, Spinner } from '../../components/ui';
import {
  ApiError,
  approveDevice,
  createTeacher,
  resetTeacherPassword,
  setTeacherStatus,
  subscribeDevices,
  subscribeUsers
} from '../../lib/api';
import { generatePassword } from '../../lib/password';
import { formatPasswordRules, passwordProblem, validateTeacherId } from '../../lib/teachers';
import { validateName } from '../../lib/teacherId';
import type { DeviceRecord, UserProfile } from '../../lib/types';

export function TeacherManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ id: string; password: string } | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubscribeUsers = subscribeUsers(
      (values) => {
        setUsers(values);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    const unsubscribeDevices = subscribeDevices(
      (values) => setDevices(values),
      () => undefined
    );
    return () => {
      unsubscribeUsers();
      unsubscribeDevices();
    };
  }, []);

  const deviceByUid = useMemo(
    () => new Map(devices.map((device) => [device.uid, device])),
    [devices]
  );

  const teachers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users
      .filter((user) => user.role === 'teacher')
      .filter(
        (user) =>
          !needle ||
          user.name.toLowerCase().includes(needle) ||
          user.teacherId.toLowerCase().includes(needle)
      )
      .sort((a, b) => a.teacherId.localeCompare(b.teacherId));
  }, [users, search]);

  const pendingDevices = useMemo(
    () =>
      devices.filter(
        (device) => device.pendingDeviceId && device.pendingDeviceId !== device.deviceId
      ),
    [devices]
  );

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string) => {
      setNotice(null);
      setError(null);
      try {
        await action();
        setNotice(successMessage);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'The action failed.');
      }
    },
    []
  );

  const handleCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setFormError(null);
      const idProblem = validateTeacherId(teacherId);
      if (idProblem) return setFormError(idProblem);
      const nameProblem = validateName(name);
      if (nameProblem) return setFormError(nameProblem);
      const effectivePassword = password || generatePassword();
      const passwordProblemText = passwordProblem(effectivePassword);
      if (passwordProblemText) return setFormError(passwordProblemText);

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
      } catch (e) {
        setFormError(e instanceof ApiError ? e.message : 'Could not create the teacher account.');
      } finally {
        setCreating(false);
      }
    },
    [name, teacherId, password]
  );

  if (loading) return <Spinner label="Loading teachers" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Teacher Management"
        subtitle="Accounts are created by the administrator only. There is no public registration."
      />

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {issued && (
        <Alert tone="warning" title="Initial credentials — shown only once">
          <p>
            Teacher ID <strong>{issued.id}</strong> · Password{' '}
            <code className="rounded bg-white px-1 py-0.5 font-mono">{issued.password}</code>
          </p>
          <p className="mt-1">
            Share these details with the teacher personally. The system does not store readable
            passwords and will not show this again.
          </p>
          <button
            type="button"
            className="btn-secondary mt-2"
            onClick={() => {
              void navigator.clipboard?.writeText(`${issued.id}: ${issued.password}`);
              setNotice('Credentials copied to the clipboard.');
            }}
          >
            Copy credentials
          </button>
        </Alert>
      )}

      <div className="card">
        <h2 className="mb-3 font-semibold text-brand-900">Create a teacher account</h2>
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-3" noValidate>
          <div>
            <label className="label" htmlFor="teacher-name">
              Teacher name
            </label>
            <input
              id="teacher-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="teacher-id">
              Teacher ID
            </label>
            <input
              id="teacher-id"
              className="input"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              placeholder="e.g. TCH-102"
              autoCapitalize="characters"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="teacher-password">
              Initial password (optional)
            </label>
            <input
              id="teacher-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to generate"
              autoComplete="new-password"
            />
            <p className="muted mt-1">{formatPasswordRules()}</p>
          </div>
          {formError && (
            <div className="md:col-span-3">
              <Alert tone="error">{formError}</Alert>
            </div>
          )}
          <div className="md:col-span-3">
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create teacher account'}
            </button>
          </div>
        </form>
      </div>

      {pendingDevices.length > 0 && (
        <div className="card border-amber-300">
          <h2 className="mb-3 font-semibold text-amber-800">
            Device change requests ({pendingDevices.length})
          </h2>
          <ul className="space-y-3">
            {pendingDevices.map((device) => (
              <li
                key={device.uid}
                className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-800">
                    {users.find((u) => u.uid === device.uid)?.name ?? device.teacherId} (
                    {device.teacherId})
                  </p>
                  <p className="text-sm text-slate-600">
                    New installation: <strong>{device.pendingDeviceLabel ?? device.pendingDeviceId}</strong>
                  </p>
                  <p className="text-xs text-slate-500">
                    Currently approved: {device.deviceLabel} ·{' '}
                    {device.requestedAt ? new Date(device.requestedAt).toLocaleString() : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() =>
                      runAction(
                        () => approveDevice(device.uid, true, 'Device change approved by admin'),
                        'Device approved. The previous device is now rejected.'
                      )
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      runAction(
                        () => approveDevice(device.uid, false, 'Device change rejected by admin'),
                        'Device change rejected. The current phone keeps working.'
                      )
                    }
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-brand-900">
            Teachers ({teachers.length})
          </h2>
          <input
            className="input sm:max-w-xs"
            placeholder="Search by name or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search teachers"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Teacher ID</th>
                <th className="py-2 pr-3">Account</th>
                <th className="py-2 pr-3">Device</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => {
                const device = deviceByUid.get(teacher.uid);
                const deviceApproved =
                  device?.status === 'approved' &&
                  (!device.pendingDeviceId || device.pendingDeviceId === device.deviceId);
                const pending =
                  device?.pendingDeviceId && device.pendingDeviceId !== device.deviceId;
                return (
                  <tr key={teacher.uid} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 font-medium text-slate-800">{teacher.name}</td>
                    <td className="py-2 pr-3 text-slate-600">{teacher.teacherId}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          teacher.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {teacher.active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {device ? (
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            pending
                              ? 'bg-amber-100 text-amber-800'
                              : deviceApproved
                                ? 'bg-green-100 text-green-800'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {pending ? 'Change pending' : deviceApproved ? 'Approved' : device.status}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Not registered</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={teacher.active ? 'btn-danger' : 'btn-primary'}
                          onClick={() =>
                            runAction(
                              () =>
                                setTeacherStatus(
                                  teacher.uid,
                                  !teacher.active,
                                  teacher.active
                                    ? 'Deactivated by administrator'
                                    : 'Reactivated by administrator'
                                ),
                              `${teacher.name} ${teacher.active ? 'deactivated' : 'activated'}.`
                            )
                          }
                        >
                          {teacher.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            const next = generatePassword();
                            void runAction(
                              async () => {
                                const result = await resetTeacherPassword(teacher.uid, next);
                                setIssued({ id: teacher.teacherId, password: result.temporaryPassword });
                                setNotice(`Password reset for ${teacher.name}.`);
                              },
                              `Password reset for ${teacher.name}.`
                            );
                          }}
                        >
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
