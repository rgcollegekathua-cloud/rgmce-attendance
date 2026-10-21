export const IST_TIME_ZONE = 'Asia/Kolkata';

export type AttendanceType = 'arrival' | 'departure';

export type Role = 'admin' | 'teacher';

export interface UserProfile {
  uid: string;
  teacherId: string;
  name: string;
  role: Role;
  active: boolean;
  email?: string;
  mustChangePassword?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export type DeviceStatus = 'none' | 'pending' | 'approved' | 'revoked';

export interface DeviceRecord {
  uid: string;
  teacherId: string;
  deviceId: string;
  deviceLabel: string;
  status: DeviceStatus;
  pendingDeviceId?: string | null;
  pendingDeviceLabel?: string | null;
  requestedAt?: number | null;
  approvedAt?: number | null;
  updatedAt?: number | null;
}

export interface AttendanceEvent {
  id: string;
  uid: string;
  teacherId: string;
  date: string;
  type: AttendanceType;
  timestampMs: number;
  source: 'qr';
  createdAt?: number;
  isCorrection?: boolean;
  correctedBy?: string;
  correctionReason?: string;
  originalEventId?: string;
}

export interface DailyAttendance {
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
  missingArrival?: boolean;
  missingDeparture?: boolean;
  status?: DayStatus;
  corrected?: boolean;
  correctionReason?: string;
  correctedAt?: number | null;
  correctedBy?: string | null;
  originalArrivalMs?: number | null;
  originalDepartureMs?: number | null;
  updatedAt?: number;
}

export type DayStatus =
  | 'present'
  | 'incomplete'
  | 'late'
  | 'early'
  | 'holiday'
  | 'weekend'
  | 'upcoming'
  | 'none';

export interface TimingSettings {
  officialArrival: string;
  officialDeparture: string;
  graceMinutes: number;
  weekendDays: number[];
  holidays: string[];
  allowWeekendAttendance: boolean;
  minimumWorkingMinutes: number;
}

export interface QrSettings {
  token: string;
  createdAt: number;
  expiresAt: number | null;
  revoked: boolean;
  revokedAt?: number | null;
}

export interface AppSettings extends TimingSettings {
  collegeName: string;
  collegePlace: string;
}

export interface AuditLogEntry {
  id: string;
  at: number;
  actorUid: string;
  actorRole: Role | 'system';
  action: string;
  targetId: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
}

export interface SecuritySettings extends QrSettings {
  rateLimitPerHour: number;
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

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ...DEFAULT_TIMING,
  collegeName: 'Rajiv Gandhi Memorial College of Education',
  collegePlace: 'Kathua, Jammu & Kashmir'
};
