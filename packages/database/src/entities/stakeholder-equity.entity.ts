import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stakeholder_equity')
export class StakeholderEquityEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'stakeholder_id', type: 'integer' })
  stakeholderId!: number;

  @Column({ name: 'effective_from', type: 'varchar', length: 35 })
  effectiveFrom!: string;

  @Column({ name: 'effective_to', type: 'varchar', length: 35, nullable: true })
  effectiveTo!: string | null;

  @Column({ name: 'share_mode', type: 'varchar', length: 30, default: 'FIXED_PERCENT' })
  shareMode!: 'FIXED_PERCENT' | 'CAPITAL_PROPORTIONAL';

  @Column({ name: 'ownership_bps', type: 'integer', default: 0 })
  ownershipBps!: number; // basis points (10000 = 100%)

  @Column({ name: 'profit_share_bps', type: 'integer', default: 0 })
  profitShareBps!: number; // basis points (10000 = 100%)

  @Column({ name: 'loss_share_bps', type: 'integer', default: 0 })
  lossShareBps!: number; // basis points (10000 = 100%)

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
