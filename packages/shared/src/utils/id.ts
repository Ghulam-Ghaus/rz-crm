import { randomUUID } from 'node:crypto';

/**
 * Generates a standard RFC 4122 v4 UUID.
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return randomUUID();
}
