import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sale_items')
export class SaleItemEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'sale_id', type: 'integer' })
  saleId!: number;

  @Column({ name: 'variant_id', type: 'integer' })
  variantId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: true })
  itemId!: number | null;

  @Column({ type: 'varchar', length: 50 })
  sku!: string;

  @Column({ name: 'product_name', type: 'varchar', length: 100 })
  productName!: string;

  @Column({ type: 'real' })
  quantity!: number;

  @Column({ name: 'unit_price_minor_units', type: 'integer' })
  unitPriceMinorUnits!: number;

  @Column({ name: 'subtotal_minor_units', type: 'integer' })
  subtotalMinorUnits!: number;

  @Column({ name: 'tax_minor_units', type: 'integer', default: 0 })
  taxMinorUnits!: number;

  @Column({ name: 'total_minor_units', type: 'integer' })
  totalMinorUnits!: number;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
