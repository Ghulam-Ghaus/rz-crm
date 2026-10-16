import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  SaleEntity,
  SalePaymentEntity,
  GoodsReceiptEntity,
  SupplierPaymentEntity,
  SupplierEntity,
  CustomerEntity,
  ProductVariantEntity,
  ProductEntity,
  CategoryEntity,
  ItemEntity,
  StockMovementEntity,
  StakeholderEntity,
  StakeholderEquityEntity,
  StakeholderTransactionEntity,
  CompanyBankAccountEntity,
  BankTransactionEntity,
} from '@rz-crm/database';
import {
  ReceivablesAgeingReport,
  CustomerAgeingBucket,
  PayablesAgeingReport,
  SupplierAgeingBucket,
  ChequeRegisterReport,
  ChequeItem,
  StockValuationReport,
  StockValuationItem,
  StockValuationCategorySummary,
  StakeholderStatementReport,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class FinancialReportsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * 1. Customer Receivables Ageing Report
   * Breaks down outstanding customer invoice balances into aging buckets:
   * Current, 1-30 days, 31-60 days, 61-90 days, 90+ days.
   */
  public async getCustomerReceivablesAgeing(storeId: number): Promise<ReceivablesAgeingReport> {
    const ds = this.databaseService.getDataSource();
    const customerRepo = ds.getRepository(CustomerEntity);
    const saleRepo = ds.getRepository(SaleEntity);

    const customers = await customerRepo.find({ where: { storeId } });
    const customerMap = new Map<number, CustomerEntity>(customers.map((c) => [c.id, c]));

    // Find all sales with outstanding balance
    const sales = await saleRepo.find({
      where: { storeId, status: 'completed' },
      order: { createdAtUtc: 'ASC' },
    });

    const unpaidSales = sales.filter((s) => s.balanceDueMinorUnits > 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group unpaid sales by customer
    const salesByCustomer = new Map<number, SaleEntity[]>();
    for (const s of unpaidSales) {
      if (!s.customerId) continue;
      if (!salesByCustomer.has(s.customerId)) {
        salesByCustomer.set(s.customerId, []);
      }
      salesByCustomer.get(s.customerId)!.push(s);
    }

    const customerBuckets: CustomerAgeingBucket[] = [];
    let totalReceivables = 0;
    let totalCurrent = 0;
    let total1to30 = 0;
    let total31to60 = 0;
    let total61to90 = 0;
    let total90Plus = 0;

    for (const [customerId, custSales] of salesByCustomer.entries()) {
      const cust = customerMap.get(customerId);
      const customerName = cust?.name || custSales[0]?.customerName || `Customer #${customerId}`;
      const phone = cust?.phone || null;
      const creditLimit = cust?.creditLimitMinorUnits || 0;

      let custTotalDue = 0;
      let custCurrent = 0;
      let cust1to30 = 0;
      let cust31to60 = 0;
      let cust61to90 = 0;
      let cust90Plus = 0;
      let oldestDate: string | null = null;

      for (const sale of custSales) {
        custTotalDue += sale.balanceDueMinorUnits;
        const invoiceDate = sale.createdAtUtc.slice(0, 10);
        if (!oldestDate || invoiceDate < oldestDate) {
          oldestDate = invoiceDate;
        }

        // Determine reference date for overdue calculation (use dueDate or invoiceDate)
        const refDateStr = sale.dueDate || invoiceDate;
        const refDate = new Date(refDateStr);
        refDate.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - refDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          custCurrent += sale.balanceDueMinorUnits;
        } else if (diffDays <= 30) {
          cust1to30 += sale.balanceDueMinorUnits;
        } else if (diffDays <= 60) {
          cust31to60 += sale.balanceDueMinorUnits;
        } else if (diffDays <= 90) {
          cust61to90 += sale.balanceDueMinorUnits;
        } else {
          cust90Plus += sale.balanceDueMinorUnits;
        }
      }

      totalReceivables += custTotalDue;
      totalCurrent += custCurrent;
      total1to30 += cust1to30;
      total31to60 += cust31to60;
      total61to90 += cust61to90;
      total90Plus += cust90Plus;

      customerBuckets.push({
        customerId,
        customerName,
        phone,
        creditLimitMinorUnits: creditLimit,
        totalDueMinorUnits: custTotalDue,
        currentMinorUnits: custCurrent,
        days1to30MinorUnits: cust1to30,
        days31to60MinorUnits: cust31to60,
        days61to90MinorUnits: cust61to90,
        days90PlusMinorUnits: cust90Plus,
        oldestInvoiceDate: oldestDate,
        unpaidInvoicesCount: custSales.length,
      });
    }

    // Sort customers by total due descending
    customerBuckets.sort((a, b) => b.totalDueMinorUnits - a.totalDueMinorUnits);

    return {
      storeId,
      generatedAtUtc: nowUtcString(),
      totalReceivablesMinorUnits: totalReceivables,
      totalCurrentMinorUnits: totalCurrent,
      total1to30MinorUnits: total1to30,
      total31to60MinorUnits: total31to60,
      total61to90MinorUnits: total61to90,
      total90PlusMinorUnits: total90Plus,
      totalCustomersCount: customerBuckets.length,
      customers: customerBuckets,
    };
  }

  /**
   * 2. Supplier Payables Ageing Report
   * Breaks down unpaid Goods Receipts (GRNs) into aging buckets based on received date.
   */
  public async getSupplierPayablesAgeing(storeId: number): Promise<PayablesAgeingReport> {
    const ds = this.databaseService.getDataSource();
    const supplierRepo = ds.getRepository(SupplierEntity);
    const grnRepo = ds.getRepository(GoodsReceiptEntity);
    const paymentRepo = ds.getRepository(SupplierPaymentEntity);

    const suppliers = await supplierRepo.find({ where: { storeId } });
    const supplierMap = new Map<number, SupplierEntity>(suppliers.map((s) => [s.id, s]));

    const grns = await grnRepo.find({
      where: { storeId, status: 'POSTED' },
      order: { receivedDateUtc: 'ASC' },
    });

    const payments = await paymentRepo.find({ where: { storeId } });
    const paymentsBySupplier = new Map<number, number>();
    for (const p of payments) {
      paymentsBySupplier.set(
        p.supplierId,
        (paymentsBySupplier.get(p.supplierId) || 0) + p.amountMinorUnits,
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group GRNs by supplier
    const grnsBySupplier = new Map<number, GoodsReceiptEntity[]>();
    for (const g of grns) {
      if (g.paymentStatus === 'PAID') continue;
      if (!grnsBySupplier.has(g.supplierId)) {
        grnsBySupplier.set(g.supplierId, []);
      }
      grnsBySupplier.get(g.supplierId)!.push(g);
    }

    const supplierBuckets: SupplierAgeingBucket[] = [];
    let totalPayables = 0;
    let totalCurrent = 0;
    let total1to30 = 0;
    let total31to60 = 0;
    let total61to90 = 0;
    let total90Plus = 0;

    for (const [supplierId, supGrns] of grnsBySupplier.entries()) {
      const sup = supplierMap.get(supplierId);
      const supplierName = sup?.name || `Supplier #${supplierId}`;
      const phone = sup?.phone || null;

      let supTotal = 0;
      let supCurrent = 0;
      let sup1to30 = 0;
      let sup31to60 = 0;
      let sup61to90 = 0;
      let sup90Plus = 0;
      let oldestDate: string | null = null;

      for (const grn of supGrns) {
        supTotal += grn.totalAmountMinorUnits;
        const rDate = grn.receivedDateUtc.slice(0, 10);
        if (!oldestDate || rDate < oldestDate) {
          oldestDate = rDate;
        }

        // Standard 30 days payment terms from receipt
        const receiptDate = new Date(rDate);
        receiptDate.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - receiptDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          supCurrent += grn.totalAmountMinorUnits;
        } else if (diffDays <= 60) {
          sup1to30 += grn.totalAmountMinorUnits;
        } else if (diffDays <= 90) {
          sup31to60 += grn.totalAmountMinorUnits;
        } else if (diffDays <= 120) {
          sup61to90 += grn.totalAmountMinorUnits;
        } else {
          sup90Plus += grn.totalAmountMinorUnits;
        }
      }

      totalPayables += supTotal;
      totalCurrent += supCurrent;
      total1to30 += sup1to30;
      total31to60 += sup31to60;
      total61to90 += sup61to90;
      total90Plus += sup90Plus;

      supplierBuckets.push({
        supplierId,
        supplierName,
        phone,
        totalPayableMinorUnits: supTotal,
        currentMinorUnits: supCurrent,
        days1to30MinorUnits: sup1to30,
        days31to60MinorUnits: sup31to60,
        days61to90MinorUnits: sup61to90,
        days90PlusMinorUnits: sup90Plus,
        oldestGrnDate: oldestDate,
        unpaidGrnsCount: supGrns.length,
      });
    }

    supplierBuckets.sort((a, b) => b.totalPayableMinorUnits - a.totalPayableMinorUnits);

    return {
      storeId,
      generatedAtUtc: nowUtcString(),
      totalPayablesMinorUnits: totalPayables,
      totalCurrentMinorUnits: totalCurrent,
      total1to30MinorUnits: total1to30,
      total31to60MinorUnits: total31to60,
      total61to90MinorUnits: total61to90,
      total90PlusMinorUnits: total90Plus,
      totalSuppliersCount: supplierBuckets.length,
      suppliers: supplierBuckets,
    };
  }

  /**
   * 3. Cheque Register & Clearing Forecast
   * Aggregates all customer cheques received and supplier cheques issued,
   * tracking clearing dates, maturities, and cashflow forecast.
   */
  public async getChequeRegister(storeId: number): Promise<ChequeRegisterReport> {
    const ds = this.databaseService.getDataSource();
    const salePaymentRepo = ds.getRepository(SalePaymentEntity);
    const saleRepo = ds.getRepository(SaleEntity);
    const supplierPaymentRepo = ds.getRepository(SupplierPaymentEntity);
    const supplierRepo = ds.getRepository(SupplierEntity);
    const bankAccRepo = ds.getRepository(CompanyBankAccountEntity);
    const bankTxRepo = ds.getRepository(BankTransactionEntity);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bankAccounts = await bankAccRepo.find({ where: { storeId } });
    const accMap = new Map<number, CompanyBankAccountEntity>(bankAccounts.map((a) => [a.id, a]));

    const bankTxs = await bankTxRepo.find({
      order: { createdAtUtc: 'DESC' },
    });
    const txMap = new Map<string, BankTransactionEntity>();
    for (const tx of bankTxs) {
      if (tx.chequeDirection && tx.chequeId) {
        txMap.set(`${tx.chequeDirection}_${tx.chequeId}`, tx);
      }
    }

    const cheques: ChequeItem[] = [];

    // 1. Inward Customer Cheques
    const salePayments = await salePaymentRepo.find({
      where: [{ paymentMethod: 'cheque' }, { paymentMethod: 'CHEQUE' }],
    });

    const sales = await saleRepo.find({ where: { storeId } });
    const saleMap = new Map<number, SaleEntity>(sales.map((s) => [s.id, s]));

    let inwardTotal = 0;
    let inwardPending = 0;
    let inwardCleared = 0;

    for (const sp of salePayments) {
      const sale = saleMap.get(sp.saleId);
      if (!sale) continue;

      const cDateStr = sp.chequeDate || sp.createdAtUtc.slice(0, 10);
      const cDate = new Date(cDateStr);
      cDate.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil((cDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const status: 'POSTED' | 'CLEARED' | 'BOUNCED' | 'CANCELLED' =
        sp.status === 'cleared'
          ? 'CLEARED'
          : sp.status === 'bounced'
            ? 'BOUNCED'
            : 'POSTED';

      inwardTotal += sp.amountPaidMinorUnits;
      if (status === 'CLEARED') {
        inwardCleared += sp.amountPaidMinorUnits;
      } else if (status === 'POSTED') {
        inwardPending += sp.amountPaidMinorUnits;
      }

      const tx = txMap.get(`INWARD_${sp.id}`);
      const clearedBankAcc = tx ? accMap.get(tx.accountId) : undefined;

      cheques.push({
        id: sp.id,
        direction: 'INWARD_CUSTOMER',
        partyName: sale.customerName || 'Walk-in Customer',
        partyId: sale.customerId,
        amountMinorUnits: sp.amountPaidMinorUnits,
        bankName: sp.bankName,
        chequeNumber: sp.reference,
        chequeDate: cDateStr,
        status,
        sourceReference: sale.invoiceNumber,
        createdAtUtc: sp.createdAtUtc,
        daysUntilMaturity: diffDays,
        clearedAtUtc: tx?.createdAtUtc || (status === 'CLEARED' ? sp.createdAtUtc : null),
        clearedBankAccountId: tx?.accountId || null,
        clearedBankAccountName: clearedBankAcc ? `${clearedBankAcc.bankName} (${clearedBankAcc.accountNumber})` : null,
        attachmentPath: tx?.attachmentPath || null,
      });
    }

    // 2. Outward Supplier Cheques
    const supPayments = await supplierPaymentRepo.find({
      where: [{ storeId, paymentMethod: 'cheque' }, { storeId, paymentMethod: 'CHEQUE' }],
    });

    const suppliers = await supplierRepo.find({ where: { storeId } });
    const supMap = new Map<number, SupplierEntity>(suppliers.map((s) => [s.id, s]));

    let outwardTotal = 0;
    let outwardPending = 0;
    let outwardCleared = 0;

    for (const supP of supPayments) {
      const sup = supMap.get(supP.supplierId);
      const cDateStr = supP.chequeDate ? supP.chequeDate.slice(0, 10) : supP.paymentDateUtc.slice(0, 10);
      const cDate = new Date(cDateStr);
      cDate.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil((cDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const tx = txMap.get(`OUTWARD_${supP.id}`);
      const status: 'POSTED' | 'CLEARED' | 'BOUNCED' | 'CANCELLED' = tx ? 'CLEARED' : 'POSTED';

      outwardTotal += supP.amountMinorUnits;
      if (status === 'CLEARED') {
        outwardCleared += supP.amountMinorUnits;
      } else {
        outwardPending += supP.amountMinorUnits;
      }

      const clearedBankAcc = tx ? accMap.get(tx.accountId) : undefined;

      cheques.push({
        id: supP.id,
        direction: 'OUTWARD_SUPPLIER',
        partyName: sup?.name || `Supplier #${supP.supplierId}`,
        partyId: supP.supplierId,
        amountMinorUnits: supP.amountMinorUnits,
        bankName: supP.bankName,
        chequeNumber: supP.reference,
        chequeDate: cDateStr,
        status,
        sourceReference: supP.paymentNumber,
        createdAtUtc: supP.createdAtUtc,
        daysUntilMaturity: diffDays,
        clearedAtUtc: tx?.createdAtUtc || null,
        clearedBankAccountId: tx?.accountId || null,
        clearedBankAccountName: clearedBankAcc ? `${clearedBankAcc.bankName} (${clearedBankAcc.accountNumber})` : null,
        attachmentPath: tx?.attachmentPath || null,
      });
    }

    // 3. Cashflow Clearing Forecast
    let forecast7In = 0;
    let forecast7Out = 0;
    let forecast30In = 0;
    let forecast30Out = 0;

    for (const c of cheques) {
      if (c.status !== 'POSTED') continue;
      if (c.daysUntilMaturity >= 0 && c.daysUntilMaturity <= 7) {
        if (c.direction === 'INWARD_CUSTOMER') forecast7In += c.amountMinorUnits;
        else forecast7Out += c.amountMinorUnits;
      }
      if (c.daysUntilMaturity >= 0 && c.daysUntilMaturity <= 30) {
        if (c.direction === 'INWARD_CUSTOMER') forecast30In += c.amountMinorUnits;
        else forecast30Out += c.amountMinorUnits;
      }
    }

    // Sort cheques by date ascending
    cheques.sort((a, b) => a.chequeDate.localeCompare(b.chequeDate));

    return {
      storeId,
      generatedAtUtc: nowUtcString(),
      inwardTotalMinorUnits: inwardTotal,
      inwardPendingMinorUnits: inwardPending,
      inwardClearedMinorUnits: inwardCleared,
      outwardTotalMinorUnits: outwardTotal,
      outwardPendingMinorUnits: outwardPending,
      outwardClearedMinorUnits: outwardCleared,
      forecast7DaysNetMinorUnits: forecast7In - forecast7Out,
      forecast30DaysNetMinorUnits: forecast30In - forecast30Out,
      cheques,
    };
  }

  /**
   * 4. Stock Valuation Report
   * Variant-by-variant and category-wise inventory valuation based on wholesale cost.
   */
  public async getStockValuation(storeId: number): Promise<StockValuationReport> {
    const ds = this.databaseService.getDataSource();
    const variantRepo = ds.getRepository(ProductVariantEntity);
    const productRepo = ds.getRepository(ProductEntity);
    const categoryRepo = ds.getRepository(CategoryEntity);
    const movementRepo = ds.getRepository(StockMovementEntity);

    const products = await productRepo.find();
    const productMap = new Map<number, ProductEntity>(products.map((p) => [p.id, p]));

    const categories = await categoryRepo.find();
    const categoryMap = new Map<number, CategoryEntity>(categories.map((c) => [c.id, c]));

    const itemRepo = ds.getRepository(ItemEntity);
    const itemsList = await itemRepo.find();
    const itemMap = new Map<number, ItemEntity>(itemsList.map((i) => [i.id, i]));

    const variants = await variantRepo.find({ where: { isActive: true } });

    const movements = await movementRepo.find({ where: { storeId } });
    const stockByItem = new Map<number, number>();
    for (const m of movements) {
      const current = stockByItem.get(m.itemId) || 0;
      stockByItem.set(m.itemId, current + m.signedBaseQuantity);
    }

    const items: StockValuationItem[] = [];
    const catMapSummary = new Map<
      number | string,
      { categoryName: string; itemCount: number; totalQty: number; totalValuation: number }
    >();

    let grandTotalQty = 0;
    let grandCostValuation = 0;
    let grandRetailValuation = 0;

    for (const v of variants) {
      const prod = productMap.get(v.productId);
      const cat = prod?.categoryId ? categoryMap.get(prod.categoryId) : null;
      const categoryName = cat?.name || 'Uncategorized';
      const catKey = prod?.categoryId || 'uncategorized';
      const itm = v.itemId ? itemMap.get(v.itemId) : null;
      const unitCode = itm?.baseUnitCode || 'pcs';

      const qty = Math.max(0, v.itemId ? stockByItem.get(v.itemId) || 0 : 0);
      const wholesaleCost = v.wholesalePriceMinorUnits || Math.round(v.priceMinorUnits * 0.7);
      const retailPrice = v.priceMinorUnits;

      const costValuation = Math.round(qty * wholesaleCost);
      const retailValuation = Math.round(qty * retailPrice);
      const potentialProfit = Math.max(0, retailValuation - costValuation);

      grandTotalQty += qty;
      grandCostValuation += costValuation;
      grandRetailValuation += retailValuation;

      // Update Category Summary
      if (!catMapSummary.has(catKey)) {
        catMapSummary.set(catKey, {
          categoryName,
          itemCount: 0,
          totalQty: 0,
          totalValuation: 0,
        });
      }
      const cSummary = catMapSummary.get(catKey)!;
      cSummary.itemCount += 1;
      cSummary.totalQty += qty;
      cSummary.totalValuation += costValuation;

      items.push({
        variantId: v.id,
        productId: v.productId,
        productName: prod?.name || 'Unknown Product',
        sku: v.sku,
        categoryName,
        unitCode,
        quantityOnHand: qty,
        wholesaleCostPriceMinorUnits: wholesaleCost,
        retailPriceMinorUnits: retailPrice,
        totalCostValuationMinorUnits: costValuation,
        totalRetailValuationMinorUnits: retailValuation,
        potentialGrossProfitMinorUnits: potentialProfit,
      });
    }

    // Sort items by valuation descending
    items.sort((a, b) => b.totalCostValuationMinorUnits - a.totalCostValuationMinorUnits);

    const categoryBreakdown: StockValuationCategorySummary[] = Array.from(catMapSummary.entries()).map(
      ([key, val]) => ({
        categoryId: typeof key === 'number' ? key : null,
        categoryName: val.categoryName,
        itemCount: val.itemCount,
        totalQuantity: val.totalQty,
        totalValuationMinorUnits: val.totalValuation,
      }),
    );
    categoryBreakdown.sort((a, b) => b.totalValuationMinorUnits - a.totalValuationMinorUnits);

    return {
      storeId,
      generatedAtUtc: nowUtcString(),
      totalStockQuantity: grandTotalQty,
      totalCostValuationMinorUnits: grandCostValuation,
      totalRetailValuationMinorUnits: grandRetailValuation,
      totalPotentialProfitMinorUnits: grandRetailValuation - grandCostValuation,
      categoryBreakdown,
      items,
    };
  }

  /**
   * 5. Stakeholder Statement Report
   * Individual ledger statement of investments, drawings, and profit distributions.
   */
  public async getStakeholderStatement(
    storeId: number,
    stakeholderId: number,
  ): Promise<StakeholderStatementReport> {
    const ds = this.databaseService.getDataSource();
    const stakeholderRepo = ds.getRepository(StakeholderEntity);
    const equityRepo = ds.getRepository(StakeholderEquityEntity);
    const txRepo = ds.getRepository(StakeholderTransactionEntity);

    const s = await stakeholderRepo.findOne({ where: { id: stakeholderId, storeId } });
    if (!s) {
      throw new NotFoundException(`Stakeholder with ID ${stakeholderId} not found`);
    }

    const equities = await equityRepo.find({ where: { stakeholderId } });
    const activeEquity = equities.find((eq) => !eq.effectiveTo) || equities[0];

    const txs = await txRepo.find({
      where: { stakeholderId, storeId },
      order: { id: 'ASC' },
    });

    let runningBalance = 0;
    let totalInvested = 0;
    let totalDrawings = 0;
    let totalDistributions = 0;

    const statementLines = txs.map((t) => {
      const isCredit =
        t.type === 'CAPITAL_INTRODUCED' ||
        t.type === 'ADDITIONAL_INVESTMENT' ||
        t.type === 'LOAN_IN';
      const isDebit =
        t.type === 'CAPITAL_WITHDRAWAL' || t.type === 'DRAWINGS' || t.type === 'LOAN_REPAYMENT';

      if (isCredit) {
        runningBalance += t.amountMinorUnits;
        if (t.type !== 'LOAN_IN') totalInvested += t.amountMinorUnits;
      } else if (isDebit) {
        runningBalance -= t.amountMinorUnits;
        if (t.type === 'DRAWINGS') totalDrawings += t.amountMinorUnits;
      } else if (t.type === 'PROFIT_DISTRIBUTION') {
        totalDistributions += t.amountMinorUnits;
      }

      return {
        id: t.id,
        txnNumber: t.txnNumber,
        txnDate: t.txnDate,
        type: t.type,
        amountMinorUnits: t.amountMinorUnits,
        paymentMethod: t.paymentMethod,
        reference: t.reference,
        notes: t.notes,
        runningBalanceMinorUnits: runningBalance,
      };
    });

    return {
      stakeholderId: s.id,
      stakeholderCode: s.code,
      fullName: s.fullName,
      stakeholderType: s.stakeholderType,
      ownershipPercent: (activeEquity?.ownershipBps || 0) / 100,
      profitSharePercent: (activeEquity?.profitShareBps || 0) / 100,
      shareMode: activeEquity?.shareMode || 'FIXED_PERCENT',
      totalCapitalInvestedMinorUnits: totalInvested,
      totalDrawingsMinorUnits: totalDrawings,
      totalProfitDistributedMinorUnits: totalDistributions,
      currentCapitalBalanceMinorUnits: runningBalance,
      transactions: statementLines,
    };
  }
}
