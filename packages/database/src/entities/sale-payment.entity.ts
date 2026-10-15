import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sale_payments')
export class SalePaymentEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'sale_id', type: 'integer' })
  saleId!: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 30, default: 'cash' })
  paymentMethod!: string;

  @Column({ name: 'amount_tendered_minor_units', type: 'integer' })
  amountTenderedMinorUnits!: number;

  @Column({ name: 'amount_paid_minor_units', type: 'integer' })
  amountPaidMinorUnits!: number;

  @Column({ name: 'change_due_minor_units', type: 'integer', default: 0 })
  changeDueMinorUnits!: number;

  @Column({ type: 'varchar', length: 20, default: 'posted' })
  status!: string;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
