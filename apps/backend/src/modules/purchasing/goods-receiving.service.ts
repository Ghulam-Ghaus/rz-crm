import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  GoodsReceiptEntity,
  GoodsReceiptLineEntity,
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
  InventoryLotEntity,
  SupplierEntity,
  SupplierPaymentEntity,
  ProductVariantEntity,
  ProductEntity,
  StockMovementEntity,
  StockLocationEntity,
} from '@rz-crm/database';
import {
  GoodsReceipt,
  GoodsReceiptLine,
  PostGoodsReceiptInput,
  UpdateGoodsReceiptInput,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class GoodsReceivingService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getGoodsReceipts(storeId: number): Promise<GoodsReceipt[]> {
    const dataSource = this.databaseService.getDataSource();
    const grnRepo = dataSource.getRepository(GoodsReceiptEntity);
    const supplierRepo = dataSource.getRepository(SupplierEntity);
    const poRepo = dataSource.getRepository(PurchaseOrderEntity);
    const paymentRepo = dataSource.getRepository(SupplierPaymentEntity);

    const receipts = await grnRepo.find({
      where: { storeId },
      order: { id: 'DESC' },
    });

    const suppliers = await supplierRepo.find({ where: { storeId } });
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

    const pos = await poRepo.find({ where: { storeId } });
    const poMap = new Map(pos.map((p) => [p.id, p.poNumber]));

    const locationRepo = dataSource.getRepository(StockLocationEntity);
    const locations = await locationRepo.find({ where: { storeId } });
    const locationMap = new Map(locations.map((l) => [l.id, l.name]));

    const payments = await paymentRepo.find({ where: { storeId } });

    // Group GRNs and Payments by supplier for accurate explicit + FIFO advance matching
    const grnsBySupplier = new Map<number, GoodsReceiptEntity[]>();
    for (const r of receipts) {
      if (!grnsBySupplier.has(r.supplierId)) grnsBySupplier.set(r.supplierId, []);
      grnsBySupplier.get(r.supplierId)!.push(r);
    }

    const paymentsBySupplier = new Map<number, SupplierPaymentEntity[]>();
    for (const p of payments) {
      if (!paymentsBySupplier.has(p.supplierId)) paymentsBySupplier.set(p.supplierId, []);
      paymentsBySupplier.get(p.supplierId)!.push(p);
    }

    // Map of grnId -> { paidAmount, balanceDue, paymentStatus, paymentMethod }
    const grnPaymentResults = new Map<number, {
      paidAmount: number;
      balanceDue: number;
      paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
      paymentMethod?: string;
    }>();

    for (const [supId, supGrns] of grnsBySupplier.entries()) {
      const supPayments = paymentsBySupplier.get(supId) ?? [];
      // Chronological order (oldest first) for FIFO
      const chronologicalGrns = [...supGrns].sort((a, b) => a.id - b.id);

      // 1. Explicit payment tracking per GRN
      const explicitAllocated = new Map<number, { amount: number; method?: string }>();
      const usedPaymentIds = new Set<number>();

      for (const grn of chronologicalGrns) {
        let explicitPaid = 0;
        let method: string | undefined;
        for (const p of supPayments) {
          const isReferenced =
            (p.reference && (p.reference.includes(grn.grnNumber) || (grn.supplierInvoiceRef && p.reference.includes(grn.supplierInvoiceRef)))) ||
            (p.notes && (p.notes.includes(grn.grnNumber) || (grn.supplierInvoiceRef && p.notes.includes(grn.supplierInvoiceRef))));
          if (isReferenced && !usedPaymentIds.has(p.id)) {
            explicitPaid += p.amountMinorUnits;
            method = p.paymentMethod;
            usedPaymentIds.add(p.id);
          }
        }
        explicitAllocated.set(grn.id, { amount: explicitPaid, method });
      }

      // 2. Unallocated payment pool (advance payments, lump-sum settlements)
      let unallocatedPool = 0;
      let fallbackMethod: string | undefined;
      for (const p of supPayments) {
        if (!usedPaymentIds.has(p.id)) {
          unallocatedPool += p.amountMinorUnits;
          fallbackMethod = p.paymentMethod;
        }
      }

      // 3. FIFO allocation of advance/unallocated pool across GRNs that still have remaining balance
      for (const grn of chronologicalGrns) {
        const explicit = explicitAllocated.get(grn.id) ?? { amount: 0 };
        let paid = explicit.amount;
        let method = explicit.method;

        if (paid < grn.totalAmountMinorUnits && unallocatedPool > 0) {
          const needed = grn.totalAmountMinorUnits - paid;
          const allocation = Math.min(needed, unallocatedPool);
          paid += allocation;
          unallocatedPool -= allocation;
          if (!method) method = fallbackMethod || 'ADVANCE_ADJUSTMENT';
        }

        const balanceDue = Math.max(0, grn.totalAmountMinorUnits - paid);
        let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
        if (paid >= grn.totalAmountMinorUnits) {
          paymentStatus = 'PAID';
        } else if (paid > 0) {
          paymentStatus = 'PARTIAL';
        }

        grnPaymentResults.set(grn.id, {
          paidAmount: paid,
          balanceDue,
          paymentStatus,
          paymentMethod: method,
        });
      }
    }

    return receipts.map((grn) => {
      const match = grnPaymentResults.get(grn.id) ?? {
        paidAmount: 0,
        balanceDue: grn.totalAmountMinorUnits,
        paymentStatus: 'UNPAID' as const,
        paymentMethod: undefined,
      };

      return {
        id: grn.id,
        storeId: grn.storeId,
        grnNumber: grn.grnNumber,
        purchaseOrderId: grn.purchaseOrderId,
        poNumber: grn.purchaseOrderId ? poMap.get(grn.purchaseOrderId) : null,
        supplierId: grn.supplierId,
        supplierName: supplierMap.get(grn.supplierId) ?? 'Unknown Supplier',
        supplierInvoiceRef: grn.supplierInvoiceRef,
        receivedDateUtc: grn.receivedDateUtc,
        status: grn.status,
        locationId: grn.locationId,
        locationName: grn.locationId ? (locationMap.get(grn.locationId) || 'Central Warehouse') : 'Central Warehouse',
        totalAmountMinorUnits: grn.totalAmountMinorUnits,
        paidAmountMinorUnits: match.paidAmount,
        balanceDueMinorUnits: match.balanceDue,
        paymentStatus: match.paymentStatus,
        paymentMethod: match.paymentMethod,
        currencyCode: grn.currencyCode,
        notes: grn.notes,
        receivedBy: grn.receivedBy,
        createdAtUtc: grn.createdAtUtc,
        updatedAtUtc: grn.updatedAtUtc,
      };
    });
  }

  public async getGoodsReceipt(grnId: number): Promise<GoodsReceipt> {
    const dataSource = this.databaseService.getDataSource();
    const grnRepo = dataSource.getRepository(GoodsReceiptEntity);
    const lineRepo = dataSource.getRepository(GoodsReceiptLineEntity);
    const supplierRepo = dataSource.getRepository(SupplierEntity);
    const poRepo = dataSource.getRepository(PurchaseOrderEntity);
    const paymentRepo = dataSource.getRepository(SupplierPaymentEntity);
    const variantRepo = dataSource.getRepository(ProductVariantEntity);
    const productRepo = dataSource.getRepository(ProductEntity);
    const locationRepo = dataSource.getRepository(StockLocationEntity);

    const grn = await grnRepo.findOne({ where: { id: grnId } });
    if (!grn) throw new Error(`Goods receipt #${grnId} not found`);

    const supplier = await supplierRepo.findOne({ where: { id: grn.supplierId } });
    const po = grn.purchaseOrderId ? await poRepo.findOne({ where: { id: grn.purchaseOrderId } }) : null;
    const location = grn.locationId ? await locationRepo.findOne({ where: { id: grn.locationId } }) : null;
    const rawLines = await lineRepo.find({ where: { goodsReceiptId: grn.id } });

    // Calculate payments for this supplier using the same FIFO logic
    const allSupplierGrns = await grnRepo.find({
      where: { storeId: grn.storeId, supplierId: grn.supplierId, status: 'POSTED' },
      order: { id: 'ASC' },
    });
    const supPayments = await paymentRepo.find({
      where: { storeId: grn.storeId, supplierId: grn.supplierId },
    });

    const usedPaymentIds = new Set<number>();
    let thisGrnExplicitPaid = 0;
    let thisGrnMethod: string | undefined;

    for (const p of supPayments) {
      const isReferenced =
        (p.reference && (p.reference.includes(grn.grnNumber) || (grn.supplierInvoiceRef && p.reference.includes(grn.supplierInvoiceRef)))) ||
        (p.notes && (p.notes.includes(grn.grnNumber) || (grn.supplierInvoiceRef && p.notes.includes(grn.supplierInvoiceRef))));
      if (isReferenced && !usedPaymentIds.has(p.id)) {
        thisGrnExplicitPaid += p.amountMinorUnits;
        thisGrnMethod = p.paymentMethod;
        usedPaymentIds.add(p.id);
      }
    }

    // Allocate unallocated advance pool across older GRNs first
    let unallocatedPool = 0;
    let fallbackMethod: string | undefined;
    for (const p of supPayments) {
      if (!usedPaymentIds.has(p.id)) {
        unallocatedPool += p.amountMinorUnits;
        fallbackMethod = p.paymentMethod;
      }
    }

    let thisGrnPaid = thisGrnExplicitPaid;
    for (const otherGrn of allSupplierGrns) {
      if (otherGrn.id === grn.id) {
        if (thisGrnPaid < grn.totalAmountMinorUnits && unallocatedPool > 0) {
          const needed = grn.totalAmountMinorUnits - thisGrnPaid;
          const allocation = Math.min(needed, unallocatedPool);
          thisGrnPaid += allocation;
          unallocatedPool -= allocation;
          if (!thisGrnMethod) thisGrnMethod = fallbackMethod || 'ADVANCE_ADJUSTMENT';
        }
        break;
      } else {
        // deduct what other older GRNs consumed from the pool
        let otherExplicit = 0;
        for (const p of supPayments) {
          if (
            !usedPaymentIds.has(p.id) &&
            ((p.reference && p.reference.includes(otherGrn.grnNumber)) ||
             (p.notes && p.notes.includes(otherGrn.grnNumber)))
          ) {
            otherExplicit += p.amountMinorUnits;
            usedPaymentIds.add(p.id);
          }
        }
        const otherRemaining = Math.max(0, otherGrn.totalAmountMinorUnits - otherExplicit);
        const otherAllocated = Math.min(otherRemaining, unallocatedPool);
        unallocatedPool -= otherAllocated;
      }
    }

    const balanceDue = Math.max(0, grn.totalAmountMinorUnits - thisGrnPaid);
    let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
    if (thisGrnPaid >= grn.totalAmountMinorUnits) {
      paymentStatus = 'PAID';
    } else if (thisGrnPaid > 0) {
      paymentStatus = 'PARTIAL';
    }

    const lines: GoodsReceiptLine[] = [];
    for (const line of rawLines) {
      const variant = await variantRepo.findOne({ where: { id: line.productVariantId } });
      const product = variant ? await productRepo.findOne({ where: { id: variant.productId } }) : null;

      lines.push({
        id: line.id,
        goodsReceiptId: line.goodsReceiptId,
        poLineId: line.poLineId,
        productVariantId: line.productVariantId,
        productName: product?.name ?? variant?.name ?? 'Unknown Product',
        sku: variant?.sku ?? '',
        receivedQuantity: line.receivedQuantity,
        unitCode: line.unitCode,
        unitCostMinorUnits: line.unitCostMinorUnits,
        salePriceMinorUnits: variant?.priceMinorUnits ?? 0,
        totalCostMinorUnits: line.totalCostMinorUnits,
        lotNumber: line.lotNumber,
        expiryDateUtc: line.expiryDateUtc,
        stockLocationId: line.stockLocationId,
      });
    }

    return {
      id: grn.id,
      storeId: grn.storeId,
      grnNumber: grn.grnNumber,
      purchaseOrderId: grn.purchaseOrderId,
      poNumber: po?.poNumber ?? null,
      supplierId: grn.supplierId,
      supplierName: supplier?.name ?? 'Unknown Supplier',
      locationId: grn.locationId ?? undefined,
      locationName: location?.name ?? undefined,
      supplierInvoiceRef: grn.supplierInvoiceRef,
      receivedDateUtc: grn.receivedDateUtc,
      status: grn.status,
      totalAmountMinorUnits: grn.totalAmountMinorUnits,
      paidAmountMinorUnits: thisGrnPaid,
      balanceDueMinorUnits: balanceDue,
      paymentStatus,
      paymentMethod: thisGrnMethod,
      currencyCode: grn.currencyCode,
      notes: grn.notes,
      receivedBy: grn.receivedBy,
      createdAtUtc: grn.createdAtUtc,
      updatedAtUtc: grn.updatedAtUtc,
      lines,
    };
  }

  public async postGoodsReceipt(input: PostGoodsReceiptInput): Promise<GoodsReceipt> {
    const dataSource = this.databaseService.getDataSource();
    const now = nowUtcString();

    return await dataSource.transaction(async (manager) => {
      const grnRepo = manager.getRepository(GoodsReceiptEntity);
      const lineRepo = manager.getRepository(GoodsReceiptLineEntity);
      const poRepo = manager.getRepository(PurchaseOrderEntity);
      const poLineRepo = manager.getRepository(PurchaseOrderLineEntity);
      const supplierRepo = manager.getRepository(SupplierEntity);
      const variantRepo = manager.getRepository(ProductVariantEntity);
      const lotRepo = manager.getRepository(InventoryLotEntity);
      const locationRepo = manager.getRepository(StockLocationEntity);
      const movementRepo = manager.getRepository(StockMovementEntity);

      // 1. Validate Supplier
      const supplier = await supplierRepo.findOne({ where: { id: input.supplierId } });
      if (!supplier) throw new Error(`Supplier #${input.supplierId} not found`);

      // 2. Stock Location Selection (WH-MAIN Central Warehouse by default, or SR-MAIN Showroom, or custom)
      let location: StockLocationEntity | null = null;
      if (input.stockLocationId) {
        location = await locationRepo.findOne({ where: { id: input.stockLocationId } });
      }
      if (!location) {
        location = await locationRepo.findOne({ where: { storeId: input.storeId, code: 'WH-MAIN' } });
      }
      if (!location) {
        location = await locationRepo.findOne({ where: { storeId: input.storeId, code: 'MAIN_STORAGE' } });
      }
      if (!location) {
        location = await locationRepo.findOne({ where: { storeId: input.storeId } });
      }
      if (!location) {
        location = locationRepo.create({
          storeId: input.storeId,
          code: 'WH-MAIN',
          name: 'Central Warehouse (WH-MAIN)',
          locationType: 'warehouse',
          isActive: true,
          createdAtUtc: now,
          updatedAtUtc: now,
        });
        location = await locationRepo.save(location);
      }

      // 3. Generate sequential GRN number: GRN-YYYYMMDD-XXXX
      const datePart = now.slice(0, 10).replace(/-/g, '');
      const count = await grnRepo.count({ where: { storeId: input.storeId } });
      const grnNumber = `GRN-${datePart}-${String(count + 1).padStart(4, '0')}`;

      // 4. Calculate total amount
      let totalAmount = 0;
      for (const line of input.lines) {
        if (line.receivedQuantity <= 0) {
          throw new Error(`Received quantity must be greater than zero`);
        }
        totalAmount += line.receivedQuantity * line.unitCostMinorUnits;
      }

      // 5. Create GoodsReceipt
      const grnEntity = grnRepo.create({
        storeId: input.storeId,
        grnNumber,
        purchaseOrderId: input.purchaseOrderId ?? null,
        supplierId: input.supplierId,
        locationId: location.id,
        supplierInvoiceRef: input.supplierInvoiceRef.trim(),
        receivedDateUtc: input.receivedDateUtc ?? now,
        status: 'POSTED',
        paymentStatus: 'UNPAID',
        totalAmountMinorUnits: totalAmount,
        currencyCode: 'PKR',
        notes: input.notes ?? null,
        receivedBy: input.receivedBy ?? 'STAFF',
        createdAtUtc: now,
        updatedAtUtc: now,
      });
      const savedGrn = await grnRepo.save(grnEntity);

      // 6. Process each received line
      const createdLines: GoodsReceiptLine[] = [];

      for (const line of input.lines) {
        const variant = await variantRepo.findOne({ where: { id: line.productVariantId } });
        if (!variant) throw new Error(`Variant #${line.productVariantId} not found`);

        // Sync variant sale price if specified in purchase invoice, and update buy cost
        let variantChanged = false;
        if (line.newSalePriceMinorUnits && line.newSalePriceMinorUnits > 0) {
          variant.priceMinorUnits = line.newSalePriceMinorUnits;
          variantChanged = true;
        }
        if (line.unitCostMinorUnits > 0) {
          variant.costMinorUnits = line.unitCostMinorUnits;
          variantChanged = true;
        }
        if (variantChanged) {
          variant.updatedAtUtc = now;
          await variantRepo.save(variant);
        }

        const lineTotal = line.receivedQuantity * line.unitCostMinorUnits;
        const targetLocationId = line.stockLocationId ?? location.id;

        const lineEntity = lineRepo.create({
          goodsReceiptId: savedGrn.id,
          poLineId: line.poLineId ?? null,
          productVariantId: variant.id,
          receivedQuantity: line.receivedQuantity,
          unitCode: line.unitCode,
          unitCostMinorUnits: line.unitCostMinorUnits,
          totalCostMinorUnits: lineTotal,
          lotNumber: line.lotNumber?.trim() || null,
          expiryDateUtc: line.expiryDateUtc || null,
          stockLocationId: targetLocationId,
        });
        const savedLine = await lineRepo.save(lineEntity);

        // 7. Track Lots & Expiry if lot specified
        if (line.lotNumber?.trim()) {
          const lotEntity = lotRepo.create({
            storeId: input.storeId,
            productVariantId: variant.id,
            lotNumber: line.lotNumber.trim(),
            supplierId: input.supplierId,
            manufactureDateUtc: null,
            expiryDateUtc: line.expiryDateUtc || null,
            unitCostMinorUnits: line.unitCostMinorUnits,
            initialQuantity: line.receivedQuantity,
            currentQuantity: line.receivedQuantity,
            createdAtUtc: now,
          });
          await lotRepo.save(lotEntity);
        }

        // 8. Immutable stock movement ledger entry (POSITIVE for purchase receipt)
        if (variant.itemId) {
          const movement = movementRepo.create({
            storeId: input.storeId,
            itemId: variant.itemId,
            locationId: targetLocationId,
            signedBaseQuantity: line.receivedQuantity,
            movementType: 'PURCHASE_RECEIPT',
            sourceType: 'GOODS_RECEIPT',
            sourceId: savedGrn.grnNumber,
            sourceLineId: String(savedLine.id),
            costPerUnitMinorUnits: line.unitCostMinorUnits,
            actorId: input.receivedBy ?? 'STAFF',
            idempotencyKey: `GRN-${savedGrn.id}-${savedLine.id}`,
            createdAtUtc: now,
          });
          await movementRepo.save(movement);
        }

        // 9. If linked to a PO line, update received quantity
        if (line.poLineId) {
          const poLine = await poLineRepo.findOne({ where: { id: line.poLineId } });
          if (poLine) {
            poLine.receivedQuantity += line.receivedQuantity;
            await poLineRepo.save(poLine);
          }
        }

        createdLines.push({
          id: savedLine.id,
          goodsReceiptId: savedLine.goodsReceiptId,
          poLineId: savedLine.poLineId,
          productVariantId: savedLine.productVariantId,
          productName: variant.name,
          sku: variant.sku,
          receivedQuantity: savedLine.receivedQuantity,
          unitCode: savedLine.unitCode,
          unitCostMinorUnits: savedLine.unitCostMinorUnits,
          salePriceMinorUnits: variant.priceMinorUnits,
          totalCostMinorUnits: savedLine.totalCostMinorUnits,
          lotNumber: savedLine.lotNumber,
          expiryDateUtc: savedLine.expiryDateUtc,
          stockLocationId: savedLine.stockLocationId,
        });
      }

      // 10. Update PO status if linked
      if (input.purchaseOrderId) {
        const po = await poRepo.findOne({ where: { id: input.purchaseOrderId } });
        if (po) {
          const allPoLines = await poLineRepo.find({ where: { purchaseOrderId: po.id } });
          const totalOrdered = allPoLines.reduce((sum, l) => sum + l.orderedQuantity, 0);
          const totalReceived = allPoLines.reduce((sum, l) => sum + l.receivedQuantity, 0);

          if (totalReceived >= totalOrdered) {
            po.status = 'RECEIVED';
          } else if (totalReceived > 0) {
            po.status = 'PARTIALLY_RECEIVED';
          }
          po.updatedAtUtc = now;
          await poRepo.save(po);
        }
      }

      // 11. Update Supplier Outstanding Balance
      supplier.outstandingBalanceMinorUnits = (supplier.outstandingBalanceMinorUnits || 0) + totalAmount;
      supplier.updatedAtUtc = now;
      await supplierRepo.save(supplier);

      return {
        id: savedGrn.id,
        storeId: savedGrn.storeId,
        grnNumber: savedGrn.grnNumber,
        purchaseOrderId: savedGrn.purchaseOrderId,
        supplierId: savedGrn.supplierId,
        supplierName: supplier.name,
        locationId: location.id,
        locationName: location.name,
        supplierInvoiceRef: savedGrn.supplierInvoiceRef,
        receivedDateUtc: savedGrn.receivedDateUtc,
        status: savedGrn.status,
        paymentStatus: 'UNPAID',
        totalAmountMinorUnits: savedGrn.totalAmountMinorUnits,
        paidAmountMinorUnits: 0,
        balanceDueMinorUnits: savedGrn.totalAmountMinorUnits,
        currencyCode: savedGrn.currencyCode,
        notes: savedGrn.notes,
        receivedBy: savedGrn.receivedBy,
        createdAtUtc: savedGrn.createdAtUtc,
        updatedAtUtc: savedGrn.updatedAtUtc,
        lines: createdLines,
      };
    });
  }

  public async updateGoodsReceipt(input: UpdateGoodsReceiptInput): Promise<GoodsReceipt> {
    const dataSource = this.databaseService.getDataSource();
    const now = nowUtcString();

    return await dataSource.transaction(async (manager) => {
      const grnRepo = manager.getRepository(GoodsReceiptEntity);
      const lineRepo = manager.getRepository(GoodsReceiptLineEntity);
      const supplierRepo = manager.getRepository(SupplierEntity);
      const variantRepo = manager.getRepository(ProductVariantEntity);
      const lotRepo = manager.getRepository(InventoryLotEntity);
      const locationRepo = manager.getRepository(StockLocationEntity);
      const movementRepo = manager.getRepository(StockMovementEntity);
      const paymentRepo = manager.getRepository(SupplierPaymentEntity);

      // 1. Locate the existing GRN
      const grn = await grnRepo.findOne({ where: { id: input.grnId, storeId: input.storeId } });
      if (!grn) {
        throw new Error(`Goods receipt #${input.grnId} not found`);
      }

      // 2. Guard: Must not be already paid or partially paid
      // Check explicit payments referencing this GRN
      const allSupplierPayments = await paymentRepo.find({ where: { storeId: input.storeId, supplierId: grn.supplierId } });
      for (const p of allSupplierPayments) {
        const isReferenced =
          (p.reference && (p.reference.includes(grn.grnNumber) || (grn.supplierInvoiceRef && p.reference.includes(grn.supplierInvoiceRef)))) ||
          (p.notes && (p.notes.includes(grn.grnNumber) || (grn.supplierInvoiceRef && p.notes.includes(grn.supplierInvoiceRef))));
        if (isReferenced) {
          throw new Error(`Cannot edit ${grn.grnNumber} because payment '${p.paymentNumber}' has already been recorded against it.`);
        }
      }

      // 3. Validate Supplier
      const supplier = await supplierRepo.findOne({ where: { id: input.supplierId } });
      if (!supplier) throw new Error(`Supplier #${input.supplierId} not found`);

      // 4. Default Location for Stock
      let location = await locationRepo.findOne({ where: { storeId: input.storeId, code: 'MAIN_STORAGE' } });
      if (!location) {
        location = await locationRepo.findOne({ where: { storeId: input.storeId } });
      }
      if (!location) {
        location = locationRepo.create({
          storeId: input.storeId,
          code: 'MAIN_STORAGE',
          name: 'Main Storage Room',
          locationType: 'store',
          isActive: true,
          createdAtUtc: now,
          updatedAtUtc: now,
        });
        location = await locationRepo.save(location);
      }

      // 5. Reconcile previous stock ledger entries by posting offset reversals
      const oldLines = await lineRepo.find({ where: { goodsReceiptId: grn.id } });
      for (const oldLine of oldLines) {
        const oldVariant = await variantRepo.findOne({ where: { id: oldLine.productVariantId } });
        if (oldVariant?.itemId) {
          // Negative signedBaseQuantity to reverse previous stock addition
          const reversalMovement = movementRepo.create({
            storeId: input.storeId,
            itemId: oldVariant.itemId,
            locationId: oldLine.stockLocationId || location.id,
            signedBaseQuantity: -oldLine.receivedQuantity,
            movementType: 'PURCHASE_RECEIPT',
            sourceType: 'GOODS_RECEIPT_CORRECTION',
            sourceId: grn.grnNumber,
            sourceLineId: String(oldLine.id),
            costPerUnitMinorUnits: oldLine.unitCostMinorUnits,
            actorId: input.receivedBy ?? 'STAFF',
            idempotencyKey: `GRN-REV-${grn.id}-${oldLine.id}-${Date.now()}`,
            createdAtUtc: now,
          });
          await movementRepo.save(reversalMovement);
        }

        // Delete old lot tracking if lot was generated from this line
        if (oldLine.lotNumber?.trim()) {
          await lotRepo.delete({
            storeId: input.storeId,
            productVariantId: oldLine.productVariantId,
            lotNumber: oldLine.lotNumber.trim(),
          });
        }
      }

      // 6. Delete old GRN lines
      await lineRepo.delete({ goodsReceiptId: grn.id });

      // 7. Calculate new total amount
      let totalAmount = 0;
      for (const line of input.lines) {
        if (line.receivedQuantity <= 0) {
          throw new Error('Received quantity must be greater than zero');
        }
        totalAmount += line.receivedQuantity * line.unitCostMinorUnits;
      }

      // 8. Update GRN header
      grn.supplierId = input.supplierId;
      grn.supplierInvoiceRef = input.supplierInvoiceRef.trim();
      grn.totalAmountMinorUnits = totalAmount;
      if (input.receivedDateUtc) {
        grn.receivedDateUtc = input.receivedDateUtc;
      }
      grn.notes = input.notes ?? null;
      grn.updatedAtUtc = now;
      const updatedGrn = await grnRepo.save(grn);

      // 9. Process and create updated lines & stock movements
      const createdLines: GoodsReceiptLine[] = [];

      for (const line of input.lines) {
        const variant = await variantRepo.findOne({ where: { id: line.productVariantId } });
        if (!variant) throw new Error(`Variant #${line.productVariantId} not found`);

        let variantChanged = false;
        if (line.newSalePriceMinorUnits && line.newSalePriceMinorUnits > 0) {
          variant.priceMinorUnits = line.newSalePriceMinorUnits;
          variantChanged = true;
        }
        if (line.unitCostMinorUnits > 0) {
          variant.costMinorUnits = line.unitCostMinorUnits;
          variantChanged = true;
        }
        if (variantChanged) {
          variant.updatedAtUtc = now;
          await variantRepo.save(variant);
        }

        const lineTotal = line.receivedQuantity * line.unitCostMinorUnits;
        const targetLocationId = line.stockLocationId ?? location.id;

        const lineEntity = lineRepo.create({
          goodsReceiptId: updatedGrn.id,
          poLineId: line.poLineId ?? null,
          productVariantId: variant.id,
          receivedQuantity: line.receivedQuantity,
          unitCode: line.unitCode,
          unitCostMinorUnits: line.unitCostMinorUnits,
          totalCostMinorUnits: lineTotal,
          lotNumber: line.lotNumber?.trim() || null,
          expiryDateUtc: line.expiryDateUtc || null,
          stockLocationId: targetLocationId,
        });
        const savedLine = await lineRepo.save(lineEntity);

        if (line.lotNumber?.trim()) {
          const lotEntity = lotRepo.create({
            storeId: input.storeId,
            productVariantId: variant.id,
            lotNumber: line.lotNumber.trim(),
            supplierId: input.supplierId,
            manufactureDateUtc: null,
            expiryDateUtc: line.expiryDateUtc || null,
            unitCostMinorUnits: line.unitCostMinorUnits,
            initialQuantity: line.receivedQuantity,
            currentQuantity: line.receivedQuantity,
            createdAtUtc: now,
          });
          await lotRepo.save(lotEntity);
        }

        if (variant.itemId) {
          const movement = movementRepo.create({
            storeId: input.storeId,
            itemId: variant.itemId,
            locationId: targetLocationId,
            signedBaseQuantity: line.receivedQuantity,
            movementType: 'PURCHASE_RECEIPT',
            sourceType: 'GOODS_RECEIPT',
            sourceId: updatedGrn.grnNumber,
            sourceLineId: String(savedLine.id),
            costPerUnitMinorUnits: line.unitCostMinorUnits,
            actorId: input.receivedBy ?? 'STAFF',
            idempotencyKey: `GRN-UPD-${updatedGrn.id}-${savedLine.id}-${Date.now()}`,
            createdAtUtc: now,
          });
          await movementRepo.save(movement);
        }

        createdLines.push({
          id: savedLine.id,
          goodsReceiptId: savedLine.goodsReceiptId,
          poLineId: savedLine.poLineId,
          productVariantId: savedLine.productVariantId,
          receivedQuantity: savedLine.receivedQuantity,
          unitCode: savedLine.unitCode,
          unitCostMinorUnits: savedLine.unitCostMinorUnits,
          totalCostMinorUnits: savedLine.totalCostMinorUnits,
          lotNumber: savedLine.lotNumber,
          expiryDateUtc: savedLine.expiryDateUtc,
          stockLocationId: savedLine.stockLocationId,
        });
      }

      return {
        id: updatedGrn.id,
        storeId: updatedGrn.storeId,
        grnNumber: updatedGrn.grnNumber,
        purchaseOrderId: updatedGrn.purchaseOrderId,
        supplierId: updatedGrn.supplierId,
        supplierName: supplier.name,
        supplierInvoiceRef: updatedGrn.supplierInvoiceRef,
        receivedDateUtc: updatedGrn.receivedDateUtc,
        status: updatedGrn.status,
        totalAmountMinorUnits: updatedGrn.totalAmountMinorUnits,
        currencyCode: updatedGrn.currencyCode,
        notes: updatedGrn.notes,
        receivedBy: updatedGrn.receivedBy,
        createdAtUtc: updatedGrn.createdAtUtc,
        updatedAtUtc: updatedGrn.updatedAtUtc,
        lines: createdLines,
      };
    });
  }
}
