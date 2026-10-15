import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { ShiftEntity, CashTransactionEntity, SaleEntity, SaleItemEntity, StoreEntity } from '@bakery/database';
import { Shift, OpenShiftInput, CloseShiftInput, ShiftReport } from '@bakery/contracts';
import { nowUtcString } from '@bakery/shared';

@Injectable()
export class ShiftsService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getActiveShift(storeId: number): Promise<Shift | null> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(ShiftEntity);
    const shift = await repo.findOne({
      where: { storeId, status: 'open' },
      order: { openedAtUtc: 'DESC' },
    });

    if (!shift) return null;
    return this.mapToDto(shift);
  }

  public async openShift(input: OpenShiftInput): Promise<Shift> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const shiftRepo = manager.getRepository(ShiftEntity);
      const cashTxRepo = manager.getRepository(CashTransactionEntity);

      // Verify no currently open shift exists for this store
      const active = await shiftRepo.findOne({
        where: { storeId: input.storeId, status: 'open' },
      });
      if (active) {
        throw new Error('An active shift is already open for this store. Please close it before opening a new one.');
      }

      const now = nowUtcString();
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await shiftRepo.count();
      const shiftCode = `SHF-${today}-${String(count + 1).padStart(4, '0')}`;

      const shift = shiftRepo.create({
        shiftCode,
        storeId: input.storeId,
        registerId: input.registerId ?? null,
        cashierId: input.cashierId ?? 'cashier-01',
        status: 'open',
        openedAtUtc: now,
        closedAtUtc: null,
        openingFloatMinorUnits: input.openingFloatMinorUnits ?? 0,
        expectedCashMinorUnits: input.openingFloatMinorUnits ?? 0,
        closingCountedMinorUnits: null,
        varianceMinorUnits: null,
        notes: input.notes ?? null,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
      await shiftRepo.save(shift);

      // Record opening float in cash transactions if greater than 0
      if (shift.openingFloatMinorUnits > 0) {
        const floatTx = cashTxRepo.create({
          shiftId: shift.id,
          transactionType: 'float',
          amountMinorUnits: shift.openingFloatMinorUnits,
          sourceId: shift.shiftCode || String(shift.id),
          notes: 'Opening cash float',
          createdAtUtc: now,
        });
        await cashTxRepo.save(floatTx);
      }

      return this.mapToDto(shift);
    });
  }

  public async closeShift(input: CloseShiftInput): Promise<Shift> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const shiftRepo = manager.getRepository(ShiftEntity);
      const shift = await shiftRepo.findOne({ where: { id: input.shiftId } });

      if (!shift) {
        throw new Error(`Shift with ID '${input.shiftId}' not found`);
      }
      if (shift.status === 'closed') {
        throw new Error('Shift has already been closed');
      }

      const now = nowUtcString();
      const variance = input.countedCashMinorUnits - shift.expectedCashMinorUnits;

      shift.status = 'closed';
      shift.closedAtUtc = now;
      shift.closingCountedMinorUnits = input.countedCashMinorUnits;
      shift.varianceMinorUnits = variance;
      shift.notes = input.notes ? `${shift.notes ?? ''} [Closed: ${input.notes}]`.trim() : shift.notes;
      shift.updatedAtUtc = now;

      await shiftRepo.save(shift);

      return this.mapToDto(shift);
    });
  }

  public async getRecentShifts(storeId: number, limit = 20): Promise<Shift[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(ShiftEntity);
    const shifts = await repo.find({
      where: { storeId },
      order: { openedAtUtc: 'DESC' },
      take: limit,
    });
    return shifts.map((s) => this.mapToDto(s));
  }

  public async getShiftReport(shiftId: number): Promise<ShiftReport> {
    const ds = this.databaseService.getDataSource();
    const shiftRepo = ds.getRepository(ShiftEntity);
    const saleRepo = ds.getRepository(SaleEntity);
    const saleItemRepo = ds.getRepository(SaleItemEntity);
    const storeRepo = ds.getRepository(StoreEntity);

    const shift = await shiftRepo.findOne({ where: { id: shiftId } });
    if (!shift) {
      throw new Error(`Shift '${shiftId}' not found`);
    }

    const store = await storeRepo.findOne({ where: { id: shift.storeId } });
    const storeName = store ? store.name : 'Bakery Store';

    // Find all sales for this shift
    const sales = await saleRepo.find({ where: { shiftId: shift.id } });
    const totalTransactions = sales.length;

    let totalCashSalesMinorUnits = 0;
    for (const sale of sales) {
      totalCashSalesMinorUnits += sale.totalMinorUnits;
    }

    // Aggregate items sold
    const itemMap = new Map<string, { productName: string; sku: string; quantitySold: number; revenueMinorUnits: number }>();

    for (const sale of sales) {
      const items = await saleItemRepo.find({ where: { saleId: sale.id } });
      for (const item of items) {
        const existing = itemMap.get(item.sku);
        if (existing) {
          existing.quantitySold += item.quantity;
          existing.revenueMinorUnits += item.totalMinorUnits;
        } else {
          itemMap.set(item.sku, {
            productName: item.productName,
            sku: item.sku,
            quantitySold: item.quantity,
            revenueMinorUnits: item.totalMinorUnits,
          });
        }
      }
    }

    const itemsSold = Array.from(itemMap.values()).sort((a, b) => b.revenueMinorUnits - a.revenueMinorUnits);
    const totalUnitsSold = itemsSold.reduce((acc, curr) => acc + curr.quantitySold, 0);

    const cashTxRepo = ds.getRepository(CashTransactionEntity);
    const cashTxs = await cashTxRepo.find({ where: { shiftId: shift.id } });

    let totalExpensesFromDrawerMinorUnits = 0;
    let totalPayoutsFromDrawerMinorUnits = 0;
    let totalRefundsMinorUnits = 0;

    for (const tx of cashTxs) {
      if (tx.transactionType === 'refund_out') {
        totalRefundsMinorUnits += tx.amountMinorUnits;
      } else if (tx.transactionType === 'payout') {
        const note = (tx.notes || '').toLowerCase();
        if (note.startsWith('expense:')) {
          totalExpensesFromDrawerMinorUnits += tx.amountMinorUnits;
        } else {
          totalPayoutsFromDrawerMinorUnits += tx.amountMinorUnits;
        }
      }
    }

    return {
      shiftId: shift.id,
      shiftCode: shift.shiftCode ?? undefined,
      storeName,
      cashierId: shift.cashierId,
      status: shift.status,
      openedAtUtc: shift.openedAtUtc,
      closedAtUtc: shift.closedAtUtc,
      openingFloatMinorUnits: shift.openingFloatMinorUnits,
      totalCashSalesMinorUnits,
      totalRefundsMinorUnits,
      totalExpensesFromDrawerMinorUnits,
      totalPayoutsFromDrawerMinorUnits,
      expectedCashMinorUnits: shift.expectedCashMinorUnits,
      closingCountedMinorUnits: shift.closingCountedMinorUnits,
      varianceMinorUnits: shift.varianceMinorUnits,
      totalTransactions,
      totalUnitsSold,
      itemsSold,
    };
  }

  private mapToDto(entity: ShiftEntity): Shift {
    return {
      id: entity.id,
      shiftCode: entity.shiftCode ?? undefined,
      storeId: entity.storeId,
      registerId: entity.registerId,
      cashierId: entity.cashierId,
      status: entity.status,
      openedAtUtc: entity.openedAtUtc,
      closedAtUtc: entity.closedAtUtc,
      openingFloatMinorUnits: entity.openingFloatMinorUnits,
      expectedCashMinorUnits: entity.expectedCashMinorUnits,
      closingCountedMinorUnits: entity.closingCountedMinorUnits,
      varianceMinorUnits: entity.varianceMinorUnits,
      notes: entity.notes,
      createdAtUtc: entity.createdAtUtc,
      updatedAtUtc: entity.updatedAtUtc,
    };
  }
}
