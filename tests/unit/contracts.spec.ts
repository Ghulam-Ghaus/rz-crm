import { describe, it, expect } from 'vitest';
import {
  Result,
  ErrorCode,
  ErrorEnvelopeSchema,
  HealthCheckInputSchema,
  HealthCheckResponseSchema,
  StoreSchema,
  InstallationSchema,
  RegisterSchema,
  SettingSchema,
} from '@rz-crm/contracts';

describe('Contracts & Schemas (Unit Tests)', () => {
  it('should construct and validate Result.ok and Result.err envelopes', () => {
    const ok = Result.ok({ count: 42 });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.count).toBe(42);
    }

    const err = Result.err({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Invalid input',
      correlationId: 'test-1234',
    });
    expect(err.success).toBe(false);
    if (!err.success) {
      expect(err.error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(ErrorEnvelopeSchema.safeParse(err.error).success).toBe(true);
    }
  });

  it('should validate HealthCheckResponse according to schema', () => {
    const validHealth = {
      status: 'ok' as const,
      electron: {
        version: '35.0.0',
        platform: 'win32',
        arch: 'x64',
        userDataPath: 'C:\\Users\\User\\AppData\\Roaming\\BakeryStore',
      },
      nestjs: {
        status: 'ok' as const,
        uptimeSeconds: 120,
      },
      database: {
        status: 'ok' as const,
        driver: 'better-sqlite3',
        filePath: 'C:\\Users\\User\\AppData\\Roaming\\BakeryStore\\data\\bakery.db',
        foreignKeysEnabled: true,
        journalMode: 'wal',
        integrityOk: true,
        currentSchemaVersion: '1.0.0',
      },
      timestamp: new Date().toISOString(),
      latencyMs: 1.45,
    };

    const result = HealthCheckResponseSchema.safeParse(validHealth);
    expect(result.success).toBe(true);

    const inputResult = HealthCheckInputSchema.safeParse({
      clientTimestamp: new Date().toISOString(),
    });
    expect(inputResult.success).toBe(true);
  });

  it('should validate Installation schema', () => {
    const validInstall = {
      id: 1,
      deviceId: 'DEVICE-POS-01',
      storeId: 2,
      appVersion: '0.1.0',
      installState: 'active' as const,
      registeredAtUtc: new Date().toISOString(),
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    };
    expect(InstallationSchema.safeParse(validInstall).success).toBe(true);
  });

  it('should reject malformed Store schema', () => {
    const invalidStore = {
      id: 'not-a-number',
      code: 'STORE-01',
      name: 'Downtown Bakery',
      timezone: 'UTC',
      currencyCode: 'TOOLONG', // Must be 3 chars
      isActive: true,
      createdAtUtc: 'invalid-date',
      updatedAtUtc: new Date().toISOString(),
    };

    const result = StoreSchema.safeParse(invalidStore);
    expect(result.success).toBe(false);
  });

  it('should validate Register and Setting schemas correctly', () => {
    const validRegister = {
      id: 1,
      storeId: 2,
      code: 'REG-01',
      name: 'Main Counter',
      isActive: true,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    };
    expect(RegisterSchema.safeParse(validRegister).success).toBe(true);

    const validSetting = {
      id: 3,
      storeId: null,
      key: 'tax.default_rate',
      value: '0.05',
      scope: 'system' as const,
      description: 'Default store tax rate',
      updatedBy: 'admin',
      version: 1,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    };
    expect(SettingSchema.safeParse(validSetting).success).toBe(true);
  });
});
