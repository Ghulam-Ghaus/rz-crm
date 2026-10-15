import { Injectable, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { UserEntity, AuditLogEntity, RoleEntity } from '@bakery/database';
import {
  User,
  UserSession,
  LoginInput,
  CreateUserInput,
  UpdateUserInput,
  Role,
  CreateRoleInput,
  UpdateRoleInput,
  DeleteRoleInput,
} from '@bakery/contracts';
import { nowUtcString, generateUuid } from '@bakery/shared';

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  manager: ['pos', 'inventory', 'products', 'categories', 'purchasing', 'production', 'custom-orders', 'scanner', 'reports'],
  cashier: ['pos', 'inventory', 'custom-orders', 'scanner'],
  purchaser: ['purchasing', 'inventory'],
  baker: ['production', 'inventory'],
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  private hashSecret(secret: string, salt: string): string {
    return crypto.scryptSync(secret, salt, 64).toString('hex');
  }

  private verifySecret(secret: string, salt: string, storedHash: string): boolean {
    const hash = this.hashSecret(secret, salt);
    try {
      const a = Buffer.from(hash, 'hex');
      const b = Buffer.from(storedHash, 'hex');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private resolvePermissions(user: UserEntity, roleEntity?: RoleEntity | null): string[] {
    if (user.role === 'admin') {
      return ['*'];
    }

    // Role permissions are authoritative for the role
    if (roleEntity?.permissionsJson) {
      try {
        const parsed = JSON.parse(roleEntity.permissionsJson);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // fallback
      }
    }

    if (user.permissionsJson) {
      try {
        const parsed = JSON.parse(user.permissionsJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // fallback
      }
    }

    return DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  }

  public async login(input: LoginInput): Promise<UserSession> {
    const ds = this.databaseService.getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const roleRepo = ds.getRepository(RoleEntity);
    const auditRepo = ds.getRepository(AuditLogEntity);

    const user = await userRepo.findOne({
      where: { username: input.username.trim().toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid username or account is deactivated');
    }

    let authenticated = false;

    if (input.pin && user.pinHash && user.pinSalt) {
      authenticated = this.verifySecret(input.pin, user.pinSalt, user.pinHash);
    } else if (input.password && user.passwordHash && user.passwordSalt) {
      authenticated = this.verifySecret(input.password, user.passwordSalt, user.passwordHash);
    }

    if (!authenticated) {
      throw new Error('Authentication failed: incorrect PIN or password');
    }

    const now = nowUtcString();
    user.lastLoginAtUtc = now;
    await userRepo.save(user);

    const role = await roleRepo.findOne({ where: { name: user.role } });
    const permissions = this.resolvePermissions(user, role);

    // Record audit log
    await auditRepo.save({
      userId: user.id,
      username: user.username,
      action: 'USER_LOGIN',
      resource: 'auth',
      detailsJson: JSON.stringify({ role: user.role, permissions }),
      createdAtUtc: now,
    });

    const token = generateUuid();

    this.logger.log(`User '${user.username}' (${user.role}) logged in successfully with ${permissions.length} permissions`);

    return {
      id: user.id,
      storeId: user.storeId,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      permissions,
      token,
      loginAtUtc: now,
    };
  }

  public async listUsers(storeId: number): Promise<User[]> {
    const ds = this.databaseService.getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const roleRepo = ds.getRepository(RoleEntity);

    const [users, roles] = await Promise.all([
      userRepo.find({
        where: { storeId },
        order: { createdAtUtc: 'ASC' },
      }),
      roleRepo.find(),
    ]);

    const roleMap = new Map<string, RoleEntity>();
    for (const r of roles) {
      roleMap.set(r.name, r);
    }

    return users.map((u) => {
      const role = roleMap.get(u.role);
      const permissions = this.resolvePermissions(u, role);
      return {
        id: u.id,
        storeId: u.storeId,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        permissions,
        isActive: u.isActive,
        lastLoginAtUtc: u.lastLoginAtUtc,
        createdAtUtc: u.createdAtUtc,
        updatedAtUtc: u.updatedAtUtc,
      };
    });
  }

  public async createUser(input: CreateUserInput): Promise<User> {
    const ds = this.databaseService.getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const roleRepo = ds.getRepository(RoleEntity);
    const auditRepo = ds.getRepository(AuditLogEntity);

    const existing = await userRepo.findOne({
      where: { username: input.username.trim().toLowerCase() },
    });
    if (existing) {
      throw new Error(`Username '${input.username}' is already in use`);
    }

    const now = nowUtcString();
    let pinHash: string | null = null;
    let pinSalt: string | null = null;
    if (input.pin) {
      pinSalt = crypto.randomBytes(16).toString('hex');
      pinHash = this.hashSecret(input.pin, pinSalt);
    }

    let passHash: string | null = null;
    let passSalt: string | null = null;
    if (input.password) {
      passSalt = crypto.randomBytes(16).toString('hex');
      passHash = this.hashSecret(input.password, passSalt);
    }

    let permissionsJson: string | null = null;
    if (input.permissions && input.permissions.length > 0) {
      permissionsJson = JSON.stringify(input.permissions);
    } else {
      const role = await roleRepo.findOne({ where: { name: input.role } });
      if (role?.permissionsJson) {
        permissionsJson = role.permissionsJson;
      }
    }

    const newUser = userRepo.create({
      storeId: input.storeId,
      username: input.username.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      role: input.role,
      permissionsJson,
      pinHash,
      pinSalt,
      passwordHash: passHash,
      passwordSalt: passSalt,
      isActive: true,
      createdAtUtc: now,
      updatedAtUtc: now,
    });

    const saved = await userRepo.save(newUser);
    const role = await roleRepo.findOne({ where: { name: saved.role } });
    const permissions = this.resolvePermissions(saved, role);

    await auditRepo.save({
      userId: saved.id,
      username: saved.username,
      action: 'USER_CREATED',
      resource: 'users',
      detailsJson: JSON.stringify({ role: saved.role, permissions }),
      createdAtUtc: now,
    });

    return {
      id: saved.id,
      storeId: saved.storeId,
      username: saved.username,
      displayName: saved.displayName,
      role: saved.role,
      permissions,
      isActive: saved.isActive,
      lastLoginAtUtc: saved.lastLoginAtUtc,
      createdAtUtc: saved.createdAtUtc,
      updatedAtUtc: saved.updatedAtUtc,
    };
  }

  public async updateUser(input: UpdateUserInput): Promise<User> {
    const ds = this.databaseService.getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const roleRepo = ds.getRepository(RoleEntity);
    const auditRepo = ds.getRepository(AuditLogEntity);

    const user = await userRepo.findOne({ where: { id: input.id } });
    if (!user) {
      throw new Error(`User with ID ${input.id} not found`);
    }

    const now = nowUtcString();

    if (input.displayName !== undefined) {
      user.displayName = input.displayName.trim();
    }
    if (input.role !== undefined) {
      user.role = input.role;
      // If role changed and permissions not explicitly provided, update from role
      if (input.permissions === undefined) {
        const role = await roleRepo.findOne({ where: { name: input.role } });
        if (role?.permissionsJson) {
          user.permissionsJson = role.permissionsJson;
        }
      }
    }
    if (input.permissions !== undefined) {
      user.permissionsJson = JSON.stringify(input.permissions);
    }
    if (input.isActive !== undefined) {
      user.isActive = input.isActive;
    }
    if (input.pin) {
      user.pinSalt = crypto.randomBytes(16).toString('hex');
      user.pinHash = this.hashSecret(input.pin, user.pinSalt);
    }
    if (input.password) {
      user.passwordSalt = crypto.randomBytes(16).toString('hex');
      user.passwordHash = this.hashSecret(input.password, user.passwordSalt);
    }

    user.updatedAtUtc = now;
    const saved = await userRepo.save(user);

    const role = await roleRepo.findOne({ where: { name: saved.role } });
    const permissions = this.resolvePermissions(saved, role);

    await auditRepo.save({
      userId: saved.id,
      username: saved.username,
      action: 'USER_UPDATED',
      resource: 'users',
      detailsJson: JSON.stringify({ role: saved.role, isActive: saved.isActive, permissions }),
      createdAtUtc: now,
    });

    return {
      id: saved.id,
      storeId: saved.storeId,
      username: saved.username,
      displayName: saved.displayName,
      role: saved.role,
      permissions,
      isActive: saved.isActive,
      lastLoginAtUtc: saved.lastLoginAtUtc,
      createdAtUtc: saved.createdAtUtc,
      updatedAtUtc: saved.updatedAtUtc,
    };
  }

  // --- ROLE MANAGEMENT (Admin Only) ---

  public async listRoles(): Promise<Role[]> {
    const ds = this.databaseService.getDataSource();
    const roleRepo = ds.getRepository(RoleEntity);

    const roles = await roleRepo.find({
      order: { isSystem: 'DESC', name: 'ASC' },
    });

    return roles.map((r) => {
      let permissions: string[] = [];
      try {
        permissions = JSON.parse(r.permissionsJson);
      } catch {
        permissions = [];
      }
      return {
        id: r.id,
        name: r.name,
        displayName: r.displayName,
        permissions,
        isSystem: r.isSystem,
        createdAtUtc: r.createdAtUtc,
        updatedAtUtc: r.updatedAtUtc,
      };
    });
  }

  public async createRole(input: CreateRoleInput): Promise<Role> {
    const ds = this.databaseService.getDataSource();
    const roleRepo = ds.getRepository(RoleEntity);
    const auditRepo = ds.getRepository(AuditLogEntity);

    const code = input.name.trim().toLowerCase().replace(/\s+/g, '_');
    const existing = await roleRepo.findOne({ where: { name: code } });
    if (existing) {
      throw new Error(`Role with code '${code}' already exists`);
    }

    const now = nowUtcString();
    const newRole = roleRepo.create({
      name: code,
      displayName: input.displayName.trim(),
      permissionsJson: JSON.stringify(input.permissions),
      isSystem: false,
      createdAtUtc: now,
      updatedAtUtc: now,
    });

    const saved = await roleRepo.save(newRole);

    await auditRepo.save({
      userId: null,
      username: 'admin',
      action: 'ROLE_CREATED',
      resource: 'roles',
      detailsJson: JSON.stringify({ name: saved.name, permissions: input.permissions }),
      createdAtUtc: now,
    });

    return {
      id: saved.id,
      name: saved.name,
      displayName: saved.displayName,
      permissions: input.permissions,
      isSystem: saved.isSystem,
      createdAtUtc: saved.createdAtUtc,
      updatedAtUtc: saved.updatedAtUtc,
    };
  }

  public async updateRole(input: UpdateRoleInput): Promise<Role> {
    const ds = this.databaseService.getDataSource();
    const roleRepo = ds.getRepository(RoleEntity);
    const auditRepo = ds.getRepository(AuditLogEntity);

    const role = await roleRepo.findOne({ where: { id: input.id } });
    if (!role) {
      throw new Error(`Role with ID ${input.id} not found`);
    }

    if (role.isSystem && role.name === 'admin') {
      throw new Error('Administrator role permissions cannot be altered');
    }

    const now = nowUtcString();
    if (input.displayName !== undefined) {
      role.displayName = input.displayName.trim();
    }
    if (input.permissions !== undefined) {
      role.permissionsJson = JSON.stringify(input.permissions);
    }
    role.updatedAtUtc = now;

    const saved = await roleRepo.save(role);

    // Sync all users of this role so their permissions update immediately
    const userRepo = ds.getRepository(UserEntity);
    await userRepo.update(
      { role: role.name },
      { permissionsJson: role.permissionsJson, updatedAtUtc: now }
    );

    let permissions: string[] = [];
    try {
      permissions = JSON.parse(saved.permissionsJson);
    } catch {
      permissions = [];
    }

    await auditRepo.save({
      userId: null,
      username: 'admin',
      action: 'ROLE_UPDATED',
      resource: 'roles',
      detailsJson: JSON.stringify({ name: saved.name, permissions }),
      createdAtUtc: now,
    });

    return {
      id: saved.id,
      name: saved.name,
      displayName: saved.displayName,
      permissions,
      isSystem: saved.isSystem,
      createdAtUtc: saved.createdAtUtc,
      updatedAtUtc: saved.updatedAtUtc,
    };
  }

  public async deleteRole(input: DeleteRoleInput): Promise<void> {
    const ds = this.databaseService.getDataSource();
    const roleRepo = ds.getRepository(RoleEntity);
    const userRepo = ds.getRepository(UserEntity);
    const auditRepo = ds.getRepository(AuditLogEntity);

    const role = await roleRepo.findOne({ where: { id: input.id } });
    if (!role) {
      throw new Error(`Role with ID ${input.id} not found`);
    }

    if (role.isSystem) {
      throw new Error(`System role '${role.name}' cannot be deleted`);
    }

    // Check if any user is currently assigned this role
    const assignedCount = await userRepo.count({ where: { role: role.name } });
    if (assignedCount > 0) {
      throw new Error(`Cannot delete role '${role.displayName}': It is assigned to ${assignedCount} staff member(s). Reassign them first.`);
    }

    await roleRepo.remove(role);

    const now = nowUtcString();
    await auditRepo.save({
      userId: null,
      username: 'admin',
      action: 'ROLE_DELETED',
      resource: 'roles',
      detailsJson: JSON.stringify({ name: role.name }),
      createdAtUtc: now,
    });
  }

  public async getSessionForUser(userId: number): Promise<UserSession | null> {
    const ds = this.databaseService.getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const roleRepo = ds.getRepository(RoleEntity);

    const user = await userRepo.findOne({ where: { id: userId, isActive: true } });
    if (!user) return null;

    const role = await roleRepo.findOne({ where: { name: user.role } });
    const permissions = this.resolvePermissions(user, role);

    return {
      id: user.id,
      storeId: user.storeId,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      permissions,
      token: generateUuid(),
      loginAtUtc: user.lastLoginAtUtc || nowUtcString(),
    };
  }
}
