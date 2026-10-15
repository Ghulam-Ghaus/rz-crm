import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  SaleEntity,
  SaleItemEntity,
  SalePaymentEntity,
  ShiftEntity,
  CashTransactionEntity,
  StockMovementEntity,
  StockLocationEntity,
  ProductVariantEntity,
  ProductEntity,
  StoreEntity,
  SettingEntity,
} from '@bakery/database';
import {
  CheckoutSaleInput,
  SaleReceipt,
  SaleSummary,
} from '@bakery/contracts';
import { nowUtcString } from '@bakery/shared';

@Injectable()
export class PosSaleService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async checkoutCashSale(input: CheckoutSaleInput): Promise<SaleReceipt> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const saleRepo = manager.getRepository(SaleEntity);
      const saleItemRepo = manager.getRepository(SaleItemEntity);
      const salePaymentRepo = manager.getRepository(SalePaymentEntity);
      const shiftRepo = manager.getRepository(ShiftEntity);
      const cashTxRepo = manager.getRepository(CashTransactionEntity);
      const stockMovementRepo = manager.getRepository(StockMovementEntity);
      const locationRepo = manager.getRepository(StockLocationEntity);
      const variantRepo = manager.getRepository(ProductVariantEntity);
      const productRepo = manager.getRepository(ProductEntity);
      const storeRepo = manager.getRepository(StoreEntity);
      const settingRepo = manager.getRepository(SettingEntity);

      // 1. Idempotency guard: If idempotencyKey provided and sale exists, return existing receipt
      if (input.idempotencyKey) {
        const existingSale = await saleRepo.findOne({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existingSale) {
          return this.buildReceiptFromExisting(existingSale, manager);
        }
      }

      // 2. Shift Verification
      const shift = await shiftRepo.findOne({ where: { id: input.shiftId } });
      if (!shift) {
        throw new Error(`Shift '${input.shiftId}' not found`);
      }
      if (shift.status !== 'open') {
        throw new Error(`Cannot post sale to a closed shift. Please open a shift first.`);
      }

      // 3. Store details
      const store = await storeRepo.findOne({ where: { id: input.storeId } });
      const storeName = store ? store.name : 'Bakery Store';

      // 4. Default location for stock deduction
      let defaultLocation = await locationRepo.findOne({
        where: { storeId: input.storeId, isActive: true },
      });
      if (!defaultLocation) {
        defaultLocation = locationRepo.create({
          storeId: input.storeId,
          code: 'MAIN_FLOOR',
          name: 'Main Sales Floor',
          locationType: 'sales_floor',
          isActive: true,
          createdAtUtc: nowUtcString(),
          updatedAtUtc: nowUtcString(),
        });
        await locationRepo.save(defaultLocation);
      }

      // 5. Line items and total calculation
      let subtotal = 0;
      const receiptItems: Array<{
        sku: string;
        productName: string;
        quantity: number;
        unitPriceMinorUnits: number;
        totalMinorUnits: number;
      }> = [];

      interface PreparedItem {
        variantId: number;
        itemId: number | null;
        sku: string;
        productName: string;
        quantity: number;
        unitPriceMinorUnits: number;
        lineTotal: number;
      }

      const preparedItems: PreparedItem[] = [];

      for (const line of input.items) {
        const variant = await variantRepo.findOne({ where: { id: line.variantId } });
        if (!variant) throw new Error(`Product variant '${line.variantId}' not found`);

        const product = await productRepo.findOne({ where: { id: variant.productId } });
        const productName = product ? product.name : variant.name;

        const lineTotal = Math.round(variant.priceMinorUnits * line.quantity);
        subtotal += lineTotal;

        preparedItems.push({
          variantId: variant.id,
          itemId: variant.itemId,
          sku: variant.sku,
          productName,
          quantity: line.quantity,
          unitPriceMinorUnits: variant.priceMinorUnits,
          lineTotal,
        });

        receiptItems.push({
          sku: variant.sku,
          productName,
          quantity: line.quantity,
          unitPriceMinorUnits: variant.priceMinorUnits,
          totalMinorUnits: lineTotal,
        });
      }

      // 5b. Negative Inventory Policy Check (Configurable via Store Settings)
      const negativeStockSetting = await settingRepo.findOne({
        where: { key: 'allow_negative_stock' },
      });
      const allowNegativeStock = negativeStockSetting?.value === 'true';

      if (!allowNegativeStock) {
        for (const p of preparedItems) {
          if (p.itemId) {
            const balanceRaw = await stockMovementRepo
              .createQueryBuilder('sm')
              .select('COALESCE(SUM(sm.signed_base_quantity), 0)', 'total')
              .where('sm.item_id = :itemId', { itemId: p.itemId })
              .getRawOne();
            const onHand = Number(balanceRaw?.total || 0);
            if (onHand < p.quantity) {
              throw new Error(
                `Cannot complete sale: Insufficient stock for "${p.productName}". Available on hand: ${onHand}, in cart: ${p.quantity}. (Negative stock is blocked by store policy)`,
              );
            }
          }
        }
      }

      const tax = 0; // Configured in Phase 6 tax engine
      const total = subtotal + tax;

      // 6. Validate Tender
      if (input.amountTenderedMinorUnits < total) {
        throw new Error(
          `Amount tendered (Rs. ${(input.amountTenderedMinorUnits / 100).toFixed(2)}) is less than total due (Rs. ${(total / 100).toFixed(2)})`,
        );
      }

      const changeDue = input.amountTenderedMinorUnits - total;
      const now = nowUtcString();

      // 7. Generate Sequential Invoice Number
      const datePrefix = now.slice(0, 10).replace(/-/g, '');
      const countToday = await saleRepo
        .createQueryBuilder('s')
        .where('s.invoice_number LIKE :prefix', { prefix: `INV-${datePrefix}-%` })
        .getCount();

      const sequence = String(countToday + 1).padStart(4, '0');
      const invoiceNumber = `INV-${datePrefix}-${sequence}`;

      // 8. Create Sale Record
      const sale = saleRepo.create({
        storeId: input.storeId,
        registerId: input.registerId ?? null,
        shiftId: shift.id,
        invoiceNumber,
        cashierId: input.cashierId ?? shift.cashierId,
        status: 'completed',
        subtotalMinorUnits: subtotal,
        discountMinorUnits: 0,
        taxMinorUnits: tax,
        totalMinorUnits: total,
        currencyCode: 'PKR',
        idempotencyKey: input.idempotencyKey ?? null,
        notes: input.notes ?? null,
        createdAtUtc: now,
      });
      await saleRepo.save(sale);

      // 9. Create Sale Items & Deduct Stock in Stock Movements
      for (const p of preparedItems) {
        const itemRecord = saleItemRepo.create({
          saleId: sale.id,
          variantId: p.variantId,
          itemId: p.itemId,
          sku: p.sku,
          productName: p.productName,
          quantity: p.quantity,
          unitPriceMinorUnits: p.unitPriceMinorUnits,
          subtotalMinorUnits: p.lineTotal,
          taxMinorUnits: 0,
          totalMinorUnits: p.lineTotal,
          createdAtUtc: now,
        });
        await saleItemRepo.save(itemRecord);

        // Immutable stock movement ledger entry (negative quantity for sale)
        if (p.itemId) {
          const movement = stockMovementRepo.create({
            storeId: input.storeId,
            itemId: p.itemId,
            locationId: defaultLocation.id,
            signedBaseQuantity: -p.quantity,
            movementType: 'SALE',
            sourceType: 'SALE',
            sourceId: sale.invoiceNumber,
            sourceLineId: String(itemRecord.id),
            costPerUnitMinorUnits: null,
            actorId: input.cashierId ?? shift.cashierId,
            idempotencyKey: `SALE-${sale.id}-${p.variantId}`,
            createdAtUtc: now,
          });
          await stockMovementRepo.save(movement);
        }
      }

      // 10. Record Payment
      const payment = salePaymentRepo.create({
        saleId: sale.id,
        paymentMethod: 'cash',
        amountTenderedMinorUnits: input.amountTenderedMinorUnits,
        amountPaidMinorUnits: total,
        changeDueMinorUnits: changeDue,
        status: 'posted',
        createdAtUtc: now,
      });
      await salePaymentRepo.save(payment);

      // 11. Record Cash in Drawer and update Shift Expected Cash
      const cashTx = cashTxRepo.create({
        shiftId: shift.id,
        transactionType: 'sale_in',
        amountMinorUnits: total,
        sourceId: sale.invoiceNumber,
        notes: `Cash sale ${sale.invoiceNumber}`,
        createdAtUtc: now,
      });
      await cashTxRepo.save(cashTx);

      shift.expectedCashMinorUnits += total;
      shift.updatedAtUtc = now;
      await shiftRepo.save(shift);

      // 12. Return Printable Receipt
      return {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        storeName,
        cashierId: sale.cashierId,
        createdAtUtc: sale.createdAtUtc,
        items: receiptItems,
        subtotalMinorUnits: sale.subtotalMinorUnits,
        taxMinorUnits: sale.taxMinorUnits,
        totalMinorUnits: sale.totalMinorUnits,
        amountTenderedMinorUnits: payment.amountTenderedMinorUnits,
        changeDueMinorUnits: payment.changeDueMinorUnits,
        currencyCode: sale.currencyCode,
      };
    });
  }

  public async getRecentSales(storeId: number): Promise<SaleSummary[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(SaleEntity);
    const itemRepo = ds.getRepository(SaleItemEntity);
    const records = await repo.find({
      where: { storeId },
      order: { createdAtUtc: 'DESC' },
      take: 50,
    });

    const result: SaleSummary[] = [];
    for (const s of records) {
      const itemCount = await itemRepo.count({ where: { saleId: s.id } });
      result.push({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        totalMinorUnits: s.totalMinorUnits,
        currencyCode: s.currencyCode,
        status: s.status,
        itemCount,
        createdAtUtc: s.createdAtUtc,
      });
    }

    return result;
  }

  public async getSaleReceipt(saleId: number): Promise<SaleReceipt> {
    const ds = this.databaseService.getDataSource();
    const saleRepo = ds.getRepository(SaleEntity);
    const sale = await saleRepo.findOne({ where: { id: saleId } });
    if (!sale) {
      throw new Error(`Sale with ID '${saleId}' not found`);
    }
    return this.buildReceiptFromExisting(sale, ds);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async buildReceiptFromExisting(sale: SaleEntity, manager: any): Promise<SaleReceipt> {
    const items = await manager.getRepository(SaleItemEntity).find({ where: { saleId: sale.id } });
    const payment = await manager.getRepository(SalePaymentEntity).findOne({ where: { saleId: sale.id } });
    const store = await manager.getRepository(StoreEntity).findOne({ where: { id: sale.storeId } });

    return {
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      storeName: store ? store.name : 'Bakery Store',
      cashierId: sale.cashierId,
      createdAtUtc: sale.createdAtUtc,
      items: items.map((i: SaleItemEntity) => ({
        sku: i.sku,
        productName: i.productName,
        quantity: i.quantity,
        unitPriceMinorUnits: i.unitPriceMinorUnits,
        totalMinorUnits: i.totalMinorUnits,
      })),
      subtotalMinorUnits: sale.subtotalMinorUnits,
      taxMinorUnits: sale.taxMinorUnits,
      totalMinorUnits: sale.totalMinorUnits,
      amountTenderedMinorUnits: payment?.amountTenderedMinorUnits ?? sale.totalMinorUnits,
      changeDueMinorUnits: payment?.changeDueMinorUnits ?? 0,
      currencyCode: sale.currencyCode,
    };
  }
}
