import { IST_TIME_ZONE } from './types';

const datePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const longFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const monthFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  month: 'long',
  year: 'numeric'
});

/** Calendar date in Asia/Kolkata as YYYY-MM-DD. */
export function istDateKey(input: Date | number = Date.now()): string {
  const date = typeof input === 'number' ? new Date(input) : input;
  return datePartsFormatter.format(date);
}

/** 24-hour HH:MM in Asia/Kolkata. */
export function istTimeKey(input: Date | number): string {
  const date = typeof input === 'number' ? new Date(input) : input;
  return timeFormatter.format(date);
}

export function formatIstLong(input: Date | number): string {
  const date = typeof input === 'number' ? new Date(input) : input;
  return longFormatter.format(date);
}

export function formatIstMonth(year: number, monthIndex: number): string {
  const sample = new Date(Date.UTC(year, monthIndex, 1, 6, 0, 0));
  return monthFormatter.format(sample);
}

export function formatClock(ms?: number | null): string {
  if (ms === undefined || ms === null) return '—';
  return istTimeKey(ms);
}

/** hh:mm (24h) string to minutes since midnight. */
export function timeToMinutes(value: string): number {
  const [h = '0', m = '0'] = value.split(':');
  const hours = Number.parseInt(h, 10);
  const minutes = Number.parseInt(m, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.round(total));
  const hours = Math.floor(clamped / 60) % 24;
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Minutes since midnight (IST) for a given timestamp. */
export function istMinutesOfDay(ms: number): number {
  return timeToMinutes(istTimeKey(ms));
}

export function weekdayInIst(ms: number): number {
  const key = istDateKey(ms);
  const [y, m, d] = key.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function monthDateKeys(year: number, monthIndex: number): string[] {
  const keys: string[] = [];
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  for (let day = 1; day <= days; day += 1) {
    keys.push(
      `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    );
  }
  return keys;
}

export function formatDuration(minutes?: number | null): string {
  if (minutes === undefined || minutes === null || Number.isNaN(minutes)) {
    return '—';
  }
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours === 0) return `${sign}${mins}m`;
  return `${sign}${hours}h ${mins}m`;
}

export function nowIstDateKey(): string {
  return istDateKey(Date.now());
}
