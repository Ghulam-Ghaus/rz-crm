import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  bootstrapBackend,
  ActiveBackend,
  HealthService,
  StoreSettingsService,
} from '@rz-crm/backend';

describe('NestJS Headless Backend Context Integration', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-backend-test-'));
    const dbPath = path.join(tempDir, 'backend_test.db');

    activeBackend = await bootstrapBackend({
      dbPath,
      runMigrations: true,
    });
  });

  afterEach(async () => {
    if (activeBackend) {
      await activeBackend.appContext.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should initialize headless context and return full health check', async () => {
    const healthService = activeBackend.appContext.get(HealthService);
    expect(healthService).toBeDefined();

    const health = await healthService.checkHealth({
      version: '0.1.0',
      platform: 'win32',
      arch: 'x64',
      userDataPath: tempDir,
    });

    expect(health.status).toBe('ok');
    expect(health.nestjs.status).toBe('ok');
    expect(health.database.status).toBe('ok');
    expect(health.database.integrityOk).toBe(true);
    expect(health.database.foreignKeysEnabled).toBe(true);
    expect(health.database.journalMode).toBe('wal');
    expect(health.database.currentSchemaVersion).toBe('1.0.0');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should query StoreSettingsService returning boundary DTOs instead of entities', async () => {
    const storeSettingsService = activeBackend.appContext.get(StoreSettingsService);
    expect(storeSettingsService).toBeDefined();

    // Auto-seeds default store if none exists
    const store = await storeSettingsService.getActiveStore();
    expect(store).not.toBeNull();
    expect(store.code).toBe('MEZAAN-01');
    expect(store.name).toContain('میزان سویٹس اینڈ بیکرز');
    expect(store.currencyCode).toBe('PKR');
    expect(typeof store.id).toBe('number');
  });
});
