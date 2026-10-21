/**
 * Minimal persistence abstraction.
 *
 * `firebase-admin`'s Firestore satisfies these shapes structurally, which lets
 * the business logic run against an in-memory fake in unit tests without
 * changing production behaviour.
 */
export interface DocRef {
  readonly path: string;
}

export interface Snapshot<T = Record<string, unknown>> {
  readonly exists: boolean;
  readonly id: string;
  data(): T | undefined;
}

export interface WriteTransaction {
  get(ref: DocRef): Promise<Snapshot>;
  set(ref: DocRef, data: Record<string, unknown>, options?: { merge?: boolean }): void;
  update(ref: DocRef, data: Record<string, unknown>): void;
  delete(ref: DocRef): void;
}

export interface Db {
  doc(path: string): DocRef;
  get(ref: DocRef): Promise<Snapshot>;
  set(ref: DocRef, data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>;
  /** Fails when the document already exists — used for unique-ID reservation. */
  create(ref: DocRef, data: Record<string, unknown>): Promise<void>;
  delete(ref: DocRef): Promise<void>;
  runTransaction<T>(updateFunction: (tx: WriteTransaction) => Promise<T>): Promise<T>;
  serverTimestamp(): unknown;
}

export interface AuthAdmin {
  createUser(record: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ uid: string }>;
  deleteUser(uid: string): Promise<void>;
  updateUser(uid: string, record: { password?: string; displayName?: string }): Promise<void>;
}

export interface Ctx {
  db: Db;
  authAdmin: AuthAdmin;
  now(): number;
  hash(value: string): string;
  randomId(): string;
  /** Marker written to documents so Firestore stamps its own server time. */
  serverTimestamp(): unknown;
}

export const paths = {
  user: (uid: string) => `users/${uid}`,
  device: (uid: string) => `registeredDevices/${uid}`,
  event: (id: string) => `attendanceEvents/${id}`,
  daily: (id: string) => `dailyAttendance/${id}`,
  audit: (id: string) => `auditLogs/${id}`,
  teacherId: (teacherId: string) => `teacherIds/${teacherId}`,
  rateLimit: (key: string) => `rateLimits/${key}`,
  appSettings: 'collegeSettings/app',
  securitySettings: 'collegeSettings/security'
} as const;

export function dailyId(teacherId: string, dateKey: string): string {
  return `${teacherId}_${dateKey}`;
}

export function eventId(teacherId: string, dateKey: string, type: string): string {
  return `${teacherId}_${dateKey}_${type}`;
}
