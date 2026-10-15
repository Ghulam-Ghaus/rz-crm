import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  PurchaseReturnEntity,
  PurchaseReturnLineEntity,
  SupplierEntity,
  GoodsReceiptEntity,
  StockMovementEntity,
  StockLocationEntity,
  ProductVariantEntity,
} from '@rz-crm/database';
import {
  PurchaseReturn,
  PostPurchaseReturnInput,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class PurchaseReturnsService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getPurchaseReturns(storeId: number): Promise<PurchaseReturn[]> {
    const ds = this.databaseService.getDataSource();
    const retRepo = ds.getRepository(PurchaseReturnEntity);
    const supplierRepo = ds.getRepository(SupplierEntity);
    const lineRepo = ds.getRepository(PurchaseReturnLineEntity);
    const variantRepo = ds.getRepository(ProductVariantEntity);
    const locationRepo = ds.getRepository(StockLocationEntity);

    const returns = await retRepo.find({
      where: { storeId },
      order: { id: 'DESC' },
    });

    const lines = await lineRepo.find();
    const linesByReturn = new Map<number, PurchaseReturnLineEntity[]>();
    for (const l of lines) {
      if (!linesByReturn.has(l.purchaseReturnId)) linesByReturn.set(l.purchaseReturnId, []);
      linesByReturn.get(l.purchaseReturnId)!.push(l);
    }
    for (const r of returns) {
      r.lines = linesByReturn.get(r.id) || [];
    }

    const suppliers = await supplierRepo.find({ where: { storeId } });
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

    const variants = await variantRepo.find();
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const locations = await locationRepo.find({ where: { storeId } });
    const locationMap = new Map(locations.map((l) => [l.id, l.name]));

    return returns.map((r) => this.mapToDto(r, supplierMap.get(r.supplierId), variantMap, locationMap));
  }

  public async getPurchaseReturnDetail(id: number): Promise<PurchaseReturn> {
    const ds = this.databaseService.getDataSource();
    const retRepo = ds.getRepository(PurchaseReturnEntity);
    const lineRepo = ds.getRepository(PurchaseReturnLineEntity);
    const supplierRepo = ds.getRepository(SupplierEntity);
    const variantRepo = ds.getRepository(ProductVariantEntity);
    const locationRepo = ds.getRepository(StockLocationEntity);

    const ret = await retRepo.findOne({
      where: { id },
    });

    if (!ret) {
      throw new NotFoundException(`Purchase Return with ID ${id} not found`);
    }

    ret.lines = await lineRepo.find({ where: { purchaseReturnId: ret.id } });

    const supplier = await supplierRepo.findOne({ where: { id: ret.supplierId } });
    const variants = await variantRepo.find();
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const locations = await locationRepo.find({ where: { storeId: ret.storeId } });
    const locationMap = new Map(locations.map((l) => [l.id, l.name]));

    return this.mapToDto(ret, supplier?.name, variantMap, locationMap);
  }

  public async postPurchaseReturn(storeId: number, input: PostPurchaseReturnInput): Promise<PurchaseReturn> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const returnRepo = manager.getRepository(PurchaseReturnEntity);
      const lineRepo = manager.getRepository(PurchaseReturnLineEntity);
      const supplierRepo = manager.getRepository(SupplierEntity);
      const grnRepo = manager.getRepository(GoodsReceiptEntity);
      const movementRepo = manager.getRepository(StockMovementEntity);
      const locationRepo = manager.getRepository(StockLocationEntity);
      const variantRepo = manager.getRepository(ProductVariantEntity);

      const now = nowUtcString();

      // 1. Validate Supplier
      const supplier = await supplierRepo.findOne({ where: { id: input.supplierId } });
      if (!supplier) {
        throw new BadRequestException(`Supplier with ID ${input.supplierId} not found`);
      }

      // 2. Validate GRN if specified
      let grn: GoodsReceiptEntity | null = null;
      if (input.goodsReceiptId) {
        grn = await grnRepo.findOne({ where: { id: input.goodsReceiptId } });
      }

      // 3. Generate Debit Note Number: DBN-YYYYMMDD-XXXX
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await returnRepo
        .createQueryBuilder('pr')
        .where('pr.store_id = :storeId', { storeId })
        .andWhere('pr.created_at_utc LIKE :pattern', { pattern: `${new Date().toISOString().slice(0, 10)}%` })
        .getCount();

      const sequence = String(countToday + 1).padStart(4, '0');
      const returnNumber = `DBN-${datePrefix}-${sequence}`;

      // 4. Create Master Purchase Return Record
      const purchaseReturn = returnRepo.create({
        storeId,
        returnNumber,
        supplierId: supplier.id,
        goodsReceiptId: grn?.id ?? input.goodsReceiptId ?? null,
        supplierInvoiceRef: input.supplierInvoiceRef ?? grn?.supplierInvoiceRef ?? null,
        returnDateUtc: now,
        reason: input.reason,
        settlementMethod: input.settlementMethod,
        totalAmountMinorUnits: input.totalAmountMinorUnits,
        refundAmountMinorUnits: input.refundAmountMinorUnits,
        status: 'COMPLETED',
        processedBy: input.processedBy || 'admin',
        notes: input.notes ?? null,
        createdAtUtc: now,
        updatedAtUtc: now,
      });

      const savedReturn = await returnRepo.save(purchaseReturn);

      // Default warehouse location for deducting stock
      const defaultLoc = await locationRepo.findOne({ where: { code: 'WH-MAIN' } }) ||
                         await locationRepo.findOne({ where: { storeId } });
      const defaultLocId = defaultLoc ? defaultLoc.id : 1;

      const createdLines: PurchaseReturnLineEntity[] = [];

      // 5. Process Line Items & Deduct Stock Movement
      for (const itemInput of input.lines) {
        const sourceLocId = itemInput.sourceLocationId || defaultLocId;
        const line = lineRepo.create({
          purchaseReturnId: savedReturn.id,
          grnLineId: itemInput.grnLineId ?? null,
          productVariantId: itemInput.productVariantId,
          quantity: itemInput.quantity,
          unitCode: itemInput.unitCode || 'pcs',
          unitCostMinorUnits: itemInput.unitCostMinorUnits,
          totalCostMinorUnits: itemInput.unitCostMinorUnits * itemInput.quantity,
          sourceLocationId: sourceLocId,
          lotNumber: itemInput.lotNumber ?? null,
          reason: itemInput.reason ?? null,
          createdAtUtc: now,
        });

        const savedLine = await lineRepo.save(line);
        createdLines.push(savedLine);

        // Deduct stock from the source location
        const variant = await variantRepo.findOne({ where: { id: itemInput.productVariantId } });
        if (variant?.itemId) {
          const movement = movementRepo.create({
            storeId,
            itemId: variant.itemId,
            locationId: sourceLocId,
            signedBaseQuantity: -itemInput.quantity, // Negative: reducing stock from inventory
            movementType: 'PURCHASE_RETURN',
            sourceType: 'PURCHASE_RETURN',
            sourceId: savedReturn.returnNumber,
            sourceLineId: String(savedLine.id),
            costPerUnitMinorUnits: itemInput.unitCostMinorUnits,
            actorId: input.processedBy || 'admin',
            idempotencyKey: `PR-OUT-${savedReturn.id}-${savedLine.id}`,
            createdAtUtc: now,
          });
          await movementRepo.save(movement);
        }
      }

      // 6. Financial Settlement Resolution (Debit Note)
      if (input.refundAmountMinorUnits > 0 && input.settlementMethod === 'DEBIT_NOTE') {
        supplier.outstandingBalanceMinorUnits = (supplier.outstandingBalanceMinorUnits || 0) - input.refundAmountMinorUnits;
        supplier.updatedAtUtc = now;
        await supplierRepo.save(supplier);
      }

      savedReturn.lines = createdLines;

      const variants = await variantRepo.find();
      const variantMap = new Map(variants.map((v) => [v.id, v]));
      const locations = await locationRepo.find({ where: { storeId } });
      const locationMap = new Map(locations.map((l) => [l.id, l.name]));

      return this.mapToDto(savedReturn, supplier.name, variantMap, locationMap);
    });
  }

  private mapToDto(
    entity: PurchaseReturnEntity,
    supplierName?: string,
    variantMap?: Map<number, ProductVariantEntity>,
    locationMap?: Map<number, string>,
  ): PurchaseReturn {
    return {
      id: entity.id,
      storeId: entity.storeId,
      returnNumber: entity.returnNumber,
      supplierId: entity.supplierId,
      supplierName: supplierName,
      goodsReceiptId: entity.goodsReceiptId,
      supplierInvoiceRef: entity.supplierInvoiceRef,
      returnDateUtc: entity.returnDateUtc,
      reason: entity.reason,
      settlementMethod: entity.settlementMethod,
      totalAmountMinorUnits: entity.totalAmountMinorUnits,
      refundAmountMinorUnits: entity.refundAmountMinorUnits,
      status: entity.status,
      processedBy: entity.processedBy,
      notes: entity.notes,
      createdAtUtc: entity.createdAtUtc,
      updatedAtUtc: entity.updatedAtUtc,
      lines: entity.lines?.map((line) => {
        const variant = variantMap?.get(line.productVariantId);
        return {
          id: line.id,
          purchaseReturnId: line.purchaseReturnId,
          grnLineId: line.grnLineId,
          productVariantId: line.productVariantId,
          productName: variant?.name,
          sku: variant?.sku,
          quantity: line.quantity,
          unitCode: line.unitCode,
          unitCostMinorUnits: line.unitCostMinorUnits,
          totalCostMinorUnits: line.totalCostMinorUnits,
          sourceLocationId: line.sourceLocationId,
          sourceLocationName: locationMap?.get(line.sourceLocationId),
          lotNumber: line.lotNumber,
          reason: line.reason,
          createdAtUtc: line.createdAtUtc,
        };
      }) ?? [],
    };
  }
}
