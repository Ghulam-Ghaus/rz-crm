import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('inventory_lots')
export class InventoryLotEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'product_variant_id', type: 'integer' })
  productVariantId!: number;

  @Column({ name: 'lot_number', type: 'varchar', length: 100 })
  lotNumber!: string;

  @Column({ name: 'supplier_id', type: 'integer', nullable: true })
  supplierId!: number | null;

  @Column({ name: 'manufacture_date_utc', type: 'varchar', length: 35, nullable: true })
  manufactureDateUtc!: string | null;

  @Column({ name: 'expiry_date_utc', type: 'varchar', length: 35, nullable: true })
  expiryDateUtc!: string | null;

  @Column({ name: 'unit_cost_minor_units', type: 'integer', default: 0 })
  unitCostMinorUnits!: number;

  @Column({ name: 'initial_quantity', type: 'integer' })
  initialQuantity!: number;

  @Column({ name: 'current_quantity', type: 'integer' })
  currentQuantity!: number;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
