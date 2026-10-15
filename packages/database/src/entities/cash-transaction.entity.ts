import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cash_transactions')
export class CashTransactionEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'shift_id', type: 'integer' })
  shiftId!: number;

  @Column({ name: 'transaction_type', type: 'varchar', length: 30 })
  transactionType!: 'float' | 'sale_in' | 'drop' | 'payout' | 'refund_out';

  @Column({ name: 'amount_minor_units', type: 'integer' })
  amountMinorUnits!: number;

  @Column({ name: 'source_id', type: 'varchar', length: 36, nullable: true })
  sourceId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
