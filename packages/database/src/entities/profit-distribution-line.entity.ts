import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('profit_distribution_lines')
export class ProfitDistributionLineEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'run_id', type: 'integer' })
  runId!: number;

  @Column({ name: 'stakeholder_id', type: 'integer' })
  stakeholderId!: number;

  @Column({ name: 'stakeholder_name', type: 'varchar', length: 150 })
  stakeholderName!: string;

  @Column({ name: 'share_mode', type: 'varchar', length: 30 })
  shareMode!: 'FIXED_PERCENT' | 'CAPITAL_PROPORTIONAL';

  @Column({ name: 'share_bps', type: 'integer' })
  shareBps!: number; // basis points (10000 = 100%)

  @Column({ name: 'capital_balance_minor_units', type: 'integer', default: 0 })
  capitalBalanceMinorUnits!: number;

  @Column({ name: 'allocated_amount_minor_units', type: 'integer' })
  allocatedAmountMinorUnits!: number;

  @Column({ name: 'paid_amount_minor_units', type: 'integer', default: 0 })
  paidAmountMinorUnits!: number;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status!: 'PENDING' | 'PAID';

  @Column({ name: 'payout_txn_id', type: 'integer', nullable: true })
  payoutTxnId!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
