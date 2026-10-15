import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('salary_payments')
export class SalaryPaymentEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  @Index()
  @Column({ name: 'payroll_month', type: 'varchar', length: 7 }) // YYYY-MM
  payrollMonth!: string;

  @Column({ name: 'base_salary_minor_units', type: 'integer' })
  baseSalaryMinorUnits!: number;

  @Column({ name: 'advances_deducted_minor_units', type: 'integer', default: 0 })
  advancesDeductedMinorUnits!: number;

  @Column({ name: 'bonuses_minor_units', type: 'integer', default: 0 })
  bonusesMinorUnits!: number;

  @Column({ name: 'deductions_minor_units', type: 'integer', default: 0 })
  deductionsMinorUnits!: number;

  @Column({ name: 'net_paid_minor_units', type: 'integer' })
  netPaidMinorUnits!: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 30, default: 'cash_hand' })
  paymentMethod!: string;

  @Column({ name: 'shift_id', type: 'integer', nullable: true })
  shiftId!: number | null;

  @Index()
  @Column({ name: 'payment_date', type: 'varchar', length: 10 })
  paymentDate!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'paid' })
  status!: 'paid' | 'pending';

  @Column({ name: 'created_by_user_id', type: 'integer', nullable: true })
  createdByUserId!: number | null;

  @Column({ name: 'created_by_name', type: 'varchar', length: 100 })
  createdByName!: string;

  @Index()
  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
