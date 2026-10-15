import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import type { ProfitDistributionLineEntity } from './profit-distribution-line.entity.js';

@Entity('profit_distribution_runs')
export class ProfitDistributionRunEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer', default: 1 })
  storeId!: number;

  @Column({ name: 'run_number', type: 'varchar', length: 50, unique: true })
  runNumber!: string;

  @Column({ name: 'period_id', type: 'integer' })
  periodId!: number;

  @Column({ name: 'revenue_minor_units', type: 'integer', default: 0 })
  revenueMinorUnits!: number;

  @Column({ name: 'cogs_minor_units', type: 'integer', default: 0 })
  cogsMinorUnits!: number;

  @Column({ name: 'gross_profit_minor_units', type: 'integer', default: 0 })
  grossProfitMinorUnits!: number;

  @Column({ name: 'operating_expenses_minor_units', type: 'integer', default: 0 })
  operatingExpensesMinorUnits!: number;

  @Column({ name: 'staff_cost_minor_units', type: 'integer', default: 0 })
  staffCostMinorUnits!: number;

  @Column({ name: 'net_profit_minor_units', type: 'integer', default: 0 })
  netProfitMinorUnits!: number;

  @Column({ name: 'distributable_profit_minor_units', type: 'integer', default: 0 })
  distributableProfitMinorUnits!: number;

  @Column({ name: 'retained_earnings_minor_units', type: 'integer', default: 0 })
  retainedEarningsMinorUnits!: number;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status!: 'DRAFT' | 'APPROVED' | 'PAID';

  @Column({ name: 'created_by', type: 'varchar', length: 50 })
  createdBy!: string;

  @Column({ name: 'approved_by', type: 'varchar', length: 50, nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'approved_at_utc', type: 'varchar', length: 35, nullable: true })
  approvedAtUtc!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;

  lines?: ProfitDistributionLineEntity[];
}
