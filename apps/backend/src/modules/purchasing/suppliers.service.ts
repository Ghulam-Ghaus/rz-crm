import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  SupplierEntity,
  SupplierPaymentEntity,
  GoodsReceiptEntity,
  CashTransactionEntity,
  ShiftEntity,
} from '@rz-crm/database';
import {
  Supplier,
  CreateSupplierInput,
  SupplierBalanceSummary,
  SupplierPayment,
  CreateSupplierPaymentInput,
  SupplierLedgerResponse,
  SupplierLedgerEntry,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class SuppliersService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getSuppliers(storeId: number): Promise<Supplier[]> {
    const repo = this.databaseService.getDataSource().getRepository(SupplierEntity);
    const suppliers = await repo.find({
      where: { storeId },
      order: { name: 'ASC' },
    });

    return suppliers.map((s) => ({
      id: s.id,
      storeId: s.storeId,
      code: s.code,
      name: s.name,
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email,
      taxNumber: s.taxNumber,
      address: s.address,
      paymentTermsDays: s.paymentTermsDays,
      creditLimitMinorUnits: s.creditLimitMinorUnits ?? 0,
      outstandingBalanceMinorUnits: s.outstandingBalanceMinorUnits ?? 0,
      isActive: s.isActive,
      createdAtUtc: s.createdAtUtc,
      updatedAtUtc: s.updatedAtUtc,
    }));
  }

  public async createSupplier(input: CreateSupplierInput): Promise<Supplier> {
    const repo = this.databaseService.getDataSource().getRepository(SupplierEntity);

    // Check code uniqueness
    const existing = await repo.findOne({ where: { code: input.code } });
    if (existing) {
      throw new Error(`Supplier with code '${input.code}' already exists`);
    }

    const now = nowUtcString();
    const entity = repo.create({
      storeId: input.storeId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      contactPerson: input.contactPerson?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      taxNumber: input.taxNumber?.trim() || null,
      address: input.address?.trim() || null,
      paymentTermsDays: input.paymentTermsDays ?? 0,
      creditLimitMinorUnits: input.creditLimitMinorUnits ?? 0,
      outstandingBalanceMinorUnits: 0,
      isActive: 1,
      createdAtUtc: now,
      updatedAtUtc: now,
    });

    const saved = await repo.save(entity);

    return {
      id: saved.id,
      storeId: saved.storeId,
      code: saved.code,
      name: saved.name,
      contactPerson: saved.contactPerson,
      phone: saved.phone,
      email: saved.email,
      taxNumber: saved.taxNumber,
      address: saved.address,
      paymentTermsDays: saved.paymentTermsDays,
      creditLimitMinorUnits: saved.creditLimitMinorUnits ?? 0,
      outstandingBalanceMinorUnits: saved.outstandingBalanceMinorUnits ?? 0,
      isActive: saved.isActive,
      createdAtUtc: saved.createdAtUtc,
      updatedAtUtc: saved.updatedAtUtc,
    };
  }

  public async getSupplierBalances(storeId: number): Promise<SupplierBalanceSummary[]> {
    const dataSource = this.databaseService.getDataSource();
    const supplierRepo = dataSource.getRepository(SupplierEntity);
    const grnRepo = dataSource.getRepository(GoodsReceiptEntity);
    const paymentRepo = dataSource.getRepository(SupplierPaymentEntity);

    const suppliers = await supplierRepo.find({
      where: { storeId },
      order: { name: 'ASC' },
    });

    const grnTotals = await grnRepo
      .createQueryBuilder('grn')
      .select('grn.supplier_id', 'supplierId')
      .addSelect('COALESCE(SUM(grn.total_amount_minor_units), 0)', 'totalPurchases')
      .where('grn.store_id = :storeId', { storeId })
      .andWhere("grn.status = 'POSTED'")
      .groupBy('grn.supplier_id')
      .getRawMany<{ supplierId: number; totalPurchases: string | number }>();

    const grnMap = new Map<number, number>(
      grnTotals.map((g) => [Number(g.supplierId), Number(g.totalPurchases)])
    );

    const paymentTotals = await paymentRepo
      .createQueryBuilder('p')
      .select('p.supplier_id', 'supplierId')
      .addSelect('COALESCE(SUM(p.amount_minor_units), 0)', 'totalPaid')
      .where('p.store_id = :storeId', { storeId })
      .groupBy('p.supplier_id')
      .getRawMany<{ supplierId: number; totalPaid: string | number }>();

    const paymentMap = new Map<number, number>(
      paymentTotals.map((p) => [Number(p.supplierId), Number(p.totalPaid)])
    );

    return suppliers.map((s) => {
      const totalPurchases = grnMap.get(s.id) ?? 0;
      const totalPaid = paymentMap.get(s.id) ?? 0;
      const outstandingBalance = totalPurchases - totalPaid;

      return {
        supplierId: s.id,
        supplierCode: s.code,
        supplierName: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        totalPurchasesMinorUnits: totalPurchases,
        totalPaidMinorUnits: totalPaid,
        outstandingBalanceMinorUnits: outstandingBalance,
      };
    });
  }

  public async getSupplierLedger(storeId: number, supplierId: number): Promise<SupplierLedgerResponse> {
    const dataSource = this.databaseService.getDataSource();
    const supplierRepo = dataSource.getRepository(SupplierEntity);
    const grnRepo = dataSource.getRepository(GoodsReceiptEntity);
    const paymentRepo = dataSource.getRepository(SupplierPaymentEntity);

    const supplier = await supplierRepo.findOne({ where: { id: supplierId, storeId } });
    if (!supplier) {
      throw new Error(`Supplier #${supplierId} not found`);
    }

    const grns = await grnRepo.find({
      where: { supplierId, storeId, status: 'POSTED' },
      order: { receivedDateUtc: 'ASC', id: 'ASC' },
    });

    const payments = await paymentRepo.find({
      where: { supplierId, storeId },
      order: { paymentDateUtc: 'ASC', id: 'ASC' },
    });

    const entries: SupplierLedgerEntry[] = [];

    for (const grn of grns) {
      entries.push({
        id: `grn-${grn.id}`,
        dateUtc: grn.receivedDateUtc,
        type: 'GRN',
        documentNumber: grn.grnNumber,
        reference: grn.supplierInvoiceRef,
        notes: grn.notes || null,
        debitMinorUnits: grn.totalAmountMinorUnits,
        creditMinorUnits: 0,
        runningBalanceMinorUnits: 0,
      });
    }

    for (const pay of payments) {
      const methodNote = pay.paymentMethod ? `[${pay.paymentMethod}]` : '';
      const notes = [methodNote, pay.notes].filter(Boolean).join(' ').trim() || null;

      entries.push({
        id: `pay-${pay.id}`,
        dateUtc: pay.paymentDateUtc,
        type: 'PAYMENT',
        documentNumber: pay.paymentNumber,
        reference: pay.reference || null,
        notes,
        debitMinorUnits: 0,
        creditMinorUnits: pay.amountMinorUnits,
        runningBalanceMinorUnits: 0,
      });
    }

    // Sort chronologically
    entries.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));

    let runningBalance = 0;
    let totalPurchases = 0;
    let totalPaid = 0;

    for (const entry of entries) {
      totalPurchases += entry.debitMinorUnits;
      totalPaid += entry.creditMinorUnits;
      runningBalance += entry.debitMinorUnits - entry.creditMinorUnits;
      entry.runningBalanceMinorUnits = runningBalance;
    }

    return {
      supplier: {
        id: supplier.id,
        storeId: supplier.storeId,
        code: supplier.code,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        taxNumber: supplier.taxNumber,
        address: supplier.address,
        paymentTermsDays: supplier.paymentTermsDays,
        creditLimitMinorUnits: supplier.creditLimitMinorUnits ?? 0,
        outstandingBalanceMinorUnits: supplier.outstandingBalanceMinorUnits ?? 0,
        isActive: supplier.isActive,
        createdAtUtc: supplier.createdAtUtc,
        updatedAtUtc: supplier.updatedAtUtc,
      },
      totalPurchasesMinorUnits: totalPurchases,
      totalPaidMinorUnits: totalPaid,
      outstandingBalanceMinorUnits: runningBalance,
      entries,
    };
  }

  public async recordSupplierPayment(input: CreateSupplierPaymentInput): Promise<SupplierPayment> {
    const dataSource = this.databaseService.getDataSource();

    return await dataSource.transaction(async (manager) => {
      const supplierRepo = manager.getRepository(SupplierEntity);
      const paymentRepo = manager.getRepository(SupplierPaymentEntity);
      const grnRepo = manager.getRepository(GoodsReceiptEntity);
      const cashRepo = manager.getRepository(CashTransactionEntity);
      const shiftRepo = manager.getRepository(ShiftEntity);

      const supplier = await supplierRepo.findOne({ where: { id: input.supplierId, storeId: input.storeId } });
      if (!supplier) {
        throw new Error(`Supplier #${input.supplierId} not found`);
      }

      if (!input.amountMinorUnits || input.amountMinorUnits <= 0) {
        throw new Error('Payment amount must be greater than zero');
      }

      const now = nowUtcString();
      const paymentDate = input.paymentDateUtc || now;

      // Generate sequential payment number: SPAY-YYYYMMDD-XXXX
      const datePart = paymentDate.slice(0, 10).replace(/-/g, '');
      const count = await paymentRepo.count({ where: { storeId: input.storeId } });
      const paymentNumber = `SPAY-${datePart}-${String(count + 1).padStart(4, '0')}`;

      const entity = paymentRepo.create({
        storeId: input.storeId,
        supplierId: input.supplierId,
        paymentNumber,
        paymentDateUtc: paymentDate,
        amountMinorUnits: input.amountMinorUnits,
        currencyCode: 'PKR',
        paymentMethod: input.paymentMethod || 'CASH',
        reference: input.reference?.trim() || null,
        bankName: input.bankName?.trim() || null,
        chequeDate: input.chequeDate?.trim() || null,
        notes: input.notes?.trim() || null,
        paidBy: input.paidBy?.trim() || null,
        createdAtUtc: now,
        updatedAtUtc: now,
      });

      const saved = await paymentRepo.save(entity);

      // Decrement supplier outstanding balance
      supplier.outstandingBalanceMinorUnits = Math.max(0, (supplier.outstandingBalanceMinorUnits ?? 0) - input.amountMinorUnits);
      supplier.updatedAtUtc = now;
      await supplierRepo.save(supplier);

      // If a specific GRN is referenced, update its payment status
      if (input.grnId) {
        const grn = await grnRepo.findOne({ where: { id: input.grnId } });
        if (grn) {
          grn.paymentStatus = 'PAID';
          grn.updatedAtUtc = now;
          await grnRepo.save(grn);
        }
      }

      // If paid via cash, record cash drawer transaction under current shift if open
      if ((input.paymentMethod || 'CASH') === 'CASH') {
        const activeShift = await shiftRepo.findOne({ where: { storeId: input.storeId, status: 'open' } });
        if (activeShift) {
          const cashTx = cashRepo.create({
            shiftId: activeShift.id,
            transactionType: 'payout',
            amountMinorUnits: input.amountMinorUnits,
            sourceId: paymentNumber,
            notes: `Supplier Payment: ${supplier.name} (${paymentNumber})`,
            createdAtUtc: now,
          });
          await cashRepo.save(cashTx);
          activeShift.expectedCashMinorUnits = Math.max(0, activeShift.expectedCashMinorUnits - input.amountMinorUnits);
          await shiftRepo.save(activeShift);
        }
      }

      return {
        id: saved.id,
        storeId: saved.storeId,
        supplierId: saved.supplierId,
        paymentNumber: saved.paymentNumber,
        paymentDateUtc: saved.paymentDateUtc,
        amountMinorUnits: saved.amountMinorUnits,
        currencyCode: saved.currencyCode,
        paymentMethod: saved.paymentMethod,
        reference: saved.reference,
        bankName: saved.bankName,
        chequeDate: saved.chequeDate,
        notes: saved.notes,
        paidBy: saved.paidBy,
        createdAtUtc: saved.createdAtUtc,
        updatedAtUtc: saved.updatedAtUtc,
      };
    });
  }
}
