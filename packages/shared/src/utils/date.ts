/**
 * Returns current UTC ISO string formatted with Z.
 */
export function nowUtcString(): string {
  return new Date().toISOString();
}

/**
 * Validates whether a string is a valid ISO date-time string.
 */
export function isValidIsoDateTime(value: string): boolean {
  const d = new Date(value);
  return !isNaN(d.getTime()) && value.includes('T');
}
