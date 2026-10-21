/** Indian Standard Time helpers. India does not observe daylight saving time. */
export const IST_TIME_ZONE = 'Asia/Kolkata';

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

export function istDateKey(ms: number): string {
  return datePartsFormatter.format(new Date(ms));
}

export function istTimeKey(ms: number): string {
  return timeFormatter.format(new Date(ms));
}

export function timeToMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  const h = Number.parseInt(hours, 10);
  const m = Number.parseInt(minutes, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function istMinutesOfDay(ms: number): number {
  return timeToMinutes(istTimeKey(ms));
}

/**
 * Converts an IST wall-clock time on a given YYYY-MM-DD day into epoch
 * milliseconds. India's fixed UTC+05:30 offset keeps this deterministic.
 */
export function istWallClockToMs(dateKey: string, hhmm: string): number {
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  const minutes = timeToMinutes(hhmm);
  const utcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return utcMs + minutes * 60_000 - 330 * 60_000;
}

export function weekdayInIst(ms: number): number {
  const [year, month, day] = istDateKey(ms)
    .split('-')
    .map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
