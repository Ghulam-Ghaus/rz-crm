import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  bootstrapBackend,
  ActiveBackend,
  AuditService,
  UsersService,
} from '@rz-crm/backend';

describe('Phase 8 — Audit Logging & Security Activity Monitor Integration', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-audit-test-'));
    const dbPath = path.join(tempDir, 'audit_test.db');

    activeBackend = await bootstrapBackend({
      dbPath,
      runMigrations: true,
    });
  });

  afterEach(async () => {
    if (activeBackend) {
      await activeBackend.appContext.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should append immutable audit logs, compute risk severity, and filter by category/action', async () => {
    const auditService = activeBackend.appContext.get(AuditService);

    // 1. Record various operational actions
    const log1 = await auditService.log({
      userId: 1,
      username: 'admin',
      action: 'USER_LOGIN',
      resource: 'auth',
      details: { ip: '127.0.0.1', device: 'POS-Terminal-1' },
    });
    expect(log1.id).toBeGreaterThan(0);
    expect(log1.severity).toBe('INFO');
    expect(log1.username).toBe('admin');

    const log2 = await auditService.log({
      userId: 1,
      username: 'admin',
      action: 'AUTH_LOGIN_FAILED',
      resource: 'auth',
      details: { reason: 'Incorrect PIN', attempts: 3 },
    });
    expect(log2.severity).toBe('CRITICAL');

    const log3 = await auditService.log({
      userId: 2,
      username: 'cashier',
      action: 'STOCK_ADJUSTMENT',
      resource: 'inventory',
      details: { sku: 'SKU-CRO-01', variance: -5, reason: 'Damaged packaging' },
    });
    expect(log3.severity).toBe('WARN');

    const log4 = await auditService.log({
      userId: 1,
      username: 'admin',
      action: 'PRICE_OVERRIDE',
      resource: 'sales',
      details: { invoice: 'INV-001', originalRs: 500, overriddenRs: 450 },
    });
    expect(log4.severity).toBe('WARN');

    const log5 = await auditService.log({
      userId: 1,
      username: 'admin',
      action: 'BACKUP_RESTORED',
      resource: 'system',
      details: { snapshot: 'backup-snapshot.db', preRestoreSafety: 'safety.db' },
    });
    expect(log5.severity).toBe('CRITICAL');

    // 2. Query summary statistics
    const summary = await auditService.getSummaryStats();
    expect(summary.totalAuditCount).toBeGreaterThanOrEqual(5);
    expect(summary.authEventsCount).toBeGreaterThanOrEqual(2);
    expect(summary.failedLoginsCount).toBeGreaterThanOrEqual(1);
    expect(summary.stockAdjustmentsCount).toBeGreaterThanOrEqual(1);
    expect(summary.priceOverridesCount).toBeGreaterThanOrEqual(1);
    expect(summary.criticalEventsCount).toBeGreaterThanOrEqual(2);
    expect(summary.lastActivityUtc).toBeTruthy();

    // 3. Query filtered logs by category
    const authLogs = await auditService.listLogs({ category: 'AUTH' });
    expect(authLogs.logs.length).toBeGreaterThanOrEqual(2);
    expect(authLogs.logs.some(l => l.action === 'AUTH_LOGIN_FAILED')).toBe(true);

    const stockLogs = await auditService.listLogs({ category: 'INVENTORY_AND_STOCK' });
    expect(stockLogs.logs.length).toBe(1);
    expect(stockLogs.logs[0]?.action).toBe('STOCK_ADJUSTMENT');

    // 4. Query filtered logs by search query
    const searchRes = await auditService.listLogs({ search: 'Damaged packaging' });
    expect(searchRes.logs.length).toBe(1);
    expect(searchRes.logs[0]?.action).toBe('STOCK_ADJUSTMENT');

    // 5. Query filtered logs by severity
    const criticalLogs = await auditService.listLogs({ severity: 'CRITICAL' });
    expect(criticalLogs.logs.length).toBeGreaterThanOrEqual(2);
    expect(criticalLogs.logs.every(l => l.severity === 'CRITICAL')).toBe(true);

    // 6. Export logs
    const exported = await auditService.exportLogs();
    expect(exported.length).toBeGreaterThanOrEqual(5);
  });

  it('should automatically audit failed login attempts when authenticate fails in UsersService', async () => {
    const usersService = activeBackend.appContext.get(UsersService);
    const auditService = activeBackend.appContext.get(AuditService);

    // Attempt login with invalid credentials
    await expect(
      usersService.login({
        username: 'admin',
        pin: 'wrong_pin_9999',
      }),
    ).rejects.toThrow();

    // Verify audit log has recorded AUTH_LOGIN_FAILED
    const logs = await auditService.listLogs({ action: 'AUTH_LOGIN_FAILED' });
    expect(logs.logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.logs[0]?.action).toBe('AUTH_LOGIN_FAILED');
    expect(logs.logs[0]?.severity).toBe('CRITICAL');
  });
});
