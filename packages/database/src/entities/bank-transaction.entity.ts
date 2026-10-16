import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('bank_transactions')
export class BankTransactionEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'account_id', type: 'integer' })
  @Index('idx_bank_tx_account_id')
  accountId!: number;

  @Column({ name: 'txn_type', type: 'varchar', length: 40 })
  txnType!: string;

  @Column({ name: 'amount_minor_units', type: 'integer' })
  amountMinorUnits!: number;

  @Column({ name: 'running_balance_minor_units', type: 'integer' })
  runningBalanceMinorUnits!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference!: string | null;

  @Column({ name: 'cheque_direction', type: 'varchar', length: 20, nullable: true })
  chequeDirection!: string | null;

  @Column({ name: 'cheque_id', type: 'integer', nullable: true })
  chequeId!: number | null;

  @Column({ name: 'attachment_path', type: 'varchar', length: 255, nullable: true })
  attachmentPath!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  @Index('idx_bank_tx_created')
  createdAtUtc!: string;
}
