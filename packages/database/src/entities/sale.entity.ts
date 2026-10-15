import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sales')
export class SaleEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'register_id', type: 'integer', nullable: true })
  registerId!: number | null;

  @Column({ name: 'shift_id', type: 'integer' })
  shiftId!: number;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50, unique: true })
  invoiceNumber!: string;

  @Column({ name: 'cashier_id', type: 'varchar', length: 36 })
  cashierId!: string;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status!: 'completed' | 'held' | 'voided' | 'refunded';

  @Column({ name: 'subtotal_minor_units', type: 'integer' })
  subtotalMinorUnits!: number;

  @Column({ name: 'discount_minor_units', type: 'integer', default: 0 })
  discountMinorUnits!: number;

  @Column({ name: 'tax_minor_units', type: 'integer', default: 0 })
  taxMinorUnits!: number;

  @Column({ name: 'total_minor_units', type: 'integer' })
  totalMinorUnits!: number;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'PKR' })
  currencyCode!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
