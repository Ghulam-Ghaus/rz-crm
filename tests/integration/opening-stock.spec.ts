import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  bootstrapBackend,
  ActiveBackend,
  CatalogService,
  InventoryService,
} from '@rz-crm/backend';
import { StoreEntity, StockMovementEntity, ItemEntity } from '@rz-crm/database';

describe('Opening Stock & Ledger Movement Integration', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-opening-test-'));
    const dbPath = path.join(tempDir, 'opening_test.db');

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

  it('should confirm opening stock and write immutable ledger movements', async () => {
    const ds = activeBackend.dbManager.getDataSource();
    const catalogService = activeBackend.appContext.get(CatalogService);
    const inventoryService = activeBackend.appContext.get(InventoryService);

    // Create Store
    const store = await ds.getRepository(StoreEntity).save({
      code: 'STORE-01',
      name: 'Test Bakery',
      timezone: 'UTC',
      currencyCode: 'USD',
      isActive: true,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });

    // Create product
    const product = await catalogService.createProduct({
      code: 'SOURDOUGH',
      name: 'Rustic Sourdough',
      sku: 'SKU-SD-01',
      priceMinorUnits: 650,
      currencyCode: 'USD',
      baseUnitCode: 'pcs',
    });

    // Query linked inventory item
    const itemRepo = ds.getRepository(ItemEntity);
    const item = await itemRepo.findOne({ where: { code: `ITEM-${product.code}` } });
    expect(item).toBeDefined();

    // Confirm Opening Stock
    const confirmed = await inventoryService.confirmOpeningStock({
      storeId: store.id,
      notes: 'Initial go-live count',
      confirmedBy: 'super_admin',
      rows: [
        {
          itemId: item!.id, // Valid ItemEntity ID
          quantity: 25,
          costPerUnitMinorUnits: 250,
        },
      ],
    });

    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.confirmedAtUtc).toBeDefined();

    // Verify stock_movements ledger table has the OPENING movement
    const movementRepo = ds.getRepository(StockMovementEntity);
    const movements = await movementRepo.find({ where: { movementType: 'OPENING' } });

    expect(movements.length).toBe(1);
    expect(movements[0]?.signedBaseQuantity).toBe(25);
    expect(movements[0]?.movementType).toBe('OPENING');

    // Attempting to re-confirm opening stock must be rejected (session locked)
    await expect(
      inventoryService.confirmOpeningStock({
        storeId: store.id,
        rows: [{ itemId: item!.id, quantity: 10 }],
      }),
    ).rejects.toThrow(/already been confirmed and locked/i);
  });
});
