export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AppError';
  }
}

export function fail(code: string, message: string): AppError {
  return new AppError(code, message);
}

/** Firestore-style error codes used by the callable wrappers. */
export type ErrorCode =
  | 'invalid-argument'
  | 'failed-precondition'
  | 'permission-denied'
  | 'not-found'
  | 'already-exists'
  | 'resource-exhausted'
  | 'unauthenticated'
  | 'internal';
