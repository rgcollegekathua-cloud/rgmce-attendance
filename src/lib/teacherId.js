/**
 * Shared account conventions.
 *
 * The same rules exist in `functions/src/teacherId.ts` (backend source of
 * truth for enforcement). Keep both files in sync.
 */
export const TEACHER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,19}$/;
export const TEACHER_EMAIL_DOMAIN = 'rgmce.edu.in';
export function normalizeTeacherId(value) {
    return value.trim().toUpperCase();
}
export function validateTeacherId(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return 'Teacher ID is required.';
    if (!TEACHER_ID_PATTERN.test(trimmed)) {
        return 'Teacher ID must be 3-20 characters using only letters, numbers, - or _.';
    }
    return null;
}
export function teacherEmailFromId(teacherId) {
    return `${teacherId.trim().toLowerCase()}@${TEACHER_EMAIL_DOMAIN}`;
}
export function validateName(value) {
    const trimmed = value.trim();
    if (trimmed.length < 3)
        return 'Enter the full name of the teacher.';
    if (trimmed.length > 80)
        return 'Name is too long.';
    return null;
}
