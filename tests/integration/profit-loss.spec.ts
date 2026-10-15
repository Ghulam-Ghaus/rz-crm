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
  ProfitLossService,
  InventoryService,
} from '@bakery/backend';
import { StoreEntity, ProductVariantEntity } from '@bakery/database';

describe('Profit & Loss (P&L) Analytics & Dual Pricing Integration', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-pnl-test-'));
    const dbPath = path.join(tempDir, 'pnl_test.db');

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

  it('should save Buy Price (Cost) & Sale Price (Retail) and calculate accurate Profit & Loss statement', async () => {
    const ds = activeBackend.dbManager.getDataSource();
    const catalogService = activeBackend.appContext.get(CatalogService);
    const shiftsService = activeBackend.appContext.get(ShiftsService);
    const posSaleService = activeBackend.appContext.get(PosSaleService);
    const profitLossService = activeBackend.appContext.get(ProfitLossService);
    const inventoryService = activeBackend.appContext.get(InventoryService);

    // 1. Setup Store
    const store = await ds.getRepository(StoreEntity).save({
      code: 'STORE-PNL-01',
      name: 'Gulberg Bakery & Sweets',
      timezone: 'Asia/Karachi',
      currencyCode: 'PKR',
      isActive: true,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });

    // 2. Setup Products with Buy Price (Cost) and Sale Price (Retail)
    // Product A: Butter Croissant (Buy: Rs. 100, Sell: Rs. 150)
    const productA = await catalogService.createProduct({
      code: 'CROISSANT-01',
      name: 'Butter Croissant',
      sku: 'SKU-CRO-01',
      priceMinorUnits: 15000,
      costMinorUnits: 10000,
      currencyCode: 'PKR',
      baseUnitCode: 'pcs',
    });

    // Product B: Pistachio Burfi (Buy: Rs. 800, Sell: Rs. 1200)
    const productB = await catalogService.createProduct({
      code: 'BURFI-01',
      name: 'Pistachio Burfi',
      sku: 'SKU-BRF-01',
      priceMinorUnits: 120000,
      costMinorUnits: 80000,
      currencyCode: 'PKR',
      baseUnitCode: 'kg',
    });

    // Verify dual prices in getProducts
    const productList = await catalogService.getProducts();
    const foundA = productList.find((p) => p.code === 'CROISSANT-01');
    const foundB = productList.find((p) => p.code === 'BURFI-01');
    expect(foundA?.costMinorUnits).toBe(10000);
    expect(foundA?.priceMinorUnits).toBe(15000);
    expect(foundB?.costMinorUnits).toBe(80000);
    expect(foundB?.priceMinorUnits).toBe(120000);

    // 3. Stock inventory using recordStockAdjustment
    const variantRepo = ds.getRepository(ProductVariantEntity);
    const varA = await variantRepo.findOne({ where: { id: productA.variantId } });
    const varB = await variantRepo.findOne({ where: { id: productB.variantId } });

    await inventoryService.recordStockAdjustment({
      storeId: store.id,
      itemId: varA!.itemId!,
      newQuantity: 100,
      reason: 'Initial stock',
    });
    await inventoryService.recordStockAdjustment({
      storeId: store.id,
      itemId: varB!.itemId!,
      newQuantity: 50,
      reason: 'Initial stock',
    });

    // 4. Open Shift
    const shift = await shiftsService.openShift({
      storeId: store.id,
      registerId: 1,
      cashierId: 'cashier-01',
      openingFloatMinorUnits: 500000,
    });

    // 5. Checkout Sale: 10 Croissants + 2 kg Burfi
    // Croissants: 10 * 15,000 = 150,000 (Cost = 10 * 10,000 = 100,000 -> Profit = 50,000)
    // Burfi: 2 * 120,000 = 240,000 (Cost = 2 * 80,000 = 160,000 -> Profit = 80,000)
    // Total Revenue = 390,000 paisa (Rs. 3,900)
    // Total COGS = 260,000 paisa (Rs. 2,600)
    // Gross Profit = 130,000 paisa (Rs. 1,300)
    // Profit Margin % = (130,000 / 390,000) * 100 = 33.3%
    await posSaleService.checkoutCashSale({
      storeId: store.id,
      shiftId: shift.id,
      cashierId: 'cashier-01',
      amountTenderedMinorUnits: 400000,
      items: [
        { variantId: productA.variantId, quantity: 10, unitPriceMinorUnits: 15000 },
        { variantId: productB.variantId, quantity: 2, unitPriceMinorUnits: 120000 },
      ],
    });

    // 6. Calculate P&L Report across all items
    const report = await profitLossService.calculateProfitLoss({
      storeId: store.id,
    });

    expect(report.totalSalesCount).toBe(1);
    expect(report.totalRevenueMinorUnits).toBe(390000);
    expect(report.totalCostMinorUnits).toBe(260000);
    expect(report.grossProfitMinorUnits).toBe(130000);
    expect(report.profitMarginPercent).toBe(33.3);
    expect(report.totalUnitsSold).toBe(12);
    expect(report.items).toHaveLength(2);

    // Verify item breakdown (ordered by Gross Profit descending: Burfi Rs. 800 > Croissant Rs. 500)
    const topItem = report.items[0]!;
    const secondItem = report.items[1]!;
    expect(topItem.productName).toBe('Pistachio Burfi');
    expect(topItem.unitsSold).toBe(2);
    expect(topItem.totalRevenueMinorUnits).toBe(240000);
    expect(topItem.totalCostMinorUnits).toBe(160000);
    expect(topItem.grossProfitMinorUnits).toBe(80000);
    expect(topItem.marginPercent).toBe(33.3);

    expect(secondItem.productName).toBe('Butter Croissant');
    expect(secondItem.unitsSold).toBe(10);
    expect(secondItem.totalRevenueMinorUnits).toBe(150000);
    expect(secondItem.totalCostMinorUnits).toBe(100000);
    expect(secondItem.grossProfitMinorUnits).toBe(50000);
    expect(secondItem.marginPercent).toBe(33.3);

    // 7. Filter test: Filter specifically by product A
    const filteredReport = await profitLossService.calculateProfitLoss({
      storeId: store.id,
      variantId: productA.variantId,
    });
    expect(filteredReport.items).toHaveLength(1);
    expect(filteredReport.totalRevenueMinorUnits).toBe(150000);
    expect(filteredReport.grossProfitMinorUnits).toBe(50000);
    expect(filteredReport.items[0]!.sku).toBe('SKU-CRO-01');
  });
});
