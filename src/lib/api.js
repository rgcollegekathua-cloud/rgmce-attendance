import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { DEFAULT_APP_SETTINGS, DEFAULT_TIMING } from './types';
export class ApiError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ApiError';
    }
}
function toApiError(error) {
    const err = error;
    const rawCode = typeof err?.code === 'string' ? err.code : 'unknown';
    const code = rawCode.replace('functions/', '');
    const rawMessage = typeof err?.message === 'string' ? err.message : '';
    switch (code) {
        case 'unavailable':
            return new ApiError('unavailable', 'Attendance service is not reachable. The Cloud Functions may not be deployed yet.');
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
async function call(name, data) {
    const callable = httpsCallable(functions, name);
    try {
        const result = await callable(data);
        return result.data;
    }
    catch (error) {
        throw toApiError(error);
    }
}
export function createTeacher(input) {
    return call('createTeacher', input);
}
export function setTeacherStatus(uid, active, reason) {
    return call('setTeacherStatus', { uid, active, reason });
}
export function resetTeacherPassword(uid, newPassword) {
    return call('resetTeacherPassword', {
        uid,
        newPassword
    });
}
export async function listUsers() {
    const snapshot = await getDocs(query(collection(db, 'users'), orderBy('name', 'asc')));
    return snapshot.docs.map((d) => d.data());
}
export function subscribeUsers(callback, onError) {
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((d) => d.data())), onError);
}
/* -------------------------------- Devices ------------------------------- */
export function subscribeDevice(uid, callback, onError) {
    return onSnapshot(doc(db, 'registeredDevices', uid), (snapshot) => callback(snapshot.exists() ? snapshot.data() : null), onError);
}
export function registerDevice(deviceId, deviceSecret, label) {
    return call('registerDevice', {
        deviceId,
        deviceSecret,
        label
    });
}
export function approveDevice(uid, approve, reason) {
    return call('approveDevice', { uid, approve, reason });
}
export function subscribeDevices(callback, onError) {
    return onSnapshot(collection(db, 'registeredDevices'), (snapshot) => callback(snapshot.docs.map((d) => d.data())), onError);
}
export function markAttendance(input) {
    return call('markAttendance', input);
}
export function subscribeTodayAttendance(date, callback, onError, max = 500) {
    const q = query(collection(db, 'dailyAttendance'), where('date', '==', date), limit(max));
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((d) => d.data())), onError);
}
export function subscribeMyDay(recordId, callback, onError) {
    return onSnapshot(doc(db, 'dailyAttendance', recordId), (snapshot) => callback(snapshot.exists() ? snapshot.data() : null), onError);
}
export function subscribeMyAttendance(uid, callback, onError) {
    const q = query(collection(db, 'dailyAttendance'), where('uid', '==', uid));
    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((d) => d.data())), onError);
}
export async function fetchAttendanceRange(startDate, endDate, max = 4000) {
    const constraints = [
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc'),
        limit(max)
    ];
    const snapshot = await getDocs(query(collection(db, 'dailyAttendance'), ...constraints));
    return snapshot.docs.map((d) => d.data());
}
export async function fetchAttendanceForDate(date, max = 500) {
    const snapshot = await getDocs(query(collection(db, 'dailyAttendance'), where('date', '==', date), limit(max)));
    return snapshot.docs.map((d) => d.data());
}
export function correctAttendance(input) {
    return call('correctAttendance', input);
}
/* -------------------------------- Settings ------------------------------ */
export async function fetchAppSettings() {
    const snapshot = await getDoc(doc(db, 'collegeSettings', 'app'));
    if (!snapshot.exists())
        return { ...DEFAULT_APP_SETTINGS };
    const data = snapshot.data();
    return {
        ...DEFAULT_APP_SETTINGS,
        ...data,
        weekendDays: Array.isArray(data.weekendDays)
            ? data.weekendDays
            : DEFAULT_TIMING.weekendDays,
        holidays: Array.isArray(data.holidays) ? data.holidays : []
    };
}
export async function fetchSecuritySettings() {
    const snapshot = await getDoc(doc(db, 'collegeSettings', 'security'));
    if (!snapshot.exists())
        return null;
    return snapshot.data();
}
export async function saveAppSettings(settings) {
    await setDoc(doc(db, 'collegeSettings', 'app'), settings, { merge: true });
}
export function regenerateQrToken(mode, validMinutes) {
    return call('setQrToken', { mode, validMinutes });
}
/* ------------------------------ Audit logs ------------------------------ */
export async function fetchAuditLogs(max = 200) {
    const snapshot = await getDocs(query(collection(db, 'auditLogs'), orderBy('at', 'desc'), limit(max)));
    return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
}
