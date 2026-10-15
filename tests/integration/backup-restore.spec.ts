import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  bootstrapBackend,
  ActiveBackend,
  BackupService,
  CatalogService,
} from '@rz-crm/backend';

describe('Backup & Restore Integration Slice', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;
  let backupService: BackupService;
  let catalogService: CatalogService;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-backup-test-'));
    const dbPath = path.join(tempDir, 'data', 'bakery_backup_test.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    activeBackend = await bootstrapBackend({
      dbPath,
      runMigrations: true,
    });

    backupService = activeBackend.appContext.get(BackupService);
    catalogService = activeBackend.appContext.get(CatalogService);
  });

  afterEach(async () => {
    if (activeBackend) {
      await activeBackend.appContext.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should create an online snapshot with valid SHA-256 checksum and manifest', async () => {
    // 1. Add some initial catalog data
    await catalogService.createCategory({ name: 'Artisan Breads', code: 'BREAD', sortOrder: 1 });

    // 2. Create backup
    const manifest = await backupService.createBackup({ notes: 'Initial test snapshot' });

    expect(manifest).toBeDefined();
    expect(manifest.filename).toMatch(/^bakery-backup-.*\.db$/);
    expect(manifest.checksumSha256).toHaveLength(64);
    expect(manifest.sizeBytes).toBeGreaterThan(0);
    expect(manifest.notes).toBe('Initial test snapshot');
    expect(manifest.isVerified).toBe(true);

    // 3. Verify backup files exist on disk
    const backupsDir = backupService.getBackupDir();
    const backupDbPath = path.join(backupsDir, manifest.filename);
    const manifestPath = path.join(backupsDir, manifest.filename.replace('.db', '.json'));

    expect(fs.existsSync(backupDbPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);
  });

  it('should list backups and get overall backup status', async () => {
    await backupService.createBackup({ notes: 'Snapshot 1' });
    await backupService.createBackup({ notes: 'Snapshot 2' });

    const backups = await backupService.listBackups();
    expect(backups.length).toBe(2);
    expect(backups[0]!.notes).toBe('Snapshot 2'); // sorted newest first

    const status = await backupService.getStatus();
    expect(status.totalBackups).toBe(2);
    expect(status.lastBackupAtUtc).toBeDefined();
    expect(status.totalSizeBytes).toBeGreaterThan(0);
  });

  it('should verify backup integrity and detect corruption or tampering', async () => {
    const manifest = await backupService.createBackup({ notes: 'Integrity Check Snapshot' });

    // Verification of untampered backup should pass
    const check1 = await backupService.verifyBackup(manifest.filename);
    expect(check1.isValid).toBe(true);
    expect(check1.message).toContain('Integrity verified');

    // Tamper with the backup file (append junk bytes)
    const backupDbPath = path.join(backupService.getBackupDir(), manifest.filename);
    fs.appendFileSync(backupDbPath, Buffer.from('TAMPERED_CONTENT_CORRUPTED'));

    // Verification should now fail checksum verification
    const check2 = await backupService.verifyBackup(manifest.filename);
    expect(check2.isValid).toBe(false);
    expect(check2.message).toContain('Checksum mismatch');
  });

  it('should enforce retention limit when prune is triggered', async () => {
    // Create 4 backups
    for (let i = 1; i <= 4; i++) {
      await backupService.createBackup({ notes: `Backup #${i}` });
    }

    expect((await backupService.listBackups()).length).toBe(4);

    // Prune to retain only 2
    const deletedCount = backupService.enforceRetention(2);
    expect(deletedCount).toBe(2);

    const remaining = await backupService.listBackups();
    expect(remaining.length).toBe(2);
    expect(remaining[0]!.notes).toBe('Backup #4');
    expect(remaining[1]!.notes).toBe('Backup #3');
  });

  it('should perform atomic disaster recovery restore with pre-restore safety copy', async () => {
    // Step 1: Create initial state
    const cat = await catalogService.createCategory({ name: 'Fresh Pastries', code: 'PASTRY', sortOrder: 1 });
    expect(cat.name).toBe('Fresh Pastries');

    // Step 2: Create a backup snapshot
    const baselineBackup = await backupService.createBackup({ notes: 'Pre-Disaster Baseline' });

    // Step 3: Simulate accidental deletion / corruption / new data
    await catalogService.createCategory({ name: 'Accidental Error Category', code: 'OOPS', sortOrder: 99 });
    let categories = await catalogService.getCategories();
    expect(categories.find(c => c.name === 'Accidental Error Category')).toBeDefined();

    // Step 4: Restore from baseline backup
    const restoreResult = await backupService.restoreBackup({
      filename: baselineBackup.filename,
      confirmRestore: true,
    });

    expect(restoreResult.restored).toBe(true);
    expect(restoreResult.safetyBackupPath).toBeDefined();
    expect(fs.existsSync(restoreResult.safetyBackupPath!)).toBe(true);

    // Step 5: Verify the database is now strictly back to the baseline state!
    categories = await catalogService.getCategories();
    expect(categories.find(c => c.name === 'Fresh Pastries')).toBeDefined();
    expect(categories.find(c => c.name === 'Accidental Error Category')).toBeUndefined();
  });

  it('should reject restore when confirmation flag is false', async () => {
    const manifest = await backupService.createBackup({ notes: 'Snapshot for rejection test' });

    await expect(
      backupService.restoreBackup({
        filename: manifest.filename,
        confirmRestore: false,
      })
    ).rejects.toThrow('Restore action was cancelled: confirmation required.');
  });

  it('should reject restore when backup file does not exist', async () => {
    await expect(
      backupService.restoreBackup({
        filename: 'non-existent-backup-file.db',
        confirmRestore: true,
      })
    ).rejects.toThrow("Backup file 'non-existent-backup-file.db' does not exist.");
  });

  it('should refuse to restore a tampered or corrupted backup file', async () => {
    const manifest = await backupService.createBackup({ notes: 'Snapshot before tampering' });

    // Tamper with the backup file
    const backupDbPath = path.join(backupService.getBackupDir(), manifest.filename);
    fs.appendFileSync(backupDbPath, Buffer.from('TAMPERED_BYTES'));

    // Attempting to restore must throw and not proceed
    await expect(
      backupService.restoreBackup({
        filename: manifest.filename,
        confirmRestore: true,
      })
    ).rejects.toThrow(/Cannot restore corrupted backup/);
  });

  it('should report invalid verification when manifest file is missing', async () => {
    const manifest = await backupService.createBackup({ notes: 'Snapshot with soon deleted manifest' });
    const manifestPath = path.join(backupService.getBackupDir(), manifest.filename.replace('.db', '.json'));
    fs.unlinkSync(manifestPath);

    const check = await backupService.verifyBackup(manifest.filename);
    expect(check.isValid).toBe(false);
    expect(check.message).toContain('manifest file not found');
  });

  it('should perform disaster recovery restore, retain data integrity, and allow post-restore write operations', async () => {
    // 1. Initial State: create initial categories
    await catalogService.createCategory({ name: 'Croissants', code: 'CROISSANT', sortOrder: 1 });
    await catalogService.createCategory({ name: 'Sourdough', code: 'SOURDOUGH', sortOrder: 2 });

    let initialCats = await catalogService.getCategories();
    expect(initialCats.length).toBe(2);

    // 2. Take Snapshot 1
    const snapshot1 = await backupService.createBackup({ notes: 'Initial 2 categories' });

    // 3. Mutate live state: add 2 more categories
    await catalogService.createCategory({ name: 'Baguette', code: 'BAGUETTE', sortOrder: 3 });
    await catalogService.createCategory({ name: 'Brioche', code: 'BRIOCHE', sortOrder: 4 });

    let updatedCats = await catalogService.getCategories();
    expect(updatedCats.length).toBe(4);

    // 4. Restore Snapshot 1
    const restoreResult = await backupService.restoreBackup({
      filename: snapshot1.filename,
      confirmRestore: true,
    });

    expect(restoreResult.restored).toBe(true);
    expect(restoreResult.safetyBackupPath).toBeDefined();

    // 5. Assert data restored exactly
    let restoredCats = await catalogService.getCategories();
    expect(restoredCats.length).toBe(2);
    expect(restoredCats.map((c) => c.code)).toEqual(['CROISSANT', 'SOURDOUGH']);

    // 6. Assert live database is fully operational for new writes after restore
    const newCat = await catalogService.createCategory({ name: 'Rye Bread', code: 'RYE', sortOrder: 5 });
    expect(newCat.code).toBe('RYE');

    const finalCats = await catalogService.getCategories();
    expect(finalCats.length).toBe(3);
  });

  it('should allow safety backup rollback recovery to recover pre-restore state', async () => {
    // 1. Base category
    await catalogService.createCategory({ name: 'Donut', code: 'DONUT', sortOrder: 1 });
    const baselineBackup = await backupService.createBackup({ notes: 'Donut baseline' });

    // 2. Add extra items before an accidental restore
    await catalogService.createCategory({ name: 'Cupcake', code: 'CUPCAKE', sortOrder: 2 });
    expect((await catalogService.getCategories()).length).toBe(2);

    // 3. Execute restore of baseline (which creates safety backup of the 2-item state)
    const restoreResult = await backupService.restoreBackup({
      filename: baselineBackup.filename,
      confirmRestore: true,
    });
    expect((await catalogService.getCategories()).length).toBe(1);

    // 4. Rollback: restore from the safety backup
    const safetyFilename = path.basename(restoreResult.safetyBackupPath);
    const rollbackResult = await backupService.restoreBackup({
      filename: safetyFilename,
      confirmRestore: true,
    });

    expect(rollbackResult.restored).toBe(true);
    const rolledBackCats = await catalogService.getCategories();
    expect(rolledBackCats.length).toBe(2);
    expect(rolledBackCats.map((c) => c.code)).toContain('CUPCAKE');
    expect(rolledBackCats.map((c) => c.code)).toContain('DONUT');
  });
});

