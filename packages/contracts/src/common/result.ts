import { ErrorEnvelope } from './error.js';

export type Result<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: ErrorEnvelope };

export const Result = {
  ok<T>(data: T): Result<T> {
    return { success: true, data };
  },

  err<T = never>(error: ErrorEnvelope): Result<T> {
    return { success: false, error };
  },
};
