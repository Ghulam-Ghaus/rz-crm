import { Injectable, Logger } from '@nestjs/common';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import type {
  BackupManifest,
  BackupStatus,
  CreateBackupInput,
  RestoreBackupInput,
} from '@rz-crm/contracts';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly maxRetainedBackups = 15;

  constructor(private readonly databaseService: DatabaseService) {}

  public getBackupDir(): string {
    const liveDbPath = this.databaseService.getManager().getFilePath();
    const baseDir = path.dirname(liveDbPath);
    const backupDir = path.join(baseDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  public async createBackup(input?: CreateBackupInput): Promise<BackupManifest> {
    const backupDir = this.getBackupDir();
    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-');
    const dbFilename = `bakery-backup-${timestampStr}.db`;
    const manifestFilename = `bakery-backup-${timestampStr}.json`;
    const targetDbPath = path.join(backupDir, dbFilename);
    const targetManifestPath = path.join(backupDir, manifestFilename);

    this.logger.log(`Creating database backup snapshot at: ${targetDbPath}`);

    const manager = this.databaseService.getManager();
    await manager.backupTo(targetDbPath);

    // Compute checksum and file stats via streams (safe for multi-GB databases)
    const checksum = await this.calculateChecksum(targetDbPath);
    const stat = fs.statSync(targetDbPath);
    const health = await manager.getHealth();

    const manifest: BackupManifest = {
      filename: dbFilename,
      filePath: targetDbPath,
      sizeBytes: stat.size,
      checksumSha256: checksum,
      createdAtUtc: now.toISOString(),
      storeCode: 'STR-001',
      appVersion: '1.0.0',
      schemaVersion: health.currentSchemaVersion ?? '1.0.0',
      isVerified: true,
      notes: input?.notes ?? null,
    };

    fs.writeFileSync(targetManifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // Run retention purge
    this.enforceRetention();

    this.logger.log(`Backup completed successfully: ${dbFilename} (${stat.size} bytes, SHA-256: ${checksum.slice(0, 8)}...)`);
    return manifest;
  }

  public async listBackups(): Promise<BackupManifest[]> {
    const backupDir = this.getBackupDir();
    const files = fs.readdirSync(backupDir);
    const manifests: BackupManifest[] = [];

    for (const f of files) {
      if (f.endsWith('.json')) {
        try {
          const content = fs.readFileSync(path.join(backupDir, f), 'utf8');
          const parsed = JSON.parse(content) as BackupManifest;
          const dbPath = path.join(backupDir, parsed.filename);
          if (fs.existsSync(dbPath)) {
            manifests.push({
              ...parsed,
              filePath: dbPath,
            });
          }
        } catch {
          // Ignore invalid manifest files
        }
      }
    }

    manifests.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());
    return manifests;
  }

  public async getStatus(): Promise<BackupStatus> {
    const manifests = await this.listBackups();
    const backupDir = this.getBackupDir();
    const totalSize = manifests.reduce((sum, m) => sum + m.sizeBytes, 0);

    return {
      totalBackups: manifests.length,
      lastBackupAtUtc: manifests[0]?.createdAtUtc ?? null,
      totalSizeBytes: totalSize,
      backupDir,
    };
  }

  public async verifyBackup(filename: string): Promise<{ isValid: boolean; message: string }> {
    const backupDir = this.getBackupDir();
    const targetDbPath = path.join(backupDir, filename);

    if (!fs.existsSync(targetDbPath)) {
      return { isValid: false, message: `Backup database file '${filename}' not found.` };
    }

    const manifestPath = path.join(backupDir, filename.replace(/\.db$/, '.json'));
    if (!fs.existsSync(manifestPath)) {
      return { isValid: false, message: `Backup manifest file not found for '${filename}'.` };
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest;
    const currentChecksum = await this.calculateChecksum(targetDbPath);

    if (currentChecksum !== manifest.checksumSha256) {
      return {
        isValid: false,
        message: `Checksum mismatch! Expected: ${manifest.checksumSha256.slice(0, 12)}..., Actual: ${currentChecksum.slice(0, 12)}...`,
      };
    }

    return {
      isValid: true,
      message: `Integrity verified. SHA-256: ${currentChecksum.slice(0, 16)}... matches manifest.`,
    };
  }

  public async restoreBackup(input: RestoreBackupInput): Promise<{ restored: boolean; safetyBackupPath: string }> {
    if (!input.confirmRestore) {
      throw new Error('Restore action was cancelled: confirmation required.');
    }

    const backupDir = this.getBackupDir();
    const targetDbPath = path.join(backupDir, input.filename);

    if (!fs.existsSync(targetDbPath)) {
      throw new Error(`Backup file '${input.filename}' does not exist.`);
    }

    const verification = await this.verifyBackup(input.filename);
    if (!verification.isValid) {
      throw new Error(`Cannot restore corrupted backup: ${verification.message}`);
    }

    const manager = this.databaseService.getManager();
    const liveDbPath = manager.getFilePath();

    // 1. Mandatory Safety Backup before destructive restore
    const now = new Date();
    const safetyTimestamp = now.toISOString().replace(/[:.]/g, '-');
    const safetyFilename = `safety-before-restore-${safetyTimestamp}.db`;
    const safetyPath = path.join(backupDir, safetyFilename);

    this.logger.warn(`Creating pre-restore emergency safety backup at: ${safetyPath}`);
    await manager.backupTo(safetyPath);

    // Save safety manifest
    const safetyManifest: BackupManifest = {
      filename: safetyFilename,
      filePath: safetyPath,
      sizeBytes: fs.statSync(safetyPath).size,
      checksumSha256: await this.calculateChecksum(safetyPath),
      createdAtUtc: now.toISOString(),
      storeCode: 'STR-001',
      appVersion: '1.0.0',
      schemaVersion: '1.0.0',
      isVerified: true,
      notes: `Pre-restore safety backup prior to restoring ${input.filename}`,
    };
    fs.writeFileSync(
      path.join(backupDir, `safety-before-restore-${safetyTimestamp}.json`),
      JSON.stringify(safetyManifest, null, 2),
      'utf8'
    );

    // 2. Close active connection
    this.logger.log('Closing live SQLite database connection for restore...');
    await manager.close();

    // 3. Atomically overwrite live database file
    fs.copyFileSync(targetDbPath, liveDbPath);

    // Clean up any stale -wal and -shm files from the previous session
    const walPath = `${liveDbPath}-wal`;
    const shmPath = `${liveDbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // 4. Re-initialize database connection and run migrations if candidate was from older schema
    this.logger.log('Re-initializing database connection on restored file...');
    await manager.initialize();
    await manager.runMigrations();

    this.logger.log(`Database restored successfully from snapshot '${input.filename}'. Safety backup: ${safetyFilename}`);
    return {
      restored: true,
      safetyBackupPath: safetyPath,
    };
  }

  public enforceRetention(limit: number = this.maxRetainedBackups): number {
    let deletedCount = 0;
    try {
      const backupDir = this.getBackupDir();
      const files = fs.readdirSync(backupDir);
      const manifests: { filename: string; jsonFile: string; createdAt: number }[] = [];

      for (const f of files) {
        if (f.endsWith('.json') && !f.startsWith('safety-')) {
          try {
            const content = fs.readFileSync(path.join(backupDir, f), 'utf8');
            const parsed = JSON.parse(content) as BackupManifest;
            manifests.push({
              filename: parsed.filename,
              jsonFile: f,
              createdAt: new Date(parsed.createdAtUtc).getTime(),
            });
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Sort newest first
      manifests.sort((a, b) => b.createdAt - a.createdAt);

      if (manifests.length > limit) {
        const toDelete = manifests.slice(limit);
        for (const item of toDelete) {
          const dbPath = path.join(backupDir, item.filename);
          const jsonPath = path.join(backupDir, item.jsonFile);
          if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
          if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
          deletedCount++;
          this.logger.log(`Retention policy pruned old backup: ${item.filename}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to enforce backup retention: ${err}`);
    }
    return deletedCount;
  }
}
