import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  StakeholderEntity,
  StakeholderEquityEntity,
  StakeholderTransactionEntity,
  FiscalPeriodEntity,
  ProfitDistributionRunEntity,
  ProfitDistributionLineEntity,
  SaleEntity,
  SaleItemEntity,
  SalesReturnEntity,
  ExpenseEntity,
  SalaryPaymentEntity,
  ProductVariantEntity,
} from '@rz-crm/database';
import {
  Stakeholder,
  CreateStakeholderInput,
  UpdateStakeholderInput,
  UpdateStakeholderEquityInput,
  StakeholderTransaction,
  CreateStakeholderTxInput,
  FiscalPeriod,
  CreateFiscalPeriodInput,
  CloseFiscalPeriodInput,
  ProfitDistributionRun,
  ProfitDistributionLine,
  CalculateDistributionInput,
  CreateDistributionRunInput,
  ApproveDistributionRunInput,
  PayoutDistributionRunInput,
  CompanyPnlSummary,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class StakeholdersService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * List all stakeholders for a store, including their current active equity and computed financial totals.
   */
  public async listStakeholders(storeId: number): Promise<Stakeholder[]> {
    const ds = this.databaseService.getDataSource();
    const stakeholderRepo = ds.getRepository(StakeholderEntity);
    const equityRepo = ds.getRepository(StakeholderEquityEntity);
    const txRepo = ds.getRepository(StakeholderTransactionEntity);

    const stakeholders = await stakeholderRepo.find({
      where: { storeId },
      order: { id: 'ASC' },
    });

    const equities = await equityRepo.find();
    const txs = await txRepo.find({ where: { storeId } });

    // Group active equity by stakeholder
    const activeEquityByStakeholder = new Map<number, StakeholderEquityEntity>();
    for (const eq of equities) {
      if (!eq.effectiveTo) {
        activeEquityByStakeholder.set(eq.stakeholderId, eq);
      }
    }

    // Group transactions by stakeholder
    const txsByStakeholder = new Map<number, StakeholderTransactionEntity[]>();
    for (const tx of txs) {
      if (!txsByStakeholder.has(tx.stakeholderId)) {
        txsByStakeholder.set(tx.stakeholderId, []);
      }
      txsByStakeholder.get(tx.stakeholderId)!.push(tx);
    }

    return stakeholders.map((s) => {
      const activeEquity = activeEquityByStakeholder.get(s.id);
      const sTxs = txsByStakeholder.get(s.id) || [];

      let capitalBalanceMinorUnits = 0;
      let totalDrawingsMinorUnits = 0;
      let totalDistributionsMinorUnits = 0;

      for (const t of sTxs) {
        if (t.type === 'CAPITAL_INTRODUCED' || t.type === 'ADDITIONAL_INVESTMENT' || t.type === 'LOAN_IN') {
          capitalBalanceMinorUnits += t.amountMinorUnits;
        } else if (t.type === 'CAPITAL_WITHDRAWAL' || t.type === 'LOAN_REPAYMENT') {
          capitalBalanceMinorUnits -= t.amountMinorUnits;
        } else if (t.type === 'DRAWINGS') {
          capitalBalanceMinorUnits -= t.amountMinorUnits;
          totalDrawingsMinorUnits += t.amountMinorUnits;
        } else if (t.type === 'PROFIT_DISTRIBUTION') {
          totalDistributionsMinorUnits += t.amountMinorUnits;
        }
      }

      return {
        id: s.id,
        storeId: s.storeId,
        code: s.code,
        fullName: s.fullName,
        cnicOrTaxId: s.cnicOrTaxId,
        phone: s.phone,
        email: s.email,
        address: s.address,
        stakeholderType: s.stakeholderType,
        status: s.status,
        joinedDate: s.joinedDate,
        userId: s.userId,
        notes: s.notes,
        createdAtUtc: s.createdAtUtc,
        updatedAtUtc: s.updatedAtUtc,
        currentEquity: activeEquity
          ? {
              shareMode: activeEquity.shareMode,
              ownershipBps: activeEquity.ownershipBps,
              profitShareBps: activeEquity.profitShareBps,
              lossShareBps: activeEquity.lossShareBps,
              effectiveFrom: activeEquity.effectiveFrom,
            }
          : undefined,
        capitalBalanceMinorUnits,
        totalDrawingsMinorUnits,
        totalDistributionsMinorUnits,
      };
    });
  }

  /**
   * Create a new stakeholder with initial equity ratio and optional initial capital transaction.
   */
  public async createStakeholder(
    input: CreateStakeholderInput,
    storeId: number = 1,
    createdBy: string = 'System Admin',
  ): Promise<Stakeholder> {
    const ds = this.databaseService.getDataSource();

    return await ds.transaction(async (manager) => {
      const stakeholderRepo = manager.getRepository(StakeholderEntity);
      const equityRepo = manager.getRepository(StakeholderEquityEntity);
      const txRepo = manager.getRepository(StakeholderTransactionEntity);

      // Generate code
      const count = await stakeholderRepo.count();
      const code = `STK-${String(count + 1).padStart(4, '0')}`;
      const now = nowUtcString();

      const stakeholder = stakeholderRepo.create({
        storeId,
        code,
        fullName: input.fullName.trim(),
        cnicOrTaxId: input.cnicOrTaxId?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        stakeholderType: input.stakeholderType,
        status: 'ACTIVE',
        joinedDate: input.joinedDate,
        notes: input.notes?.trim() || null,
        createdAtUtc: now,
        updatedAtUtc: now,
      });

      const savedStakeholder = await stakeholderRepo.save(stakeholder);

      // Save initial equity
      const equity = equityRepo.create({
        stakeholderId: savedStakeholder.id,
        effectiveFrom: input.joinedDate,
        effectiveTo: null,
        shareMode: input.shareMode,
        ownershipBps: input.ownershipBps,
        profitShareBps: input.profitShareBps,
        lossShareBps: input.lossShareBps,
        notes: 'Initial equity configuration on registration',
        createdAtUtc: now,
      });
      await equityRepo.save(equity);

      // Record initial capital if provided
      let capitalBalanceMinorUnits = 0;
      if (input.initialCapitalMinorUnits > 0) {
        const txCount = await txRepo.count();
        const txnNumber = `CTX-${Date.now().toString().slice(-6)}-${String(txCount + 1).padStart(3, '0')}`;

        const tx = txRepo.create({
          storeId,
          stakeholderId: savedStakeholder.id,
          txnNumber,
          type: 'CAPITAL_INTRODUCED',
          amountMinorUnits: input.initialCapitalMinorUnits,
          paymentMethod: input.initialPaymentMethod,
          reference: 'Initial Capital Injection',
          notes: input.notes || 'Initial capital deposited',
          periodId: null,
          txnDate: input.joinedDate,
          createdBy,
          createdAtUtc: now,
        });
        await txRepo.save(tx);
        capitalBalanceMinorUnits = input.initialCapitalMinorUnits;
      }

      return {
        id: savedStakeholder.id,
        storeId: savedStakeholder.storeId,
        code: savedStakeholder.code,
        fullName: savedStakeholder.fullName,
        cnicOrTaxId: savedStakeholder.cnicOrTaxId,
        phone: savedStakeholder.phone,
        email: savedStakeholder.email,
        address: savedStakeholder.address,
        stakeholderType: savedStakeholder.stakeholderType,
        status: savedStakeholder.status,
        joinedDate: savedStakeholder.joinedDate,
        userId: savedStakeholder.userId,
        notes: savedStakeholder.notes,
        createdAtUtc: savedStakeholder.createdAtUtc,
        updatedAtUtc: savedStakeholder.updatedAtUtc,
        currentEquity: {
          shareMode: equity.shareMode,
          ownershipBps: equity.ownershipBps,
          profitShareBps: equity.profitShareBps,
          lossShareBps: equity.lossShareBps,
          effectiveFrom: equity.effectiveFrom,
        },
        capitalBalanceMinorUnits,
        totalDrawingsMinorUnits: 0,
        totalDistributionsMinorUnits: 0,
      };
    });
  }

  /**
   * Update stakeholder personal & contact information.
   */
  public async updateStakeholder(input: UpdateStakeholderInput): Promise<Stakeholder> {
    const ds = this.databaseService.getDataSource();
    const stakeholderRepo = ds.getRepository(StakeholderEntity);

    const s = await stakeholderRepo.findOne({ where: { id: input.id } });
    if (!s) {
      throw new NotFoundException(`Stakeholder with ID ${input.id} not found`);
    }

    s.fullName = input.fullName.trim();
    s.cnicOrTaxId = input.cnicOrTaxId?.trim() || null;
    s.phone = input.phone?.trim() || null;
    s.email = input.email?.trim() || null;
    s.address = input.address?.trim() || null;
    s.stakeholderType = input.stakeholderType;
    s.status = input.status;
    s.notes = input.notes?.trim() || null;
    s.updatedAtUtc = nowUtcString();

    await stakeholderRepo.save(s);

    const list = await this.listStakeholders(s.storeId);
    return list.find((item) => item.id === s.id)!;
  }

  /**
   * Update stakeholder equity ratio (versioned; preserves full historical audit).
   */
  public async updateStakeholderEquity(input: UpdateStakeholderEquityInput): Promise<void> {
    const ds = this.databaseService.getDataSource();

    await ds.transaction(async (manager) => {
      const equityRepo = manager.getRepository(StakeholderEquityEntity);

      // Close previous active equity record
      const activeEquities = await equityRepo.find({
        where: { stakeholderId: input.stakeholderId },
      });

      const now = nowUtcString();
      for (const eq of activeEquities) {
        if (!eq.effectiveTo) {
          eq.effectiveTo = input.effectiveFrom;
          await equityRepo.save(eq);
        }
      }

      // Create new equity version
      const newEquity = equityRepo.create({
        stakeholderId: input.stakeholderId,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
        shareMode: input.shareMode,
        ownershipBps: input.ownershipBps,
        profitShareBps: input.profitShareBps,
        lossShareBps: input.lossShareBps,
        notes: input.notes?.trim() || 'Equity ratio update',
        createdAtUtc: now,
      });

      await equityRepo.save(newEquity);
    });
  }

  /**
   * List immutable capital transactions.
   */
  public async listTransactions(storeId: number, stakeholderId?: number): Promise<StakeholderTransaction[]> {
    const ds = this.databaseService.getDataSource();
    const txRepo = ds.getRepository(StakeholderTransactionEntity);
    const stakeholderRepo = ds.getRepository(StakeholderEntity);

    const where: any = { storeId };
    if (stakeholderId) {
      where.stakeholderId = stakeholderId;
    }

    const txs = await txRepo.find({
      where,
      order: { id: 'DESC' },
    });

    const stakeholders = await stakeholderRepo.find({ where: { storeId } });
    const nameMap = new Map<number, string>(stakeholders.map((s) => [s.id, s.fullName]));

    return txs.map((t) => ({
      id: t.id,
      storeId: t.storeId,
      stakeholderId: t.stakeholderId,
      stakeholderName: nameMap.get(t.stakeholderId) || 'Unknown Partner',
      txnNumber: t.txnNumber,
      type: t.type,
      amountMinorUnits: t.amountMinorUnits,
      paymentMethod: t.paymentMethod,
      reference: t.reference,
      notes: t.notes,
      periodId: t.periodId,
      txnDate: t.txnDate,
      createdBy: t.createdBy,
      createdAtUtc: t.createdAtUtc,
    }));
  }

  /**
   * Create an immutable capital transaction (Investment, Drawings, Withdrawal, or Loan).
   */
  public async createTransaction(
    input: CreateStakeholderTxInput,
    storeId: number = 1,
    createdBy: string = 'System Admin',
  ): Promise<StakeholderTransaction> {
    const ds = this.databaseService.getDataSource();
    const stakeholderRepo = ds.getRepository(StakeholderEntity);
    const txRepo = ds.getRepository(StakeholderTransactionEntity);

    const stakeholder = await stakeholderRepo.findOne({ where: { id: input.stakeholderId } });
    if (!stakeholder) {
      throw new NotFoundException(`Stakeholder with ID ${input.stakeholderId} not found`);
    }

    const txCount = await txRepo.count();
    const txnNumber = `CTX-${Date.now().toString().slice(-6)}-${String(txCount + 1).padStart(3, '0')}`;
    const now = nowUtcString();

    const tx = txRepo.create({
      storeId,
      stakeholderId: input.stakeholderId,
      txnNumber,
      type: input.type,
      amountMinorUnits: input.amountMinorUnits,
      paymentMethod: input.paymentMethod,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      periodId: input.periodId || null,
      txnDate: input.txnDate,
      createdBy,
      createdAtUtc: now,
    });

    const saved = await txRepo.save(tx);

    return {
      id: saved.id,
      storeId: saved.storeId,
      stakeholderId: saved.stakeholderId,
      stakeholderName: stakeholder.fullName,
      txnNumber: saved.txnNumber,
      type: saved.type,
      amountMinorUnits: saved.amountMinorUnits,
      paymentMethod: saved.paymentMethod,
      reference: saved.reference,
      notes: saved.notes,
      periodId: saved.periodId,
      txnDate: saved.txnDate,
      createdBy: saved.createdBy,
      createdAtUtc: saved.createdAtUtc,
    };
  }

  /**
   * Fiscal Periods Management
   */
  public async listFiscalPeriods(storeId: number): Promise<FiscalPeriod[]> {
    const ds = this.databaseService.getDataSource();
    const periodRepo = ds.getRepository(FiscalPeriodEntity);

    return await periodRepo.find({
      where: { storeId },
      order: { startDate: 'DESC' },
    });
  }

  public async createFiscalPeriod(input: CreateFiscalPeriodInput, storeId: number = 1): Promise<FiscalPeriod> {
    const ds = this.databaseService.getDataSource();
    const periodRepo = ds.getRepository(FiscalPeriodEntity);

    const count = await periodRepo.count();
    const periodCode = `FP-${input.startDate.slice(0, 7)}-${String(count + 1).padStart(2, '0')}`;
    const now = nowUtcString();

    const period = periodRepo.create({
      storeId,
      periodCode,
      label: input.label.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'OPEN',
      notes: input.notes?.trim() || null,
      createdAtUtc: now,
      updatedAtUtc: now,
    });

    return await periodRepo.save(period);
  }

  public async closeFiscalPeriod(
    input: CloseFiscalPeriodInput,
    closedBy: string = 'System Admin',
  ): Promise<FiscalPeriod> {
    const ds = this.databaseService.getDataSource();
    const periodRepo = ds.getRepository(FiscalPeriodEntity);

    const period = await periodRepo.findOne({ where: { id: input.periodId } });
    if (!period) {
      throw new NotFoundException(`Fiscal period with ID ${input.periodId} not found`);
    }

    const now = nowUtcString();
    period.status = 'CLOSED';
    period.closedBy = closedBy;
    period.closedAtUtc = now;
    if (input.notes) period.notes = (period.notes ? period.notes + ' | ' : '') + input.notes;
    period.updatedAtUtc = now;

    return await periodRepo.save(period);
  }

  /**
   * Calculate profit & loss for a fiscal period and allocate partner shares.
   */
  public async calculateDistribution(input: CalculateDistributionInput): Promise<ProfitDistributionRun> {
    const ds = this.databaseService.getDataSource();
    const periodRepo = ds.getRepository(FiscalPeriodEntity);
    const saleRepo = ds.getRepository(SaleEntity);
    const saleItemRepo = ds.getRepository(SaleItemEntity);
    const returnRepo = ds.getRepository(SalesReturnEntity);
    const expenseRepo = ds.getRepository(ExpenseEntity);
    const salaryRepo = ds.getRepository(SalaryPaymentEntity);
    const variantRepo = ds.getRepository(ProductVariantEntity);

    const period = await periodRepo.findOne({ where: { id: input.periodId } });
    if (!period) {
      throw new NotFoundException(`Fiscal period with ID ${input.periodId} not found`);
    }

    // 1. Sales Revenue
    const allSales = await saleRepo.find({ where: { storeId: period.storeId, status: 'completed' } });
    const periodSales = allSales.filter((s) => {
      const d = s.createdAtUtc.slice(0, 10);
      return d >= period.startDate && d <= period.endDate;
    });

    let grossSalesMinorUnits = 0;
    for (const s of periodSales) {
      grossSalesMinorUnits += s.totalMinorUnits;
    }

    // 2. Sales Returns
    const allReturns = await returnRepo.find({ where: { storeId: period.storeId, status: 'COMPLETED' } });
    const periodReturns = allReturns.filter((r) => {
      const d = r.returnDateUtc.slice(0, 10);
      return d >= period.startDate && d <= period.endDate;
    });

    let salesReturnsMinorUnits = 0;
    for (const r of periodReturns) {
      salesReturnsMinorUnits += r.refundAmountMinorUnits;
    }

    const revenueMinorUnits = Math.max(0, grossSalesMinorUnits - salesReturnsMinorUnits);

    // 3. COGS Calculation
    const variants = await variantRepo.find();
    const costMap = new Map<number, number>(variants.map((v) => [v.id, v.wholesalePriceMinorUnits || 0]));

    let cogsMinorUnits = 0;
    if (periodSales.length > 0) {
      const saleIds = new Set(periodSales.map((s) => s.id));
      const allItems = await saleItemRepo.find();
      for (const item of allItems) {
        if (saleIds.has(item.saleId)) {
          const unitCost = costMap.get(item.variantId) || Math.round(item.unitPriceMinorUnits * 0.7);
          cogsMinorUnits += Math.round(unitCost * item.quantity);
        }
      }
    }

    const grossProfitMinorUnits = revenueMinorUnits - cogsMinorUnits;

    // 4. Operating Expenses
    const allExpenses = await expenseRepo.find({ where: { storeId: period.storeId } });
    const periodExpenses = allExpenses.filter((e) => e.expenseDate >= period.startDate && e.expenseDate <= period.endDate);

    let operatingExpensesMinorUnits = 0;
    for (const e of periodExpenses) {
      operatingExpensesMinorUnits += e.amountMinorUnits;
    }

    // 5. Staff Salaries (shown separately from general opex)
    const allSalaries = await salaryRepo.find({ where: { storeId: period.storeId } });
    const periodSalaries = allSalaries.filter((s) => s.paymentDate >= period.startDate && s.paymentDate <= period.endDate);

    let staffCostMinorUnits = 0;
    for (const s of periodSalaries) {
      staffCostMinorUnits += s.netPaidMinorUnits;
    }

    // 6. Net Profit
    const netProfitMinorUnits = grossProfitMinorUnits - operatingExpensesMinorUnits - staffCostMinorUnits;

    const retentionBps = input.retentionPercentBps || 0;
    const retainedEarningsMinorUnits =
      netProfitMinorUnits > 0 ? Math.round((netProfitMinorUnits * retentionBps) / 10000) : 0;
    const distributableProfitMinorUnits = Math.max(0, netProfitMinorUnits - retainedEarningsMinorUnits);

    // 7. Active Stakeholders & Allocation
    const stakeholders = await this.listStakeholders(period.storeId);
    const activeStakeholders = stakeholders.filter((s) => s.status === 'ACTIVE');

    const lines: ProfitDistributionLine[] = [];

    if (activeStakeholders.length > 0 && distributableProfitMinorUnits > 0) {
      // Determine shares
      let totalActiveCapital = 0;
      for (const s of activeStakeholders) {
        totalActiveCapital += Math.max(0, s.capitalBalanceMinorUnits || 0);
      }

      // Compute initial basis points
      let remainingBps = 10000;
      const computedShares: { stakeholder: Stakeholder; shareMode: 'FIXED_PERCENT' | 'CAPITAL_PROPORTIONAL'; bps: number }[] = [];

      for (let i = 0; i < activeStakeholders.length; i++) {
        const s = activeStakeholders[i]!;
        const isLast = i === activeStakeholders.length - 1;
        const mode = s.currentEquity?.shareMode || 'FIXED_PERCENT';

        let bps = 0;
        if (mode === 'FIXED_PERCENT') {
          bps = s.currentEquity?.profitShareBps || 0;
        } else {
          // Capital proportional
          if (totalActiveCapital > 0) {
            bps = Math.round(((s.capitalBalanceMinorUnits || 0) / totalActiveCapital) * 10000);
          } else {
            bps = Math.round(10000 / activeStakeholders.length);
          }
        }

        if (isLast) {
          // Normalize to exactly 10,000 bps
          bps = Math.max(0, remainingBps);
        } else {
          remainingBps -= bps;
        }

        computedShares.push({ stakeholder: s, shareMode: mode, bps });
      }

      // Allocate amounts
      let remainingAmount = distributableProfitMinorUnits;
      for (let i = 0; i < computedShares.length; i++) {
        const item = computedShares[i]!;
        const isLast = i === computedShares.length - 1;

        let allocatedAmount = Math.round((distributableProfitMinorUnits * item.bps) / 10000);
        if (isLast) {
          allocatedAmount = remainingAmount;
        } else {
          remainingAmount -= allocatedAmount;
        }

        lines.push({
          stakeholderId: item.stakeholder.id,
          stakeholderName: item.stakeholder.fullName,
          shareMode: item.shareMode,
          shareBps: item.bps,
          capitalBalanceMinorUnits: item.stakeholder.capitalBalanceMinorUnits || 0,
          allocatedAmountMinorUnits: Math.max(0, allocatedAmount),
          paidAmountMinorUnits: 0,
          status: 'PENDING',
          notes: `${(item.bps / 100).toFixed(2)}% share of distributable profit`,
        });
      }
    } else {
      // Distributable profit is 0 or negative
      for (const s of activeStakeholders) {
        lines.push({
          stakeholderId: s.id,
          stakeholderName: s.fullName,
          shareMode: s.currentEquity?.shareMode || 'FIXED_PERCENT',
          shareBps: s.currentEquity?.profitShareBps || 0,
          capitalBalanceMinorUnits: s.capitalBalanceMinorUnits || 0,
          allocatedAmountMinorUnits: 0,
          paidAmountMinorUnits: 0,
          status: 'PENDING',
          notes: 'No distributable profit in this period',
        });
      }
    }

    return {
      id: 0,
      storeId: period.storeId,
      runNumber: `PDR-PREVIEW`,
      periodId: period.id,
      periodLabel: period.label,
      revenueMinorUnits,
      cogsMinorUnits,
      grossProfitMinorUnits,
      operatingExpensesMinorUnits,
      staffCostMinorUnits,
      netProfitMinorUnits,
      distributableProfitMinorUnits,
      retainedEarningsMinorUnits,
      status: 'DRAFT',
      createdBy: 'System Preview',
      createdAtUtc: nowUtcString(),
      updatedAtUtc: nowUtcString(),
      lines,
    };
  }

  /**
   * Save a profit distribution run (Status DRAFT).
   */
  public async createDistributionRun(
    input: CreateDistributionRunInput,
    storeId: number = 1,
    createdBy: string = 'System Admin',
  ): Promise<ProfitDistributionRun> {
    const ds = this.databaseService.getDataSource();

    const calculation = await this.calculateDistribution({
      periodId: input.periodId,
      retentionPercentBps: input.retentionPercentBps,
    });

    return await ds.transaction(async (manager) => {
      const runRepo = manager.getRepository(ProfitDistributionRunEntity);
      const lineRepo = manager.getRepository(ProfitDistributionLineEntity);

      const count = await runRepo.count();
      const runNumber = `PDR-${Date.now().toString().slice(-6)}-${String(count + 1).padStart(3, '0')}`;
      const now = nowUtcString();

      const run = runRepo.create({
        storeId,
        runNumber,
        periodId: input.periodId,
        revenueMinorUnits: calculation.revenueMinorUnits,
        cogsMinorUnits: calculation.cogsMinorUnits,
        grossProfitMinorUnits: calculation.grossProfitMinorUnits,
        operatingExpensesMinorUnits: calculation.operatingExpensesMinorUnits,
        staffCostMinorUnits: calculation.staffCostMinorUnits,
        netProfitMinorUnits: calculation.netProfitMinorUnits,
        distributableProfitMinorUnits: calculation.distributableProfitMinorUnits,
        retainedEarningsMinorUnits: calculation.retainedEarningsMinorUnits,
        status: 'DRAFT',
        createdBy,
        notes: input.notes?.trim() || null,
        createdAtUtc: now,
        updatedAtUtc: now,
      });

      const savedRun = await runRepo.save(run);

      const savedLines: ProfitDistributionLine[] = [];
      for (const line of calculation.lines || []) {
        const l = lineRepo.create({
          runId: savedRun.id,
          stakeholderId: line.stakeholderId,
          stakeholderName: line.stakeholderName,
          shareMode: line.shareMode,
          shareBps: line.shareBps,
          capitalBalanceMinorUnits: line.capitalBalanceMinorUnits,
          allocatedAmountMinorUnits: line.allocatedAmountMinorUnits,
          paidAmountMinorUnits: 0,
          status: 'PENDING',
          notes: line.notes || null,
          createdAtUtc: now,
        });
        const savedL = await lineRepo.save(l);
        savedLines.push({
          id: savedL.id,
          runId: savedL.runId,
          stakeholderId: savedL.stakeholderId,
          stakeholderName: savedL.stakeholderName,
          shareMode: savedL.shareMode,
          shareBps: savedL.shareBps,
          capitalBalanceMinorUnits: savedL.capitalBalanceMinorUnits,
          allocatedAmountMinorUnits: savedL.allocatedAmountMinorUnits,
          paidAmountMinorUnits: savedL.paidAmountMinorUnits,
          status: savedL.status,
          notes: savedL.notes,
          createdAtUtc: savedL.createdAtUtc,
        });
      }

      return {
        id: savedRun.id,
        storeId: savedRun.storeId,
        runNumber: savedRun.runNumber,
        periodId: savedRun.periodId,
        periodLabel: calculation.periodLabel,
        revenueMinorUnits: savedRun.revenueMinorUnits,
        cogsMinorUnits: savedRun.cogsMinorUnits,
        grossProfitMinorUnits: savedRun.grossProfitMinorUnits,
        operatingExpensesMinorUnits: savedRun.operatingExpensesMinorUnits,
        staffCostMinorUnits: savedRun.staffCostMinorUnits,
        netProfitMinorUnits: savedRun.netProfitMinorUnits,
        distributableProfitMinorUnits: savedRun.distributableProfitMinorUnits,
        retainedEarningsMinorUnits: savedRun.retainedEarningsMinorUnits,
        status: savedRun.status,
        createdBy: savedRun.createdBy,
        notes: savedRun.notes,
        createdAtUtc: savedRun.createdAtUtc,
        updatedAtUtc: savedRun.updatedAtUtc,
        lines: savedLines,
      };
    });
  }

  /**
   * List distribution runs and their allocated lines.
   */
  public async listDistributionRuns(storeId: number, periodId?: number): Promise<ProfitDistributionRun[]> {
    const ds = this.databaseService.getDataSource();
    const runRepo = ds.getRepository(ProfitDistributionRunEntity);
    const lineRepo = ds.getRepository(ProfitDistributionLineEntity);
    const periodRepo = ds.getRepository(FiscalPeriodEntity);

    const where: any = { storeId };
    if (periodId) {
      where.periodId = periodId;
    }

    const runs = await runRepo.find({
      where,
      order: { id: 'DESC' },
    });

    const lines = await lineRepo.find();
    const linesByRun = new Map<number, ProfitDistributionLineEntity[]>();
    for (const l of lines) {
      if (!linesByRun.has(l.runId)) linesByRun.set(l.runId, []);
      linesByRun.get(l.runId)!.push(l);
    }

    const periods = await periodRepo.find({ where: { storeId } });
    const periodMap = new Map<number, string>(periods.map((p) => [p.id, p.label]));

    return runs.map((r) => ({
      id: r.id,
      storeId: r.storeId,
      runNumber: r.runNumber,
      periodId: r.periodId,
      periodLabel: periodMap.get(r.periodId) || `Period #${r.periodId}`,
      revenueMinorUnits: r.revenueMinorUnits,
      cogsMinorUnits: r.cogsMinorUnits,
      grossProfitMinorUnits: r.grossProfitMinorUnits,
      operatingExpensesMinorUnits: r.operatingExpensesMinorUnits,
      staffCostMinorUnits: r.staffCostMinorUnits,
      netProfitMinorUnits: r.netProfitMinorUnits,
      distributableProfitMinorUnits: r.distributableProfitMinorUnits,
      retainedEarningsMinorUnits: r.retainedEarningsMinorUnits,
      status: r.status,
      createdBy: r.createdBy,
      approvedBy: r.approvedBy,
      approvedAtUtc: r.approvedAtUtc,
      notes: r.notes,
      createdAtUtc: r.createdAtUtc,
      updatedAtUtc: r.updatedAtUtc,
      lines: (linesByRun.get(r.id) || []).map((l) => ({
        id: l.id,
        runId: l.runId,
        stakeholderId: l.stakeholderId,
        stakeholderName: l.stakeholderName,
        shareMode: l.shareMode,
        shareBps: l.shareBps,
        capitalBalanceMinorUnits: l.capitalBalanceMinorUnits,
        allocatedAmountMinorUnits: l.allocatedAmountMinorUnits,
        paidAmountMinorUnits: l.paidAmountMinorUnits,
        status: l.status,
        payoutTxnId: l.payoutTxnId,
        notes: l.notes,
        createdAtUtc: l.createdAtUtc,
      })),
    }));
  }

  /**
   * Approve a distribution run.
   */
  public async approveDistributionRun(
    input: ApproveDistributionRunInput,
    approvedBy: string = 'Director',
  ): Promise<ProfitDistributionRun> {
    const ds = this.databaseService.getDataSource();
    const runRepo = ds.getRepository(ProfitDistributionRunEntity);

    const run = await runRepo.findOne({ where: { id: input.runId } });
    if (!run) {
      throw new NotFoundException(`Distribution run with ID ${input.runId} not found`);
    }

    if (run.status !== 'DRAFT') {
      throw new BadRequestException(`Distribution run is already ${run.status}`);
    }

    const now = nowUtcString();
    run.status = 'APPROVED';
    run.approvedBy = approvedBy;
    run.approvedAtUtc = now;
    if (input.notes) run.notes = (run.notes ? run.notes + ' | ' : '') + input.notes;
    run.updatedAtUtc = now;

    await runRepo.save(run);

    const runs = await this.listDistributionRuns(run.storeId);
    return runs.find((r) => r.id === run.id)!;
  }

  /**
   * Payout an approved distribution run: records immutable PROFIT_DISTRIBUTION transactions.
   */
  public async payoutDistributionRun(
    input: PayoutDistributionRunInput,
    paidBy: string = 'Finance Manager',
  ): Promise<ProfitDistributionRun> {
    const ds = this.databaseService.getDataSource();

    return await ds.transaction(async (manager) => {
      const runRepo = manager.getRepository(ProfitDistributionRunEntity);
      const lineRepo = manager.getRepository(ProfitDistributionLineEntity);
      const txRepo = manager.getRepository(StakeholderTransactionEntity);

      const run = await runRepo.findOne({ where: { id: input.runId } });
      if (!run) {
        throw new NotFoundException(`Distribution run with ID ${input.runId} not found`);
      }

      if (run.status !== 'APPROVED') {
        throw new BadRequestException(`Only APPROVED distribution runs can be paid out. Current status: ${run.status}`);
      }

      const lines = await lineRepo.find({ where: { runId: run.id } });
      const now = nowUtcString();
      const today = now.slice(0, 10);

      let txIndex = 0;
      for (const line of lines) {
        if (line.allocatedAmountMinorUnits > 0 && line.status !== 'PAID') {
          txIndex++;
          const txnNumber = `CTX-${Date.now().toString().slice(-6)}-${String(txIndex).padStart(3, '0')}`;

          const tx = txRepo.create({
            storeId: run.storeId,
            stakeholderId: line.stakeholderId,
            txnNumber,
            type: 'PROFIT_DISTRIBUTION',
            amountMinorUnits: line.allocatedAmountMinorUnits,
            paymentMethod: input.paymentMethod,
            reference: input.reference?.trim() || `Profit Distribution ${run.runNumber}`,
            notes: input.notes?.trim() || `Disbursed for period #${run.periodId}`,
            periodId: run.periodId,
            txnDate: today,
            createdBy: paidBy,
            createdAtUtc: now,
          });

          const savedTx = await txRepo.save(tx);

          line.paidAmountMinorUnits = line.allocatedAmountMinorUnits;
          line.status = 'PAID';
          line.payoutTxnId = savedTx.id;
          await lineRepo.save(line);
        }
      }

      run.status = 'PAID';
      run.updatedAtUtc = now;
      await runRepo.save(run);

      const runs = await this.listDistributionRuns(run.storeId);
      return runs.find((r) => r.id === run.id)!;
    });
  }

  /**
   * Top-Level Company P&L Summary for Stakeholders.
   */
  public async getCompanyPnlSummary(
    storeId: number = 1,
    startDate?: string,
    endDate?: string,
  ): Promise<CompanyPnlSummary> {
    const ds = this.databaseService.getDataSource();
    const saleRepo = ds.getRepository(SaleEntity);
    const saleItemRepo = ds.getRepository(SaleItemEntity);
    const returnRepo = ds.getRepository(SalesReturnEntity);
    const expenseRepo = ds.getRepository(ExpenseEntity);
    const salaryRepo = ds.getRepository(SalaryPaymentEntity);
    const variantRepo = ds.getRepository(ProductVariantEntity);
    const txRepo = ds.getRepository(StakeholderTransactionEntity);
    const stakeholderRepo = ds.getRepository(StakeholderEntity);

    const start = startDate || '2000-01-01';
    const end = endDate || '2099-12-31';

    // 1. Sales
    const sales = await saleRepo.find({ where: { storeId, status: 'completed' } });
    const periodSales = sales.filter((s) => {
      const d = s.createdAtUtc.slice(0, 10);
      return d >= start && d <= end;
    });

    let grossSalesMinorUnits = 0;
    for (const s of periodSales) {
      grossSalesMinorUnits += s.totalMinorUnits;
    }

    // 2. Returns
    const returns = await returnRepo.find({ where: { storeId, status: 'COMPLETED' } });
    const periodReturns = returns.filter((r) => {
      const d = r.returnDateUtc.slice(0, 10);
      return d >= start && d <= end;
    });

    let salesReturnsMinorUnits = 0;
    for (const r of periodReturns) {
      salesReturnsMinorUnits += r.refundAmountMinorUnits;
    }

    const netRevenueMinorUnits = Math.max(0, grossSalesMinorUnits - salesReturnsMinorUnits);

    // 3. COGS
    const variants = await variantRepo.find();
    const costMap = new Map<number, number>(variants.map((v) => [v.id, v.wholesalePriceMinorUnits || 0]));

    let cogsMinorUnits = 0;
    if (periodSales.length > 0) {
      const saleIds = new Set(periodSales.map((s) => s.id));
      const items = await saleItemRepo.find();
      for (const item of items) {
        if (saleIds.has(item.saleId)) {
          const unitCost = costMap.get(item.variantId) || Math.round(item.unitPriceMinorUnits * 0.7);
          cogsMinorUnits += Math.round(unitCost * item.quantity);
        }
      }
    }

    const grossProfitMinorUnits = netRevenueMinorUnits - cogsMinorUnits;

    // 4. Expenses
    const expenses = await expenseRepo.find({ where: { storeId } });
    const periodExpenses = expenses.filter((e) => e.expenseDate >= start && e.expenseDate <= end);

    let operatingExpensesMinorUnits = 0;
    for (const e of periodExpenses) {
      operatingExpensesMinorUnits += e.amountMinorUnits;
    }

    // 5. Salaries
    const salaries = await salaryRepo.find({ where: { storeId } });
    const periodSalaries = salaries.filter((s) => s.paymentDate >= start && s.paymentDate <= end);

    let staffCostMinorUnits = 0;
    for (const s of periodSalaries) {
      staffCostMinorUnits += s.netPaidMinorUnits;
    }

    const netProfitMinorUnits = grossProfitMinorUnits - operatingExpensesMinorUnits - staffCostMinorUnits;

    // 6. Stakeholder Capital, Distributions & Drawings
    const txs = await txRepo.find({ where: { storeId } });
    let totalCapitalInvestedMinorUnits = 0;
    let totalDistributionsPaidMinorUnits = 0;
    let totalDrawingsMinorUnits = 0;

    for (const t of txs) {
      if (t.type === 'CAPITAL_INTRODUCED' || t.type === 'ADDITIONAL_INVESTMENT') {
        totalCapitalInvestedMinorUnits += t.amountMinorUnits;
      } else if (t.type === 'PROFIT_DISTRIBUTION') {
        totalDistributionsPaidMinorUnits += t.amountMinorUnits;
      } else if (t.type === 'DRAWINGS') {
        totalDrawingsMinorUnits += t.amountMinorUnits;
      }
    }

    const activePartnersCount = await stakeholderRepo.count({ where: { storeId, status: 'ACTIVE' } });

    return {
      startDate: start,
      endDate: end,
      grossSalesMinorUnits,
      salesReturnsMinorUnits,
      netRevenueMinorUnits,
      cogsMinorUnits,
      grossProfitMinorUnits,
      operatingExpensesMinorUnits,
      staffCostMinorUnits,
      netProfitMinorUnits,
      totalCapitalInvestedMinorUnits,
      totalDistributionsPaidMinorUnits,
      totalDrawingsMinorUnits,
      activePartnersCount,
    };
  }
}
