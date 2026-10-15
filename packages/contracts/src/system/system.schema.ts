import { z } from 'zod';

export const StoreSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  timezone: z.string().min(1).max(50),
  currencyCode: z.string().length(3),
  taxNumber: z.string().max(50).nullish(),
  address: z.string().max(255).nullish(),
  phone: z.string().max(50).nullish(),
  receiptHeader: z.string().nullish(),
  receiptFooter: z.string().nullish(),
  isActive: z.boolean(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type Store = z.infer<typeof StoreSchema>;

export const InstallationSchema = z.object({
  id: z.number().int().positive(),
  deviceId: z.string().min(1).max(100),
  storeId: z.number().int().positive().nullish(),
  appVersion: z.string().min(1).max(50),
  installState: z.enum(['pending_onboarding', 'active', 'suspended']),
  registeredAtUtc: z.string().nullish(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type Installation = z.infer<typeof InstallationSchema>;

export const RegisterSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  isActive: z.boolean(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type Register = z.infer<typeof RegisterSchema>;

export const SettingSchema = z.object({
  id: z.number().int().positive(),
  storeId: z.number().int().positive().nullish(),
  key: z.string().min(1).max(100),
  value: z.string(),
  scope: z.enum(['system', 'store', 'register', 'device']),
  description: z.string().nullish(),
  updatedBy: z.string().nullish(),
  version: z.number().int().nonnegative(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});

export type Setting = z.infer<typeof SettingSchema>;

export const SystemInfoResponseSchema = z.object({
  appVersion: z.string(),
  electronVersion: z.string(),
  nodeVersion: z.string(),
  platform: z.string(),
  arch: z.string(),
  userDataPath: z.string(),
  databasePath: z.string(),
  installation: InstallationSchema.nullable(),
  store: StoreSchema.nullable(),
});

export type SystemInfoResponse = z.infer<typeof SystemInfoResponseSchema>;
