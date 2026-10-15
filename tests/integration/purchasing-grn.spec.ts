import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  bootstrapBackend,
  ActiveBackend,
  CatalogService,
  SuppliersService,
  PurchaseOrdersService,
  GoodsReceivingService,
} from '@bakery/backend';
import { StoreEntity, StockMovementEntity, InventoryLotEntity, ProductVariantEntity } from '@bakery/database';

describe('Phase 4 — Purchasing, Purchase Orders & Goods Receiving (GRN) Integration', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-purchasing-test-'));
    const dbPath = path.join(tempDir, 'purchasing_test.db');

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

  it('should manage supplier, create PO, handle partial and full GRN receiving, update lots and increase stock ledger', async () => {
    const ds = activeBackend.dbManager.getDataSource();
    const catalogService = activeBackend.appContext.get(CatalogService);
    const suppliersService = activeBackend.appContext.get(SuppliersService);
    const poService = activeBackend.appContext.get(PurchaseOrdersService);
    const grnService = activeBackend.appContext.get(GoodsReceivingService);

    // 1. Setup Store
    const store = await ds.getRepository(StoreEntity).save({
      code: 'STORE-PURCH-01',
      name: 'Gulberg Bakery Test Store',
      address: 'Main Boulevard, Lahore',
      phone: '+92 42 35789000',
      currencyCode: 'PKR',
      timezone: 'Asia/Karachi',
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });

    // 2. Setup Category & Product
    const category = await catalogService.createCategory({
      code: 'RAW_ING',
      name: 'Raw Ingredients',
    });

    const product = await catalogService.createProduct({
      code: 'FLOUR-50KG',
      name: 'Premium Wheat Flour (50kg)',
      sku: 'SKU-FLR-50',
      categoryId: category.id,
      baseUnitCode: 'kg',
      priceMinorUnits: 550000, // Retail price Rs. 5,500.00
      barcode: '8901112223334',
    });
    expect(product.variantId).toBeDefined();

    // 3. Register Supplier
    const supplier = await suppliersService.createSupplier({
      storeId: store.id,
      code: 'SUP-MILL-01',
      name: 'National Flour Mills Ltd',
      contactPerson: 'Muhammad Tariq',
      phone: '+92 300 1234567',
      email: 'tariq@nationalmills.pk',
      taxNumber: 'NTN-8899001-2',
      address: 'Industrial Estate, Multan Road, Lahore',
      paymentTermsDays: 15,
    });
    expect(supplier.id).toBeGreaterThan(0);
    expect(supplier.name).toBe('National Flour Mills Ltd');

    // 4. Create Purchase Order (PO) for 20 bags at cost of Rs. 4,500.00 (450,000 minor units)
    const po = await poService.createPurchaseOrder({
      storeId: store.id,
      supplierId: supplier.id,
      expectedDeliveryDateUtc: '2026-09-15T10:00:00Z',
      notes: 'Urgent delivery for weekend bakery production',
      lines: [
        {
          productVariantId: product.variantId,
          orderedQuantity: 20,
          unitCode: 'kg',
          unitCostMinorUnits: 450000,
          notes: 'Standard 50kg bags',
        },
      ],
    });
    expect(po.poNumber).toMatch(/^PO-\d{8}-\d{4}$/);
    expect(po.status).toBe('DRAFT');
    expect(po.totalCostMinorUnits).toBe(20 * 450000); // 9,000,000 minor units (Rs. 90,000)

    // 5. Approve Purchase Order
    const approvedPo = await poService.approvePurchaseOrder(po.id);
    expect(approvedPo.status).toBe('APPROVED');
    const poLine = approvedPo.lines![0]!;
    expect(poLine.orderedQuantity).toBe(20);
    expect(poLine.receivedQuantity).toBe(0);

    // 6. Partial Receiving (GRN #1): Receive 8 bags with Lot & Expiry
    const grn1 = await grnService.postGoodsReceipt({
      storeId: store.id,
      supplierId: supplier.id,
      purchaseOrderId: approvedPo.id,
      supplierInvoiceRef: 'INV-MILL-7890',
      receivedDateUtc: '2026-09-04T11:00:00Z',
      notes: 'First delivery truck arrived - 8 bags received in good condition',
      receivedBy: 'RECEIVER-01',
      lines: [
        {
          poLineId: poLine.id,
          productVariantId: product.variantId,
          receivedQuantity: 8,
          unitCode: 'kg',
          unitCostMinorUnits: 450000,
          lotNumber: 'LOT-FLR-202609-A',
          expiryDateUtc: '2027-03-04T00:00:00Z',
        },
      ],
    });
    expect(grn1.grnNumber).toMatch(/^GRN-\d{8}-\d{4}$/);
    expect(grn1.status).toBe('POSTED');
    expect(grn1.totalAmountMinorUnits).toBe(8 * 450000);

    // Verify PO status transitioned to PARTIALLY_RECEIVED
    const poAfterGrn1 = await poService.getPurchaseOrder(approvedPo.id);
    expect(poAfterGrn1.status).toBe('PARTIALLY_RECEIVED');
    expect(poAfterGrn1.lines![0]!.receivedQuantity).toBe(8);

    // Verify Inventory Lot was recorded
    const lots = await ds.getRepository(InventoryLotEntity).find({
      where: { productVariantId: product.variantId },
    });
    expect(lots.length).toBe(1);
    expect(lots[0]!.lotNumber).toBe('LOT-FLR-202609-A');
    expect(lots[0]!.initialQuantity).toBe(8);

    // Verify Stock Movement Ledger: Exact positive movement recorded
    const movements1 = await ds.getRepository(StockMovementEntity).find({
      where: { movementType: 'PURCHASE_RECEIPT' },
    });
    expect(movements1.length).toBe(1);
    expect(movements1[0]!.signedBaseQuantity).toBe(8);
    expect(movements1[0]!.sourceType).toBe('GOODS_RECEIPT');
    expect(movements1[0]!.costPerUnitMinorUnits).toBe(450000);

    // 7. Complete Remaining Receiving (GRN #2): Receive remaining 12 bags
    const grn2 = await grnService.postGoodsReceipt({
      storeId: store.id,
      supplierId: supplier.id,
      purchaseOrderId: approvedPo.id,
      supplierInvoiceRef: 'INV-MILL-7910',
      receivedDateUtc: '2026-09-05T10:00:00Z',
      notes: 'Second delivery truck arrived - remaining 12 bags received',
      lines: [
        {
          poLineId: poLine.id,
          productVariantId: product.variantId,
          receivedQuantity: 12,
          unitCode: 'kg',
          unitCostMinorUnits: 450000,
          lotNumber: 'LOT-FLR-202609-B',
          expiryDateUtc: '2027-03-05T00:00:00Z',
        },
      ],
    });
    expect(grn2.status).toBe('POSTED');

    // Verify PO status transitioned to fully RECEIVED
    const poAfterGrn2 = await poService.getPurchaseOrder(approvedPo.id);
    expect(poAfterGrn2.status).toBe('RECEIVED');
    expect(poAfterGrn2.lines![0]!.receivedQuantity).toBe(20);

    // Verify total stock movements recorded: 8 + 12 = 20
    const allMovements = await ds.getRepository(StockMovementEntity).find({
      where: { movementType: 'PURCHASE_RECEIPT' },
    });
    expect(allMovements.length).toBe(2);
    const totalStock = allMovements.reduce((sum, m) => sum + m.signedBaseQuantity, 0);
    expect(totalStock).toBe(20);

    // 8. Direct Goods Receipt without PO (e.g. Local Dairy Milk purchase)
    const milkProduct = await catalogService.createProduct({
      code: 'FRESH-MILK-L',
      name: 'Fresh Dairy Milk',
      sku: 'SKU-MILK-01',
      categoryId: category.id,
      baseUnitCode: 'l',
      priceMinorUnits: 22000, // Retail Rs. 220.00
      barcode: '8909998887771',
    });

    const directGrn = await grnService.postGoodsReceipt({
      storeId: store.id,
      supplierId: supplier.id,
      supplierInvoiceRef: 'CASH-RECEIPT-MILK-44',
      notes: 'Direct morning milk delivery without PO',
      lines: [
        {
          productVariantId: milkProduct.variantId,
          receivedQuantity: 50,
          unitCode: 'l',
          unitCostMinorUnits: 18000, // Rs. 180.00 per liter
          lotNumber: 'LOT-MILK-0904',
          expiryDateUtc: '2026-09-06T00:00:00Z',
        },
      ],
    });
    expect(directGrn.purchaseOrderId).toBeNull();
    expect(directGrn.totalAmountMinorUnits).toBe(50 * 18000); // Rs. 9,000.00

    // Verify milk stock movement
    const milkVariant = await ds.getRepository(ProductVariantEntity).findOne({
      where: { id: milkProduct.variantId },
    });
    const milkMovements = await ds.getRepository(StockMovementEntity).find({
      where: { itemId: milkVariant!.itemId! },
    });
    expect(milkMovements.length).toBe(1);
    expect(milkMovements[0]!.signedBaseQuantity).toBe(50);
  });

  it('should support purchasing multiple items in a single GRN, compute supplier balance, record payments, and generate chronological ledger', async () => {
    const ds = activeBackend.dbManager.getDataSource();
    const catalogService = activeBackend.appContext.get(CatalogService);
    const suppliersService = activeBackend.appContext.get(SuppliersService);
    const grnService = activeBackend.appContext.get(GoodsReceivingService);

    // 1. Setup Store
    const store = await ds.getRepository(StoreEntity).save({
      code: 'STORE-LEDGER-01',
      name: 'Main Bakery Store',
      currencyCode: 'PKR',
      timezone: 'Asia/Karachi',
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });

    // 2. Setup Category & Multiple Products from Wholesaler
    const category = await catalogService.createCategory({
      code: 'BAKERY_SUPPLIES',
      name: 'Bakery Raw Supplies',
    });

    const flour = await catalogService.createProduct({
      code: 'FLOUR-FINE',
      name: 'Fine White Flour (Maida)',
      sku: 'SKU-FLOUR-FINE',
      categoryId: category.id,
      baseUnitCode: 'kg',
      priceMinorUnits: 15000,
    });

    const sugar = await catalogService.createProduct({
      code: 'SUGAR-WHITE',
      name: 'Refined White Sugar',
      sku: 'SKU-SUGAR-REF',
      categoryId: category.id,
      baseUnitCode: 'kg',
      priceMinorUnits: 16000,
    });

    const ghee = await catalogService.createProduct({
      code: 'DESI-GHEE',
      name: 'Pure Desi Ghee 16kg Tin',
      sku: 'SKU-DESI-GHEE',
      categoryId: category.id,
      baseUnitCode: 'kg',
      priceMinorUnits: 250000,
    });

    // 3. Register Wholesaler Supplier
    const wholesaler = await suppliersService.createSupplier({
      storeId: store.id,
      code: 'SUP-WHOLESALE-01',
      name: 'Al-Madina Wholesalers & Traders',
      contactPerson: 'Haji Abdul Rehman',
      phone: '+92 321 9876543',
      paymentTermsDays: 30,
    });

    // 4. MULTI-ITEM PURCHASE: Buy Flour, Sugar, and Ghee together on 1 invoice
    // Line 1: 50 kg Flour @ Rs. 120 (12,000 minor units) = Rs. 6,000 (600,000 minor units)
    // Line 2: 25 kg Sugar @ Rs. 140 (14,000 minor units) = Rs. 3,500 (350,000 minor units)
    // Line 3: 10 tins Ghee @ Rs. 2,000 (200,000 minor units) = Rs. 20,000 (2,000,000 minor units)
    // Total Invoice: Rs. 29,500 (2,950,000 minor units)
    const multiItemGrn = await grnService.postGoodsReceipt({
      storeId: store.id,
      supplierId: wholesaler.id,
      supplierInvoiceRef: 'INV-ALMADINA-4402',
      receivedDateUtc: '2026-09-08T09:00:00Z',
      notes: 'Monthly bulk bakery raw materials invoice',
      lines: [
        {
          productVariantId: flour.variantId,
          receivedQuantity: 50,
          unitCode: 'kg',
          unitCostMinorUnits: 12000,
          lotNumber: 'LOT-FLR-01',
        },
        {
          productVariantId: sugar.variantId,
          receivedQuantity: 25,
          unitCode: 'kg',
          unitCostMinorUnits: 14000,
          lotNumber: 'LOT-SGR-01',
        },
        {
          productVariantId: ghee.variantId,
          receivedQuantity: 10,
          unitCode: 'kg',
          unitCostMinorUnits: 200000,
          lotNumber: 'LOT-GHE-01',
        },
      ],
    });

    expect(multiItemGrn.totalAmountMinorUnits).toBe(600000 + 350000 + 2000000); // 2,950,000 minor units (Rs. 29,500)
    expect(multiItemGrn.lines).toHaveLength(3);

    // Verify all 3 items received stock ledger movements
    const movements = await ds.getRepository(StockMovementEntity).find({
      where: { sourceType: 'GOODS_RECEIPT' },
    });
    expect(movements.length).toBeGreaterThanOrEqual(3);

    // 5. Check Supplier Balance Summary before any payment
    const balances1 = await suppliersService.getSupplierBalances(store.id);
    const wholesalerBalance1 = balances1.find((b) => b.supplierId === wholesaler.id);
    expect(wholesalerBalance1).toBeDefined();
    expect(wholesalerBalance1!.totalPurchasesMinorUnits).toBe(2950000);
    expect(wholesalerBalance1!.totalPaidMinorUnits).toBe(0);
    expect(wholesalerBalance1!.outstandingBalanceMinorUnits).toBe(2950000); // Owes Rs. 29,500

    // 6. Record Partial Payment of Rs. 20,000 (2,000,000 minor units) via Bank Transfer
    const payment1 = await suppliersService.recordSupplierPayment({
      storeId: store.id,
      supplierId: wholesaler.id,
      amountMinorUnits: 2000000,
      paymentMethod: 'BANK_TRANSFER',
      paymentDateUtc: '2026-09-08T14:00:00Z',
      reference: 'HBL-FT-994821',
      notes: 'Partial payment against INV-ALMADINA-4402',
      paidBy: 'MANAGER-01',
    });
    expect(payment1.paymentNumber).toMatch(/^SPAY-\d{8}-\d{4}$/);
    expect(payment1.amountMinorUnits).toBe(2000000);

    // 7. Check Supplier Balance Summary after payment
    const balances2 = await suppliersService.getSupplierBalances(store.id);
    const wholesalerBalance2 = balances2.find((b) => b.supplierId === wholesaler.id);
    expect(wholesalerBalance2!.totalPurchasesMinorUnits).toBe(2950000);
    expect(wholesalerBalance2!.totalPaidMinorUnits).toBe(2000000);
    expect(wholesalerBalance2!.outstandingBalanceMinorUnits).toBe(950000); // Remaining Rs. 9,500

    // 8. Fetch Supplier Chronological Ledger Statement
    const ledger = await suppliersService.getSupplierLedger(store.id, wholesaler.id);
    expect(ledger.supplier.id).toBe(wholesaler.id);
    expect(ledger.totalPurchasesMinorUnits).toBe(2950000);
    expect(ledger.totalPaidMinorUnits).toBe(2000000);
    expect(ledger.outstandingBalanceMinorUnits).toBe(950000);
    expect(ledger.entries).toHaveLength(2);

    // Entry 1: GRN delivery (Debit Rs. 29,500 -> Running balance Rs. 29,500)
    expect(ledger.entries[0]!.type).toBe('GRN');
    expect(ledger.entries[0]!.debitMinorUnits).toBe(2950000);
    expect(ledger.entries[0]!.creditMinorUnits).toBe(0);
    expect(ledger.entries[0]!.runningBalanceMinorUnits).toBe(2950000);

    // Entry 2: Payment (Credit Rs. 20,000 -> Running balance Rs. 9,500)
    expect(ledger.entries[1]!.type).toBe('PAYMENT');
    expect(ledger.entries[1]!.debitMinorUnits).toBe(0);
    expect(ledger.entries[1]!.creditMinorUnits).toBe(2000000);
    expect(ledger.entries[1]!.runningBalanceMinorUnits).toBe(950000);
  });
});
