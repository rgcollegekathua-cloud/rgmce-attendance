/**
 * Account conventions shared with the web client
 * (`src/lib/teacherId.ts` in the application root). Keep both files in sync.
 */
export const TEACHER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,19}$/;
export const TEACHER_EMAIL_DOMAIN = 'rgmce.edu.in';

export function normalizeTeacherId(value: string): string {
  return String(value ?? '').trim();
}

export function isValidTeacherId(value: string): boolean {
  return TEACHER_ID_PATTERN.test(normalizeTeacherId(value));
}

export function teacherEmailFromId(teacherId: string): string {
  return `${normalizeTeacherId(teacherId).toLowerCase()}@${TEACHER_EMAIL_DOMAIN}`;
}

export interface PasswordProblem {
  valid: boolean;
  message?: string;
}

export function checkPassword(password: string): PasswordProblem {
  if (password.length < 10) {
    return { valid: false, message: 'Password must be at least 10 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain an uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain a lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain a digit.' };
  }
  return { valid: true };
}

export function isValidName(value: string): boolean {
  const trimmed = String(value ?? '').trim();
  return trimmed.length >= 3 && trimmed.length <= 80;
}
