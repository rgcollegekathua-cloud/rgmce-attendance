import { fail } from './errors';
import {
  dailyId,
  eventId,
  paths,
  type Ctx,
  type Db,
  type DocRef
} from './db';
import {
  assertApprovedDevice,
  assertNoClientTimestamp,
  assertPunch,
  assertQrToken,
  checkRateLimit,
  computePunchFlags,
  requireActiveAccount,
  requireAdmin,
  validateCorrection,
  validateDeviceCredential,
  validateTeacherInput
} from './rules';
import { istDateKey, istTimeKey, istWallClockToMs } from './time';
import { checkPassword } from './teacherId';
import type {
  AuditEntry,
  AttendanceType,
  DailyAttendanceRecord,
  DeviceRecord,
  Principal,
  QrSettings,
  TimingSettings,
  UserRecord
} from './types';
import { DEFAULT_RATE_LIMIT_PER_HOUR, DEFAULT_TIMING } from './types';

async function writeAudit(ctx: Ctx, entry: AuditEntry): Promise<void> {
  await ctx.db.set(ctx.db.doc(paths.audit(ctx.randomId())), entry as unknown as Record<string, unknown>);
}

async function loadJson(db: Db, ref: DocRef): Promise<Record<string, unknown>> {
  const snapshot = await db.get(ref);
  return snapshot.exists ? (snapshot.data() ?? {}) : {};
}

export async function loadTiming(db: Db): Promise<TimingSettings> {
  const data = await loadJson(db, db.doc(paths.appSettings));
  const holidays = Array.isArray(data.holidays) ? (data.holidays as string[]) : [];
  const weekendDays = Array.isArray(data.weekendDays)
    ? (data.weekendDays as number[])
    : DEFAULT_TIMING.weekendDays;
  return {
    ...DEFAULT_TIMING,
    officialArrival: typeof data.officialArrival === 'string' ? data.officialArrival : DEFAULT_TIMING.officialArrival,
    officialDeparture:
      typeof data.officialDeparture === 'string' ? data.officialDeparture : DEFAULT_TIMING.officialDeparture,
    graceMinutes:
      typeof data.graceMinutes === 'number' ? data.graceMinutes : DEFAULT_TIMING.graceMinutes,
    minimumWorkingMinutes:
      typeof data.minimumWorkingMinutes === 'number'
        ? data.minimumWorkingMinutes
        : DEFAULT_TIMING.minimumWorkingMinutes,
    allowWeekendAttendance: data.allowWeekendAttendance === true,
    weekendDays,
    holidays
  };
}

async function loadSecurity(db: Db): Promise<QrSettings | undefined> {
  const data = await loadJson(db, db.doc(paths.securitySettings));
  if (typeof data.token !== 'string') return undefined;
  return {
    token: data.token,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : null,
    revoked: data.revoked === true,
    revokedAt: typeof data.revokedAt === 'number' ? data.revokedAt : null,
    rateLimitPerHour:
      typeof data.rateLimitPerHour === 'number'
        ? data.rateLimitPerHour
        : DEFAULT_RATE_LIMIT_PER_HOUR
  };
}

/**
 * Reads a stored document as a known record shape.
 *
 * The Admin SDK returns untyped maps and TypeScript cannot verify them, so
 * this is the single type boundary for every stored record. Attendance
 * documents are written only by these handlers (`firestore.rules` blocks all
 * client writes to those collections), so the shape is guaranteed at write
 * time; a document that does not exist is reported as `undefined`.
 */
function readRecord<T>(snapshot: { exists: boolean; data(): Record<string, unknown> | undefined }): T | undefined {
  if (!snapshot.exists) return undefined;
  const data = snapshot.data();
  if (!data) return undefined;
  return data as unknown as T;
}

async function loadUser(ctx: Ctx, uid: string): Promise<UserRecord> {
  const snapshot = await ctx.db.get(ctx.db.doc(paths.user(uid)));
  const user = readRecord<UserRecord>(snapshot);
  if (!user) {
    throw fail('not-found', 'This account has no profile. Contact the administrator.');
  }
  return user;
}

/* ------------------------------ admin: teachers ------------------------- */

export async function createTeacher(
  ctx: Ctx,
  principal: Principal,
  input: { teacherId: string; name: string; initialPassword: string }
): Promise<{ uid: string; temporaryPassword: string }> {
  requireAdmin(principal);
  const validated = validateTeacherInput(input);

  const reservationRef = ctx.db.doc(paths.teacherId(validated.teacherId));
  try {
    await ctx.db.create(reservationRef, {
      uid: 'pending',
      reservedAt: ctx.now(),
      createdBy: principal.uid
    });
  } catch {
    throw fail(
      'already-exists',
      `Teacher ID ${validated.teacherId} is already registered in the system.`
    );
  }

  let uid: string;
  try {
    const created = await ctx.authAdmin.createUser({
      email: validated.email,
      password: validated.password,
      displayName: validated.name
    });
    uid = created.uid;
  } catch (error) {
    await ctx.db.delete(reservationRef).catch(() => undefined);
    const message = error instanceof Error ? error.message : '';
    if (/already-exists|email-already-in-use/i.test(message)) {
      throw fail('already-exists', 'An account with this sign-in already exists.');
    }
    throw fail('internal', 'The sign-in account could not be created.');
  }

  const now = ctx.now();
  await ctx.db.set(reservationRef, { uid, reservedAt: now }, { merge: true });
  const user: UserRecord = {
    uid,
    teacherId: validated.teacherId,
    name: validated.name,
    role: 'teacher',
    active: true,
    email: validated.email,
    createdAt: now,
    updatedAt: now
  };
  await ctx.db.set(ctx.db.doc(paths.user(uid)), user as unknown as Record<string, unknown>);

  await writeAudit(ctx, {
    at: now,
    actorUid: principal.uid,
    actorRole: principal.role,
    action: 'teacher.create',
    targetId: validated.teacherId,
    after: { teacherId: validated.teacherId, name: validated.name, email: validated.email }
  });

  return { uid, temporaryPassword: validated.password };
}

export async function setTeacherStatus(
  ctx: Ctx,
  principal: Principal,
  input: { uid: string; active: boolean; reason?: string }
): Promise<{ ok: true }> {
  requireAdmin(principal);
  const uid = String(input.uid ?? '');
  if (!uid) throw fail('invalid-argument', 'A teacher account is required.');
  if (uid === principal.uid && input.active === false) {
    throw fail('failed-precondition', 'You cannot deactivate your own administrator account.');
  }

  const user = await loadUser(ctx, uid);
  if (user.role !== 'teacher') {
    throw fail('failed-precondition', 'Only teacher accounts can be changed here.');
  }

  const now = ctx.now();
  const before = { active: user.active };
  await ctx.db.set(
    ctx.db.doc(paths.user(uid)),
    { active: input.active === true, updatedAt: now },
    { merge: true }
  );

  const deviceRef = ctx.db.doc(paths.device(uid));
  const deviceSnapshot = await ctx.db.get(deviceRef);
  if (deviceSnapshot.exists) {
    await ctx.db.set(
      deviceRef,
      {
        status: input.active === true ? 'approved' : 'revoked',
        updatedAt: now,
        pending: null
      },
      { merge: true }
    );
  }

  await writeAudit(ctx, {
    at: now,
    actorUid: principal.uid,
    actorRole: principal.role,
    action: input.active === true ? 'teacher.activate' : 'teacher.deactivate',
    targetId: `${user.teacherId} (${uid})`,
    reason: input.reason,
    before,
    after: { active: input.active === true }
  });

  return { ok: true };
}

export async function resetTeacherPassword(
  ctx: Ctx,
  principal: Principal,
  input: { uid: string; newPassword: string }
): Promise<{ ok: true; temporaryPassword: string }> {
  requireAdmin(principal);
  const uid = String(input.uid ?? '');
  if (!uid) throw fail('invalid-argument', 'A teacher account is required.');

  const check = checkPassword(String(input.newPassword ?? ''));
  if (!check.valid) {
    throw fail('invalid-argument', check.message ?? 'The password is not strong enough.');
  }

  const user = await loadUser(ctx, uid);
  await ctx.authAdmin.updateUser(uid, { password: input.newPassword });

  await writeAudit(ctx, {
    at: ctx.now(),
    actorUid: principal.uid,
    actorRole: principal.role,
    action: 'teacher.password-reset',
    targetId: `${user.teacherId} (${uid})`,
    reason: 'Password reset by administrator'
    // The password itself is intentionally never written to the audit log.
  });

  return { ok: true, temporaryPassword: input.newPassword };
}

/* -------------------------------- devices -------------------------------- */

export async function registerDevice(
  ctx: Ctx,
  principal: Principal,
  input: { deviceId?: unknown; deviceSecret?: unknown; label?: unknown }
): Promise<{ status: 'approved' | 'pending'; message: string }> {
  const user = await loadUser(ctx, principal.uid);
  requireActiveAccount(user);

  const credential = validateDeviceCredential(input);
  const now = ctx.now();
  const deviceRef = ctx.db.doc(paths.device(principal.uid));
  const snapshot = await ctx.db.get(deviceRef);
  const secretHash = ctx.hash(credential.deviceSecret);

  if (!snapshot.exists) {
    const record: DeviceRecord = {
      uid: principal.uid,
      teacherId: user.teacherId,
      deviceId: credential.deviceId,
      deviceSecretHash: secretHash,
      deviceLabel: credential.label,
      status: 'approved',
      pending: null,
      approvedAt: now,
      updatedAt: now
    };
    await ctx.db.set(deviceRef, record as unknown as Record<string, unknown>);
    await writeAudit(ctx, {
      at: now,
      actorUid: principal.uid,
      actorRole: principal.role,
      action: 'device.register-first',
      targetId: `${user.teacherId} (${principal.uid})`,
      after: { deviceLabel: credential.label }
    });
    return {
      status: 'approved',
      message: 'This phone is registered and approved. You can mark attendance.'
    };
  }

  const device = readRecord<DeviceRecord>(snapshot);
  if (!device) {
    throw fail('not-found', 'This device record could not be read. Register the phone again.');
  }
  const sameInstallation =
    device.deviceId === credential.deviceId &&
    device.deviceSecretHash === secretHash;

  if (sameInstallation) {
    await ctx.db.set(deviceRef, { deviceLabel: credential.label, updatedAt: now }, { merge: true });
    return {
      status: 'approved',
      message: 'This phone is already approved.'
    };
  }

  await ctx.db.set(
    deviceRef,
    {
      pending: {
        deviceId: credential.deviceId,
        deviceSecretHash: secretHash,
        deviceLabel: credential.label,
        requestedAt: now
      },
      requestedAt: now,
      updatedAt: now
    },
    { merge: true }
  );

  await writeAudit(ctx, {
    at: now,
    actorUid: principal.uid,
    actorRole: principal.role,
    action: 'device.request-change',
    targetId: `${user.teacherId} (${principal.uid})`,
    after: { deviceLabel: credential.label },
    reason: 'New installation requested device approval'
  });

  return {
    status: 'pending',
    message:
      'A device change has been requested. The administrator must approve this phone before attendance can be marked. Your previously approved phone keeps working until then.'
  };
}

export async function approveDevice(
  ctx: Ctx,
  principal: Principal,
  input: { uid?: unknown; approve?: unknown; reason?: unknown }
): Promise<{ ok: true }> {
  requireAdmin(principal);
  const uid = String(input.uid ?? '');
  if (!uid) throw fail('invalid-argument', 'A teacher account is required.');

  const deviceRef = ctx.db.doc(paths.device(uid));
  const snapshot = await ctx.db.get(deviceRef);
  if (!snapshot.exists) {
    throw fail('not-found', 'This teacher has no registered device.');
  }
  const device = readRecord<DeviceRecord>(snapshot);
  if (!device) {
    throw fail('not-found', 'This device record could not be read.');
  }
  if (!device.pending) {
    throw fail('failed-precondition', 'There is no pending device request for this teacher.');
  }

  const now = ctx.now();
  const approve = input.approve === true;
  const before = {
    deviceId: device.deviceId,
    deviceLabel: device.deviceLabel,
    status: device.status,
    pendingDeviceLabel: device.pending.deviceLabel
  };

  if (approve) {
    await ctx.db.set(
      deviceRef,
      {
        deviceId: device.pending.deviceId,
        deviceSecretHash: device.pending.deviceSecretHash,
        deviceLabel: device.pending.deviceLabel,
        status: 'approved',
        approvedAt: now,
        pending: null,
        updatedAt: now
      },
      { merge: true }
    );
  } else {
    await ctx.db.set(deviceRef, { pending: null, updatedAt: now }, { merge: true });
  }

  await writeAudit(ctx, {
    at: now,
    actorUid: principal.uid,
    actorRole: principal.role,
    action: approve ? 'device.approve' : 'device.reject',
    targetId: uid,
    reason: typeof input.reason === 'string' ? input.reason : undefined,
    before,
    after: {
      deviceId: approve ? device.pending.deviceId : device.deviceId,
      deviceLabel: approve ? device.pending.deviceLabel : device.deviceLabel,
      status: approve ? 'approved' : device.status
    }
  });

  return { ok: true };
}

/* ------------------------------- attendance ----------------------------- */

export interface MarkAttendanceInput {
  qrToken?: unknown;
  type?: unknown;
  deviceId?: unknown;
  deviceSecret?: unknown;
}

export interface MarkAttendanceResult {
  ok: true;
  type: AttendanceType;
  date: string;
  timestampMs: number;
  timeLabel: string;
  message: string;
}

export async function markAttendance(
  ctx: Ctx,
  principal: Principal,
  input: MarkAttendanceInput
): Promise<MarkAttendanceResult> {
  assertNoClientTimestamp(input as unknown as Record<string, unknown>);

  const type = input.type;
  if (type !== 'arrival' && type !== 'departure') {
    throw fail('invalid-argument', 'Choose either "arrival" or "departure".');
  }

  const user = await loadUser(ctx, principal.uid);
  requireActiveAccount(user);

  const credential = validateDeviceCredential(input);
  const device = readRecord<DeviceRecord>(
    await ctx.db.get(ctx.db.doc(paths.device(principal.uid)))
  );
  assertApprovedDevice(device, credential, ctx.hash);

  const now = ctx.now();
  const security = await loadSecurity(ctx.db);
  assertQrToken(input.qrToken, security, now);

  const limit = security?.rateLimitPerHour ?? DEFAULT_RATE_LIMIT_PER_HOUR;
  const rateKey = `mark_${principal.uid}`;
  const rateRef = ctx.db.doc(paths.rateLimit(rateKey));
  await ctx.db.runTransaction(async (tx) => {
    const snapshot = await tx.get(rateRef);
    const state = snapshot.exists
      ? (snapshot.data() as unknown as { windowStart: number; count: number })
      : undefined;
    const result = checkRateLimit(state, now, limit);
    if (!result.allowed) {
      throw fail(
        'resource-exhausted',
        'Too many attendance attempts in the last hour. Please wait and try again.'
      );
    }
    tx.set(rateRef, result.next as unknown as Record<string, unknown>);
  });

  const timing = await loadTiming(ctx.db);
  const date = istDateKey(now);
  const eventPath = paths.event(eventId(user.teacherId, date, type));
  const dailyPath = paths.daily(dailyId(user.teacherId, date));

  await ctx.db.runTransaction(async (tx) => {
    const eventSnapshot = await tx.get(ctx.db.doc(eventPath));
    if (eventSnapshot.exists) {
      throw fail(
        'already-exists',
        `This ${type} has already been recorded for ${date}.`
      );
    }

    const dailySnapshot = await tx.get(ctx.db.doc(dailyPath));
    const existing = dailySnapshot.exists
      ? (dailySnapshot.data() as Partial<DailyAttendanceRecord>)
      : { date };

    assertPunch({ type, nowMs: now, existing, timing });

    const arrivalMs = type === 'arrival' ? now : (existing.arrivalMs ?? null);
    const departureMs = type === 'departure' ? now : (existing.departureMs ?? null);
    const flags = computePunchFlags(arrivalMs, departureMs, timing);

    const next: DailyAttendanceRecord = {
      id: dailyId(user.teacherId, date),
      uid: principal.uid,
      teacherId: user.teacherId,
      teacherName: user.name,
      date,
      arrivalMs,
      departureMs,
      arrivalTime: arrivalMs ? istTimeKey(arrivalMs) : null,
      departureTime: departureMs ? istTimeKey(departureMs) : null,
      ...flags,
      updatedAt: now
    };

    const existingRecord =
      dailySnapshot.exists
        ? (dailySnapshot.data() as Partial<DailyAttendanceRecord>)
        : {};

    tx.set(ctx.db.doc(eventPath), {
      id: eventId(user.teacherId, date, type),
      uid: principal.uid,
      teacherId: user.teacherId,
      date,
      type,
      timestampMs: now,
      source: 'qr',
      deviceLabel: device?.deviceLabel ?? 'unknown',
      createdAt: ctx.serverTimestamp()
    });
    tx.set(ctx.db.doc(dailyPath), { ...existingRecord, ...next } as Record<string, unknown>, {
      merge: true
    });
  });

  const timeLabel = istTimeKey(now);
  return {
    ok: true,
    type,
    date,
    timestampMs: now,
    timeLabel,
    message: `${type === 'arrival' ? 'Arrival' : 'Departure'} recorded at ${timeLabel} (IST) by the college server.`
  };
}

/* ------------------------------ QR token admin -------------------------- */

export async function setQrToken(
  ctx: Ctx,
  principal: Principal,
  input: { mode?: unknown; validMinutes?: unknown }
): Promise<{ token: string | null; expiresAt: number | null; revoked: boolean }> {
  requireAdmin(principal);
  const mode = input.mode;
  if (mode !== 'regenerate' && mode !== 'revoke') {
    throw fail('invalid-argument', 'Mode must be "regenerate" or "revoke".');
  }

  const now = ctx.now();
  const ref = ctx.db.doc(paths.securitySettings);
  const before = await loadSecurity(ctx.db);

  if (mode === 'revoke') {
    await ctx.db.set(
      ref,
      { revoked: true, revokedAt: now },
      { merge: true }
    );
    await writeAudit(ctx, {
      at: now,
      actorUid: principal.uid,
      actorRole: principal.role,
      action: 'qr.revoke',
      targetId: 'collegeSettings/security',
      before: { revoked: before?.revoked ?? false, expiresAt: before?.expiresAt ?? null },
      after: { revoked: true }
    });
    return { token: null, expiresAt: null, revoked: true };
  }

  const validMinutes =
    typeof input.validMinutes === 'number' && input.validMinutes > 0
      ? Math.floor(input.validMinutes)
      : 0;
  const token = `RGMCE-${ctx.randomId().replace(/-/g, '')}-${ctx.randomId().replace(/-/g, '')}`;
  const expiresAt = validMinutes > 0 ? now + validMinutes * 60_000 : null;

  await ctx.db.set(ref, {
    token,
    createdAt: now,
    expiresAt,
    revoked: false,
    revokedAt: null,
    rateLimitPerHour: before?.rateLimitPerHour ?? DEFAULT_RATE_LIMIT_PER_HOUR
  } as Record<string, unknown>);

  await writeAudit(ctx, {
    at: now,
    actorUid: principal.uid,
    actorRole: principal.role,
    action: 'qr.regenerate',
    targetId: 'collegeSettings/security',
    before: { revoked: before?.revoked ?? false },
    after: { expiresAt }
  });

  return { token, expiresAt, revoked: false };
}

/* ------------------------------- corrections ---------------------------- */

export async function correctAttendance(
  ctx: Ctx,
  principal: Principal,
  input: {
    teacherId?: unknown;
    date?: unknown;
    arrivalTime?: unknown;
    departureTime?: unknown;
    reason?: unknown;
  }
): Promise<{ ok: true; date: string }> {
  requireAdmin(principal);

  const correction = validateCorrection({
    teacherId: String(input.teacherId ?? ''),
    date: String(input.date ?? ''),
    arrivalTime:
      input.arrivalTime === null || input.arrivalTime === undefined || input.arrivalTime === ''
        ? null
        : String(input.arrivalTime),
    departureTime:
      input.departureTime === null || input.departureTime === undefined || input.departureTime === ''
        ? null
        : String(input.departureTime),
    reason: String(input.reason ?? '')
  });

  const teacherIdRef = ctx.db.doc(paths.teacherId(correction.teacherId));
  const teacherIdSnapshot = await ctx.db.get(teacherIdRef);
  if (!teacherIdSnapshot.exists) {
    throw fail('not-found', `No teacher is registered with ID ${correction.teacherId}.`);
  }
  const uid = (teacherIdSnapshot.data() as { uid: string }).uid;
  if (uid === 'pending' || !uid) {
    throw fail('failed-precondition', 'This teacher account is incomplete.');
  }
  const user = await loadUser(ctx, uid);

  const timing = await loadTiming(ctx.db);
  const dailyPath = paths.daily(dailyId(correction.teacherId, correction.date));
  const dailySnapshot = await ctx.db.get(ctx.db.doc(dailyPath));
  const existing = dailySnapshot.exists
    ? (dailySnapshot.data() as Partial<DailyAttendanceRecord>)
    : undefined;

  if (!existing && (!correction.arrivalTime || !correction.departureTime)) {
    throw fail(
      'failed-precondition',
      'No attendance record exists for this date. Provide both arrival and departure times to create one.'
    );
  }

  const arrivalMs = correction.arrivalTime
    ? istWallClockToMs(correction.date, correction.arrivalTime)
    : (existing?.arrivalMs ?? null);
  const departureMs = correction.departureTime
    ? istWallClockToMs(correction.date, correction.departureTime)
    : (existing?.departureMs ?? null);

  if (arrivalMs !== null && departureMs !== null && departureMs <= arrivalMs) {
    throw fail('invalid-argument', 'Departure must be later than arrival.');
  }

  const now = ctx.now();
  const flags = computePunchFlags(arrivalMs, departureMs, timing);
  const before = existing
    ? {
        arrivalTime: existing.arrivalTime ?? null,
        departureTime: existing.departureTime ?? null,
        arrivalMs: existing.arrivalMs ?? null,
        departureMs: existing.departureMs ?? null,
        corrected: existing.corrected === true
      }
    : null;

  const updated: DailyAttendanceRecord = {
    id: dailyId(correction.teacherId, correction.date),
    uid,
    teacherId: correction.teacherId,
    teacherName: user.name,
    date: correction.date,
    arrivalMs,
    departureMs,
    arrivalTime: arrivalMs ? istTimeKey(arrivalMs) : null,
    departureTime: departureMs ? istTimeKey(departureMs) : null,
    ...flags,
    corrected: true,
    correctionReason: correction.reason,
    correctedAt: now,
    correctedBy: principal.uid,
    originalArrivalMs: existing?.originalArrivalMs ?? existing?.arrivalMs ?? null,
    originalDepartureMs: existing?.originalDepartureMs ?? existing?.departureMs ?? null,
    updatedAt: now
  };

  await ctx.db.set(ctx.db.doc(dailyPath), updated as unknown as Record<string, unknown>, {
    merge: true
  });

  const correctionEventId = `correction_${correction.teacherId}_${correction.date}_${ctx
    .randomId()
    .replace(/-/g, '')
    .slice(0, 10)}`;
  await ctx.db.set(ctx.db.doc(paths.event(correctionEventId)), {
    id: correctionEventId,
    uid,
    teacherId: correction.teacherId,
    date: correction.date,
    type: 'correction',
    isCorrection: true,
    timestampMs: now,
    correctedBy: principal.uid,
    correctionReason: correction.reason,
    before,
    after: {
      arrivalTime: updated.arrivalTime,
      departureTime: updated.departureTime,
      arrivalMs,
      departureMs
    },
    createdAt: ctx.serverTimestamp()
  });

  await writeAudit(ctx, {
    at: now,
    actorUid: principal.uid,
    actorRole: principal.role,
    action: 'attendance.correct',
    targetId: `${correction.teacherId}_${correction.date}`,
    reason: correction.reason,
    before,
    after: {
      arrivalTime: updated.arrivalTime,
      departureTime: updated.departureTime
    }
  });

  return { ok: true, date: correction.date };
}

