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
  CustomerEntity,
} from '@rz-crm/database';
import {
  CheckoutSaleInput,
  SaleReceipt,
  SaleSummary,
  RecordSalePaymentInput,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

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
      const customerRepo = manager.getRepository(CustomerEntity);

      // 1. Idempotency guard: If idempotencyKey provided and sale exists, return existing receipt
      if (input.idempotencyKey) {
        const existingSale = await saleRepo.findOne({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existingSale) {
          return this.buildReceiptFromExisting(existingSale, manager);
        }
      }

      // 2. Shift Resolution (CRM Auto-Session Support)
      let shift: ShiftEntity | null = null;
      if (input.shiftId) {
        shift = await shiftRepo.findOne({ where: { id: input.shiftId } });
      }
      if (!shift || shift.status !== 'open') {
        shift = await shiftRepo.findOne({ where: { storeId: input.storeId, status: 'open' } });
      }
      if (!shift) {
        // Auto-initialize standard CRM sales session
        shift = shiftRepo.create({
          shiftCode: `CRM-${Date.now().toString().slice(-6)}`,
          storeId: input.storeId,
          registerId: input.registerId ?? null,
          cashierId: input.cashierId || 'admin',
          status: 'open',
          openedAtUtc: nowUtcString(),
          openingFloatMinorUnits: 0,
          expectedCashMinorUnits: 0,
          createdAtUtc: nowUtcString(),
          updatedAtUtc: nowUtcString(),
          notes: 'Auto-initialized CRM sales session',
        });
        await shiftRepo.save(shift);
      }

      // 3. Store details
      const store = await storeRepo.findOne({ where: { id: input.storeId } });
      const storeName = store ? store.name : 'RZ Enterprises';

      // 4. Stock Location Resolution for deduction
      let targetLocation: StockLocationEntity | null = null;
      if (input.locationId) {
        targetLocation = await locationRepo.findOne({
          where: { id: input.locationId, storeId: input.storeId, isActive: true },
        });
      }
      if (!targetLocation) {
        // Default to Showroom or first active location
        targetLocation = await locationRepo.findOne({
          where: { storeId: input.storeId, code: 'SR-MAIN', isActive: true },
        });
        if (!targetLocation) {
          targetLocation = await locationRepo.findOne({
            where: { storeId: input.storeId, isActive: true },
          });
        }
      }
      if (!targetLocation) {
        targetLocation = locationRepo.create({
          storeId: input.storeId,
          code: 'SR-MAIN',
          name: 'Main Showroom',
          locationType: 'sales_floor',
          isActive: true,
          createdAtUtc: nowUtcString(),
          updatedAtUtc: nowUtcString(),
        });
        await locationRepo.save(targetLocation);
      }

      // 5. Customer Resolution
      let customer: CustomerEntity | null = null;
      if (input.customerId) {
        customer = await customerRepo.findOne({ where: { id: input.customerId } });
      }
      const customerName = customer ? customer.name : (input.customerName || 'Walk-In Customer');

      // 6. Line items and total calculation with Wholesale Price support
      const orderType = input.orderType || 'retail';
      const priceTier = input.priceTier || (orderType === 'wholesale' ? 'wholesale' : 'retail');

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

        // Price resolution: explicit line price takes priority, else wholesale vs retail
        let unitPrice = line.unitPriceMinorUnits;
        if (unitPrice === 0 || unitPrice === undefined) {
          if (line.priceTier === 'wholesale' || priceTier === 'wholesale') {
            unitPrice = variant.wholesalePriceMinorUnits > 0 ? variant.wholesalePriceMinorUnits : variant.priceMinorUnits;
          } else {
            unitPrice = variant.priceMinorUnits;
          }
        }

        const lineTotal = Math.round(unitPrice * line.quantity);
        subtotal += lineTotal;

        preparedItems.push({
          variantId: variant.id,
          itemId: variant.itemId,
          sku: variant.sku,
          productName,
          quantity: line.quantity,
          unitPriceMinorUnits: unitPrice,
          lineTotal,
        });

        receiptItems.push({
          sku: variant.sku,
          productName,
          quantity: line.quantity,
          unitPriceMinorUnits: unitPrice,
          totalMinorUnits: lineTotal,
        });
      }

      // 7. Negative Inventory Policy Check (Configurable via Store Settings)
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
              .andWhere('sm.location_id = :locId', { locId: targetLocation.id })
              .getRawOne();
            const onHand = Number(balanceRaw?.total || 0);
            if (onHand < p.quantity) {
              throw new Error(
                `Cannot complete sale: Insufficient stock for "${p.productName}" at location "${targetLocation.name}". Available on hand: ${onHand}, in cart: ${p.quantity}. (Negative stock is blocked by store policy)`,
              );
            }
          }
        }
      }

      const tax = 0; // Tax configuration
      const total = subtotal + tax;

      // 8. Payment Method & Tender Calculations
      const paymentMethod = input.paymentMethod || 'cash';
      let amountPaid = 0;
      let changeDue = 0;
      let balanceDue = 0;

      if (paymentMethod === 'cash') {
        const tendered = input.amountTenderedMinorUnits;
        if (tendered < total) {
          throw new Error(
            `Amount tendered (Rs. ${(tendered / 100).toFixed(2)}) is less than total due (Rs. ${(total / 100).toFixed(2)})`,
          );
        }
        amountPaid = total;
        changeDue = tendered - total;
        balanceDue = 0;
      } else if (paymentMethod === 'credit') {
        amountPaid = input.amountPaidMinorUnits ?? 0;
        balanceDue = Math.max(0, total - amountPaid);

        // Credit limit guard for wholesale customers
        if (customer && customer.creditLimitMinorUnits > 0) {
          const projectedBalance = customer.outstandingBalanceMinorUnits + balanceDue;
          if (projectedBalance > customer.creditLimitMinorUnits) {
            throw new Error(
              `Credit Limit Exceeded for customer "${customer.name}". Credit Limit: Rs. ${(customer.creditLimitMinorUnits / 100).toFixed(2)}, Current Balance: Rs. ${(customer.outstandingBalanceMinorUnits / 100).toFixed(2)}, New Order Balance: Rs. ${(balanceDue / 100).toFixed(2)}. Total projected: Rs. ${(projectedBalance / 100).toFixed(2)}.`,
            );
          }
        }
      } else {
        // bank_transfer or cheque
        amountPaid = input.amountPaidMinorUnits ?? total;
        balanceDue = Math.max(0, total - amountPaid);
        changeDue = 0;
      }

      // Determine Payment Status
      let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'paid';
      if (amountPaid === 0) {
        paymentStatus = 'unpaid';
      } else if (amountPaid < total) {
        paymentStatus = 'partial';
      }

      const now = nowUtcString();

      // 9. Generate Sequential Invoice Number (INV-YYYYMMDD-XXXX)
      const datePrefix = now.slice(0, 10).replace(/-/g, '');
      const countToday = await saleRepo
        .createQueryBuilder('s')
        .where('s.invoice_number LIKE :prefix', { prefix: `INV-${datePrefix}-%` })
        .getCount();

      const sequence = String(countToday + 1).padStart(4, '0');
      const invoiceNumber = `INV-${datePrefix}-${sequence}`;

      // 10. Create Sale Record
      const sale = saleRepo.create({
        storeId: input.storeId,
        registerId: input.registerId ?? null,
        shiftId: shift.id,
        invoiceNumber,
        cashierId: input.cashierId ?? shift.cashierId,
        customerId: customer?.id ?? null,
        customerName,
        orderType,
        priceTier,
        locationId: targetLocation.id,
        paymentStatus,
        paymentMethod,
        subtotalMinorUnits: subtotal,
        discountMinorUnits: 0,
        taxMinorUnits: tax,
        totalMinorUnits: total,
        amountPaidMinorUnits: amountPaid,
        balanceDueMinorUnits: balanceDue,
        dueDate: input.dueDate ?? null,
        paymentTerms: input.paymentTerms ?? null,
        referenceNote: input.referenceNote ?? null,
        currencyCode: 'PKR',
        idempotencyKey: input.idempotencyKey ?? null,
        notes: input.notes ?? null,
        status: 'completed',
        createdAtUtc: now,
      });
      await saleRepo.save(sale);

      // 11. Create Sale Items & Immutable Stock Movement Ledger Entries
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

        // Deduct from the selected target stock location
        if (p.itemId) {
          const movement = stockMovementRepo.create({
            storeId: input.storeId,
            itemId: p.itemId,
            locationId: targetLocation.id,
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

      // 12. Record Initial Payment
      if (amountPaid > 0 || paymentMethod === 'cash') {
        const payment = salePaymentRepo.create({
          saleId: sale.id,
          paymentMethod,
          amountTenderedMinorUnits: paymentMethod === 'cash' ? input.amountTenderedMinorUnits : amountPaid,
          amountPaidMinorUnits: amountPaid,
          changeDueMinorUnits: changeDue,
          reference: input.referenceNote ?? null,
          bankName: input.bankName ?? null,
          chequeDate: input.chequeDate ?? null,
          notes: input.notes ?? null,
          status: 'posted',
          createdAtUtc: now,
        });
        await salePaymentRepo.save(payment);
      }

      // 13. Cash Drawer & Customer Balance Ledger Updates
      if (paymentMethod === 'cash' && amountPaid > 0) {
        const cashTx = cashTxRepo.create({
          shiftId: shift.id,
          transactionType: 'sale_in',
          amountMinorUnits: amountPaid,
          sourceId: sale.invoiceNumber,
          notes: `Cash sale ${sale.invoiceNumber} (${orderType})`,
          createdAtUtc: now,
        });
        await cashTxRepo.save(cashTx);

        shift.expectedCashMinorUnits += amountPaid;
        shift.updatedAtUtc = now;
        await shiftRepo.save(shift);
      }

      if (customer && balanceDue > 0) {
        customer.outstandingBalanceMinorUnits += balanceDue;
        customer.updatedAtUtc = now;
        await customerRepo.save(customer);
      }

      // 14. Return Rich Printable Receipt & Commercial Invoice Data
      return {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        storeName,
        cashierId: sale.cashierId,
        customerId: customer?.id ?? null,
        customerName: sale.customerName,
        customerCompanyName: customer?.companyName ?? null,
        customerTaxNumber: customer?.taxNumber ?? null,
        customerAddress: customer?.address ?? null,
        customerPhone: customer?.phone ?? null,
        orderType: sale.orderType,
        priceTier: sale.priceTier,
        locationName: targetLocation.name,
        createdAtUtc: sale.createdAtUtc,
        dueDate: sale.dueDate,
        paymentTerms: sale.paymentTerms,
        paymentMethod: sale.paymentMethod,
        paymentStatus: sale.paymentStatus,
        referenceNote: sale.referenceNote,
        items: receiptItems,
        subtotalMinorUnits: sale.subtotalMinorUnits,
        taxMinorUnits: sale.taxMinorUnits,
        totalMinorUnits: sale.totalMinorUnits,
        amountPaidMinorUnits: sale.amountPaidMinorUnits,
        amountTenderedMinorUnits: paymentMethod === 'cash' ? input.amountTenderedMinorUnits : amountPaid,
        changeDueMinorUnits: changeDue,
        balanceDueMinorUnits: sale.balanceDueMinorUnits,
        currencyCode: sale.currencyCode,
      };
    });
  }

  public async recordSalePayment(input: RecordSalePaymentInput): Promise<{
    success: boolean;
    balanceDueMinorUnits: number;
    paymentStatus: string;
  }> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const saleRepo = manager.getRepository(SaleEntity);
      const salePaymentRepo = manager.getRepository(SalePaymentEntity);
      const customerRepo = manager.getRepository(CustomerEntity);
      const shiftRepo = manager.getRepository(ShiftEntity);
      const cashTxRepo = manager.getRepository(CashTransactionEntity);

      const sale = await saleRepo.findOne({ where: { id: input.saleId } });
      if (!sale) {
        throw new Error(`Sale with ID ${input.saleId} not found`);
      }

      if (sale.balanceDueMinorUnits <= 0) {
        throw new Error(`Invoice ${sale.invoiceNumber} is already fully paid.`);
      }

      const payAmount = Math.min(input.amountMinorUnits, sale.balanceDueMinorUnits);
      const now = nowUtcString();

      // Record payment entry
      const payment = salePaymentRepo.create({
        saleId: sale.id,
        paymentMethod: input.paymentMethod,
        amountTenderedMinorUnits: payAmount,
        amountPaidMinorUnits: payAmount,
        changeDueMinorUnits: 0,
        reference: input.reference ?? null,
        bankName: input.bankName ?? null,
        chequeDate: input.chequeDate ?? null,
        notes: input.notes ?? null,
        status: 'posted',
        createdAtUtc: now,
      });
      await salePaymentRepo.save(payment);

      // Update sale amounts and status
      sale.amountPaidMinorUnits += payAmount;
      sale.balanceDueMinorUnits -= payAmount;
      if (sale.balanceDueMinorUnits <= 0) {
        sale.balanceDueMinorUnits = 0;
        sale.paymentStatus = 'paid';
      } else {
        sale.paymentStatus = 'partial';
      }
      await saleRepo.save(sale);

      // If customer has outstanding balance, reduce it
      if (sale.customerId) {
        const customer = await customerRepo.findOne({ where: { id: sale.customerId } });
        if (customer) {
          customer.outstandingBalanceMinorUnits = Math.max(0, customer.outstandingBalanceMinorUnits - payAmount);
          customer.updatedAtUtc = now;
          await customerRepo.save(customer);
        }
      }

      // If cash, update active shift drawer
      if (input.paymentMethod === 'cash') {
        const openShift = await shiftRepo.findOne({ where: { storeId: sale.storeId, status: 'open' } });
        if (openShift) {
          const cashTx = cashTxRepo.create({
            shiftId: openShift.id,
            transactionType: 'sale_in',
            amountMinorUnits: payAmount,
            sourceId: sale.invoiceNumber,
            notes: `Subsequent payment for ${sale.invoiceNumber}`,
            createdAtUtc: now,
          });
          await cashTxRepo.save(cashTx);

          openShift.expectedCashMinorUnits += payAmount;
          openShift.updatedAtUtc = now;
          await shiftRepo.save(openShift);
        }
      }

      return {
        success: true,
        balanceDueMinorUnits: sale.balanceDueMinorUnits,
        paymentStatus: sale.paymentStatus,
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
      take: 100,
    });

    const result: SaleSummary[] = [];
    for (const s of records) {
      const itemCount = await itemRepo.count({ where: { saleId: s.id } });
      result.push({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        customerName: s.customerName,
        orderType: s.orderType || 'retail',
        priceTier: s.priceTier || 'retail',
        paymentMethod: s.paymentMethod || 'cash',
        paymentStatus: s.paymentStatus || 'paid',
        totalMinorUnits: s.totalMinorUnits,
        amountPaidMinorUnits: s.amountPaidMinorUnits ?? s.totalMinorUnits,
        balanceDueMinorUnits: s.balanceDueMinorUnits ?? 0,
        currencyCode: s.currencyCode,
        status: s.status,
        itemCount,
        createdAtUtc: s.createdAtUtc,
        dueDate: s.dueDate,
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
    const customer = sale.customerId
      ? await manager.getRepository(CustomerEntity).findOne({ where: { id: sale.customerId } })
      : null;
    const location = sale.locationId
      ? await manager.getRepository(StockLocationEntity).findOne({ where: { id: sale.locationId } })
      : null;

    return {
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      storeName: store ? store.name : 'RZ Enterprises',
      cashierId: sale.cashierId,
      customerId: sale.customerId,
      customerName: sale.customerName,
      customerCompanyName: customer?.companyName ?? null,
      customerTaxNumber: customer?.taxNumber ?? null,
      customerAddress: customer?.address ?? null,
      customerPhone: customer?.phone ?? null,
      orderType: sale.orderType || 'retail',
      priceTier: sale.priceTier || 'retail',
      locationName: location?.name || 'Main Showroom',
      createdAtUtc: sale.createdAtUtc,
      dueDate: sale.dueDate,
      paymentTerms: sale.paymentTerms,
      paymentMethod: sale.paymentMethod || 'cash',
      paymentStatus: sale.paymentStatus || 'paid',
      referenceNote: sale.referenceNote,
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
      amountPaidMinorUnits: sale.amountPaidMinorUnits ?? sale.totalMinorUnits,
      amountTenderedMinorUnits: payment?.amountTenderedMinorUnits ?? sale.totalMinorUnits,
      changeDueMinorUnits: payment?.changeDueMinorUnits ?? 0,
      balanceDueMinorUnits: sale.balanceDueMinorUnits ?? 0,
      currencyCode: sale.currencyCode,
    };
  }
}
