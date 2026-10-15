import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('shifts')
export class ShiftEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'shift_code', type: 'varchar', length: 50, unique: true, nullable: true })
  shiftCode!: string | null;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'register_id', type: 'integer', nullable: true })
  registerId!: number | null;

  @Column({ name: 'cashier_id', type: 'varchar', length: 36 })
  cashierId!: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status!: 'open' | 'closed';

  @Column({ name: 'opened_at_utc', type: 'varchar', length: 35 })
  openedAtUtc!: string;

  @Column({ name: 'closed_at_utc', type: 'varchar', length: 35, nullable: true })
  closedAtUtc!: string | null;

  @Column({ name: 'opening_float_minor_units', type: 'integer', default: 0 })
  openingFloatMinorUnits!: number;

  @Column({ name: 'expected_cash_minor_units', type: 'integer', default: 0 })
  expectedCashMinorUnits!: number;

  @Column({ name: 'closing_counted_minor_units', type: 'integer', nullable: true })
  closingCountedMinorUnits!: number | null;

  @Column({ name: 'variance_minor_units', type: 'integer', nullable: true })
  varianceMinorUnits!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
