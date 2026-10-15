import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  ExpenseEntity,
  ExpenseCategoryEntity,
  ShiftEntity,
  CashTransactionEntity,
  AuditLogEntity,
} from '@bakery/database';
import {
  Expense,
  CreateExpenseInput,
  ListExpensesQuery,
  ExpenseCategory,
  CreateExpenseCategoryInput,
} from '@bakery/contracts';

function nowUtcString(): string {
  return new Date().toISOString();
}

@Injectable()
export class ExpensesService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ==========================================
  // EXPENSE CATEGORIES
  // ==========================================

  public async listCategories(): Promise<ExpenseCategory[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(ExpenseCategoryEntity);
    const categories = await repo.find({
      order: { isSystem: 'DESC', name: 'ASC' },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      isSystem: c.isSystem,
      createdAtUtc: c.createdAtUtc,
    }));
  }

  public async createCategory(input: CreateExpenseCategoryInput): Promise<ExpenseCategory> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(ExpenseCategoryEntity);

    const trimmed = input.name.trim();
    const existing = await repo.findOne({ where: { name: trimmed } });
    if (existing) {
      throw new Error(`Expense category '${trimmed}' already exists`);
    }

    const cat = repo.create({
      name: trimmed,
      isSystem: false,
      createdAtUtc: nowUtcString(),
    });
    const saved = await repo.save(cat);

    return {
      id: saved.id,
      name: saved.name,
      isSystem: saved.isSystem,
      createdAtUtc: saved.createdAtUtc,
    };
  }

  // ==========================================
  // EXPENSES
  // ==========================================

  public async listExpenses(query: ListExpensesQuery): Promise<Expense[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(ExpenseEntity);
    const catRepo = ds.getRepository(ExpenseCategoryEntity);

    const qb = repo
      .createQueryBuilder('expense')
      .where('expense.store_id = :storeId', { storeId: query.storeId });

    if (query.categoryId) {
      qb.andWhere('expense.category_id = :catId', { catId: query.categoryId });
    }
    if (query.startDate) {
      qb.andWhere('expense.expense_date >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('expense.expense_date <= :endDate', { endDate: query.endDate });
    }
    if (query.paymentMethod) {
      qb.andWhere('expense.payment_method = :pm', { pm: query.paymentMethod });
    }

    qb.orderBy('expense.expense_date', 'DESC').addOrderBy('expense.id', 'DESC');

    const expenses = await qb.getMany();
    const categories = await catRepo.find();
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    return expenses.map((e) => ({
      id: e.id,
      storeId: e.storeId,
      categoryId: e.categoryId,
      categoryName: catMap.get(e.categoryId) ?? 'Other',
      title: e.title,
      amountMinorUnits: e.amountMinorUnits,
      paymentMethod: e.paymentMethod,
      shiftId: e.shiftId,
      voucherNumber: e.voucherNumber,
      paidTo: e.paidTo,
      expenseDate: e.expenseDate,
      notes: e.notes,
      createdByUserId: e.createdByUserId,
      createdByName: e.createdByName,
      createdAtUtc: e.createdAtUtc,
    }));
  }

  public async createExpense(input: CreateExpenseInput): Promise<Expense> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const expenseRepo = manager.getRepository(ExpenseEntity);
      const catRepo = manager.getRepository(ExpenseCategoryEntity);
      const shiftRepo = manager.getRepository(ShiftEntity);
      const cashTxRepo = manager.getRepository(CashTransactionEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const category = await catRepo.findOne({ where: { id: input.categoryId } });
      if (!category) {
        throw new Error(`Expense category ID ${input.categoryId} not found`);
      }

      const now = nowUtcString();
      let shiftIdToLink: number | null = null;

      // If paid directly out of the POS cash drawer, link with the active shift and deduct expected cash
      if (input.paymentMethod === 'cash_drawer') {
        const activeShift = await shiftRepo.findOne({
          where: { storeId: input.storeId, status: 'open' },
        });

        if (activeShift) {
          shiftIdToLink = activeShift.id;

          // Record cash transaction payout
          const cashTx = cashTxRepo.create({
            shiftId: activeShift.id,
            transactionType: 'payout',
            amountMinorUnits: input.amountMinorUnits,
            sourceId: input.voucherNumber || input.title.slice(0, 36),
            notes: `Expense: ${category.name} - ${input.title}`.slice(0, 255),
            createdAtUtc: now,
          });
          await cashTxRepo.save(cashTx);

          // Deduct from shift expected cash
          activeShift.expectedCashMinorUnits -= input.amountMinorUnits;
          activeShift.updatedAtUtc = now;
          await shiftRepo.save(activeShift);
        }
      }

      const newExpense = expenseRepo.create({
        storeId: input.storeId,
        categoryId: input.categoryId,
        title: input.title.trim(),
        amountMinorUnits: input.amountMinorUnits,
        paymentMethod: input.paymentMethod,
        shiftId: shiftIdToLink,
        voucherNumber: input.voucherNumber?.trim() || null,
        paidTo: input.paidTo?.trim() || null,
        expenseDate: input.expenseDate,
        notes: input.notes?.trim() || null,
        createdByUserId: input.createdByUserId ?? null,
        createdByName: input.createdByName,
        createdAtUtc: now,
      });

      const saved = await expenseRepo.save(newExpense);

      // Audit log
      await auditRepo.save({
        userId: input.createdByUserId ?? null,
        username: input.createdByName,
        action: 'EXPENSE_RECORDED',
        resource: 'expenses',
        detailsJson: JSON.stringify({
          expenseId: saved.id,
          category: category.name,
          title: saved.title,
          amountMinorUnits: saved.amountMinorUnits,
          paymentMethod: saved.paymentMethod,
          shiftId: shiftIdToLink,
        }),
        createdAtUtc: now,
      });

      return {
        id: saved.id,
        storeId: saved.storeId,
        categoryId: saved.categoryId,
        categoryName: category.name,
        title: saved.title,
        amountMinorUnits: saved.amountMinorUnits,
        paymentMethod: saved.paymentMethod,
        shiftId: saved.shiftId,
        voucherNumber: saved.voucherNumber,
        paidTo: saved.paidTo,
        expenseDate: saved.expenseDate,
        notes: saved.notes,
        createdByUserId: saved.createdByUserId,
        createdByName: saved.createdByName,
        createdAtUtc: saved.createdAtUtc,
      };
    });
  }

  public async deleteExpense(id: number): Promise<void> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(ExpenseEntity);
    const auditRepo = ds.getRepository(AuditLogEntity);

    const expense = await repo.findOne({ where: { id } });
    if (!expense) {
      throw new Error(`Expense ID ${id} not found`);
    }

    await repo.remove(expense);

    await auditRepo.save({
      userId: null,
      username: 'admin',
      action: 'EXPENSE_DELETED',
      resource: 'expenses',
      detailsJson: JSON.stringify({ expenseId: id, title: expense.title, amount: expense.amountMinorUnits }),
      createdAtUtc: nowUtcString(),
    });
  }
}
