import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { DatabaseManager, assertRzCrmDatabase, DatabaseIdentityError } from '@rz-crm/database';
import { resolveAppPaths } from '@rz-crm/config';

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

describe('RZ CRM database isolation and identity guard', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rz-crm-identity-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('default paths use the isolated @rz-crm folder and rz_crm.db, never bakery', () => {
    const saved = process.env.RZ_CRM_DATA_DIR;
    delete process.env.RZ_CRM_DATA_DIR;
    try {
      const p = resolveAppPaths();
      expect(path.basename(p.databasePath)).toBe('rz_crm.db');
      expect(p.userDataDir.toLowerCase()).not.toContain('bakery');
    } finally {
      if (saved !== undefined) process.env.RZ_CRM_DATA_DIR = saved;
    }
  });

  it('stamps a fresh database as rz_crm and reopens it', async () => {
    const dbPath = path.join(tempDir, 'rz_crm.db');
    const mgr = new DatabaseManager({ filePath: dbPath });
    await mgr.initialize();
    await mgr.runMigrations();
    const rows = await mgr.getDataSource().query(`SELECT db_name FROM app_identity WHERE id = 1`);
    expect(rows[0].db_name).toBe('rz_crm');
    await mgr.close();

    const again = new DatabaseManager({ filePath: dbPath });
    await expect(again.initialize()).resolves.toBeDefined();
    await again.close();
  });

  it('refuses a file named bakery.db and leaves it byte-identical', async () => {
    const bakeryPath = path.join(tempDir, 'bakery.db');
    const legacy = new Database(bakeryPath);
    legacy.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY); INSERT INTO users DEFAULT VALUES;`);
    legacy.close();
    const before = sha256(bakeryPath);

    const mgr = new DatabaseManager({ filePath: bakeryPath });
    await expect(mgr.initialize()).rejects.toBeInstanceOf(DatabaseIdentityError);
    expect(sha256(bakeryPath)).toBe(before);
    expect(fs.existsSync(`${bakeryPath}-wal`)).toBe(false);
  });

  it('refuses any non-empty database without an rz_crm stamp and does not modify it', () => {
    const foreign = path.join(tempDir, 'other.db');
    const db = new Database(foreign);
    db.exec(`CREATE TABLE sales (id INTEGER PRIMARY KEY);`);
    db.close();
    const before = sha256(foreign);

    expect(() => assertRzCrmDatabase(foreign)).toThrow(DatabaseIdentityError);
    expect(sha256(foreign)).toBe(before);
  });

  it('refuses a database stamped with a different identity', () => {
    const wrong = path.join(tempDir, 'wrong.db');
    const db = new Database(wrong);
    db.exec(
      `CREATE TABLE app_identity (id INTEGER PRIMARY KEY, db_name TEXT, created_at_utc TEXT);
       INSERT INTO app_identity VALUES (1, 'bakery', 'x');`
    );
    db.close();
    expect(() => assertRzCrmDatabase(wrong)).toThrow(DatabaseIdentityError);
  });
});
