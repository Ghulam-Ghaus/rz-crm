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

  @Column({ name: 'customer_id', type: 'integer', nullable: true })
  customerId!: number | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 150, nullable: true })
  customerName!: string | null;

  @Column({ name: 'order_type', type: 'varchar', length: 20, default: 'retail' })
  orderType!: 'retail' | 'wholesale';

  @Column({ name: 'price_tier', type: 'varchar', length: 20, default: 'retail' })
  priceTier!: 'retail' | 'wholesale';

  @Column({ name: 'location_id', type: 'integer', nullable: true })
  locationId!: number | null;

  @Column({ name: 'payment_status', type: 'varchar', length: 20, default: 'paid' })
  paymentStatus!: 'paid' | 'partial' | 'unpaid';

  @Column({ name: 'payment_method', type: 'varchar', length: 30, default: 'cash' })
  paymentMethod!: string;

  @Column({ name: 'amount_paid_minor_units', type: 'integer', default: 0 })
  amountPaidMinorUnits!: number;

  @Column({ name: 'balance_due_minor_units', type: 'integer', default: 0 })
  balanceDueMinorUnits!: number;

  @Column({ name: 'due_date', type: 'varchar', length: 10, nullable: true })
  dueDate!: string | null;

  @Column({ name: 'payment_terms', type: 'varchar', length: 50, nullable: true })
  paymentTerms!: string | null;

  @Column({ name: 'reference_note', type: 'varchar', length: 255, nullable: true })
  referenceNote!: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
