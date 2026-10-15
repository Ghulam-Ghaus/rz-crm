import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('production_runs')
export class ProductionRunEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'run_number', type: 'varchar', length: 50, unique: true })
  runNumber!: string;

  @Column({ name: 'recipe_id', type: 'integer' })
  recipeId!: number;

  @Column({ name: 'recipe_version_id', type: 'integer' })
  recipeVersionId!: number;

  @Column({ name: 'output_variant_id', type: 'integer' })
  outputVariantId!: number;

  @Column({ type: 'varchar', length: 25, default: 'PLANNED' })
  status!: 'PLANNED' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @Column({ name: 'planned_batch_count', type: 'integer', default: 1 })
  plannedBatchCount!: number;

  @Column({ name: 'planned_output_quantity', type: 'integer' })
  plannedOutputQuantity!: number;

  @Column({ name: 'actual_output_quantity', type: 'integer', nullable: true })
  actualOutputQuantity!: number | null;

  @Column({ name: 'output_unit_code', type: 'varchar', length: 20 })
  outputUnitCode!: string;

  @Column({ name: 'total_cost_minor_units', type: 'integer', default: 0 })
  totalCostMinorUnits!: number;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'PKR' })
  currencyCode!: string;

  @Column({ name: 'planned_date_utc', type: 'varchar', length: 35 })
  plannedDateUtc!: string;

  @Column({ name: 'completed_at_utc', type: 'varchar', length: 35, nullable: true })
  completedAtUtc!: string | null;

  @Column({ name: 'output_lot_number', type: 'varchar', length: 50, nullable: true })
  outputLotNumber!: string | null;

  @Column({ name: 'output_expiry_date', type: 'varchar', length: 20, nullable: true })
  outputExpiryDate!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
