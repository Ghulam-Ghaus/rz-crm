import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  SaleEntity,
  SaleItemEntity,
  ProductVariantEntity,
  ProductEntity,
  CategoryEntity,
  GoodsReceiptEntity,
  GoodsReceiptLineEntity,
  ExpenseEntity,
  SalaryPaymentEntity,
  SalaryAdvanceEntity,
} from '@rz-crm/database';
import {
  GetProfitLossQuery,
  ProfitLossReport,
  ProfitLossItemBreakdown,
} from '@rz-crm/contracts';

@Injectable()
export class ProfitLossService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async calculateProfitLoss(query: GetProfitLossQuery): Promise<ProfitLossReport> {
    const ds = this.databaseService.getDataSource();
    const saleRepo = ds.getRepository(SaleEntity);
    const saleItemRepo = ds.getRepository(SaleItemEntity);
    const variantRepo = ds.getRepository(ProductVariantEntity);
    const productRepo = ds.getRepository(ProductEntity);
    const categoryRepo = ds.getRepository(CategoryEntity);
    const grnRepo = ds.getRepository(GoodsReceiptEntity);
    const grnLineRepo = ds.getRepository(GoodsReceiptLineEntity);
    const expenseRepo = ds.getRepository(ExpenseEntity);
    const salaryRepo = ds.getRepository(SalaryPaymentEntity);
    const advanceRepo = ds.getRepository(SalaryAdvanceEntity);

    // Query Operating Expenses
    const expenseQb = expenseRepo
      .createQueryBuilder('exp')
      .where('exp.store_id = :storeId', { storeId: query.storeId });

    if (query.startDateUtc) {
      const startDay = query.startDateUtc.slice(0, 10);
      expenseQb.andWhere('exp.expense_date >= :startDate', { startDate: startDay });
    }
    if (query.endDateUtc) {
      const endDay = query.endDateUtc.slice(0, 10);
      expenseQb.andWhere('exp.expense_date <= :endDate', { endDate: endDay });
    }
    const expenses = await expenseQb.getMany();
    const totalOperatingExpenses = expenses.reduce((sum, e) => sum + e.amountMinorUnits, 0);

    // Query Staff Advances issued in this period
    const advanceQb = advanceRepo
      .createQueryBuilder('adv')
      .where('adv.store_id = :storeId', { storeId: query.storeId });

    if (query.startDateUtc) {
      const startDay = query.startDateUtc.slice(0, 10);
      advanceQb.andWhere('adv.advance_date >= :startDate', { startDate: startDay });
    }
    if (query.endDateUtc) {
      const endDay = query.endDateUtc.slice(0, 10);
      advanceQb.andWhere('adv.advance_date <= :endDate', { endDate: endDay });
    }
    const advances = await advanceQb.getMany();
    const totalAdvances = advances.reduce((sum, a) => sum + (a.amountMinorUnits || 0), 0);

    // Query Staff Payroll (Paid net salaries disbursed in this period)
    const salaryQb = salaryRepo
      .createQueryBuilder('sal')
      .where('sal.store_id = :storeId', { storeId: query.storeId })
      .andWhere('sal.status = :status', { status: 'paid' });

    if (query.startDateUtc) {
      const startDay = query.startDateUtc.slice(0, 10);
      salaryQb.andWhere('sal.payment_date >= :startDate', { startDate: startDay });
    }
    if (query.endDateUtc) {
      const endDay = query.endDateUtc.slice(0, 10);
      salaryQb.andWhere('sal.payment_date <= :endDate', { endDate: endDay });
    }
    const salaries = await salaryQb.getMany();
    const totalPayroll = salaries.reduce(
      (sum, s) => sum + (s.netPaidMinorUnits || 0),
      0
    );

    // 1. Build Sales Query
    const saleQb = saleRepo
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId: query.storeId })
      .andWhere('sale.status = :status', { status: 'completed' });

    if (query.startDateUtc) {
      saleQb.andWhere('sale.created_at_utc >= :startDate', { startDate: query.startDateUtc });
    }
    if (query.endDateUtc) {
      saleQb.andWhere('sale.created_at_utc <= :endDate', { endDate: query.endDateUtc });
    }

    const sales = await saleQb.getMany();
    const saleIds = sales.map((s) => s.id);

    if (saleIds.length === 0) {
      const netProfit = 0 - totalOperatingExpenses - totalPayroll - totalAdvances;
      return {
        storeId: query.storeId,
        startDateUtc: query.startDateUtc ?? null,
        endDateUtc: query.endDateUtc ?? null,
        totalRevenueMinorUnits: 0,
        totalCostMinorUnits: 0,
        grossProfitMinorUnits: 0,
        profitMarginPercent: 0,
        totalOperatingExpensesMinorUnits: totalOperatingExpenses,
        totalPayrollMinorUnits: totalPayroll,
        totalAdvancesMinorUnits: totalAdvances,
        netProfitMinorUnits: netProfit,
        netProfitMarginPercent: 0,
        totalUnitsSold: 0,
        totalSalesCount: 0,
        currencyCode: 'PKR',
        items: [],
      };
    }


    // 2. If supplierId filter is specified, find variants received from this supplier
    let allowedVariantIdsFromSupplier: Set<number> | null = null;
    if (query.supplierId) {
      const grns = await grnRepo.find({
        where: { storeId: query.storeId, supplierId: query.supplierId },
      });
      const grnIds = grns.map((g) => g.id);
      if (grnIds.length > 0) {
        const grnLines = await grnLineRepo
          .createQueryBuilder('line')
          .where('line.goods_receipt_id IN (:...grnIds)', { grnIds })
          .getMany();
        allowedVariantIdsFromSupplier = new Set(grnLines.map((l) => l.productVariantId));
      } else {
        allowedVariantIdsFromSupplier = new Set();
      }
    }

    // 3. Batch query sale items (SQLite parameter chunking if large)
    const saleItems: SaleItemEntity[] = [];
    const CHUNK_SIZE = 400;
    for (let i = 0; i < saleIds.length; i += CHUNK_SIZE) {
      const chunk = saleIds.slice(i, i + CHUNK_SIZE);
      const items = await saleItemRepo
        .createQueryBuilder('item')
        .where('item.sale_id IN (:...chunk)', { chunk })
        .getMany();
      saleItems.push(...items);
    }

    // 4. Preload variants, products, categories for enrichment
    const allVariants = await variantRepo.find();
    const variantMap = new Map(allVariants.map((v) => [v.id, v]));

    const allProducts = await productRepo.find();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    const allCategories = await categoryRepo.find();
    const categoryMap = new Map(allCategories.map((c) => [c.id, c.name]));

    // 5. Aggregate by variant
    const variantAggregates = new Map<
      number,
      {
        variantId: number;
        productName: string;
        sku: string;
        categoryName: string | null;
        unitsSold: number;
        totalRevenue: number;
        costPerUnit: number;
      }
    >();

    for (const item of saleItems) {
      if (query.variantId && item.variantId !== query.variantId) {
        continue;
      }
      if (allowedVariantIdsFromSupplier && !allowedVariantIdsFromSupplier.has(item.variantId)) {
        continue;
      }

      const variant = variantMap.get(item.variantId);
      const product = variant ? productMap.get(variant.productId) : null;
      const categoryId = product?.categoryId ?? null;

      if (query.categoryId && categoryId !== query.categoryId) {
        continue;
      }

      const categoryName = categoryId ? categoryMap.get(categoryId) ?? null : null;
      const costPerUnit = variant?.costMinorUnits ?? 0;

      let agg = variantAggregates.get(item.variantId);
      if (!agg) {
        agg = {
          variantId: item.variantId,
          productName: item.productName || product?.name || 'Unknown Product',
          sku: item.sku || variant?.sku || `VAR-${item.variantId}`,
          categoryName,
          unitsSold: 0,
          totalRevenue: 0,
          costPerUnit,
        };
        variantAggregates.set(item.variantId, agg);
      }

      agg.unitsSold += item.quantity;
      agg.totalRevenue += item.totalMinorUnits;
    }

    // 6. Build Breakdown Items & Global Totals
    const breakdownItems: ProfitLossItemBreakdown[] = [];
    let globalRevenue = 0;
    let globalCost = 0;
    let globalUnits = 0;

    for (const agg of variantAggregates.values()) {
      const lineCost = Math.round(agg.unitsSold * agg.costPerUnit);
      const grossProfit = agg.totalRevenue - lineCost;
      const marginPercent =
        agg.totalRevenue > 0
          ? Number(((grossProfit / agg.totalRevenue) * 100).toFixed(1))
          : 0;

      const avgSellPrice =
        agg.unitsSold > 0 ? Math.round(agg.totalRevenue / agg.unitsSold) : 0;

      breakdownItems.push({
        variantId: agg.variantId,
        productName: agg.productName,
        sku: agg.sku,
        categoryName: agg.categoryName,
        unitsSold: agg.unitsSold,
        avgSellPriceMinorUnits: avgSellPrice,
        avgCostPriceMinorUnits: agg.costPerUnit,
        totalRevenueMinorUnits: agg.totalRevenue,
        totalCostMinorUnits: lineCost,
        grossProfitMinorUnits: grossProfit,
        marginPercent,
      });

      globalRevenue += agg.totalRevenue;
      globalCost += lineCost;
      globalUnits += agg.unitsSold;
    }

    // Sort items by Gross Profit descending
    breakdownItems.sort((a, b) => b.grossProfitMinorUnits - a.grossProfitMinorUnits);

    const globalGrossProfit = globalRevenue - globalCost;
    const globalMarginPercent =
      globalRevenue > 0
        ? Number(((globalGrossProfit / globalRevenue) * 100).toFixed(1))
        : 0;

    const netProfit = globalGrossProfit - totalOperatingExpenses - totalPayroll - totalAdvances;
    const netProfitMarginPercent =
      globalRevenue > 0
        ? Number(((netProfit / globalRevenue) * 100).toFixed(1))
        : 0;

    return {
      storeId: query.storeId,
      startDateUtc: query.startDateUtc ?? null,
      endDateUtc: query.endDateUtc ?? null,
      totalRevenueMinorUnits: globalRevenue,
      totalCostMinorUnits: globalCost,
      grossProfitMinorUnits: globalGrossProfit,
      profitMarginPercent: globalMarginPercent,
      totalOperatingExpensesMinorUnits: totalOperatingExpenses,
      totalPayrollMinorUnits: totalPayroll,
      totalAdvancesMinorUnits: totalAdvances,
      netProfitMinorUnits: netProfit,
      netProfitMarginPercent,
      totalUnitsSold: globalUnits,
      totalSalesCount: sales.length,
      currencyCode: 'PKR',
      items: breakdownItems,
    };
  }

}
