import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  DatabaseManager,
  StoreEntity,
  RegisterEntity,
  SettingEntity,
  SchemaMetadataEntity,
} from '@bakery/database';

describe('SQLite Database & Migration #1 Integration', () => {
  let tempDir: string;
  let dbPath: string;
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-db-test-'));
    dbPath = path.join(tempDir, 'test_bakery.db');
    dbManager = new DatabaseManager({ filePath: dbPath });
    await dbManager.initialize();
  });

  afterEach(async () => {
    await dbManager.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should run initial migration #1 and verify schema metadata', async () => {
    await dbManager.runMigrations();

    const health = await dbManager.getHealth();
    expect(health.status).toBe('ok');
    expect(health.integrityOk).toBe(true);
    expect(health.foreignKeysEnabled).toBe(true);
    expect(health.journalMode).toBe('wal');
    expect(health.currentSchemaVersion).toBe('1.0.0');

    const ds = dbManager.getDataSource();
    const metaRepo = ds.getRepository(SchemaMetadataEntity);
    const metaList = await metaRepo.find();
    expect(metaList.length).toBeGreaterThanOrEqual(1);
    expect(metaList[0]?.schemaVersion).toBe('1.0.0');
    expect(metaList[0]?.appVersion).toBe('0.1.0');
  });

  it('should enforce SQLite Foreign Key constraints', async () => {
    await dbManager.runMigrations();
    const ds = dbManager.getDataSource();

    const registerRepo = ds.getRepository(RegisterEntity);
    const orphanRegister = registerRepo.create({
      storeId: 999999, // Non-existent store
      code: 'REG-01',
      name: 'Orphan Counter',
      isActive: true,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });

    // Foreign keys are enabled, so inserting with non-existent foreign key must reject!
    await expect(registerRepo.save(orphanRegister)).rejects.toThrow();
  });

  it('should persist store, register, and settings across restart', async () => {
    await dbManager.runMigrations();
    const ds = dbManager.getDataSource();

    const storeRepo = ds.getRepository(StoreEntity);
    const registerRepo = ds.getRepository(RegisterEntity);
    const settingRepo = ds.getRepository(SettingEntity);

    const store = storeRepo.create({
      code: 'STORE-MAIN',
      name: 'Main Bakery Store',
      timezone: 'America/New_York',
      currencyCode: 'USD',
      taxNumber: 'TAX-998877',
      address: '123 Baker Street',
      phone: '555-0199',
      isActive: true,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });
    await storeRepo.save(store);
    const storeId = store.id;

    const register = registerRepo.create({
      storeId: store.id,
      code: 'REG-01',
      name: 'Counter Register 1',
      isActive: true,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });
    await registerRepo.save(register);

    const setting = settingRepo.create({
      storeId: store.id,
      key: 'pos.allow_price_override',
      value: 'false',
      scope: 'store',
      version: 1,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });
    await settingRepo.save(setting);

    // Close database connection cleanly
    await dbManager.close();

    // Reopen database connection to verify persistence
    const reopenedManager = new DatabaseManager({ filePath: dbPath });
    await reopenedManager.initialize();

    try {
      const reopenedDs = reopenedManager.getDataSource();
      const loadedStore = await reopenedDs.getRepository(StoreEntity).findOneBy({ id: storeId });
      expect(loadedStore).not.toBeNull();
      expect(loadedStore?.name).toBe('Main Bakery Store');

      const loadedRegister = await reopenedDs.getRepository(RegisterEntity).findOneBy({ storeId });
      expect(loadedRegister).not.toBeNull();
      expect(loadedRegister?.code).toBe('REG-01');

      const loadedSetting = await reopenedDs
        .getRepository(SettingEntity)
        .findOneBy({ key: 'pos.allow_price_override' });
      expect(loadedSetting).not.toBeNull();
      expect(loadedSetting?.value).toBe('false');
    } finally {
      await reopenedManager.close();
    }
  });
});
