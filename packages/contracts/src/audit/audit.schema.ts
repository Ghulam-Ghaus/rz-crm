import { z } from 'zod';

// ==========================================
// Audit Action Categories & Severities
// ==========================================
export const AuditSeveritySchema = z.enum(['INFO', 'WARN', 'CRITICAL']);
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

export const AuditActionCategorySchema = z.enum([
  'ALL',
  'AUTH',
  'SALES_AND_PRICING',
  'INVENTORY_AND_STOCK',
  'PURCHASING_AND_RETURNS',
  'FINANCE_AND_PAYROLL',
  'STAKEHOLDERS_AND_EQUITY',
  'SYSTEM_AND_BACKUP',
]);
export type AuditActionCategory = z.infer<typeof AuditActionCategorySchema>;

// ==========================================
// Audit Log Item Schema
// ==========================================
export const AuditLogSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().nullable().optional(),
  username: z.string().nullable().optional(),
  action: z.string(),
  resource: z.string().nullable().optional(),
  detailsJson: z.string().nullable().optional(),
  severity: AuditSeveritySchema.default('INFO'),
  createdAtUtc: z.string(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

// ==========================================
// Query & Filter Schema
// ==========================================
export const ListAuditLogsQuerySchema = z.object({
  userId: z.number().int().optional(),
  action: z.string().optional(),
  category: AuditActionCategorySchema.optional(),
  resource: z.string().optional(),
  severity: AuditSeveritySchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});
export type ListAuditLogsQuery = z.input<typeof ListAuditLogsQuerySchema>;

export const ListAuditLogsResponseSchema = z.object({
  logs: z.array(AuditLogSchema),
  totalCount: z.number().int(),
});
export type ListAuditLogsResponse = z.infer<typeof ListAuditLogsResponseSchema>;

// ==========================================
// Summary Statistics Schema
// ==========================================
export const AuditSummaryStatsSchema = z.object({
  totalAuditCount: z.number().int(),
  authEventsCount: z.number().int(),
  failedLoginsCount: z.number().int(),
  stockAdjustmentsCount: z.number().int(),
  priceOverridesCount: z.number().int(),
  criticalEventsCount: z.number().int(),
  lastActivityUtc: z.string().nullable().optional(),
});
export type AuditSummaryStats = z.infer<typeof AuditSummaryStatsSchema>;

// ==========================================
// Create Audit Log Input Schema
// ==========================================
export const CreateAuditLogInputSchema = z.object({
  userId: z.number().int().nullable().optional(),
  username: z.string().nullable().optional(),
  action: z.string().min(1).max(100),
  resource: z.string().max(100).nullable().optional(),
  details: z.record(z.unknown()).nullable().optional(),
  severity: AuditSeveritySchema.optional(),
  createdAtUtc: z.string().optional(),
});
export type CreateAuditLogInput = z.infer<typeof CreateAuditLogInputSchema>;
