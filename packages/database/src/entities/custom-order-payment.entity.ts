import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('custom_order_payments')
export class CustomOrderPaymentEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'custom_order_id', type: 'integer' })
  customOrderId!: number;

  @Column({ name: 'payment_type', type: 'varchar', length: 30 }) // 'DEPOSIT', 'BALANCE', 'REFUND'
  paymentType!: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 30 }) // 'CASH', 'CARD', 'ONLINE'
  paymentMethod!: string;

  @Column({ name: 'amount_minor_units', type: 'integer' })
  amountMinorUnits!: number;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'PKR' })
  currencyCode!: string;

  @Column({ name: 'shift_id', type: 'integer', nullable: true })
  shiftId!: number | null;

  @Column({ name: 'cashier_id', type: 'varchar', length: 36, nullable: true })
  cashierId!: string | null;

  @Column({ name: 'reference_notes', type: 'text', nullable: true })
  referenceNotes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
