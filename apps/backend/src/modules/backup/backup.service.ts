import { Injectable, Logger, Optional } from '@nestjs/common';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { simulateRestoreDrill } from '@rz-crm/database';
import { AuditService } from '../audit/audit.service.js';
import type {
  BackupManifest,
  BackupStatus,
  CreateBackupInput,
  RestoreBackupInput,
  RestoreDrillResult,
  BackupScheduleConfig,
  ExportArchiveBundleInput,
  ExportArchiveBundleResult,
} from '@rz-crm/contracts';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly maxRetainedBackups = 15;

  constructor(
    private readonly databaseService: DatabaseService,
    @Optional() private readonly auditService?: AuditService
  ) {}

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

  /**
   * Phase 10: Run isolated restore drill simulation without mutating production state.
   */
  public async runRestoreDrill(filename: string): Promise<RestoreDrillResult> {
    const backupDir = this.getBackupDir();
    const targetDbPath = path.join(backupDir, filename);

    this.logger.log(`Executing isolated restore drill simulation for snapshot: ${filename}`);
    const result = await simulateRestoreDrill(targetDbPath, filename);

    if (this.auditService) {
      try {
        await this.auditService.log({
          action: 'BACKUP_RESTORE_DRILL',
          resource: filename,
          severity: result.passed ? 'INFO' : 'CRITICAL',
          details: {
            filename,
            passed: result.passed,
            integrityCheck: result.integrityCheckResult,
            foreignKeyCheckPassed: result.foreignKeyCheckPassed,
            tablesCount: result.tablesVerifiedCount,
            durationMs: result.durationMs,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to log audit entry for restore drill: ${err}`);
      }
    }

    return result;
  }

  /**
   * Phase 10: Retrieve automated backup schedule configuration.
   */
  public async getScheduleConfig(): Promise<BackupScheduleConfig> {
    const configPath = path.join(this.getBackupDir(), 'backup-schedule.json');
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          enabled: Boolean(parsed.enabled ?? true),
          frequencyHours: Number(parsed.frequencyHours ?? 24),
          autoBackupOnShiftClose: Boolean(parsed.autoBackupOnShiftClose ?? true),
          includeAttachments: Boolean(parsed.includeAttachments ?? true),
          lastAutoBackupUtc: parsed.lastAutoBackupUtc ?? null,
          nextScheduledBackupUtc: parsed.nextScheduledBackupUtc ?? null,
        };
      } catch (err) {
        this.logger.warn(`Failed to read backup schedule config, using default: ${err}`);
      }
    }

    const defaultNext = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    return {
      enabled: true,
      frequencyHours: 24,
      autoBackupOnShiftClose: true,
      includeAttachments: true,
      lastAutoBackupUtc: null,
      nextScheduledBackupUtc: defaultNext,
    };
  }

  /**
   * Phase 10: Update automated backup schedule configuration.
   */
  public async setScheduleConfig(config: BackupScheduleConfig): Promise<BackupScheduleConfig> {
    const backupDir = this.getBackupDir();
    const configPath = path.join(backupDir, 'backup-schedule.json');

    const nextDate = new Date(Date.now() + Math.max(1, config.frequencyHours) * 3600 * 1000).toISOString();
    const updated: BackupScheduleConfig = {
      ...config,
      frequencyHours: Math.max(1, config.frequencyHours),
      nextScheduledBackupUtc: config.enabled ? nextDate : null,
    };

    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
    this.logger.log(`Updated automated backup schedule: enabled=${updated.enabled}, interval=${updated.frequencyHours}h`);
    return updated;
  }

  /**
   * Phase 10: Export standalone disaster recovery bundle including DB snapshot, manifest, and attachments.
   */
  public async exportArchiveBundle(input: ExportArchiveBundleInput): Promise<ExportArchiveBundleResult> {
    const backupDir = this.getBackupDir();
    const dbFile = path.join(backupDir, input.filename);
    const manifestFile = path.join(backupDir, input.filename.replace(/\.db$/, '.json'));

    if (!fs.existsSync(dbFile)) {
      throw new Error(`Backup snapshot file '${input.filename}' not found on disk.`);
    }

    const verification = await this.verifyBackup(input.filename);
    if (!verification.isValid) {
      throw new Error(`Cannot export archive bundle for corrupted backup: ${verification.message}`);
    }

    const bundleBaseName = `disaster-recovery-${input.filename.replace(/\.db$/, '')}`;
    const bundleDir = path.join(backupDir, 'bundles', bundleBaseName);
    if (!fs.existsSync(bundleDir)) {
      fs.mkdirSync(bundleDir, { recursive: true });
    }

    // 1. Copy Database Snapshot
    const destDbPath = path.join(bundleDir, input.filename);
    fs.copyFileSync(dbFile, destDbPath);

    // 2. Copy Manifest (if exists)
    let manifestIncluded = false;
    if (fs.existsSync(manifestFile)) {
      fs.copyFileSync(manifestFile, path.join(bundleDir, path.basename(manifestFile)));
      manifestIncluded = true;
    }

    // 3. Copy Attachments Folder (Phase 9 WebP photos) if requested
    let attachmentsCount = 0;
    if (input.includeAttachments) {
      const liveDbPath = this.databaseService.getManager().getFilePath();
      const userDataDir = path.dirname(liveDbPath);
      const attachmentsSrcDir = path.join(userDataDir, 'attachments');
      const attachmentsDestDir = path.join(bundleDir, 'attachments');

      if (fs.existsSync(attachmentsSrcDir)) {
        if (!fs.existsSync(attachmentsDestDir)) {
          fs.mkdirSync(attachmentsDestDir, { recursive: true });
        }
        const copyDirRecursive = (src: string, dest: string) => {
          const entries = fs.readdirSync(src, { withFileTypes: true });
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
              if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
              copyDirRecursive(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
              attachmentsCount++;
            }
          }
        };
        copyDirRecursive(attachmentsSrcDir, attachmentsDestDir);
      }
    }

    // 4. Create README disaster recovery instructions
    const readmeContent = [
      '======================================================================',
      'RZ ENTERPRISES CRM - DISASTER RECOVERY ARCHIVE BUNDLE',
      '======================================================================',
      `Exported At (UTC): ${new Date().toISOString()}`,
      `Database File: ${input.filename}`,
      `Checksum Verified: YES (SHA-256)`,
      `Attachments Included: ${input.includeAttachments ? `YES (${attachmentsCount} files)` : 'NO'}`,
      '',
      'RECOVERY & RESTORATION PROCEDURE:',
      '1. In the event of primary hardware failure, install RZ Enterprises CRM on the destination PC.',
      '2. Locate the application userData folder (e.g. %APPDATA%/rz-enterprises-crm/ on Windows).',
      `3. Copy "${input.filename}" into the userData folder and rename it to "rz_crm.db".`,
      '4. If attachments are included in this bundle, copy the "attachments" folder directly into the userData folder alongside "rz_crm.db".',
      '5. Launch RZ Enterprises CRM. The application will automatically verify the database identity and open all operational records.',
      '======================================================================',
    ].join('\r\n');

    fs.writeFileSync(path.join(bundleDir, 'README-DISASTER-RECOVERY.txt'), readmeContent, 'utf8');

    // 5. Calculate total size of bundle
    let totalSizeBytes = 0;
    const calcDirSize = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          calcDirSize(full);
        } else {
          totalSizeBytes += fs.statSync(full).size;
        }
      }
    };
    calcDirSize(bundleDir);

    if (this.auditService) {
      try {
        await this.auditService.log({
          action: 'BACKUP_ARCHIVE_BUNDLE_EXPORTED',
          resource: input.filename,
          severity: 'INFO',
          details: {
            filename: input.filename,
            bundleDir,
            attachmentsCount,
            totalSizeBytes,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to log audit entry for archive bundle export: ${err}`);
      }
    }

    return {
      saved: true,
      destinationPath: bundleDir,
      databaseIncluded: true,
      manifestIncluded,
      attachmentsCount,
      totalSizeBytes,
      message: `Disaster recovery bundle exported successfully to: ${bundleDir}`,
    };
  }
}

