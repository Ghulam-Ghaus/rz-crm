import { z } from 'zod';

export const ErrorCode = {
  // Authentication & authorization
  AUTH_UNAUTHENTICATED: 'AUTH_UNAUTHENTICATED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',

  // Validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BAD_REQUEST: 'BAD_REQUEST',

  // System & Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  DATABASE_BUSY: 'DATABASE_BUSY',
  DATABASE_INTEGRITY_FAILED: 'DATABASE_INTEGRITY_FAILED',
  DATABASE_RECOVERY_REQUIRED: 'DATABASE_RECOVERY_REQUIRED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // IPC
  IPC_CHANNEL_NOT_FOUND: 'IPC_CHANNEL_NOT_FOUND',
  IPC_PAYLOAD_INVALID: 'IPC_PAYLOAD_INVALID',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
