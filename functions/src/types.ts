export type Role = 'admin' | 'teacher';

export type AttendanceType = 'arrival' | 'departure';

export interface Principal {
  uid: string;
  role: Role;
}

export interface UserRecord {
  uid: string;
  teacherId: string;
  name: string;
  role: Role;
  active: boolean;
  email?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface PendingDevice {
  deviceId: string;
  deviceSecretHash: string;
  deviceLabel: string;
  requestedAt: number;
}

export interface DeviceRecord {
  uid: string;
  teacherId: string;
  deviceId: string;
  deviceSecretHash: string;
  deviceLabel: string;
  status: 'approved' | 'revoked';
  pending?: PendingDevice | null;
  approvedAt?: number;
  requestedAt?: number;
  updatedAt?: number;
}

export interface TimingSettings {
  officialArrival: string;
  officialDeparture: string;
  graceMinutes: number;
  weekendDays: number[];
  holidays: string[];
  allowWeekendAttendance: boolean;
  minimumWorkingMinutes: number;
}

export interface DailyAttendanceRecord {
  id: string;
  uid: string;
  teacherId: string;
  teacherName: string;
  date: string;
  arrivalMs?: number | null;
  departureMs?: number | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
  isLate?: boolean;
  lateMinutes?: number;
  earlyDeparture?: boolean;
  earlyMinutes?: number;
  workingMinutes?: number;
  corrected?: boolean;
  correctionReason?: string;
  correctedAt?: number;
  correctedBy?: string;
  originalArrivalMs?: number | null;
  originalDepartureMs?: number | null;
  updatedAt?: number;
}

export interface QrSettings {
  token: string;
  createdAt: number;
  expiresAt: number | null;
  revoked: boolean;
  revokedAt?: number | null;
  rateLimitPerHour?: number;
}

export interface AuditEntry {
  at: number;
  actorUid: string;
  actorRole: Role | 'system';
  action: string;
  targetId: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
}

export const DEFAULT_TIMING: TimingSettings = {
  officialArrival: '09:30',
  officialDeparture: '17:00',
  graceMinutes: 15,
  weekendDays: [0],
  holidays: [],
  allowWeekendAttendance: false,
  minimumWorkingMinutes: 180
};

export const DEFAULT_RATE_LIMIT_PER_HOUR = 20;
