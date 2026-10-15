import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('staff_payroll_profiles')
export class StaffPayrollProfileEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  @Column({ name: 'base_monthly_salary_minor_units', type: 'integer', default: 0 })
  baseMonthlySalaryMinorUnits!: number;

  @Column({ type: 'varchar', length: 100, default: 'Staff' })
  designation!: string;

  @Column({ name: 'joining_date', type: 'varchar', length: 10, nullable: true })
  joiningDate!: string | null;

  @Column({ name: 'payment_method_preference', type: 'varchar', length: 30, default: 'cash' })
  paymentMethodPreference!: string;

  @Column({ name: 'bank_account_details', type: 'text', nullable: true })
  bankAccountDetails!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
