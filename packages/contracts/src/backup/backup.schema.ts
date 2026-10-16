import { z } from 'zod';

export const BackupManifestSchema = z.object({
  filename: z.string(),
  filePath: z.string().optional(),
  sizeBytes: z.number().int().nonnegative(),
  checksumSha256: z.string(),
  createdAtUtc: z.string(),
  storeCode: z.string().default('STR-001'),
  appVersion: z.string().default('1.0.0'),
  schemaVersion: z.string().nullable().optional(),
  isVerified: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});

export type BackupManifest = z.infer<typeof BackupManifestSchema>;

export const BackupStatusSchema = z.object({
  totalBackups: z.number().int().nonnegative(),
  lastBackupAtUtc: z.string().nullable().optional(),
  totalSizeBytes: z.number().int().nonnegative(),
  backupDir: z.string(),
});

export type BackupStatus = z.infer<typeof BackupStatusSchema>;

export const CreateBackupInputSchema = z.object({
  notes: z.string().max(255).optional(),
});

export type CreateBackupInput = z.infer<typeof CreateBackupInputSchema>;

export const RestoreBackupInputSchema = z.object({
  filename: z.string().min(1),
  confirmRestore: z.boolean(),
});

export type RestoreBackupInput = z.infer<typeof RestoreBackupInputSchema>;

export const ExportReportInputSchema = z.object({
  suggestedFilename: z.string().min(1),
  content: z.string(),
  format: z.enum(['csv', 'txt', 'json']),
  title: z.string().optional(),
});

export type ExportReportInput = z.infer<typeof ExportReportInputSchema>;

export const ExportReportResultSchema = z.object({
  saved: z.boolean(),
  filePath: z.string().nullable().optional(),
});

export type ExportReportResult = z.infer<typeof ExportReportResultSchema>;

// ==========================================
// Phase 10: Restore Drill Simulation & Recovery
// ==========================================
export const RestoreDrillResultSchema = z.object({
  snapshotFilename: z.string(),
  drillExecutedAtUtc: z.string(),
  passed: z.boolean(),
  integrityCheckResult: z.string(),
  foreignKeyCheckPassed: z.boolean(),
  tablesVerifiedCount: z.number().int().nonnegative(),
  recordCounts: z.record(z.string(), z.number().int().nonnegative()),
  durationMs: z.number().int().nonnegative(),
  message: z.string(),
});
export type RestoreDrillResult = z.infer<typeof RestoreDrillResultSchema>;

// ==========================================
// Phase 10: Automated Scheduled Backups
// ==========================================
export const BackupScheduleConfigSchema = z.object({
  enabled: z.boolean().default(true),
  frequencyHours: z.number().int().positive().default(24),
  autoBackupOnShiftClose: z.boolean().default(true),
  includeAttachments: z.boolean().default(true),
  lastAutoBackupUtc: z.string().nullable().optional(),
  nextScheduledBackupUtc: z.string().nullable().optional(),
});
export type BackupScheduleConfig = z.infer<typeof BackupScheduleConfigSchema>;

// ==========================================
// Phase 10: Disaster Recovery Archive Bundle
// ==========================================
export const ExportArchiveBundleInputSchema = z.object({
  filename: z.string().min(1),
  includeAttachments: z.boolean().default(true),
});
export type ExportArchiveBundleInput = z.infer<typeof ExportArchiveBundleInputSchema>;

export const ExportArchiveBundleResultSchema = z.object({
  saved: z.boolean(),
  destinationPath: z.string().nullable().optional(),
  databaseIncluded: z.boolean().default(true),
  manifestIncluded: z.boolean().default(true),
  attachmentsCount: z.number().int().nonnegative().default(0),
  totalSizeBytes: z.number().int().nonnegative().default(0),
  message: z.string(),
});
export type ExportArchiveBundleResult = z.infer<typeof ExportArchiveBundleResultSchema>;

