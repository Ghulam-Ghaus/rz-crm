import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('expenses')
export class ExpenseEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Index()
  @Column({ name: 'category_id', type: 'integer' })
  categoryId!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'amount_minor_units', type: 'integer' })
  amountMinorUnits!: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 30 })
  paymentMethod!: 'cash_drawer' | 'cash_hand' | 'bank_transfer' | 'cheque';

  @Column({ name: 'shift_id', type: 'integer', nullable: true })
  shiftId!: number | null;

  @Column({ name: 'voucher_number', type: 'varchar', length: 100, nullable: true })
  voucherNumber!: string | null;

  @Column({ name: 'paid_to', type: 'varchar', length: 150, nullable: true })
  paidTo!: string | null;

  @Index()
  @Column({ name: 'expense_date', type: 'varchar', length: 10 })
  expenseDate!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by_user_id', type: 'integer', nullable: true })
  createdByUserId!: number | null;

  @Column({ name: 'created_by_name', type: 'varchar', length: 100 })
  createdByName!: string;

  @Index()
  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
