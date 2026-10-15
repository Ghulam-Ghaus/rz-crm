import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('production_run_items')
export class ProductionRunItemEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'production_run_id', type: 'integer' })
  productionRunId!: number;

  @Column({ name: 'input_variant_id', type: 'integer' })
  inputVariantId!: number;

  @Column({ name: 'planned_quantity', type: 'integer' })
  plannedQuantity!: number;

  @Column({ name: 'actual_quantity', type: 'integer' })
  actualQuantity!: number;

  @Column({ name: 'unit_code', type: 'varchar', length: 20 })
  unitCode!: string;

  @Column({ name: 'unit_cost_minor_units', type: 'integer', default: 0 })
  unitCostMinorUnits!: number;

  @Column({ name: 'total_cost_minor_units', type: 'integer', default: 0 })
  totalCostMinorUnits!: number;

  @Column({ name: 'lot_id', type: 'integer', nullable: true })
  lotId!: number | null;
}
