import { z } from 'zod';

export const HealthCheckInputSchema = z.object({
  clientTimestamp: z.string().datetime().optional(),
});

export type HealthCheckInput = z.infer<typeof HealthCheckInputSchema>;

export const HealthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'unhealthy']),
  electron: z.object({
    version: z.string(),
    platform: z.string(),
    arch: z.string(),
    userDataPath: z.string(),
  }),
  nestjs: z.object({
    status: z.enum(['ok', 'down']),
    uptimeSeconds: z.number(),
  }),
  database: z.object({
    status: z.enum(['ok', 'down']),
    driver: z.string(),
    filePath: z.string(),
    foreignKeysEnabled: z.boolean(),
    journalMode: z.string(),
    integrityOk: z.boolean(),
    currentSchemaVersion: z.string().nullable(),
  }),
  timestamp: z.string().datetime(),
  latencyMs: z.number().nonnegative(),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
