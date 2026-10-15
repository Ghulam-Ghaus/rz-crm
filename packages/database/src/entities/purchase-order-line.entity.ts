import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('purchase_order_lines')
export class PurchaseOrderLineEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'purchase_order_id', type: 'integer' })
  purchaseOrderId!: number;

  @Column({ name: 'product_variant_id', type: 'integer' })
  productVariantId!: number;

  @Column({ name: 'ordered_quantity', type: 'integer' })
  orderedQuantity!: number;

  @Column({ name: 'received_quantity', type: 'integer', default: 0 })
  receivedQuantity!: number;

  @Column({ name: 'unit_code', type: 'varchar', length: 20 })
  unitCode!: string;

  @Column({ name: 'unit_cost_minor_units', type: 'integer' })
  unitCostMinorUnits!: number;

  @Column({ name: 'total_cost_minor_units', type: 'integer' })
  totalCostMinorUnits!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
