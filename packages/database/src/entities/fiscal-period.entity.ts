import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fiscal_periods')
export class FiscalPeriodEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer', default: 1 })
  storeId!: number;

  @Column({ name: 'period_code', type: 'varchar', length: 50, unique: true })
  periodCode!: string;

  @Column({ type: 'varchar', length: 100 })
  label!: string;

  @Column({ name: 'start_date', type: 'varchar', length: 35 })
  startDate!: string;

  @Column({ name: 'end_date', type: 'varchar', length: 35 })
  endDate!: string;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status!: 'OPEN' | 'CLOSING' | 'CLOSED';

  @Column({ name: 'closed_by', type: 'varchar', length: 50, nullable: true })
  closedBy!: string | null;

  @Column({ name: 'closed_at_utc', type: 'varchar', length: 35, nullable: true })
  closedAtUtc!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
