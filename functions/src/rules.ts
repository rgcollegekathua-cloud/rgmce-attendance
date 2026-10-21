import { fail } from './errors';
import { istDateKey, istMinutesOfDay, timeToMinutes } from './time';
import {
  checkPassword,
  isValidName,
  isValidTeacherId,
  normalizeTeacherId,
  teacherEmailFromId
} from './teacherId';
import type {
  AttendanceType,
  DailyAttendanceRecord,
  DeviceRecord,
  Principal,
  QrSettings,
  Role,
  TimingSettings
} from './types';

/* ----------------------------- authorisation ---------------------------- */

export function requireAdmin(principal: Principal): void {
  if (principal.role !== 'admin') {
    throw fail('permission-denied', 'Only an administrator can perform this action.');
  }
}

export function requireActiveAccount(
  user: { role: Role; active: boolean } | undefined
): void {
  if (!user) {
    throw fail('not-found', 'This account has no profile. Contact the administrator.');
  }
  if (user.role !== 'admin' && user.role !== 'teacher') {
    throw fail('permission-denied', 'This account is not authorised to use the attendance system.');
  }
  if (user.active !== true) {
    throw fail(
      'failed-precondition',
      'This account is deactivated. Contact the administrator.'
    );
  }
}

/* --------------------------- teacher accounts --------------------------- */

export interface TeacherInput {
  teacherId: string;
  name: string;
  initialPassword: string;
}

export interface ValidatedTeacher {
  teacherId: string;
  name: string;
  email: string;
  password: string;
}

export function validateTeacherInput(input: TeacherInput): ValidatedTeacher {
  const teacherId = normalizeTeacherId(input.teacherId);
  if (!isValidTeacherId(teacherId)) {
    throw fail(
      'invalid-argument',
      'Teacher ID must be 3-20 characters using only letters, numbers, - or _.'
    );
  }
  const name = String(input.name ?? '').trim();
  if (!isValidName(name)) {
    throw fail('invalid-argument', 'Enter a teacher name between 3 and 80 characters.');
  }
  const password = String(input.initialPassword ?? '');
  const passwordCheck = checkPassword(password);
  if (!passwordCheck.valid) {
    throw fail('invalid-argument', passwordCheck.message ?? 'Password is not strong enough.');
  }
  return { teacherId, name, email: teacherEmailFromId(teacherId), password };
}

/* ------------------------------ device checks --------------------------- */

export function validateDeviceCredential(input: {
  deviceId?: unknown;
  deviceSecret?: unknown;
  label?: unknown;
}): { deviceId: string; deviceSecret: string; label: string } {
  const deviceId = typeof input.deviceId === 'string' ? input.deviceId.trim() : '';
  const deviceSecret =
    typeof input.deviceSecret === 'string' ? input.deviceSecret.trim() : '';
  const label =
    typeof input.label === 'string' && input.label.trim()
      ? input.label.trim().slice(0, 80)
      : 'Unknown device';

  if (deviceId.length < 8 || deviceId.length > 128) {
    throw fail('invalid-argument', 'The device registration key is not valid.');
  }
  if (deviceSecret.length < 16 || deviceSecret.length > 256) {
    throw fail('invalid-argument', 'The device secret is not valid.');
  }
  return { deviceId, deviceSecret, label };
}

/**
 * Returns true only when the presented key matches the approved installation.
 * Device identity in a browser is best-effort — see README, "Device security".
 */
export function isApprovedDevice(
  device: DeviceRecord | undefined,
  credential: { deviceId: string; deviceSecret: string },
  hash: (value: string) => string
): boolean {
  if (!device) return false;
  if (device.status !== 'approved') return false;
  if (device.deviceId !== credential.deviceId) return false;
  return device.deviceSecretHash === hash(credential.deviceSecret);
}

export function assertApprovedDevice(
  device: DeviceRecord | undefined,
  credential: { deviceId: string; deviceSecret: string },
  hash: (value: string) => string
): DeviceRecord {
  if (!device) {
    throw fail(
      'failed-precondition',
      'This phone is not registered. Use "Register this phone" on the dashboard first.'
    );
  }
  if (device.deviceId !== credential.deviceId || device.deviceSecretHash !== hash(credential.deviceSecret)) {
    throw fail(
      'failed-precondition',
      'This installation is not the approved phone. The administrator must approve a device change.'
    );
  }
  if (device.status !== 'approved') {
    throw fail('failed-precondition', 'This device registration has been revoked.');
  }
  return device;
}

/* ------------------------------- QR tokens ------------------------------ */

export function assertQrToken(
  presentedToken: unknown,
  settings: QrSettings | undefined,
  nowMs: number
): void {
  if (typeof presentedToken !== 'string' || presentedToken.trim().length < 8) {
    throw fail('invalid-argument', 'Scan the college QR code before marking attendance.');
  }
  if (!settings || !settings.token) {
    throw fail(
      'failed-precondition',
      'No college QR token has been generated. Ask the administrator to generate one.'
    );
  }
  if (settings.revoked) {
    throw fail('failed-precondition', 'The college QR code has been revoked. Attendance is disabled.');
  }
  if (presentedToken !== settings.token) {
    throw fail(
      'invalid-argument',
      'This QR code is not valid for this college. Re-scan the code displayed in the office.'
    );
  }
  if (settings.expiresAt !== null && settings.expiresAt !== undefined && settings.expiresAt <= nowMs) {
    throw fail('failed-precondition', 'This QR code has expired. Re-scan the current code.');
  }
}

/* ------------------------------- rate limit ----------------------------- */

export interface RateLimitState {
  windowStart: number;
  count: number;
}

export function checkRateLimit(
  state: RateLimitState | undefined,
  nowMs: number,
  limitPerHour: number
): { allowed: boolean; next: RateLimitState } {
  const windowMs = 60 * 60 * 1000;
  const current: RateLimitState =
    state && nowMs - state.windowStart < windowMs
      ? { windowStart: state.windowStart, count: state.count }
      : { windowStart: nowMs, count: 0 };

  if (current.count >= limitPerHour) {
    return { allowed: false, next: current };
  }
  return { allowed: true, next: { windowStart: current.windowStart, count: current.count + 1 } };
}

/* --------------------------- attendance rules --------------------------- */

export interface PunchFlags {
  isLate: boolean;
  lateMinutes: number;
  earlyDeparture: boolean;
  earlyMinutes: number;
  workingMinutes: number;
}

export function computePunchFlags(
  arrivalMs: number | null | undefined,
  departureMs: number | null | undefined,
  timing: TimingSettings
): PunchFlags {
  const officialArrival = timeToMinutes(timing.officialArrival);
  const officialDeparture = timeToMinutes(timing.officialDeparture);

  const lateMinutes = arrivalMs
    ? Math.max(0, istMinutesOfDay(arrivalMs) - officialArrival)
    : 0;
  const earlyMinutes = departureMs
    ? Math.max(0, officialDeparture - istMinutesOfDay(departureMs))
    : 0;

  return {
    isLate: lateMinutes > timing.graceMinutes,
    lateMinutes,
    earlyDeparture: earlyMinutes > timing.graceMinutes,
    earlyMinutes,
    workingMinutes:
      arrivalMs && departureMs ? Math.round((departureMs - arrivalMs) / 60_000) : 0
  };
}

export function isNonWorkingDay(dateKey: string, timing: TimingSettings): boolean {
  if (timing.holidays.includes(dateKey)) return true;
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return timing.weekendDays.includes(weekday);
}

export interface PunchContext {
  type: AttendanceType;
  nowMs: number;
  existing: Partial<DailyAttendanceRecord>;
  timing: TimingSettings;
}

export function assertPunch(context: PunchContext): void {
  const { type, nowMs, existing, timing } = context;

  if (type !== 'arrival' && type !== 'departure') {
    throw fail('invalid-argument', 'Attendance type must be "arrival" or "departure".');
  }

  const dateKey = istDateKey(nowMs);
  if (existing.date && existing.date !== dateKey) {
    throw fail(
      'failed-precondition',
      'There is an open attendance record for another day. Contact the administrator.'
    );
  }

  if (isNonWorkingDay(dateKey, timing) && !timing.allowWeekendAttendance) {
    throw fail(
      'failed-precondition',
      `Attendance cannot be marked on ${dateKey} because it is configured as a non-working day.`
    );
  }

  if (type === 'arrival' && existing.arrivalMs) {
    throw fail(
      'already-exists',
      `Arrival is already recorded for ${dateKey} at the recorded server time.`
    );
  }

  if (type === 'departure') {
    if (existing.departureMs) {
      throw fail(
        'already-exists',
        `Departure is already recorded for ${dateKey} at the recorded server time.`
      );
    }
    if (!existing.arrivalMs) {
      throw fail('failed-precondition', 'Departure cannot be recorded before arrival.');
    }
  }
}

/** Rejects client-supplied timestamps; only the server clock is trusted. */
export function assertNoClientTimestamp(input: Record<string, unknown>): void {
  const forbidden = [
    'timestamp',
    'timestampMs',
    'date',
    'serverTimestamp',
    'createdAt',
    'time'
  ];
  for (const key of forbidden) {
    if (key in input) {
      throw fail(
        'invalid-argument',
        'Client-supplied timestamps are not accepted. The server records the time.'
      );
    }
  }
}

export interface CorrectionInput {
  teacherId: string;
  date: string;
  arrivalTime: string | null;
  departureTime: string | null;
  reason: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateCorrection(input: CorrectionInput): {
  teacherId: string;
  date: string;
  arrivalTime: string | null;
  departureTime: string | null;
  reason: string;
} {
  const teacherId = normalizeTeacherId(input.teacherId);
  if (!isValidTeacherId(teacherId)) {
    throw fail('invalid-argument', 'The teacher ID is not valid.');
  }
  const date = String(input.date ?? '');
  if (!DATE_PATTERN.test(date)) {
    throw fail('invalid-argument', 'The date must be in YYYY-MM-DD format.');
  }
  const reason = String(input.reason ?? '').trim();
  if (reason.length < 5) {
    throw fail('invalid-argument', 'A reason of at least 5 characters is required.');
  }

  const arrivalTime = input.arrivalTime === null ? null : String(input.arrivalTime);
  const departureTime = input.departureTime === null ? null : String(input.departureTime);

  if (arrivalTime !== null && !TIME_PATTERN.test(arrivalTime)) {
    throw fail('invalid-argument', 'Arrival time must be in HH:MM format.');
  }
  if (departureTime !== null && !TIME_PATTERN.test(departureTime)) {
    throw fail('invalid-argument', 'Departure time must be in HH:MM format.');
  }
  if (arrivalTime === null && departureTime === null) {
    throw fail('invalid-argument', 'Provide an arrival time, a departure time, or both.');
  }
  if (arrivalTime !== null && departureTime !== null) {
    if (timeToMinutes(departureTime) <= timeToMinutes(arrivalTime)) {
      throw fail('invalid-argument', 'Departure must be later than arrival.');
    }
  }
  return { teacherId, date, arrivalTime, departureTime, reason };
}
