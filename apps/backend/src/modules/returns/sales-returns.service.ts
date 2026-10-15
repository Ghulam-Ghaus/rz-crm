import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  SalesReturnEntity,
  SalesReturnLineEntity,
  SaleEntity,
  CustomerEntity,
  ShiftEntity,
  CashTransactionEntity,
  StockMovementEntity,
  StockLocationEntity,
  ProductVariantEntity,
} from '@rz-crm/database';
import {
  SalesReturn,
  PostSalesReturnInput,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class SalesReturnsService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getSalesReturns(storeId: number): Promise<SalesReturn[]> {
    const ds = this.databaseService.getDataSource();
    const retRepo = ds.getRepository(SalesReturnEntity);
    const lineRepo = ds.getRepository(SalesReturnLineEntity);

    const returns = await retRepo.find({
      where: { storeId },
      order: { id: 'DESC' },
    });

    const lines = await lineRepo.find();
    const linesByReturn = new Map<number, SalesReturnLineEntity[]>();
    for (const l of lines) {
      if (!linesByReturn.has(l.salesReturnId)) linesByReturn.set(l.salesReturnId, []);
      linesByReturn.get(l.salesReturnId)!.push(l);
    }
    for (const r of returns) {
      r.lines = linesByReturn.get(r.id) || [];
    }

    const variantRepo = ds.getRepository(ProductVariantEntity);
    const locationRepo = ds.getRepository(StockLocationEntity);
    const variants = await variantRepo.find();
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const locations = await locationRepo.find({ where: { storeId } });
    const locationMap = new Map(locations.map((l) => [l.id, l.name]));

    return returns.map((r) => this.mapToDto(r, variantMap, locationMap));
  }

  public async getSalesReturnDetail(id: number): Promise<SalesReturn> {
    const ds = this.databaseService.getDataSource();
    const retRepo = ds.getRepository(SalesReturnEntity);
    const lineRepo = ds.getRepository(SalesReturnLineEntity);

    const ret = await retRepo.findOne({
      where: { id },
    });

    if (!ret) {
      throw new NotFoundException(`Sales Return with ID ${id} not found`);
    }

    ret.lines = await lineRepo.find({ where: { salesReturnId: ret.id } });

    const variantRepo = ds.getRepository(ProductVariantEntity);
    const locationRepo = ds.getRepository(StockLocationEntity);
    const variants = await variantRepo.find();
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const locations = await locationRepo.find({ where: { storeId: ret.storeId } });
    const locationMap = new Map(locations.map((l) => [l.id, l.name]));

    return this.mapToDto(ret, variantMap, locationMap);
  }

  public async postSalesReturn(storeId: number, input: PostSalesReturnInput): Promise<SalesReturn> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const returnRepo = manager.getRepository(SalesReturnEntity);
      const lineRepo = manager.getRepository(SalesReturnLineEntity);
      const saleRepo = manager.getRepository(SaleEntity);
      const customerRepo = manager.getRepository(CustomerEntity);
      const shiftRepo = manager.getRepository(ShiftEntity);
      const cashTxRepo = manager.getRepository(CashTransactionEntity);
      const movementRepo = manager.getRepository(StockMovementEntity);
      const locationRepo = manager.getRepository(StockLocationEntity);
      const variantRepo = manager.getRepository(ProductVariantEntity);

      const now = nowUtcString();

      // 1. Generate Return / Credit Note Number: CRN-YYYYMMDD-XXXX
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await returnRepo
        .createQueryBuilder('sr')
        .where('sr.store_id = :storeId', { storeId })
        .andWhere('sr.created_at_utc LIKE :pattern', { pattern: `${new Date().toISOString().slice(0, 10)}%` })
        .getCount();

      const sequence = String(countToday + 1).padStart(4, '0');
      const returnNumber = `CRN-${datePrefix}-${sequence}`;

      // 2. Validate original sale if provided
      let originalSale: SaleEntity | null = null;
      if (input.saleId) {
        originalSale = await saleRepo.findOne({ where: { id: input.saleId } });
      }

      // 3. Customer resolution
      let customer: CustomerEntity | null = null;
      if (input.customerId) {
        customer = await customerRepo.findOne({ where: { id: input.customerId } });
      } else if (originalSale?.customerId) {
        customer = await customerRepo.findOne({ where: { id: originalSale.customerId } });
      }

      // 4. Create Master Sales Return Record
      const salesReturn = returnRepo.create({
        storeId,
        returnNumber,
        saleId: originalSale?.id ?? input.saleId ?? null,
        customerId: customer?.id ?? input.customerId ?? null,
        customerName: customer?.name ?? input.customerName ?? originalSale?.customerName ?? null,
        returnDateUtc: now,
        reason: input.reason,
        refundMethod: input.refundMethod,
        totalAmountMinorUnits: input.totalAmountMinorUnits,
        refundAmountMinorUnits: input.refundAmountMinorUnits,
        status: 'COMPLETED',
        processedBy: input.processedBy || 'admin',
        notes: input.notes ?? null,
        createdAtUtc: now,
        updatedAtUtc: now,
      });

      const savedReturn = await returnRepo.save(salesReturn);

      // Default location for restock
      const defaultLoc = await locationRepo.findOne({ where: { code: 'SR-MAIN' } }) ||
                         await locationRepo.findOne({ where: { storeId } });
      const defaultLocId = defaultLoc ? defaultLoc.id : 1;

      const createdLines: SalesReturnLineEntity[] = [];

      // 5. Process Line Items & Stock Restock Movements
      for (const itemInput of input.lines) {
        const targetLocId = itemInput.targetLocationId || defaultLocId;
        const line = lineRepo.create({
          salesReturnId: savedReturn.id,
          saleItemId: itemInput.saleItemId ?? null,
          productVariantId: itemInput.productVariantId,
          quantity: itemInput.quantity,
          unitCode: itemInput.unitCode || 'pcs',
          unitPriceMinorUnits: itemInput.unitPriceMinorUnits,
          totalPriceMinorUnits: itemInput.unitPriceMinorUnits * itemInput.quantity,
          condition: itemInput.condition || 'RESTOCK',
          targetLocationId: targetLocId,
          reason: itemInput.reason ?? null,
          createdAtUtc: now,
        });

        const savedLine = await lineRepo.save(line);
        createdLines.push(savedLine);

        // If condition is RESTOCK, restore stock back to the target location
        if (itemInput.condition === 'RESTOCK') {
          const variant = await variantRepo.findOne({ where: { id: itemInput.productVariantId } });
          if (variant?.itemId) {
            const movement = movementRepo.create({
              storeId,
              itemId: variant.itemId,
              locationId: targetLocId,
              signedBaseQuantity: itemInput.quantity, // Positive: adding back to stock!
              movementType: 'SALE_REFUND',
              sourceType: 'SALES_RETURN',
              sourceId: savedReturn.returnNumber,
              sourceLineId: String(savedLine.id),
              costPerUnitMinorUnits: variant.costMinorUnits ?? null,
              actorId: input.processedBy || 'admin',
              idempotencyKey: `SR-RESTOCK-${savedReturn.id}-${savedLine.id}`,
              createdAtUtc: now,
            });
            await movementRepo.save(movement);
          }
        }
      }

      // 6. Financial Settlement Resolution
      if (input.refundAmountMinorUnits > 0) {
        if (input.refundMethod === 'CREDIT_NOTE') {
          // Deduct from customer's outstanding balance
          if (customer) {
            customer.outstandingBalanceMinorUnits = (customer.outstandingBalanceMinorUnits || 0) - input.refundAmountMinorUnits;
            customer.updatedAtUtc = now;
            await customerRepo.save(customer);
          }
        } else if (input.refundMethod === 'CASH_REFUND') {
          // Cash drawer payout
          const shift = await shiftRepo.findOne({ where: { storeId, status: 'open' } });
          if (shift) {
            shift.expectedCashMinorUnits = Math.max(0, (shift.expectedCashMinorUnits || 0) - input.refundAmountMinorUnits);
            await shiftRepo.save(shift);

            const cashTx = cashTxRepo.create({
              shiftId: shift.id,
              transactionType: 'refund_out',
              amountMinorUnits: input.refundAmountMinorUnits,
              sourceId: savedReturn.returnNumber,
              notes: `Sales Return Payout (${savedReturn.returnNumber})`,
              createdAtUtc: now,
            });
            await cashTxRepo.save(cashTx);
          }
        }
      }

      savedReturn.lines = createdLines;

      const variants = await variantRepo.find();
      const variantMap = new Map(variants.map((v) => [v.id, v]));
      const locations = await locationRepo.find({ where: { storeId } });
      const locationMap = new Map(locations.map((l) => [l.id, l.name]));

      return this.mapToDto(savedReturn, variantMap, locationMap, originalSale?.invoiceNumber);
    });
  }

  private mapToDto(
    entity: SalesReturnEntity,
    variantMap?: Map<number, ProductVariantEntity>,
    locationMap?: Map<number, string>,
    invoiceNumber?: string,
  ): SalesReturn {
    return {
      id: entity.id,
      storeId: entity.storeId,
      returnNumber: entity.returnNumber,
      saleId: entity.saleId,
      originalInvoiceNumber: invoiceNumber,
      customerId: entity.customerId,
      customerName: entity.customerName,
      returnDateUtc: entity.returnDateUtc,
      reason: entity.reason,
      refundMethod: entity.refundMethod,
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
          salesReturnId: line.salesReturnId,
          saleItemId: line.saleItemId,
          productVariantId: line.productVariantId,
          productName: variant?.name,
          sku: variant?.sku,
          quantity: line.quantity,
          unitCode: line.unitCode,
          unitPriceMinorUnits: line.unitPriceMinorUnits,
          totalPriceMinorUnits: line.totalPriceMinorUnits,
          condition: line.condition,
          targetLocationId: line.targetLocationId,
          targetLocationName: locationMap?.get(line.targetLocationId),
          reason: line.reason,
          createdAtUtc: line.createdAtUtc,
        };
      }) ?? [],
    };
  }
}
