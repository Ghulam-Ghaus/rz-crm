import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('custom_orders')
export class CustomOrderEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'order_number', type: 'varchar', length: 50, unique: true })
  orderNumber!: string;

  @Column({ name: 'customer_id', type: 'integer' })
  customerId!: number;

  @Column({ name: 'due_date_utc', type: 'varchar', length: 35 })
  dueDateUtc!: string;

  @Column({ name: 'event_date_utc', type: 'varchar', length: 35, nullable: true })
  eventDateUtc!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'CONFIRMED' })
  status!: string; // 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'COLLECTED', 'CANCELLED'

  @Column({ name: 'total_amount_minor_units', type: 'integer', default: 0 })
  totalAmountMinorUnits!: number;

  @Column({ name: 'deposit_amount_minor_units', type: 'integer', default: 0 })
  depositAmountMinorUnits!: number;

  @Column({ name: 'balance_amount_minor_units', type: 'integer', default: 0 })
  balanceAmountMinorUnits!: number;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'PKR' })
  currencyCode!: string;

  @Column({ name: 'cake_flavor', type: 'varchar', length: 100, nullable: true })
  cakeFlavor!: string | null;

  @Column({ name: 'cake_size', type: 'varchar', length: 50, nullable: true })
  cakeSize!: string | null;

  @Column({ name: 'cake_message', type: 'text', nullable: true })
  cakeMessage!: string | null;

  @Column({ name: 'decoration_notes', type: 'text', nullable: true })
  decorationNotes!: string | null;

  @Column({ name: 'allergens_notes', type: 'text', nullable: true })
  allergensNotes!: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
