import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { createHash, randomUUID } from 'node:crypto';
import type { AuthAdmin, Ctx, Db, WriteTransaction } from './db';
import { AppError } from './errors';
import {
  approveDevice as approveDeviceHandler,
  correctAttendance as correctAttendanceHandler,
  createTeacher as createTeacherHandler,
  markAttendance as markAttendanceHandler,
  registerDevice as registerDeviceHandler,
  resetTeacherPassword as resetTeacherPasswordHandler,
  setQrToken as setQrTokenHandler,
  setTeacherStatus as setTeacherStatusHandler
} from './handlers';
import type { Principal, Role } from './types';

initializeApp();
setGlobalOptions({ region: 'asia-south1', maxInstances: 20 });

const firestore = getFirestore();

/** Structural adapter so the business logic can run against a fake in tests. */
const db: Db = {
  doc: (path: string) => firestore.doc(path),
  get: (ref) => firestore.doc(ref.path).get(),
  set: async (ref, data, options) => {
    await firestore.doc(ref.path).set(data, options ?? {});
  },
  create: async (ref, data) => {
    await firestore.doc(ref.path).create(data);
  },
  delete: async (ref) => {
    await firestore.doc(ref.path).delete();
  },
  runTransaction: <T>(fn: (tx: WriteTransaction) => Promise<T>): Promise<T> =>
    firestore.runTransaction((tx) => fn(tx)),
  serverTimestamp: () => FieldValue.serverTimestamp()
};

const authAdmin: AuthAdmin = {
  createUser: async ({ email, password, displayName }) => {
    const user = await getAuth().createUser({ email, password, displayName });
    return { uid: user.uid };
  },
  deleteUser: async (uid) => {
    await getAuth().deleteUser(uid);
  },
  updateUser: async (uid, record) => {
    await getAuth().updateUser(uid, record);
  }
};

const ctx: Ctx = {
  db,
  authAdmin,
  now: () => Date.now(),
  hash: (value: string) => createHash('sha256').update(value).digest('hex'),
  randomId: () => randomUUID(),
  serverTimestamp: () => FieldValue.serverTimestamp()
};

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof AppError) {
    return new HttpsError(
      error.code as
        | 'invalid-argument'
        | 'failed-precondition'
        | 'permission-denied'
        | 'not-found'
        | 'already-exists'
        | 'resource-exhausted'
        | 'unauthenticated'
        | 'internal',
      error.message
    );
  }
  if (error instanceof HttpsError) return error;
  console.error('Unhandled attendance error', error);
  return new HttpsError('internal', 'Unexpected server error. Please try again.');
}

async function resolvePrincipal(uid: string): Promise<Principal> {
  const snapshot = await firestore.doc(`users/${uid}`).get();
  if (!snapshot.exists) {
    throw new AppError('permission-denied', 'Your account profile does not exist.');
  }
  const data = snapshot.data() as { role?: string };
  if (data.role !== 'admin' && data.role !== 'teacher') {
    throw new AppError('permission-denied', 'This account is not authorised.');
  }
  return { uid, role: data.role as Role };
}

function readData(request: CallableRequest): Record<string, unknown> {
  const data = request.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'The request payload is missing.');
  }
  return data as Record<string, unknown>;
}

async function execute<T>(
  request: CallableRequest,
  operation: (principal: Principal, data: Record<string, unknown>) => Promise<T>
): Promise<T> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  try {
    const principal = await resolvePrincipal(request.auth.uid);
    return await operation(principal, readData(request));
  } catch (error) {
    throw toHttpsError(error);
  }
}

/* ------------------------------ admin actions --------------------------- */

export const createTeacher = onCall(async (request) =>
  execute(request, (principal, data) =>
    createTeacherHandler(ctx, principal, {
      teacherId: String(data.teacherId ?? ''),
      name: String(data.name ?? ''),
      initialPassword: String(data.initialPassword ?? '')
    })
  )
);

export const setTeacherStatus = onCall(async (request) =>
  execute(request, (principal, data) =>
    setTeacherStatusHandler(ctx, principal, {
      uid: String(data.uid ?? ''),
      active: data.active === true,
      reason: typeof data.reason === 'string' ? data.reason : undefined
    })
  )
);

export const resetTeacherPassword = onCall(async (request) =>
  execute(request, (principal, data) =>
    resetTeacherPasswordHandler(ctx, principal, {
      uid: String(data.uid ?? ''),
      newPassword: String(data.newPassword ?? '')
    })
  )
);

export const approveDevice = onCall(async (request) =>
  execute(request, (principal, data) => approveDeviceHandler(ctx, principal, data))
);

export const correctAttendance = onCall(async (request) =>
  execute(request, (principal, data) => correctAttendanceHandler(ctx, principal, data))
);

export const setQrToken = onCall(async (request) =>
  execute(request, (principal, data) => setQrTokenHandler(ctx, principal, data))
);

/* ----------------------------- teacher actions -------------------------- */

export const registerDevice = onCall(async (request) =>
  execute(request, (principal, data) => registerDeviceHandler(ctx, principal, data))
);

export const markAttendance = onCall(async (request) =>
  execute(request, (principal, data) => markAttendanceHandler(ctx, principal, data))
);
