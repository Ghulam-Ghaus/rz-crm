import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stakeholder_transactions')
export class StakeholderTransactionEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer', default: 1 })
  storeId!: number;

  @Column({ name: 'stakeholder_id', type: 'integer' })
  stakeholderId!: number;

  @Column({ name: 'txn_number', type: 'varchar', length: 50, unique: true })
  txnNumber!: string;

  @Column({ type: 'varchar', length: 40 })
  type!:
    | 'CAPITAL_INTRODUCED'
    | 'ADDITIONAL_INVESTMENT'
    | 'CAPITAL_WITHDRAWAL'
    | 'PROFIT_DISTRIBUTION'
    | 'DRAWINGS'
    | 'LOAN_IN'
    | 'LOAN_REPAYMENT';

  @Column({ name: 'amount_minor_units', type: 'integer' })
  amountMinorUnits!: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 30, default: 'BANK_TRANSFER' })
  paymentMethod!: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'period_id', type: 'integer', nullable: true })
  periodId!: number | null;

  @Column({ name: 'txn_date', type: 'varchar', length: 35 })
  txnDate!: string;

  @Column({ name: 'created_by', type: 'varchar', length: 50 })
  createdBy!: string;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
