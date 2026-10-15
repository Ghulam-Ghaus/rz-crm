import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  bootstrapBackend,
  ActiveBackend,
  CatalogService,
  RecipesService,
  ProductionRunsService,
} from '@rz-crm/backend';
import { StoreEntity, StockMovementEntity, InventoryLotEntity, StockLocationEntity } from '@rz-crm/database';

describe('Phase 5 — Production & Recipe Management Integration', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-production-test-'));
    const dbPath = path.join(tempDir, 'production_test.db');

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

  it('should create recipe with versioning, plan run, complete run atomically, deduct ingredients and add finished goods', async () => {
    const ds = activeBackend.dbManager.getDataSource();
    const catalogService = activeBackend.appContext.get(CatalogService);
    const recipesService = activeBackend.appContext.get(RecipesService);
    const productionService = activeBackend.appContext.get(ProductionRunsService);

    // 1. Setup Store & Location
    const store = await ds.getRepository(StoreEntity).save({
      code: 'STORE-PRD-01',
      name: 'DHA Production Kitchen',
      address: 'Phase 5 DHA, Lahore',
      phone: '+92 42 35789111',
      currencyCode: 'PKR',
      timezone: 'Asia/Karachi',
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });

    await ds.getRepository(StockLocationEntity).save({
      storeId: store.id,
      code: 'MAIN',
      name: 'Main Bakery Kitchen',
      locationType: 'kitchen',
      isActive: true,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });

    // 2. Setup Category & Items
    const ingCategory = await catalogService.createCategory({
      code: 'RAW_MAT',
      name: 'Raw Materials',
    });
    const bakedCategory = await catalogService.createCategory({
      code: 'BAKERY_FIN',
      name: 'Finished Bakery',
    });

    // Raw Materials
    const flour = await catalogService.createProduct({
      code: 'RAW-FLOUR',
      name: 'All-Purpose Fine Flour',
      sku: 'RAW-FLOUR-01',
      categoryId: ingCategory.id,
      baseUnitCode: 'g',
      priceMinorUnits: 2000,
    });
    const sugar = await catalogService.createProduct({
      code: 'RAW-SUGAR',
      name: 'Refined White Sugar',
      sku: 'RAW-SUGAR-01',
      categoryId: ingCategory.id,
      baseUnitCode: 'g',
      priceMinorUnits: 1500,
    });

    // Finished Bakery Output Product
    const croissant = await catalogService.createProduct({
      code: 'FIN-CROISSANT',
      name: 'French Butter Croissant',
      sku: 'FIN-CROISSANT-01',
      categoryId: bakedCategory.id,
      baseUnitCode: 'pcs',
      priceMinorUnits: 25000, // Rs. 250.00
    });

    // 3. Create Recipe (Version 1)
    const recipe = await recipesService.createRecipe(store.id, {
      code: 'RCP-CROISSANT-STD',
      name: 'French Butter Croissant Standard Batch',
      outputVariantId: croissant.variantId,
      expectedYieldQuantity: 12, // 12 pcs per batch
      outputUnitCode: 'pcs',
      items: [
        {
          inputVariantId: flour.variantId,
          quantity: 600, // 600g flour
          unitCode: 'g',
          wastagePercent: 2,
        },
        {
          inputVariantId: sugar.variantId,
          quantity: 150, // 150g sugar
          unitCode: 'g',
          wastagePercent: 0,
        },
      ],
    });

    expect(recipe.id).toBeDefined();
    expect(recipe.code).toBe('RCP-CROISSANT-STD');
    expect(recipe.currentVersion?.versionNumber).toBe(1);
    expect(recipe.currentVersion?.items?.length).toBe(2);

    // 4. Create New Recipe Version (Version 2 with adjusted sugar)
    const v2 = await recipesService.createRecipeVersion(recipe.id, {
      recipeId: recipe.id,
      notes: 'Reduced sugar recipe',
      items: [
        {
          inputVariantId: flour.variantId,
          quantity: 600,
          unitCode: 'g',
          wastagePercent: 2,
        },
        {
          inputVariantId: sugar.variantId,
          quantity: 120, // Reduced to 120g
          unitCode: 'g',
          wastagePercent: 0,
        },
      ],
    });

    expect(v2.versionNumber).toBe(2);
    expect(v2.items?.length).toBe(2);

    // 5. Plan Production Run for 2 Batches
    // Expected output: 12 * 2 = 24 croissants
    // Expected flour: 600 * 2 = 1200g
    // Expected sugar: 120 * 2 = 240g
    const run = await productionService.createProductionRun(store.id, {
      recipeId: recipe.id,
      plannedBatchCount: 2,
      notes: 'Morning shift croissant batch',
    });

    expect(run.id).toBeDefined();
    expect(run.runNumber).toMatch(/^PRD-\d{8}-\d{4}$/);
    expect(run.status).toBe('PLANNED');
    expect(run.plannedBatchCount).toBe(2);
    expect(run.plannedOutputQuantity).toBe(24);
    expect(run.items?.length).toBe(2);

    const flourItem = run.items?.find((i) => i.inputVariantId === flour.variantId);
    expect(flourItem?.plannedQuantity).toBe(1200);

    const sugarItem = run.items?.find((i) => i.inputVariantId === sugar.variantId);
    expect(sugarItem?.plannedQuantity).toBe(240);

    // 6. Transition Run Status: PLANNED -> RELEASED -> IN_PROGRESS
    const releasedRun = await productionService.updateProductionRunStatus({
      runId: run.id,
      status: 'RELEASED',
    });
    expect(releasedRun.status).toBe('RELEASED');

    const inProgressRun = await productionService.updateProductionRunStatus({
      runId: run.id,
      status: 'IN_PROGRESS',
    });
    expect(inProgressRun.status).toBe('IN_PROGRESS');

    // 7. Complete Run with Actual Output = 23 croissants (1 burned/wasted)
    const completedRun = await productionService.completeProductionRun(store.id, {
      runId: run.id,
      actualOutputQuantity: 23,
      outputLotNumber: 'LOT-CRS-20260904',
      outputExpiryDate: '2026-09-06',
      notes: 'Excellent lamination, 1 unit discarded during baking',
    });

    expect(completedRun.status).toBe('COMPLETED');
    expect(completedRun.actualOutputQuantity).toBe(23);
    expect(completedRun.outputLotNumber).toBe('LOT-CRS-20260904');
    expect(completedRun.outputExpiryDate).toBe('2026-09-06');
    expect(completedRun.completedAtUtc).toBeDefined();

    // 8. Verify Stock Movement Ledger Invariants
    const movements = await ds.getRepository(StockMovementEntity).find({
      order: { id: 'ASC' },
    });

    // We expect 2 consumption movements (negative) and 1 output movement (positive)
    expect(movements.length).toBe(3);

    const consumptions = movements.filter((m) => m.movementType === 'PRODUCTION_CONSUMPTION');
    expect(consumptions.length).toBe(2);

    const flourConsumption = consumptions.find(
      (m) => m.idempotencyKey === `PRD-CONSUME-${run.id}-${flour.variantId}`,
    );
    expect(flourConsumption).toBeDefined();
    expect(flourConsumption?.signedBaseQuantity).toBe(-1200);
    expect(flourConsumption?.sourceType).toBe('PRODUCTION_RUN');
    expect(flourConsumption?.sourceId).toBe(run.runNumber);

    const sugarConsumption = consumptions.find(
      (m) => m.idempotencyKey === `PRD-CONSUME-${run.id}-${sugar.variantId}`,
    );
    expect(sugarConsumption).toBeDefined();
    expect(sugarConsumption?.signedBaseQuantity).toBe(-240);

    const outputMovement = movements.find(
      (m) => m.idempotencyKey === `PRD-OUTPUT-${run.id}`,
    );
    expect(outputMovement).toBeDefined();
    expect(outputMovement?.movementType).toBe('PRODUCTION_OUTPUT');
    expect(outputMovement?.signedBaseQuantity).toBe(23); // Positive finished goods inflow
    expect(outputMovement?.sourceType).toBe('PRODUCTION_RUN');
    expect(outputMovement?.sourceId).toBe(run.runNumber);

    // 9. Verify Inventory Lot Created for Finished Bakery Goods
    const lot = await ds.getRepository(InventoryLotEntity).findOne({
      where: { lotNumber: 'LOT-CRS-20260904' },
    });
    expect(lot).toBeDefined();
    expect(lot?.productVariantId).toBe(croissant.variantId);
    expect(lot?.initialQuantity).toBe(23);
    expect(lot?.currentQuantity).toBe(23);
    expect(lot?.expiryDateUtc).toBe('2026-09-06');

    // 10. Verify Cannot Complete an Already Completed Run
    await expect(
      productionService.completeProductionRun(store.id, {
        runId: run.id,
        actualOutputQuantity: 23,
      }),
    ).rejects.toThrow('already completed');
  });
});
