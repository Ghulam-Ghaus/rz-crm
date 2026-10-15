import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  bootstrapBackend,
  ActiveBackend,
  CatalogService,
  ShiftsService,
  PosSaleService,
  InventoryService,
} from '@bakery/backend';
import { StoreEntity, StockMovementEntity, ProductVariantEntity } from '@bakery/database';

describe('Phase 3 — POS Sales & Cashier Shifts Integration', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-pos-test-'));
    const dbPath = path.join(tempDir, 'pos_test.db');

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

  it('should complete full cashier shift, cash sale, stock deduction, and change calculation', async () => {
    const ds = activeBackend.dbManager.getDataSource();
    const catalogService = activeBackend.appContext.get(CatalogService);
    const shiftsService = activeBackend.appContext.get(ShiftsService);
    const posSaleService = activeBackend.appContext.get(PosSaleService);
    const inventoryService = activeBackend.appContext.get(InventoryService);

    // 1. Setup Store
    const store = await ds.getRepository(StoreEntity).save({
      code: 'STORE-POS-01',
      name: 'Lahore Model Town Bakery',
      timezone: 'Asia/Karachi',
      currencyCode: 'PKR',
      isActive: true,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });

    // 2. Setup Product: Butter Croissant at Rs. 150 (15000 paisa)
    const product = await catalogService.createProduct({
      code: 'CROISSANT-01',
      name: 'Butter Croissant',
      sku: 'SKU-CRO-01',
      priceMinorUnits: 15000,
      currencyCode: 'PKR',
      baseUnitCode: 'pcs',
      barcode: '998877665544',
    });

    // 3. Open Cashier Shift with Rs. 1,000 opening float (100000 paisa)
    const shift = await shiftsService.openShift({
      storeId: store.id,
      cashierId: 'cashier-ahmad',
      openingFloatMinorUnits: 100000,
      notes: 'Morning shift opening',
    });

    expect(shift.status).toBe('open');
    expect(shift.openingFloatMinorUnits).toBe(100000);
    expect(shift.expectedCashMinorUnits).toBe(100000);

    // Find the variant ID
    const products = await catalogService.getProducts();
    const createdProd = products.find((p) => p.code === product.code);
    expect(createdProd).toBeDefined();

    // 3b. Verify Negative Stock Guard: Sale fails because Butter Croissant has 0 stock
    await expect(
      posSaleService.checkoutCashSale({
        storeId: store.id,
        shiftId: shift.id,
        cashierId: 'cashier-ahmad',
        items: [
          {
            variantId: createdProd!.variantId,
            quantity: 2,
            unitPriceMinorUnits: 15000,
          },
        ],
        amountTenderedMinorUnits: 50000,
      }),
    ).rejects.toThrow(/Insufficient stock for "Butter Croissant"/);

    // 3c. Adjust Stock to 10 pcs
    const variant = await ds.getRepository(ProductVariantEntity).findOne({ where: { id: createdProd!.variantId } });
    expect(variant).toBeDefined();

    await inventoryService.recordStockAdjustment({
      storeId: store.id,
      itemId: variant!.itemId!,
      newQuantity: 10,
      reason: 'Physical shelf count opening true-up',
    });

    // 4. Perform Cash Sale: 2 Croissants = Rs. 300 (30000 paisa)
    // Customer tenders Rs. 500 (50000 paisa) -> Change should be Rs. 200 (20000 paisa)
    const receipt = await posSaleService.checkoutCashSale({
      storeId: store.id,
      shiftId: shift.id,
      cashierId: 'cashier-ahmad',
      items: [
        {
          variantId: createdProd!.variantId,
          quantity: 2,
          unitPriceMinorUnits: 15000,
        },
      ],
      amountTenderedMinorUnits: 50000,
      idempotencyKey: 'SALE-IDEMP-001',
    });

    expect(receipt.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/);
    expect(receipt.totalMinorUnits).toBe(30000); // Rs. 300
    expect(receipt.amountTenderedMinorUnits).toBe(50000); // Rs. 500
    expect(receipt.changeDueMinorUnits).toBe(20000); // Rs. 200 change
    expect(receipt.currencyCode).toBe('PKR');

    // 5. Verify Stock Deduction in authoritative stock_movements ledger
    const movementRepo = ds.getRepository(StockMovementEntity);
    const saleMovements = await movementRepo.find({ where: { movementType: 'SALE' } });
    expect(saleMovements.length).toBe(1);
    expect(saleMovements[0]?.signedBaseQuantity).toBe(-2); // -2 base units deducted

    // 6. Verify Drawer Cash Update: Expected Cash is now Rs. 1000 + Rs. 300 = Rs. 1300
    const activeShift = await shiftsService.getActiveShift(store.id);
    expect(activeShift?.expectedCashMinorUnits).toBe(130000);

    // 7. Verify Idempotency Guard: Retrying checkout with same key returns original receipt without duplicate stock deduction
    const retryReceipt = await posSaleService.checkoutCashSale({
      storeId: store.id,
      shiftId: shift.id,
      cashierId: 'cashier-ahmad',
      items: [{ variantId: createdProd!.variantId, quantity: 2, unitPriceMinorUnits: 15000 }],
      amountTenderedMinorUnits: 50000,
      idempotencyKey: 'SALE-IDEMP-001',
    });
    expect(retryReceipt.invoiceNumber).toBe(receipt.invoiceNumber);
    const postRetryMovements = await movementRepo.find({ where: { movementType: 'SALE' } });
    expect(postRetryMovements.length).toBe(1); // No double deduction

    // 8. Close Shift with counted cash Rs. 1,300 -> 0 variance
    const closedShift = await shiftsService.closeShift({
      shiftId: shift.id,
      countedCashMinorUnits: 130000,
      notes: 'Even drawer, all matched',
    });

    expect(closedShift.status).toBe('closed');
    expect(closedShift.varianceMinorUnits).toBe(0);

    // 9. Verify that selling to a closed shift is rejected
    await expect(
      posSaleService.checkoutCashSale({
        storeId: store.id,
        shiftId: shift.id,
        cashierId: 'cashier-ahmad',
        items: [{ variantId: createdProd!.variantId, quantity: 1, unitPriceMinorUnits: 15000 }],
        amountTenderedMinorUnits: 20000,
      }),
    ).rejects.toThrow(/closed shift/i);

    // 10. Verify Historical Receipt Retrieval & Recent Sales List
    const recentSales = await posSaleService.getRecentSales(store.id);
    expect(recentSales.length).toBeGreaterThanOrEqual(1);
    expect(recentSales[0]?.invoiceNumber).toBe(receipt.invoiceNumber);
    expect(recentSales[0]?.itemCount).toBe(1);

    const fetchedReceipt = await posSaleService.getSaleReceipt(receipt.saleId);
    expect(fetchedReceipt.invoiceNumber).toBe(receipt.invoiceNumber);
    expect(fetchedReceipt.items.length).toBe(1);
    expect(fetchedReceipt.items[0]?.productName).toBe('Butter Croissant');
    expect(fetchedReceipt.totalMinorUnits).toBe(30000);

    // 11. Verify Shifts List & Comprehensive X/Z Shift Report
    const shiftsList = await shiftsService.getRecentShifts(store.id);
    expect(shiftsList.length).toBeGreaterThanOrEqual(1);
    expect(shiftsList[0]?.id).toBe(shift.id);

    const shiftReport = await shiftsService.getShiftReport(shift.id);
    expect(shiftReport.shiftId).toBe(shift.id);
    expect(shiftReport.status).toBe('closed');
    expect(shiftReport.openingFloatMinorUnits).toBe(100000); // Rs. 1000 float
    expect(shiftReport.totalCashSalesMinorUnits).toBe(30000); // Rs. 300 cash sales
    expect(shiftReport.expectedCashMinorUnits).toBe(130000); // Rs. 1300 expected
    expect(shiftReport.closingCountedMinorUnits).toBe(130000); // Rs. 1300 counted
    expect(shiftReport.varianceMinorUnits).toBe(0); // 0 variance
    expect(shiftReport.totalTransactions).toBe(1);
    expect(shiftReport.totalUnitsSold).toBe(2);
    expect(shiftReport.itemsSold.length).toBe(1);
    expect(shiftReport.itemsSold[0]?.productName).toBe('Butter Croissant');
    expect(shiftReport.itemsSold[0]?.quantitySold).toBe(2);
    expect(shiftReport.itemsSold[0]?.revenueMinorUnits).toBe(30000);
  });
});
