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
