import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('salary_advances')
export class SalaryAdvanceEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  @Column({ name: 'amount_minor_units', type: 'integer' })
  amountMinorUnits!: number;

  @Index()
  @Column({ name: 'advance_date', type: 'varchar', length: 10 })
  advanceDate!: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 30, default: 'cash_drawer' })
  paymentMethod!: string;

  @Column({ name: 'shift_id', type: 'integer', nullable: true })
  shiftId!: number | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: 'pending' | 'deducted_in_salary' | 'written_off';

  @Column({ name: 'settled_in_salary_payment_id', type: 'integer', nullable: true })
  settledInSalaryPaymentId!: number | null;

  @Column({ name: 'created_by_user_id', type: 'integer', nullable: true })
  createdByUserId!: number | null;

  @Column({ name: 'created_by_name', type: 'varchar', length: 100 })
  createdByName!: string;

  @Index()
  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
