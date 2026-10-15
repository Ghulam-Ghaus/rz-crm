import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductEntity } from './product.entity.js';
import { ItemEntity } from './item.entity.js';
import { TaxClassEntity } from './tax-class.entity.js';

@Entity('product_variants')
export class ProductVariantEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'product_id', type: 'integer' })
  productId!: number;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity;

  @Column({ name: 'item_id', type: 'integer', nullable: true })
  itemId!: number | null;

  @ManyToOne(() => ItemEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'item_id' })
  item?: ItemEntity | null;

  @Column({ type: 'varchar', length: 50, unique: true })
  sku!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'price_minor_units', type: 'integer' })
  priceMinorUnits!: number;

  @Column({ name: 'cost_minor_units', type: 'integer', default: 0 })
  costMinorUnits!: number;

  @Column({ name: 'wholesale_price_minor_units', type: 'integer', default: 0 })
  wholesalePriceMinorUnits!: number;

  @Column({ name: 'reorder_point', type: 'real', default: 10 })
  reorderPoint!: number;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'PKR' })
  currencyCode!: string;

  @Column({ name: 'tax_class_id', type: 'integer', nullable: true })
  taxClassId!: number | null;

  @ManyToOne(() => TaxClassEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tax_class_id' })
  taxClass?: TaxClassEntity | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
