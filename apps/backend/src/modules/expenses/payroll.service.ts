import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  StaffPayrollProfileEntity,
  SalaryAdvanceEntity,
  SalaryPaymentEntity,
  UserEntity,
  ShiftEntity,
  CashTransactionEntity,
  AuditLogEntity,
} from '@bakery/database';
import {
  StaffPayrollProfile,
  UpsertPayrollProfileInput,
  SalaryAdvance,
  CreateSalaryAdvanceInput,
  UpdateSalaryAdvanceInput,
  DeleteSalaryAdvanceInput,
  SalaryPayment,
  DisburseSalaryInput,
  MonthlyPayrollSheetResponse,
  GetEmployeeStatementQuery,
  EmployeeMonthlyStatementResponse,
  EmployeeStatementEntry,
} from '@bakery/contracts';

function nowUtcString(): string {
  return new Date().toISOString();
}

@Injectable()
export class PayrollService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ==========================================
  // STAFF PAYROLL PROFILES
  // ==========================================

  public async listProfiles(): Promise<StaffPayrollProfile[]> {
    const ds = this.databaseService.getDataSource();
    const profileRepo = ds.getRepository(StaffPayrollProfileEntity);
    const userRepo = ds.getRepository(UserEntity);

    const [profiles, users] = await Promise.all([
      profileRepo.find(),
      userRepo.find(),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));

    return profiles.map((p) => {
      const u = userMap.get(p.userId);
      return {
        id: p.id,
        userId: p.userId,
        username: u?.username,
        displayName: u?.displayName,
        userRole: u?.role,
        baseMonthlySalaryMinorUnits: p.baseMonthlySalaryMinorUnits,
        designation: p.designation,
        joiningDate: p.joiningDate,
        paymentMethodPreference: p.paymentMethodPreference,
        bankAccountDetails: p.bankAccountDetails,
        createdAtUtc: p.createdAtUtc,
        updatedAtUtc: p.updatedAtUtc,
      };
    });
  }

  public async upsertProfile(input: UpsertPayrollProfileInput): Promise<StaffPayrollProfile> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(StaffPayrollProfileEntity);
    const userRepo = ds.getRepository(UserEntity);

    const user = await userRepo.findOne({ where: { id: input.userId } });
    if (!user) {
      throw new Error(`User ID ${input.userId} not found`);
    }

    const now = nowUtcString();
    let profile = await repo.findOne({ where: { userId: input.userId } });

    if (profile) {
      profile.baseMonthlySalaryMinorUnits = input.baseMonthlySalaryMinorUnits;
      if (input.designation !== undefined) profile.designation = input.designation.trim();
      if (input.joiningDate !== undefined) profile.joiningDate = input.joiningDate;
      if (input.paymentMethodPreference !== undefined) profile.paymentMethodPreference = input.paymentMethodPreference;
      if (input.bankAccountDetails !== undefined) profile.bankAccountDetails = input.bankAccountDetails.trim();
      profile.updatedAtUtc = now;
      profile = await repo.save(profile);
    } else {
      profile = repo.create({
        userId: input.userId,
        baseMonthlySalaryMinorUnits: input.baseMonthlySalaryMinorUnits,
        designation: input.designation?.trim() || user.role,
        joiningDate: input.joiningDate || null,
        paymentMethodPreference: input.paymentMethodPreference || 'cash',
        bankAccountDetails: input.bankAccountDetails?.trim() || null,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
      profile = await repo.save(profile);
    }

    return {
      id: profile.id,
      userId: profile.userId,
      username: user.username,
      displayName: user.displayName,
      userRole: user.role,
      baseMonthlySalaryMinorUnits: profile.baseMonthlySalaryMinorUnits,
      designation: profile.designation,
      joiningDate: profile.joiningDate,
      paymentMethodPreference: profile.paymentMethodPreference,
      bankAccountDetails: profile.bankAccountDetails,
      createdAtUtc: profile.createdAtUtc,
      updatedAtUtc: profile.updatedAtUtc,
    };
  }

  // ==========================================
  // SALARY ADVANCES
  // ==========================================

  public async listAdvances(storeId: number, userId?: number): Promise<SalaryAdvance[]> {
    const ds = this.databaseService.getDataSource();
    const advanceRepo = ds.getRepository(SalaryAdvanceEntity);
    const userRepo = ds.getRepository(UserEntity);

    const qb = advanceRepo
      .createQueryBuilder('adv')
      .where('adv.store_id = :storeId', { storeId });

    if (userId) {
      qb.andWhere('adv.user_id = :userId', { userId });
    }

    qb.orderBy('adv.advance_date', 'DESC').addOrderBy('adv.id', 'DESC');

    const advances = await qb.getMany();
    const users = await userRepo.find();
    const userMap = new Map(users.map((u) => [u.id, u]));

    return advances.map((a) => {
      const u = userMap.get(a.userId);
      return {
        id: a.id,
        storeId: a.storeId,
        userId: a.userId,
        username: u?.username,
        displayName: u?.displayName,
        amountMinorUnits: a.amountMinorUnits,
        advanceDate: a.advanceDate,
        paymentMethod: a.paymentMethod,
        shiftId: a.shiftId,
        reason: a.reason,
        status: a.status,
        settledInSalaryPaymentId: a.settledInSalaryPaymentId,
        createdByUserId: a.createdByUserId,
        createdByName: a.createdByName,
        createdAtUtc: a.createdAtUtc,
      };
    });
  }

  public async createAdvance(input: CreateSalaryAdvanceInput): Promise<SalaryAdvance> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const advanceRepo = manager.getRepository(SalaryAdvanceEntity);
      const userRepo = manager.getRepository(UserEntity);
      const shiftRepo = manager.getRepository(ShiftEntity);
      const cashTxRepo = manager.getRepository(CashTransactionEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const staff = await userRepo.findOne({ where: { id: input.userId } });
      if (!staff) {
        throw new Error(`Staff user ID ${input.userId} not found`);
      }

      const now = nowUtcString();
      let shiftIdToLink: number | null = null;

      // Deduct from cash drawer if cash drawer payout selected
      if (input.paymentMethod === 'cash_drawer') {
        const activeShift = await shiftRepo.findOne({
          where: { storeId: input.storeId, status: 'open' },
        });

        if (activeShift) {
          shiftIdToLink = activeShift.id;

          const cashTx = cashTxRepo.create({
            shiftId: activeShift.id,
            transactionType: 'payout',
            amountMinorUnits: input.amountMinorUnits,
            sourceId: `ADV-${staff.username}`,
            notes: `Salary Advance: ${staff.displayName} (${staff.username})`.slice(0, 255),
            createdAtUtc: now,
          });
          await cashTxRepo.save(cashTx);

          activeShift.expectedCashMinorUnits -= input.amountMinorUnits;
          activeShift.updatedAtUtc = now;
          await shiftRepo.save(activeShift);
        }
      }

      const newAdvance = advanceRepo.create({
        storeId: input.storeId,
        userId: input.userId,
        amountMinorUnits: input.amountMinorUnits,
        advanceDate: input.advanceDate,
        paymentMethod: input.paymentMethod,
        shiftId: shiftIdToLink,
        reason: input.reason?.trim() || null,
        status: 'pending',
        settledInSalaryPaymentId: null,
        createdByUserId: input.createdByUserId ?? null,
        createdByName: input.createdByName,
        createdAtUtc: now,
      });

      const saved = await advanceRepo.save(newAdvance);

      await auditRepo.save({
        userId: input.createdByUserId ?? null,
        username: input.createdByName,
        action: 'SALARY_ADVANCE_GIVEN',
        resource: 'payroll',
        detailsJson: JSON.stringify({
          advanceId: saved.id,
          staffId: staff.id,
          staffName: staff.displayName,
          amountMinorUnits: saved.amountMinorUnits,
          paymentMethod: saved.paymentMethod,
          shiftId: shiftIdToLink,
        }),
        createdAtUtc: now,
      });

      return {
        id: saved.id,
        storeId: saved.storeId,
        userId: saved.userId,
        username: staff.username,
        displayName: staff.displayName,
        amountMinorUnits: saved.amountMinorUnits,
        advanceDate: saved.advanceDate,
        paymentMethod: saved.paymentMethod,
        shiftId: saved.shiftId,
        reason: saved.reason,
        status: saved.status,
        settledInSalaryPaymentId: saved.settledInSalaryPaymentId,
        createdByUserId: saved.createdByUserId,
        createdByName: saved.createdByName,
        createdAtUtc: saved.createdAtUtc,
      };
    });
  }

  public async updateAdvance(input: UpdateSalaryAdvanceInput): Promise<SalaryAdvance> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const advanceRepo = manager.getRepository(SalaryAdvanceEntity);
      const userRepo = manager.getRepository(UserEntity);
      const shiftRepo = manager.getRepository(ShiftEntity);

      const advance = await advanceRepo.findOne({ where: { id: input.id } });
      if (!advance) {
        throw new Error(`Salary advance ID ${input.id} not found`);
      }

      if (advance.status !== 'pending') {
        throw new Error('Only pending salary advances can be edited. This advance has already been settled in salary.');
      }

      // Adjust cash drawer expected balance if amount changed and payment was cash_drawer
      if (input.amountMinorUnits && input.amountMinorUnits !== advance.amountMinorUnits && advance.paymentMethod === 'cash_drawer' && advance.shiftId) {
        const shift = await shiftRepo.findOne({ where: { id: advance.shiftId } });
        if (shift && shift.status === 'open') {
          const delta = input.amountMinorUnits - advance.amountMinorUnits;
          shift.expectedCashMinorUnits -= delta;
          shift.updatedAtUtc = nowUtcString();
          await shiftRepo.save(shift);
        }
      }

      if (input.amountMinorUnits) advance.amountMinorUnits = input.amountMinorUnits;
      if (input.advanceDate) advance.advanceDate = input.advanceDate;
      if (input.paymentMethod) advance.paymentMethod = input.paymentMethod;
      if (input.reason !== undefined) advance.reason = input.reason ? input.reason.trim() : null;

      const saved = await advanceRepo.save(advance);
      const staff = await userRepo.findOne({ where: { id: saved.userId } });

      return {
        id: saved.id,
        storeId: saved.storeId,
        userId: saved.userId,
        username: staff?.username,
        displayName: staff?.displayName,
        amountMinorUnits: saved.amountMinorUnits,
        advanceDate: saved.advanceDate,
        paymentMethod: saved.paymentMethod,
        shiftId: saved.shiftId,
        reason: saved.reason,
        status: saved.status,
        settledInSalaryPaymentId: saved.settledInSalaryPaymentId,
        createdByUserId: saved.createdByUserId,
        createdByName: saved.createdByName,
        createdAtUtc: saved.createdAtUtc,
      };
    });
  }

  public async deleteAdvance(input: DeleteSalaryAdvanceInput): Promise<void> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const advanceRepo = manager.getRepository(SalaryAdvanceEntity);
      const shiftRepo = manager.getRepository(ShiftEntity);

      const advance = await advanceRepo.findOne({ where: { id: input.id } });
      if (!advance) {
        throw new Error(`Salary advance ID ${input.id} not found`);
      }

      if (advance.status !== 'pending') {
        throw new Error('Only pending salary advances can be deleted. This advance has already been settled in salary.');
      }

      // If paid from cash drawer on an open shift, refund expected cash
      if (advance.paymentMethod === 'cash_drawer' && advance.shiftId) {
        const shift = await shiftRepo.findOne({ where: { id: advance.shiftId } });
        if (shift && shift.status === 'open') {
          shift.expectedCashMinorUnits += advance.amountMinorUnits;
          shift.updatedAtUtc = nowUtcString();
          await shiftRepo.save(shift);
        }
      }

      await advanceRepo.remove(advance);
    });
  }

  // ==========================================
  // MONTHLY PAYROLL SHEET & DISBURSEMENT
  // ==========================================

  public async getMonthlySheet(storeId: number, payrollMonth: string): Promise<MonthlyPayrollSheetResponse> {
    const ds = this.databaseService.getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const profileRepo = ds.getRepository(StaffPayrollProfileEntity);
    const advanceRepo = ds.getRepository(SalaryAdvanceEntity);
    const paymentRepo = ds.getRepository(SalaryPaymentEntity);

    // 1. Fetch active staff users
    const users = await userRepo.find({
      where: { storeId, isActive: true },
      order: { displayName: 'ASC' },
    });

    const profiles = await profileRepo.find();
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    // 2. Fetch pending advances for these users
    const pendingAdvances = await advanceRepo.find({
      where: { storeId, status: 'pending' },
    });

    const monthStart = `${payrollMonth}-01`;
    const userAdvancesMap = new Map<
      number,
      { current: number; carried: number; total: number; count: number }
    >();
    for (const a of pendingAdvances) {
      const entry = userAdvancesMap.get(a.userId) || {
        current: 0,
        carried: 0,
        total: 0,
        count: 0,
      };
      entry.count += 1;
      entry.total += a.amountMinorUnits;
      if (a.advanceDate < monthStart) {
        entry.carried += a.amountMinorUnits;
      } else {
        entry.current += a.amountMinorUnits;
      }
      userAdvancesMap.set(a.userId, entry);
    }

    // 3. Fetch any payments already made for this month
    const payments = await paymentRepo.find({
      where: { storeId, payrollMonth },
    });
    const paymentMap = new Map(payments.map((p) => [p.userId, p]));

    let totalBaseSalary = 0;
    let totalAdvancesPending = 0;
    let totalCurrentMonthAdvances = 0;
    let totalCarriedOverAdvances = 0;
    let totalNetPaid = 0;

    const rows = users.map((u) => {
      const prof = profileMap.get(u.id);
      const baseSalary = prof?.baseMonthlySalaryMinorUnits || 0;
      const advInfo = userAdvancesMap.get(u.id) || {
        current: 0,
        carried: 0,
        total: 0,
        count: 0,
      };
      const advances = advInfo.total;
      const currentMonthAdvances = advInfo.current;
      const carriedOverAdvances = advInfo.carried;
      const paymentRecord = paymentMap.get(u.id);

      const overAdvancedMinorUnits = Math.max(0, advances - baseSalary);
      const status: 'paid' | 'unpaid' | 'over_advanced' = paymentRecord
        ? 'paid'
        : overAdvancedMinorUnits > 0
          ? 'over_advanced'
          : 'unpaid';

      totalBaseSalary += baseSalary;
      totalAdvancesPending += advances;
      totalCurrentMonthAdvances += currentMonthAdvances;
      totalCarriedOverAdvances += carriedOverAdvances;
      if (paymentRecord) {
        totalNetPaid += paymentRecord.netPaidMinorUnits;
      }

      return {
        userId: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        designation: prof?.designation || u.role.toUpperCase(),
        baseMonthlySalaryMinorUnits: baseSalary,
        pendingAdvancesMinorUnits: advances,
        currentMonthAdvancesMinorUnits: currentMonthAdvances,
        carriedOverAdvanceMinorUnits: carriedOverAdvances,
        overAdvancedMinorUnits,
        advancesCount: advInfo.count,
        status,
        paidRecord: paymentRecord
          ? {
              id: paymentRecord.id,
              storeId: paymentRecord.storeId,
              userId: paymentRecord.userId,
              username: u.username,
              displayName: u.displayName,
              payrollMonth: paymentRecord.payrollMonth,
              baseSalaryMinorUnits: paymentRecord.baseSalaryMinorUnits,
              advancesDeductedMinorUnits: paymentRecord.advancesDeductedMinorUnits,
              bonusesMinorUnits: paymentRecord.bonusesMinorUnits,
              deductionsMinorUnits: paymentRecord.deductionsMinorUnits,
              netPaidMinorUnits: paymentRecord.netPaidMinorUnits,
              paymentMethod: paymentRecord.paymentMethod,
              shiftId: paymentRecord.shiftId,
              paymentDate: paymentRecord.paymentDate,
              notes: paymentRecord.notes,
              status: paymentRecord.status,
              createdByUserId: paymentRecord.createdByUserId,
              createdByName: paymentRecord.createdByName,
              createdAtUtc: paymentRecord.createdAtUtc,
            }
          : null,
      };
    });

    return {
      payrollMonth,
      rows,
      totalBaseSalaryMinorUnits: totalBaseSalary,
      totalAdvancesPendingMinorUnits: totalAdvancesPending,
      totalCurrentMonthAdvancesMinorUnits: totalCurrentMonthAdvances,
      totalCarriedOverAdvanceMinorUnits: totalCarriedOverAdvances,
      totalNetPaidMinorUnits: totalNetPaid,
    };
  }

  public async disburseSalary(input: DisburseSalaryInput): Promise<SalaryPayment> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(SalaryPaymentEntity);
      const advanceRepo = manager.getRepository(SalaryAdvanceEntity);
      const userRepo = manager.getRepository(UserEntity);
      const shiftRepo = manager.getRepository(ShiftEntity);
      const cashTxRepo = manager.getRepository(CashTransactionEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const staff = await userRepo.findOne({ where: { id: input.userId } });
      if (!staff) {
        throw new Error(`Staff user ID ${input.userId} not found`);
      }

      // Check if already paid for this month
      const existing = await paymentRepo.findOne({
        where: { storeId: input.storeId, userId: input.userId, payrollMonth: input.payrollMonth },
      });
      if (existing) {
        throw new Error(`Salary for '${staff.displayName}' has already been paid for month ${input.payrollMonth}`);
      }

      const now = nowUtcString();
      let shiftIdToLink: number | null = null;

      // Handle cash drawer payout if paid from counter cash
      if (input.paymentMethod === 'cash_drawer') {
        const activeShift = await shiftRepo.findOne({
          where: { storeId: input.storeId, status: 'open' },
        });

        if (activeShift) {
          shiftIdToLink = activeShift.id;

          const cashTx = cashTxRepo.create({
            shiftId: activeShift.id,
            transactionType: 'payout',
            amountMinorUnits: input.netPaidMinorUnits,
            sourceId: `SAL-${input.payrollMonth}-${staff.username}`,
            notes: `Salary Payment: ${staff.displayName} (${input.payrollMonth})`.slice(0, 255),
            createdAtUtc: now,
          });
          await cashTxRepo.save(cashTx);

          activeShift.expectedCashMinorUnits -= input.netPaidMinorUnits;
          activeShift.updatedAtUtc = now;
          await shiftRepo.save(activeShift);
        }
      }

      const payment = paymentRepo.create({
        storeId: input.storeId,
        userId: input.userId,
        payrollMonth: input.payrollMonth,
        baseSalaryMinorUnits: input.baseSalaryMinorUnits,
        advancesDeductedMinorUnits: input.advancesDeductedMinorUnits || 0,
        bonusesMinorUnits: input.bonusesMinorUnits || 0,
        deductionsMinorUnits: input.deductionsMinorUnits || 0,
        netPaidMinorUnits: input.netPaidMinorUnits,
        paymentMethod: input.paymentMethod,
        shiftId: shiftIdToLink,
        paymentDate: input.paymentDate,
        notes: input.notes?.trim() || null,
        status: 'paid',
        createdByUserId: input.createdByUserId ?? null,
        createdByName: input.createdByName,
        createdAtUtc: now,
      });

      const saved = await paymentRepo.save(payment);

      // Auto-settle pending advances for this user up to advancesDeductedMinorUnits
      if (input.advancesDeductedMinorUnits > 0) {
        const pendingAdvances = await advanceRepo.find({
          where: { storeId: input.storeId, userId: input.userId, status: 'pending' },
          order: { advanceDate: 'ASC', id: 'ASC' },
        });

        let remainingToDeduct = input.advancesDeductedMinorUnits;
        for (const adv of pendingAdvances) {
          if (remainingToDeduct <= 0) break;

          if (adv.amountMinorUnits <= remainingToDeduct) {
            adv.status = 'deducted_in_salary';
            adv.settledInSalaryPaymentId = saved.id;
            await advanceRepo.save(adv);
            remainingToDeduct -= adv.amountMinorUnits;
          } else {
            // Over-advance split: deduct what fits this month, roll remainder to next month
            const excess = adv.amountMinorUnits - remainingToDeduct;
            adv.amountMinorUnits = remainingToDeduct;
            adv.status = 'deducted_in_salary';
            adv.settledInSalaryPaymentId = saved.id;
            await advanceRepo.save(adv);

            const carryoverAdv = advanceRepo.create({
              storeId: adv.storeId,
              userId: adv.userId,
              amountMinorUnits: excess,
              advanceDate: adv.advanceDate,
              paymentMethod: adv.paymentMethod,
              shiftId: null,
              reason: `[Rolled Over Balance from Adv #${adv.id}] ${adv.reason || ''}`.trim().slice(0, 255),
              status: 'pending',
              createdByUserId: input.createdByUserId ?? null,
              createdByName: input.createdByName,
              createdAtUtc: now,
            });
            await advanceRepo.save(carryoverAdv);
            remainingToDeduct = 0;
            break;
          }
        }
      }

      // Audit log
      await auditRepo.save({
        userId: input.createdByUserId ?? null,
        username: input.createdByName,
        action: 'SALARY_DISBURSED',
        resource: 'payroll',
        detailsJson: JSON.stringify({
          paymentId: saved.id,
          staffId: staff.id,
          staffName: staff.displayName,
          month: saved.payrollMonth,
          netPaidMinorUnits: saved.netPaidMinorUnits,
          paymentMethod: saved.paymentMethod,
        }),
        createdAtUtc: now,
      });

      return {
        id: saved.id,
        storeId: saved.storeId,
        userId: saved.userId,
        username: staff.username,
        displayName: staff.displayName,
        payrollMonth: saved.payrollMonth,
        baseSalaryMinorUnits: saved.baseSalaryMinorUnits,
        advancesDeductedMinorUnits: saved.advancesDeductedMinorUnits,
        bonusesMinorUnits: saved.bonusesMinorUnits,
        deductionsMinorUnits: saved.deductionsMinorUnits,
        netPaidMinorUnits: saved.netPaidMinorUnits,
        paymentMethod: saved.paymentMethod,
        shiftId: saved.shiftId,
        paymentDate: saved.paymentDate,
        notes: saved.notes,
        status: saved.status,
        createdByUserId: saved.createdByUserId,
        createdByName: saved.createdByName,
        createdAtUtc: saved.createdAtUtc,
      };
    });
  }

  public async getEmployeeStatement(query: GetEmployeeStatementQuery): Promise<EmployeeMonthlyStatementResponse> {
    const ds = this.databaseService.getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const profileRepo = ds.getRepository(StaffPayrollProfileEntity);
    const advanceRepo = ds.getRepository(SalaryAdvanceEntity);
    const paymentRepo = ds.getRepository(SalaryPaymentEntity);

    const user = await userRepo.findOne({ where: { id: query.userId } });
    if (!user) {
      throw new Error(`User ID ${query.userId} not found`);
    }

    const profile = await profileRepo.findOne({ where: { userId: query.userId } });
    const baseSalary = profile?.baseMonthlySalaryMinorUnits || 0;
    const designation = profile?.designation || user.role.toUpperCase();

    const targetMonth = query.month || new Date().toISOString().slice(0, 7);
    const monthStart = `${targetMonth}-01`;

    // Fetch all advances for this user in this store
    const allAdvances = await advanceRepo.find({
      where: { storeId: query.storeId, userId: query.userId },
      order: { advanceDate: 'ASC', id: 'ASC' },
    });

    // Fetch payment for this month if any
    const paymentForMonth = await paymentRepo.findOne({
      where: { storeId: query.storeId, userId: query.userId, payrollMonth: targetMonth },
    });

    // Determine current vs carried over advances
    let carriedOverAdvanceMinorUnits = 0;
    let currentMonthAdvancesMinorUnits = 0;

    const statementEntries: EmployeeStatementEntry[] = [];

    for (const adv of allAdvances) {
      const isPriorMonth = adv.advanceDate < monthStart;
      const isTargetMonth = adv.advanceDate.startsWith(targetMonth);

      // Carried over: taken in a prior month AND (still pending OR settled in THIS month's salary payment)
      if (
        isPriorMonth &&
        (adv.status === 'pending' ||
          (paymentForMonth && adv.settledInSalaryPaymentId === paymentForMonth.id))
      ) {
        carriedOverAdvanceMinorUnits += adv.amountMinorUnits;
        statementEntries.push({
          id: adv.id,
          type: 'advance',
          amountMinorUnits: adv.amountMinorUnits,
          date: adv.advanceDate,
          createdAtUtc: adv.createdAtUtc,
          paymentMethod: adv.paymentMethod,
          reference: adv.shiftId ? `Shift #${adv.shiftId}` : undefined,
          notes: `[Carried Over from ${adv.advanceDate.slice(0, 7)}] ${adv.reason || ''}`.trim(),
          status: adv.status === 'pending' ? 'Pending' : 'Deducted in Salary',
          createdByName: adv.createdByName,
        });
      } else if (isTargetMonth) {
        currentMonthAdvancesMinorUnits += adv.amountMinorUnits;
        statementEntries.push({
          id: adv.id,
          type: 'advance',
          amountMinorUnits: adv.amountMinorUnits,
          date: adv.advanceDate,
          createdAtUtc: adv.createdAtUtc,
          paymentMethod: adv.paymentMethod,
          reference: adv.shiftId ? `Shift #${adv.shiftId}` : undefined,
          notes: adv.reason || null,
          status: adv.status === 'pending' ? 'Pending' : 'Deducted in Salary',
          createdByName: adv.createdByName,
        });
      }
    }

    const totalAdvances = carriedOverAdvanceMinorUnits + currentMonthAdvancesMinorUnits;
    const totalBonuses = paymentForMonth?.bonusesMinorUnits || 0;
    const totalDeductions = paymentForMonth?.deductionsMinorUnits || 0;

    if (paymentForMonth) {
      if (paymentForMonth.bonusesMinorUnits > 0) {
        statementEntries.push({
          id: paymentForMonth.id * 1000 + 1,
          type: 'bonus',
          amountMinorUnits: paymentForMonth.bonusesMinorUnits,
          date: paymentForMonth.paymentDate,
          createdAtUtc: paymentForMonth.createdAtUtc,
          paymentMethod: paymentForMonth.paymentMethod,
          reference: `Payroll ${paymentForMonth.payrollMonth}`,
          notes: paymentForMonth.notes ? `Bonus / Benefit: ${paymentForMonth.notes}` : 'Bonus / Incentive Benefit',
          status: 'Applied',
          createdByName: paymentForMonth.createdByName,
        });
      }

      if (paymentForMonth.deductionsMinorUnits > 0) {
        statementEntries.push({
          id: paymentForMonth.id * 1000 + 2,
          type: 'deduction',
          amountMinorUnits: paymentForMonth.deductionsMinorUnits,
          date: paymentForMonth.paymentDate,
          createdAtUtc: paymentForMonth.createdAtUtc,
          paymentMethod: paymentForMonth.paymentMethod,
          reference: `Payroll ${paymentForMonth.payrollMonth}`,
          notes: paymentForMonth.notes ? `Deduction: ${paymentForMonth.notes}` : 'Salary Deduction',
          status: 'Applied',
          createdByName: paymentForMonth.createdByName,
        });
      }

      statementEntries.push({
        id: paymentForMonth.id,
        type: 'salary_payment',
        amountMinorUnits: paymentForMonth.netPaidMinorUnits,
        date: paymentForMonth.paymentDate,
        createdAtUtc: paymentForMonth.createdAtUtc,
        paymentMethod: paymentForMonth.paymentMethod,
        reference: `Salary Slip #${paymentForMonth.id}`,
        notes: paymentForMonth.notes || 'Net Salary Disbursed',
        status: 'Paid',
        createdByName: paymentForMonth.createdByName,
      });
    }

    // Sort entries by date ASC, then id ASC
    statementEntries.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.id - b.id;
    });

    const netPayable = paymentForMonth
      ? paymentForMonth.netPaidMinorUnits
      : Math.max(0, baseSalary - totalAdvances);

    const status: 'paid' | 'unpaid' | 'over_advanced' = paymentForMonth
      ? 'paid'
      : totalAdvances > baseSalary
        ? 'over_advanced'
        : 'unpaid';

    return {
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      role: user.role,
      designation,
      month: targetMonth,
      baseSalaryMinorUnits: baseSalary,
      totalAdvancesMinorUnits: totalAdvances,
      totalBonusesMinorUnits: totalBonuses,
      totalDeductionsMinorUnits: totalDeductions,
      netPayableMinorUnits: netPayable,
      status,
      carriedOverAdvanceMinorUnits,
      paidRecord: paymentForMonth
        ? {
            id: paymentForMonth.id,
            storeId: paymentForMonth.storeId,
            userId: paymentForMonth.userId,
            username: user.username,
            displayName: user.displayName,
            payrollMonth: paymentForMonth.payrollMonth,
            baseSalaryMinorUnits: paymentForMonth.baseSalaryMinorUnits,
            advancesDeductedMinorUnits: paymentForMonth.advancesDeductedMinorUnits,
            bonusesMinorUnits: paymentForMonth.bonusesMinorUnits,
            deductionsMinorUnits: paymentForMonth.deductionsMinorUnits,
            netPaidMinorUnits: paymentForMonth.netPaidMinorUnits,
            paymentMethod: paymentForMonth.paymentMethod,
            shiftId: paymentForMonth.shiftId,
            paymentDate: paymentForMonth.paymentDate,
            notes: paymentForMonth.notes,
            status: paymentForMonth.status,
            createdByUserId: paymentForMonth.createdByUserId,
            createdByName: paymentForMonth.createdByName,
            createdAtUtc: paymentForMonth.createdAtUtc,
          }
        : null,
      entries: statementEntries,
    };
  }

  public async listPayments(storeId: number, payrollMonth?: string): Promise<SalaryPayment[]> {
    const ds = this.databaseService.getDataSource();
    const paymentRepo = ds.getRepository(SalaryPaymentEntity);
    const userRepo = ds.getRepository(UserEntity);

    const qb = paymentRepo
      .createQueryBuilder('p')
      .where('p.store_id = :storeId', { storeId });

    if (payrollMonth) {
      qb.andWhere('p.payroll_month = :pm', { pm: payrollMonth });
    }

    qb.orderBy('p.payment_date', 'DESC').addOrderBy('p.id', 'DESC');

    const payments = await qb.getMany();
    const users = await userRepo.find();
    const userMap = new Map(users.map((u) => [u.id, u]));

    return payments.map((p) => {
      const u = userMap.get(p.userId);
      return {
        id: p.id,
        storeId: p.storeId,
        userId: p.userId,
        username: u?.username,
        displayName: u?.displayName,
        payrollMonth: p.payrollMonth,
        baseSalaryMinorUnits: p.baseSalaryMinorUnits,
        advancesDeductedMinorUnits: p.advancesDeductedMinorUnits,
        bonusesMinorUnits: p.bonusesMinorUnits,
        deductionsMinorUnits: p.deductionsMinorUnits,
        netPaidMinorUnits: p.netPaidMinorUnits,
        paymentMethod: p.paymentMethod,
        shiftId: p.shiftId,
        paymentDate: p.paymentDate,
        notes: p.notes,
        status: p.status,
        createdByUserId: p.createdByUserId,
        createdByName: p.createdByName,
        createdAtUtc: p.createdAtUtc,
      };
    });
  }
}
