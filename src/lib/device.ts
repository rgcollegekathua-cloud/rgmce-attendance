/**
 * Installation-specific device identity.
 *
 * HONEST LIMITATION: a web browser cannot expose a permanent, unspoofable
 * hardware identifier. What we do instead:
 *
 *  1. Generate a random installation key pair (id + secret) with the Web
 *     Crypto API on first run and keep it in `localStorage`.
 *  2. Register it with the server, which stores only a SHA-256 hash of the
 *     secret plus an admin approval decision.
 *  3. Require the key on every attendance call and reject unknown or
 *     unapproved keys server-side.
 *
 * This raises the bar (cloning requires stealing the stored secret) but does
 * NOT make device cloning impossible: anyone with full control of the device
 * or of the browser profile can copy `localStorage`. Physical presence is
 * therefore supported by additional, separately documented checks
 * (college network gateway verification, rotating QR code).
 */

const DEVICE_ID_KEY = 'rgmce.device.id';
const DEVICE_SECRET_KEY = 'rgmce.device.secret';

export interface DeviceIdentity {
  deviceId: string;
  deviceSecret: string;
  label: string;
}

function randomId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSecret(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function describeDevice(): string {
  const ua = navigator.userAgent;
  const platform =
    /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'iOS'
        : /Macintosh/i.test(ua)
          ? 'macOS'
          : /Windows/i.test(ua)
            ? 'Windows'
            : /Linux/i.test(ua)
              ? 'Linux'
              : 'Device';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\//i.test(ua)
      ? 'Opera'
      : /Chrome\//i.test(ua)
        ? 'Chrome'
        : /Firefox\//i.test(ua)
          ? 'Firefox'
          : /Safari\//i.test(ua)
            ? 'Safari'
            : 'Browser';
  const size =
    typeof window !== 'undefined'
      ? `${window.screen.width}x${window.screen.height}`
      : '';
  return `${platform} ${browser}${size ? ` (${size})` : ''}`;
}

export function getOrCreateDeviceIdentity(): DeviceIdentity {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  let deviceSecret = localStorage.getItem(DEVICE_SECRET_KEY);
  if (!deviceId || !deviceSecret) {
    deviceId = randomId();
    deviceSecret = randomSecret();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    localStorage.setItem(DEVICE_SECRET_KEY, deviceSecret);
  }
  return { deviceId, deviceSecret, label: describeDevice() };
}

export function clearDeviceIdentity(): void {
  localStorage.removeItem(DEVICE_ID_KEY);
  localStorage.removeItem(DEVICE_SECRET_KEY);
}
