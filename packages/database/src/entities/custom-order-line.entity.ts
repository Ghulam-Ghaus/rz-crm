import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('custom_order_lines')
export class CustomOrderLineEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'custom_order_id', type: 'integer' })
  customOrderId!: number;

  @Column({ name: 'product_variant_id', type: 'integer', nullable: true })
  productVariantId!: number | null;

  @Column({ name: 'item_name', type: 'varchar', length: 150 })
  itemName!: string;

  @Column({ type: 'integer', default: 1 })
  quantity!: number;

  @Column({ name: 'unit_price_minor_units', type: 'integer', default: 0 })
  unitPriceMinorUnits!: number;

  @Column({ name: 'total_price_minor_units', type: 'integer', default: 0 })
  totalPriceMinorUnits!: number;
}
