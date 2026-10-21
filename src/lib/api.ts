import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type QueryConstraint,
  type Unsubscribe
} from 'firebase/firestore';
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { db, functions } from './firebase';
import type {
  AppSettings,
  AuditLogEntry,
  AttendanceType,
  DailyAttendance,
  DeviceRecord,
  SecuritySettings,
  UserProfile
} from './types';
import { DEFAULT_APP_SETTINGS, DEFAULT_TIMING } from './types';

export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiError';
  }
}

interface CallableErrorLike {
  code?: string;
  message?: string;
}

function toApiError(error: unknown): ApiError {
  const err = error as CallableErrorLike & { code?: unknown };
  const rawCode = typeof err?.code === 'string' ? err.code : 'unknown';
  const code = rawCode.replace('functions/', '');
  const rawMessage = typeof err?.message === 'string' ? err.message : '';
  switch (code) {
    case 'unavailable':
      return new ApiError(
        'unavailable',
        'Attendance service is not reachable. The Cloud Functions may not be deployed yet.'
      );
    case 'unauthenticated':
      return new ApiError('unauthenticated', 'Your session has expired. Please sign in again.');
    case 'permission-denied':
      return new ApiError('permission-denied', 'You are not allowed to perform this action.');
    case 'resource-exhausted':
      return new ApiError('resource-exhausted', rawMessage || 'Too many attempts. Please wait and try again.');
    case 'not-found':
      return new ApiError('not-found', rawMessage || 'The requested record was not found.');
    case 'already-exists':
      return new ApiError('already-exists', rawMessage || 'This record already exists.');
    case 'invalid-argument':
      return new ApiError('invalid-argument', rawMessage || 'The request was not valid.');
    case 'failed-precondition':
      return new ApiError('failed-precondition', rawMessage || 'The request cannot be completed right now.');
    case 'deadline-exceeded':
      return new ApiError('deadline-exceeded', 'The request timed out. Please try again.');
    default:
      return new ApiError(code, rawMessage || 'Something went wrong. Please try again.');
  }
}

async function call<T>(name: string, data: unknown): Promise<T> {
  const callable = httpsCallable<typeof data, T>(functions, name);
  try {
    const result: HttpsCallableResult<T> = await callable(data);
    return result.data;
  } catch (error) {
    throw toApiError(error);
  }
}

/* ------------------------------- Teachers ------------------------------- */

export interface CreateTeacherInput {
  teacherId: string;
  name: string;
  initialPassword: string;
}

export interface CreateTeacherResult {
  uid: string;
  temporaryPassword: string;
}

export function createTeacher(input: CreateTeacherInput): Promise<CreateTeacherResult> {
  return call<CreateTeacherResult>('createTeacher', input);
}

export function setTeacherStatus(
  uid: string,
  active: boolean,
  reason: string
): Promise<{ ok: boolean }> {
  return call<{ ok: boolean }>('setTeacherStatus', { uid, active, reason });
}

export function resetTeacherPassword(
  uid: string,
  newPassword: string
): Promise<{ ok: boolean; temporaryPassword: string }> {
  return call<{ ok: boolean; temporaryPassword: string }>('resetTeacherPassword', {
    uid,
    newPassword
  });
}

export async function listUsers(): Promise<UserProfile[]> {
  const snapshot = await getDocs(query(collection(db, 'users'), orderBy('name', 'asc')));
  return snapshot.docs.map((d) => d.data() as UserProfile);
}

export function subscribeUsers(
  callback: (users: UserProfile[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'users'), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => d.data() as UserProfile)),
    onError
  );
}

/* -------------------------------- Devices ------------------------------- */

export function subscribeDevice(
  uid: string,
  callback: (device: DeviceRecord | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'registeredDevices', uid),
    (snapshot) => callback(snapshot.exists() ? (snapshot.data() as DeviceRecord) : null),
    onError
  );
}

export function registerDevice(
  deviceId: string,
  deviceSecret: string,
  label: string
): Promise<{ status: string; message: string }> {
  return call<{ status: string; message: string }>('registerDevice', {
    deviceId,
    deviceSecret,
    label
  });
}

export function approveDevice(
  uid: string,
  approve: boolean,
  reason: string
): Promise<{ ok: boolean }> {
  return call<{ ok: boolean }>('approveDevice', { uid, approve, reason });
}

export function subscribeDevices(
  callback: (devices: DeviceRecord[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'registeredDevices'), (snapshot) =>
    callback(snapshot.docs.map((d) => d.data() as DeviceRecord))
  , onError);
}

/* ------------------------------ Attendance ------------------------------ */

export interface MarkAttendanceInput {
  qrToken: string;
  type: AttendanceType;
  deviceId: string;
  deviceSecret: string;
}

export interface MarkAttendanceResult {
  ok: true;
  type: AttendanceType;
  date: string;
  timestampMs: number;
  timeLabel: string;
  message: string;
}

export function markAttendance(input: MarkAttendanceInput): Promise<MarkAttendanceResult> {
  return call<MarkAttendanceResult>('markAttendance', input);
}

export function subscribeTodayAttendance(
  date: string,
  callback: (records: DailyAttendance[]) => void,
  onError: (error: Error) => void,
  max = 500
): Unsubscribe {
  const q = query(collection(db, 'dailyAttendance'), where('date', '==', date), limit(max));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => d.data() as DailyAttendance)),
    onError
  );
}

export function subscribeMyDay(
  recordId: string,
  callback: (record: DailyAttendance | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'dailyAttendance', recordId),
    (snapshot) => callback(snapshot.exists() ? (snapshot.data() as DailyAttendance) : null),
    onError
  );
}

export function subscribeMyAttendance(
  uid: string,
  callback: (records: DailyAttendance[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'dailyAttendance'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => d.data() as DailyAttendance)),
    onError
  );
}

export async function fetchAttendanceRange(
  startDate: string,
  endDate: string,
  max = 4000
): Promise<DailyAttendance[]> {
  const constraints: QueryConstraint[] = [
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc'),
    limit(max)
  ];
  const snapshot = await getDocs(query(collection(db, 'dailyAttendance'), ...constraints));
  return snapshot.docs.map((d) => d.data() as DailyAttendance);
}

export async function fetchAttendanceForDate(
  date: string,
  max = 500
): Promise<DailyAttendance[]> {
  const snapshot = await getDocs(
    query(collection(db, 'dailyAttendance'), where('date', '==', date), limit(max))
  );
  return snapshot.docs.map((d) => d.data() as DailyAttendance);
}

export interface CorrectAttendanceInput {
  teacherId: string;
  date: string;
  arrivalTime: string | null;
  departureTime: string | null;
  reason: string;
}

export function correctAttendance(
  input: CorrectAttendanceInput
): Promise<{ ok: boolean; date: string }> {
  return call<{ ok: boolean; date: string }>('correctAttendance', input);
}

/* -------------------------------- Settings ------------------------------ */

export async function fetchAppSettings(): Promise<AppSettings> {
  const snapshot = await getDoc(doc(db, 'collegeSettings', 'app'));
  if (!snapshot.exists()) return { ...DEFAULT_APP_SETTINGS };
  const data = snapshot.data() as Partial<AppSettings>;
  return {
    ...DEFAULT_APP_SETTINGS,
    ...data,
    weekendDays: Array.isArray(data.weekendDays)
      ? data.weekendDays
      : DEFAULT_TIMING.weekendDays,
    holidays: Array.isArray(data.holidays) ? data.holidays : []
  };
}

export async function fetchSecuritySettings(): Promise<SecuritySettings | null> {
  const snapshot = await getDoc(doc(db, 'collegeSettings', 'security'));
  if (!snapshot.exists()) return null;
  return snapshot.data() as SecuritySettings;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await setDoc(doc(db, 'collegeSettings', 'app'), settings, { merge: true });
}

export function regenerateQrToken(
  mode: 'regenerate' | 'revoke',
  validMinutes: number
): Promise<{ token: string | null; expiresAt: number | null; revoked: boolean }> {
  return call<{ token: string | null; expiresAt: number | null; revoked: boolean }>(
    'setQrToken',
    { mode, validMinutes }
  );
}

/* ------------------------------ Audit logs ------------------------------ */

export async function fetchAuditLogs(max = 200): Promise<AuditLogEntry[]> {
  const snapshot = await getDocs(
    query(collection(db, 'auditLogs'), orderBy('at', 'desc'), limit(max))
  );
  return snapshot.docs.map((d) => ({ ...(d.data() as AuditLogEntry), id: d.id }));
}
