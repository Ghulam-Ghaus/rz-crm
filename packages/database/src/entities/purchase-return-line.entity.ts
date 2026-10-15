import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('purchase_return_lines')
export class PurchaseReturnLineEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'purchase_return_id', type: 'integer' })
  purchaseReturnId!: number;

  @Column({ name: 'grn_line_id', type: 'integer', nullable: true })
  grnLineId!: number | null;

  @Column({ name: 'product_variant_id', type: 'integer' })
  productVariantId!: number;

  @Column({ type: 'real' })
  quantity!: number;

  @Column({ name: 'unit_code', type: 'varchar', length: 20 })
  unitCode!: string;

  @Column({ name: 'unit_cost_minor_units', type: 'integer' })
  unitCostMinorUnits!: number;

  @Column({ name: 'total_cost_minor_units', type: 'integer' })
  totalCostMinorUnits!: number;

  @Column({ name: 'source_location_id', type: 'integer' })
  sourceLocationId!: number;

  @Column({ name: 'lot_number', type: 'varchar', length: 50, nullable: true })
  lotNumber!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reason!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
