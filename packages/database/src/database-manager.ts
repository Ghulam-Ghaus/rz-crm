import { DataSource } from 'typeorm';
import { createDataSource, DatabaseConnectionOptions } from './data-source.js';
import { SchemaMetadataEntity } from './entities/schema-metadata.entity.js';

export interface DatabaseHealthInfo {
  status: 'ok' | 'down';
  driver: string;
  filePath: string;
  foreignKeysEnabled: boolean;
  journalMode: string;
  integrityOk: boolean;
  currentSchemaVersion: string | null;
}

export class DatabaseManager {
  private dataSource: DataSource | null = null;
  private readonly options: DatabaseConnectionOptions;

  constructor(options: DatabaseConnectionOptions) {
    this.options = options;
  }

  public async initialize(): Promise<DataSource> {
    if (this.dataSource && this.dataSource.isInitialized) {
      return this.dataSource;
    }

    this.dataSource = createDataSource(this.options);
    await this.dataSource.initialize();

    // Enforce required SQLite Pragmas per AGENTS.md and ARCHITECTURE.md
    await this.applyPragmas();

    return this.dataSource;
  }

  private async applyPragmas(): Promise<void> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new Error('Cannot apply pragmas to uninitialized database');
    }

    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.query('PRAGMA foreign_keys = ON;');
      const busyTimeout = this.options.busyTimeoutMs ?? 5000;
      await runner.query(`PRAGMA busy_timeout = ${busyTimeout};`);
      await runner.query('PRAGMA journal_mode = WAL;');
    } finally {
      await runner.release();
    }
  }

  public async runMigrations(): Promise<void> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new Error('Cannot run migrations: database not initialized');
    }

    await this.dataSource.runMigrations();

    // Verify integrity after migration
    const integrity = await this.checkIntegrity();
    if (!integrity) {
      throw new Error('Database integrity check failed following migration run');
    }
  }

  public async checkIntegrity(): Promise<boolean> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      return false;
    }

    const runner = this.dataSource.createQueryRunner();
    try {
      const result = (await runner.query('PRAGMA quick_check;')) as Array<{ quick_check: string }>;
      return Array.isArray(result) && result[0]?.quick_check === 'ok';
    } catch {
      return false;
    } finally {
      await runner.release();
    }
  }

  public async getHealth(): Promise<DatabaseHealthInfo> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      return {
        status: 'down',
        driver: 'better-sqlite3',
        filePath: this.options.filePath,
        foreignKeysEnabled: false,
        journalMode: 'unknown',
        integrityOk: false,
        currentSchemaVersion: null,
      };
    }

    const runner = this.dataSource.createQueryRunner();
    try {
      // 1. Foreign keys
      const fkResult = (await runner.query('PRAGMA foreign_keys;')) as Array<{
        foreign_keys: number;
      }>;
      const foreignKeysEnabled = fkResult?.[0]?.foreign_keys === 1;

      // 2. Journal mode
      const jmResult = (await runner.query('PRAGMA journal_mode;')) as Array<{
        journal_mode: string;
      }>;
      const journalMode = jmResult?.[0]?.journal_mode?.toLowerCase() ?? 'unknown';

      // 3. Integrity
      const integrityOk = await this.checkIntegrity();

      // 4. Schema version
      let currentSchemaVersion: string | null = null;
      try {
        const repo = this.dataSource.getRepository(SchemaMetadataEntity);
        const metadata = await repo.find({
          order: { installedAtUtc: 'DESC' },
          take: 1,
        });
        currentSchemaVersion = metadata[0]?.schemaVersion ?? null;
      } catch {
        currentSchemaVersion = null;
      }

      return {
        status: integrityOk ? 'ok' : 'down',
        driver: 'better-sqlite3',
        filePath: this.options.filePath,
        foreignKeysEnabled,
        journalMode,
        integrityOk,
        currentSchemaVersion,
      };
    } finally {
      await runner.release();
    }
  }

  public getDataSource(): DataSource {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new Error('Database is not initialized');
    }
    return this.dataSource;
  }

  public getFilePath(): string {
    return this.options.filePath;
  }

  public async flushWal(): Promise<void> {
    if (!this.dataSource || !this.dataSource.isInitialized) return;
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.query('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // Ignore if cannot truncate WAL
    } finally {
      await runner.release();
    }
  }

  public async backupTo(destFilePath: string): Promise<void> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new Error('Cannot backup: database is not initialized');
    }

    await this.flushWal();

    const nativeDb = (this.dataSource.driver as any)?.databaseConnection;
    if (nativeDb && typeof nativeDb.backup === 'function') {
      await nativeDb.backup(destFilePath);
    } else {
      const fs = await import('node:fs');
      await fs.promises.copyFile(this.options.filePath, destFilePath);
    }
  }

  public async reconnect(): Promise<void> {
    await this.close();
    await this.initialize();
  }

  public async close(): Promise<void> {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.dataSource = null;
    }
  }
}

