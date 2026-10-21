import { validateTeacherId as validateId, teacherEmailFromId } from './teacherId';
export { validateId as validateTeacherId, teacherEmailFromId };
export function isEmailInput(value) {
    return value.includes('@');
}
export function resolveSignInEmail(value) {
    const trimmed = value.trim();
    return isEmailInput(trimmed) ? trimmed : teacherEmailFromId(trimmed);
}
export function formatPasswordRules() {
    return 'At least 10 characters, with an uppercase letter, a lowercase letter and a digit.';
}
export function passwordProblem(password) {
    if (password.length < 10)
        return 'Password must be at least 10 characters long.';
    if (!/[A-Z]/.test(password))
        return 'Password must contain an uppercase letter.';
    if (!/[a-z]/.test(password))
        return 'Password must contain a lowercase letter.';
    if (!/[0-9]/.test(password))
        return 'Password must contain a digit.';
    return null;
}
