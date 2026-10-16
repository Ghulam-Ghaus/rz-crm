import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CompanyBankAccountEntity,
  BankTransactionEntity,
  SalePaymentEntity,
  SupplierPaymentEntity,
} from '@rz-crm/database';
import {
  CompanyBankAccount,
  CreateBankAccountInput,
  UpdateBankAccountInput,
  BankTransaction,
  ListBankTransactionsQuery,
  CashToBankDepositInput,
  ClearChequeInput,
  BankSummaryStats,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class BankAccountsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * List all company bank accounts for the store
   */
  public async listAccounts(storeId: number = 1): Promise<CompanyBankAccount[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(CompanyBankAccountEntity);

    const accounts = await repo.find({
      where: { storeId },
      order: { id: 'ASC' },
    });

    return accounts.map((acc) => ({
      id: acc.id,
      storeId: acc.storeId,
      bankName: acc.bankName,
      accountTitle: acc.accountTitle,
      accountNumber: acc.accountNumber,
      iban: acc.iban,
      branchName: acc.branchName,
      openingBalanceMinorUnits: acc.openingBalanceMinorUnits,
      currentBalanceMinorUnits: acc.currentBalanceMinorUnits,
      isActive: Boolean(acc.isActive),
      createdAtUtc: acc.createdAtUtc,
      updatedAtUtc: acc.updatedAtUtc,
    }));
  }

  /**
   * Create a new company bank account
   */
  public async createAccount(input: CreateBankAccountInput): Promise<CompanyBankAccount> {
    const ds = this.databaseService.getDataSource();
    const now = nowUtcString();

    return await ds.transaction(async (manager) => {
      const accountRepo = manager.getRepository(CompanyBankAccountEntity);
      const txRepo = manager.getRepository(BankTransactionEntity);

      const openingBal = input.openingBalanceMinorUnits || 0;

      const account = accountRepo.create({
        storeId: input.storeId || 1,
        bankName: input.bankName.trim(),
        accountTitle: input.accountTitle.trim(),
        accountNumber: input.accountNumber.trim(),
        iban: input.iban?.trim() || null,
        branchName: input.branchName?.trim() || null,
        openingBalanceMinorUnits: openingBal,
        currentBalanceMinorUnits: openingBal,
        isActive: 1,
        createdAtUtc: now,
        updatedAtUtc: now,
      });

      const savedAccount = await accountRepo.save(account);

      if (openingBal > 0) {
        const tx = txRepo.create({
          accountId: savedAccount.id,
          txnType: 'OPENING',
          amountMinorUnits: openingBal,
          runningBalanceMinorUnits: openingBal,
          reference: 'OPENING_BAL',
          chequeDirection: null,
          chequeId: null,
          attachmentPath: null,
          notes: 'Account opening initial balance',
          createdAtUtc: now,
        });
        await txRepo.save(tx);
      }

      await this.auditService.log({
        action: 'BANK_ACCOUNT_CREATE',
        resource: `CompanyBankAccount #${savedAccount.id}`,
        severity: 'INFO',
        details: {
          storeId: savedAccount.storeId,
          bankName: savedAccount.bankName,
          accountNumber: savedAccount.accountNumber,
          openingBal,
          summary: `Created bank account ${savedAccount.bankName} - ${savedAccount.accountNumber} with opening balance Rs. ${(openingBal / 100).toFixed(2)}`,
        },
      });

      return {
        id: savedAccount.id,
        storeId: savedAccount.storeId,
        bankName: savedAccount.bankName,
        accountTitle: savedAccount.accountTitle,
        accountNumber: savedAccount.accountNumber,
        iban: savedAccount.iban,
        branchName: savedAccount.branchName,
        openingBalanceMinorUnits: savedAccount.openingBalanceMinorUnits,
        currentBalanceMinorUnits: savedAccount.currentBalanceMinorUnits,
        isActive: Boolean(savedAccount.isActive),
        createdAtUtc: savedAccount.createdAtUtc,
        updatedAtUtc: savedAccount.updatedAtUtc,
      };
    });
  }

  /**
   * Update an existing bank account
   */
  public async updateAccount(input: UpdateBankAccountInput): Promise<CompanyBankAccount> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(CompanyBankAccountEntity);

    const account = await repo.findOne({ where: { id: input.id } });
    if (!account) {
      throw new NotFoundException(`Bank account #${input.id} not found`);
    }

    if (input.bankName !== undefined) account.bankName = input.bankName.trim();
    if (input.accountTitle !== undefined) account.accountTitle = input.accountTitle.trim();
    if (input.accountNumber !== undefined) account.accountNumber = input.accountNumber.trim();
    if (input.iban !== undefined) account.iban = input.iban?.trim() || null;
    if (input.branchName !== undefined) account.branchName = input.branchName?.trim() || null;
    if (input.isActive !== undefined) account.isActive = input.isActive ? 1 : 0;
    account.updatedAtUtc = nowUtcString();

    const saved = await repo.save(account);

    await this.auditService.log({
      action: 'BANK_ACCOUNT_UPDATE',
      resource: `CompanyBankAccount #${saved.id}`,
      severity: 'INFO',
      details: {
        storeId: saved.storeId,
        bankName: saved.bankName,
        accountNumber: saved.accountNumber,
        summary: `Updated bank account ${saved.bankName} - ${saved.accountNumber}`,
      },
    });

    return {
      id: saved.id,
      storeId: saved.storeId,
      bankName: saved.bankName,
      accountTitle: saved.accountTitle,
      accountNumber: saved.accountNumber,
      iban: saved.iban,
      branchName: saved.branchName,
      openingBalanceMinorUnits: saved.openingBalanceMinorUnits,
      currentBalanceMinorUnits: saved.currentBalanceMinorUnits,
      isActive: Boolean(saved.isActive),
      createdAtUtc: saved.createdAtUtc,
      updatedAtUtc: saved.updatedAtUtc,
    };
  }

  /**
   * List bank transactions ledger
   */
  public async listTransactions(query: ListBankTransactionsQuery): Promise<BankTransaction[]> {
    const ds = this.databaseService.getDataSource();
    const txRepo = ds.getRepository(BankTransactionEntity);
    const accRepo = ds.getRepository(CompanyBankAccountEntity);

    const accounts = await accRepo.find({ where: { storeId: query.storeId || 1 } });
    const accMap = new Map<number, CompanyBankAccountEntity>(accounts.map((a) => [a.id, a]));

    const qb = txRepo.createQueryBuilder('tx');

    if (query.bankAccountId) {
      qb.andWhere('tx.account_id = :accId', { accId: query.bankAccountId });
    } else {
      const accountIds = accounts.map((a) => a.id);
      if (accountIds.length === 0) return [];
      qb.andWhere('tx.account_id IN (:...accountIds)', { accountIds });
    }

    if (query.startDateUtc) {
      qb.andWhere('tx.created_at_utc >= :startDate', { startDate: query.startDateUtc });
    }
    if (query.endDateUtc) {
      qb.andWhere('tx.created_at_utc <= :endDate', { endDate: query.endDateUtc });
    }

    qb.orderBy('tx.created_at_utc', 'DESC');
    qb.addOrderBy('tx.id', 'DESC');
    qb.take(query.limit || 100);

    const txs = await qb.getMany();

    return txs.map((tx) => {
      const acc = accMap.get(tx.accountId);
      const isOutflow =
        tx.txnType === 'WITHDRAWAL' ||
        tx.chequeDirection === 'OUTWARD' ||
        tx.txnType === 'EXPENSE_PAYMENT' ||
        tx.txnType === 'SUPPLIER_PAYMENT' ||
        tx.txnType === 'STAKEHOLDER_PAYOUT';

      return {
        id: tx.id,
        accountId: tx.accountId,
        bankName: acc?.bankName,
        accountTitle: acc?.accountTitle,
        accountNumber: acc?.accountNumber,
        txnType: tx.txnType as any,
        direction: isOutflow ? 'OUTFLOW' : 'INFLOW',
        amountMinorUnits: tx.amountMinorUnits,
        runningBalanceMinorUnits: tx.runningBalanceMinorUnits,
        reference: tx.reference,
        chequeDirection: (tx.chequeDirection as any) || null,
        chequeId: tx.chequeId,
        attachmentPath: tx.attachmentPath,
        notes: tx.notes,
        createdAtUtc: tx.createdAtUtc,
      };
    });
  }

  /**
   * Deposit Cash from store cash drawer to company bank account
   */
  public async depositCash(input: CashToBankDepositInput): Promise<BankTransaction> {
    const ds = this.databaseService.getDataSource();
    const now = input.depositDateUtc || nowUtcString();

    return await ds.transaction(async (manager) => {
      const accRepo = manager.getRepository(CompanyBankAccountEntity);
      const txRepo = manager.getRepository(BankTransactionEntity);

      const account = await accRepo.findOne({ where: { id: input.bankAccountId } });
      if (!account) {
        throw new NotFoundException(`Bank account #${input.bankAccountId} not found`);
      }

      const newBalance = account.currentBalanceMinorUnits + input.amountMinorUnits;
      account.currentBalanceMinorUnits = newBalance;
      account.updatedAtUtc = nowUtcString();
      await accRepo.save(account);

      const tx = txRepo.create({
        accountId: account.id,
        txnType: 'CASH_DEPOSIT',
        amountMinorUnits: input.amountMinorUnits,
        runningBalanceMinorUnits: newBalance,
        reference: input.depositSlipNumber?.trim() || null,
        chequeDirection: null,
        chequeId: null,
        attachmentPath: input.attachmentPath?.trim() || null,
        notes: input.notes?.trim() || 'Counter cash deposited to bank account',
        createdAtUtc: now,
      });

      const savedTx = await txRepo.save(tx);

      await this.auditService.log({
        action: 'BANK_CASH_DEPOSIT',
        resource: `BankTransaction #${savedTx.id}`,
        severity: 'INFO',
        details: {
          storeId: account.storeId,
          bankAccountId: account.id,
          amountMinorUnits: input.amountMinorUnits,
          depositSlipNumber: input.depositSlipNumber,
          summary: `Deposited Rs. ${(input.amountMinorUnits / 100).toFixed(2)} cash into ${account.bankName} (${account.accountNumber})${input.depositSlipNumber ? ` Slip #${input.depositSlipNumber}` : ''}`,
        },
      });

      return {
        id: savedTx.id,
        accountId: savedTx.accountId,
        bankName: account.bankName,
        accountTitle: account.accountTitle,
        accountNumber: account.accountNumber,
        txnType: 'CASH_DEPOSIT',
        direction: 'INFLOW',
        amountMinorUnits: savedTx.amountMinorUnits,
        runningBalanceMinorUnits: savedTx.runningBalanceMinorUnits,
        reference: savedTx.reference,
        chequeDirection: null,
        chequeId: null,
        attachmentPath: savedTx.attachmentPath,
        notes: savedTx.notes,
        createdAtUtc: savedTx.createdAtUtc,
      };
    });
  }

  /**
   * Clear Inward Customer Cheque or Outward Supplier Cheque
   */
  public async clearCheque(input: ClearChequeInput): Promise<BankTransaction> {
    const ds = this.databaseService.getDataSource();
    const now = input.clearingDateUtc || nowUtcString();

    return await ds.transaction(async (manager) => {
      const accRepo = manager.getRepository(CompanyBankAccountEntity);
      const txRepo = manager.getRepository(BankTransactionEntity);
      const salePaymentRepo = manager.getRepository(SalePaymentEntity);
      const supPaymentRepo = manager.getRepository(SupplierPaymentEntity);

      const account = await accRepo.findOne({ where: { id: input.bankAccountId } });
      if (!account) {
        throw new NotFoundException(`Bank account #${input.bankAccountId} not found`);
      }

      let newBalance = account.currentBalanceMinorUnits;
      let refStr = input.chequeNumber || '';
      let chkDir: 'INWARD' | 'OUTWARD' = 'INWARD';

      if (input.chequeDirection === 'INWARD_CUSTOMER') {
        chkDir = 'INWARD';
        const salePayment = await salePaymentRepo.findOne({ where: { id: input.chequeId } });
        if (!salePayment) {
          throw new NotFoundException(`Customer cheque payment #${input.chequeId} not found`);
        }

        salePayment.status = 'cleared';
        await salePaymentRepo.save(salePayment);

        newBalance += input.amountMinorUnits;
        if (!refStr) refStr = salePayment.reference || '';
      } else {
        chkDir = 'OUTWARD';
        const supPayment = await supPaymentRepo.findOne({ where: { id: input.chequeId } });
        if (!supPayment) {
          throw new NotFoundException(`Supplier cheque payment #${input.chequeId} not found`);
        }

        newBalance -= input.amountMinorUnits;
        if (!refStr) refStr = supPayment.reference || supPayment.paymentNumber || '';
      }

      account.currentBalanceMinorUnits = newBalance;
      account.updatedAtUtc = nowUtcString();
      await accRepo.save(account);

      const tx = txRepo.create({
        accountId: account.id,
        txnType: 'CHEQUE_CLEAR',
        amountMinorUnits: input.amountMinorUnits,
        runningBalanceMinorUnits: newBalance,
        reference: refStr || null,
        chequeDirection: chkDir,
        chequeId: input.chequeId,
        attachmentPath: input.attachmentPath?.trim() || null,
        notes: input.notes?.trim() || `${chkDir === 'INWARD' ? 'Customer' : 'Supplier'} cheque cleared via ${account.bankName}`,
        createdAtUtc: now,
      });

      const savedTx = await txRepo.save(tx);

      await this.auditService.log({
        action: 'CHEQUE_CLEAR',
        resource: `BankTransaction #${savedTx.id}`,
        severity: 'INFO',
        details: {
          storeId: account.storeId,
          bankAccountId: account.id,
          chequeDirection: chkDir,
          chequeId: input.chequeId,
          reference: refStr,
          amountMinorUnits: input.amountMinorUnits,
          summary: `Cleared ${chkDir} cheque #${refStr} of Rs. ${(input.amountMinorUnits / 100).toFixed(2)} into ${account.bankName}`,
        },
      });

      return {
        id: savedTx.id,
        accountId: savedTx.accountId,
        bankName: account.bankName,
        accountTitle: account.accountTitle,
        accountNumber: account.accountNumber,
        txnType: 'CHEQUE_CLEAR',
        direction: chkDir === 'INWARD' ? 'INFLOW' : 'OUTFLOW',
        amountMinorUnits: savedTx.amountMinorUnits,
        runningBalanceMinorUnits: savedTx.runningBalanceMinorUnits,
        reference: savedTx.reference,
        chequeDirection: chkDir,
        chequeId: savedTx.chequeId,
        attachmentPath: savedTx.attachmentPath,
        notes: savedTx.notes,
        createdAtUtc: savedTx.createdAtUtc,
      };
    });
  }

  /**
   * Get KPI summary of company bank accounts and pending cheques
   */
  public async getSummaryStats(storeId: number = 1): Promise<BankSummaryStats> {
    const ds = this.databaseService.getDataSource();
    const accRepo = ds.getRepository(CompanyBankAccountEntity);
    const txRepo = ds.getRepository(BankTransactionEntity);
    const salePaymentRepo = ds.getRepository(SalePaymentEntity);
    const supPaymentRepo = ds.getRepository(SupplierPaymentEntity);

    // 1. Bank Accounts Total
    const accounts = await accRepo.find({ where: { storeId } });
    const activeAccounts = accounts.filter((a) => Boolean(a.isActive));
    const totalBankBalanceMinorUnits = activeAccounts.reduce(
      (sum, acc) => sum + acc.currentBalanceMinorUnits,
      0,
    );

    // 2. Pending Inward Customer Cheques
    const inwardCheques = await salePaymentRepo.find({
      where: [{ paymentMethod: 'cheque' }, { paymentMethod: 'CHEQUE' }],
    });
    const pendingInward = inwardCheques.filter((c) => c.status !== 'cleared' && c.status !== 'bounced');
    const pendingInwardChequesCount = pendingInward.length;
    const pendingInwardChequesMinorUnits = pendingInward.reduce(
      (sum, c) => sum + c.amountPaidMinorUnits,
      0,
    );

    // 3. Pending Outward Supplier Cheques
    const outwardCheques = await supPaymentRepo.find({
      where: [{ storeId, paymentMethod: 'cheque' }, { storeId, paymentMethod: 'CHEQUE' }],
    });
    const clearedOutwardTxs = await txRepo.find({
      where: { chequeDirection: 'OUTWARD' },
    });
    const clearedOutwardIds = new Set(clearedOutwardTxs.map((t) => t.chequeId));

    const pendingOutward = outwardCheques.filter((c) => !clearedOutwardIds.has(c.id));
    const pendingOutwardChequesCount = pendingOutward.length;
    const pendingOutwardChequesMinorUnits = pendingOutward.reduce(
      (sum, c) => sum + c.amountMinorUnits,
      0,
    );

    return {
      totalBankBalanceMinorUnits,
      activeAccountsCount: activeAccounts.length,
      pendingInwardChequesCount,
      pendingInwardChequesMinorUnits,
      pendingOutwardChequesCount,
      pendingOutwardChequesMinorUnits,
    };
  }
}
