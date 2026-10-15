import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  bootstrapBackend,
  ActiveBackend,
  CatalogService,
  InventoryService,
  UsersService,
} from '@rz-crm/backend';
import { StoreEntity, StockMovementEntity, StockLocationEntity, ItemEntity } from '@rz-crm/database';

describe('Phase 8 — Multi-User RBAC & Live Stock Ledger Integration', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-rbac-stock-test-'));
    const dbPath = path.join(tempDir, 'rbac_stock_test.db');

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

  it('should authenticate default admin and cashier with PIN, enforce RBAC user management, and compute stock balances from immutable movements', async () => {
    const ds = activeBackend.dbManager.getDataSource();
    const usersService = activeBackend.appContext.get(UsersService);
    const catalogService = activeBackend.appContext.get(CatalogService);
    const inventoryService = activeBackend.appContext.get(InventoryService);

    // Setup Store
    const store = await ds.getRepository(StoreEntity).save({
      code: 'STORE-STK-01',
      name: 'Gulberg Bakery Stock Store',
      address: 'Main Boulevard, Lahore',
      phone: '+92 42 35789000',
      currencyCode: 'PKR',
      timezone: 'Asia/Karachi',
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });

    // 1. Verify default seed users from migration
    const adminSession = await usersService.login({
      username: 'admin',
      pin: '1234',
    });
    expect(adminSession).toBeDefined();
    expect(adminSession.username).toBe('admin');
    expect(adminSession.role).toBe('admin');
    expect(adminSession.displayName).toBe('Store Admin');

    const cashierSession = await usersService.login({
      username: 'cashier',
      pin: '1111',
    });
    expect(cashierSession).toBeDefined();
    expect(cashierSession.username).toBe('cashier');
    expect(cashierSession.role).toBe('cashier');

    // 2. Test failed login (wrong PIN)
    await expect(
      usersService.login({
        username: 'admin',
        pin: '9999',
      })
    ).rejects.toThrow('Authentication failed: incorrect PIN or password');

    // 3. Admin creates a new staff user (Baker)
    const newBaker = await usersService.createUser({
      storeId: store.id,
      username: 'baker_tariq',
      displayName: 'Tariq Head Baker',
      role: 'baker',
      pin: '5678',
    });
    expect(newBaker.id).toBeDefined();
    expect(newBaker.username).toBe('baker_tariq');
    expect(newBaker.role).toBe('baker');

    // Verify baker can now log in
    const bakerSession = await usersService.login({
      username: 'baker_tariq',
      pin: '5678',
    });
    expect(bakerSession.role).toBe('baker');
    expect(bakerSession.displayName).toBe('Tariq Head Baker');

    // 4. Test User Deactivation
    await usersService.updateUser({
      id: newBaker.id,
      isActive: false,
    });

    // Attempt to log in with deactivated account
    await expect(
      usersService.login({
        username: 'baker_tariq',
        pin: '5678',
      })
    ).rejects.toThrow('Invalid username or account is deactivated');

    // Re-activate
    await usersService.updateUser({
      id: newBaker.id,
      isActive: true,
    });

    const userList = await usersService.listUsers(store.id);
    expect(userList.length).toBe(3); // admin, cashier, baker_tariq

    // 4b. Admin creates a Custom Role with specific assigned forms (Sales + Purchasing + Custom Orders)
    const customRole = await usersService.createRole({
      name: 'sales_and_purchasing',
      displayName: 'Sales & Purchasing Specialist',
      permissions: ['pos', 'purchasing', 'custom-orders'],
    });
    expect(customRole.id).toBeDefined();
    expect(customRole.name).toBe('sales_and_purchasing');
    expect(customRole.permissions).toEqual(['pos', 'purchasing', 'custom-orders']);

    // Verify all roles can be listed
    const allRoles = await usersService.listRoles();
    expect(allRoles.some((r) => r.name === 'sales_and_purchasing')).toBe(true);
    expect(allRoles.some((r) => r.name === 'admin' && r.isSystem)).toBe(true);

    // Create staff member assigned to this custom role
    const customStaff = await usersService.createUser({
      storeId: store.id,
      username: 'kashif_specialist',
      displayName: 'Kashif Specialist',
      role: 'sales_and_purchasing',
      pin: '3344',
    });
    expect(customStaff.role).toBe('sales_and_purchasing');
    expect(customStaff.permissions).toEqual(['pos', 'purchasing', 'custom-orders']);

    // Log in as this custom user and verify session has only the assigned forms
    const customSession = await usersService.login({
      username: 'kashif_specialist',
      pin: '3344',
    });
    expect(customSession.role).toBe('sales_and_purchasing');
    expect(customSession.permissions).toEqual(['pos', 'purchasing', 'custom-orders']);

    // System roles cannot be deleted
    const adminRole = allRoles.find((r) => r.name === 'admin')!;
    await expect(usersService.deleteRole({ id: adminRole.id })).rejects.toThrow('System role');

    // 5. Test Live Stock Balances from Ledger Movements
    // Setup Category & Products
    const cat = await catalogService.createCategory({
      code: 'BREAD',
      name: 'Breads & Buns',
    });

    const breadProd = await catalogService.createProduct({
      code: 'MILK-BREAD',
      name: 'Fresh Milk Bread (Large)',
      sku: 'SKU-BRD-01',
      categoryId: cat.id,
      baseUnitCode: 'pcs',
      priceMinorUnits: 18000,
      barcode: '890123456701',
    });

    const croissantProd = await catalogService.createProduct({
      code: 'BUTTER-CRST',
      name: 'Butter Croissant',
      sku: 'SKU-CRS-01',
      categoryId: cat.id,
      baseUnitCode: 'pcs',
      priceMinorUnits: 25000,
      barcode: '890123456702',
    });

    // Create Default Location
    const loc = await ds.getRepository(StockLocationEntity).save({
      storeId: store.id,
      code: 'MAIN_FLOOR',
      name: 'Main Sales Floor',
      locationType: 'sales_floor',
      isActive: true,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });

    // Lookup Item Entities
    const itemRepo = ds.getRepository(ItemEntity);
    const breadItem = await itemRepo.findOne({ where: { code: `ITEM-${breadProd.code}` } });
    const croissantItem = await itemRepo.findOne({ where: { code: `ITEM-${croissantProd.code}` } });
    expect(breadItem).toBeDefined();
    expect(croissantItem).toBeDefined();

    // Initial stock balance check: should be 0 (out_of_stock)
    let stockBalances = await inventoryService.getStockBalances({ storeId: store.id });
    expect(stockBalances.length).toBe(2);
    const breadBal = stockBalances.find((b) => b.sku === 'SKU-BRD-01');
    expect(breadBal?.onHandQuantity).toBe(0);
    expect(breadBal?.status).toBe('out_of_stock');

    // Write immutable ledger movements to simulate GRN and sales:
    // +50 pcs milk bread (GRN)
    // -5 pcs milk bread (Sale)
    // +20 pcs croissant (Production)
    const movementsRepo = ds.getRepository(StockMovementEntity);
    await movementsRepo.save([
      {
        storeId: store.id,
        itemId: breadItem!.id,
        locationId: loc.id,
        movementType: 'PURCHASE_RECEIPT',
        signedBaseQuantity: 50,
        sourceType: 'goods_receipt',
        sourceId: 'GRN-101',
        costPerUnitMinorUnits: 12000,
        actorId: String(adminSession.id),
        createdAtUtc: '2026-09-01T10:00:00Z',
      },
      {
        storeId: store.id,
        itemId: breadItem!.id,
        locationId: loc.id,
        movementType: 'SALE',
        signedBaseQuantity: -5,
        sourceType: 'sale_invoice',
        sourceId: 'INV-101',
        actorId: String(cashierSession.id),
        createdAtUtc: '2026-09-02T10:00:00Z',
      },
      {
        storeId: store.id,
        itemId: croissantItem!.id,
        locationId: loc.id,
        movementType: 'PRODUCTION_OUTPUT',
        signedBaseQuantity: 20,
        sourceType: 'production_run',
        sourceId: 'RUN-201',
        actorId: String(newBaker.id),
        createdAtUtc: '2026-09-03T10:00:00Z',
      },
    ]);

    // Query updated stock balances
    stockBalances = await inventoryService.getStockBalances({ storeId: store.id });
    const updatedBread = stockBalances.find((b) => b.sku === 'SKU-BRD-01');
    const updatedCroissant = stockBalances.find((b) => b.sku === 'SKU-CRS-01');

    // 50 - 5 = 45 on hand
    expect(updatedBread?.onHandQuantity).toBe(45);
    expect(updatedBread?.status).toBe('in_stock');

    // 20 on hand
    expect(updatedCroissant?.onHandQuantity).toBe(20);
    expect(updatedCroissant?.status).toBe('in_stock');

    // 6. Test movement audit trail query
    const breadMovements = await inventoryService.getMovements(store.id, breadItem!.id);
    expect(breadMovements.length).toBe(2);
    expect(breadMovements[0]!.movementType).toBe('SALE'); // Ordered DESC
    expect(breadMovements[0]!.signedBaseQuantity).toBe(-5);
    expect(breadMovements[1]!.movementType).toBe('PURCHASE_RECEIPT');
    expect(breadMovements[1]!.signedBaseQuantity).toBe(50);
  });
});
