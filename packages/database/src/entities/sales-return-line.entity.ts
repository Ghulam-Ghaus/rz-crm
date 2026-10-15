import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sales_return_lines')
export class SalesReturnLineEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'sales_return_id', type: 'integer' })
  salesReturnId!: number;

  @Column({ name: 'sale_item_id', type: 'integer', nullable: true })
  saleItemId!: number | null;

  @Column({ name: 'product_variant_id', type: 'integer' })
  productVariantId!: number;

  @Column({ type: 'real' })
  quantity!: number;

  @Column({ name: 'unit_code', type: 'varchar', length: 20 })
  unitCode!: string;

  @Column({ name: 'unit_price_minor_units', type: 'integer' })
  unitPriceMinorUnits!: number;

  @Column({ name: 'total_price_minor_units', type: 'integer' })
  totalPriceMinorUnits!: number;

  @Column({ type: 'varchar', length: 20, default: 'RESTOCK' })
  condition!: 'RESTOCK' | 'DAMAGED_SCRAP';

  @Column({ name: 'target_location_id', type: 'integer' })
  targetLocationId!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reason!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
