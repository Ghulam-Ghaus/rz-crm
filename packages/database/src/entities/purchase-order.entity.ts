import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('purchase_orders')
export class PurchaseOrderEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'po_number', type: 'varchar', length: 50, unique: true })
  poNumber!: string;

  @Column({ name: 'supplier_id', type: 'integer' })
  supplierId!: number;

  @Column({ type: 'varchar', length: 25, default: 'DRAFT' })
  status!: 'DRAFT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

  @Column({ name: 'order_date_utc', type: 'varchar', length: 35 })
  orderDateUtc!: string;

  @Column({ name: 'expected_delivery_date_utc', type: 'varchar', length: 35, nullable: true })
  expectedDeliveryDateUtc!: string | null;

  @Column({ name: 'subtotal_minor_units', type: 'integer', default: 0 })
  subtotalMinorUnits!: number;

  @Column({ name: 'tax_minor_units', type: 'integer', default: 0 })
  taxMinorUnits!: number;

  @Column({ name: 'total_cost_minor_units', type: 'integer', default: 0 })
  totalCostMinorUnits!: number;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'PKR' })
  currencyCode!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
