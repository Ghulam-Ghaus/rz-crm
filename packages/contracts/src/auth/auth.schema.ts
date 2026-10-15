import { z } from 'zod';

export const AppPermissionSchema = z.enum([
  'pos',
  'purchasing',
  'custom-orders',
  'inventory',
  'production',
  'products',
  'categories',
  'reports',
  'scanner',
  'users',
  'diagnostics',
]);
export type AppPermission = z.infer<typeof AppPermissionSchema>;

export const UserRoleSchema = z.string().min(1).max(50);
export type UserRole = string;

export const RoleSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  permissions: z.array(z.string()).default([]),
  isSystem: z.boolean().default(false),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});
export type Role = z.infer<typeof RoleSchema>;

export const CreateRoleInputSchema = z.object({
  name: z.string().min(2).max(50),
  displayName: z.string().min(2).max(100),
  permissions: z.array(z.string()).min(1),
});
export type CreateRoleInput = z.infer<typeof CreateRoleInputSchema>;

export const UpdateRoleInputSchema = z.object({
  id: z.number().int(),
  displayName: z.string().min(2).max(100).optional(),
  permissions: z.array(z.string()).min(1).optional(),
});
export type UpdateRoleInput = z.infer<typeof UpdateRoleInputSchema>;

export const DeleteRoleInputSchema = z.object({
  id: z.number().int(),
});
export type DeleteRoleInput = z.infer<typeof DeleteRoleInputSchema>;

export const UserSchema = z.object({
  id: z.number().int(),
  storeId: z.number().int(),
  username: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  role: UserRoleSchema,
  permissions: z.array(z.string()).default([]),
  isActive: z.boolean(),
  lastLoginAtUtc: z.string().nullable().optional(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const UserSessionSchema = z.object({
  id: z.number().int(),
  storeId: z.number().int(),
  username: z.string(),
  displayName: z.string(),
  role: UserRoleSchema,
  permissions: z.array(z.string()).default([]),
  token: z.string(),
  loginAtUtc: z.string(),
});
export type UserSession = z.infer<typeof UserSessionSchema>;

export const LoginInputSchema = z.object({
  username: z.string().min(1),
  pin: z.string().optional(),
  password: z.string().optional(),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const CreateUserInputSchema = z.object({
  storeId: z.number().int().default(1),
  username: z.string().min(2).max(50),
  displayName: z.string().min(2).max(100),
  role: UserRoleSchema,
  permissions: z.array(z.string()).optional(),
  pin: z.string().min(4).max(8).optional(),
  password: z.string().min(4).max(64).optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export const UpdateUserInputSchema = z.object({
  id: z.number().int(),
  displayName: z.string().min(2).max(100).optional(),
  role: UserRoleSchema.optional(),
  permissions: z.array(z.string()).optional(),
  pin: z.string().min(4).max(8).optional(),
  password: z.string().min(4).max(64).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;
