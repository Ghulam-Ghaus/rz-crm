import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('supplier_payments')
export class SupplierPaymentEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'supplier_id', type: 'integer' })
  supplierId!: number;

  @Column({ name: 'payment_number', type: 'varchar', length: 50, unique: true })
  paymentNumber!: string;

  @Column({ name: 'payment_date_utc', type: 'varchar', length: 35 })
  paymentDateUtc!: string;

  @Column({ name: 'amount_minor_units', type: 'integer' })
  amountMinorUnits!: number;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'PKR' })
  currencyCode!: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 30 }) // 'CASH', 'BANK_TRANSFER', 'CHEQUE', etc.
  paymentMethod!: string;

  @Column({ name: 'reference', type: 'varchar', length: 100, nullable: true })
  reference!: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName!: string | null;

  @Column({ name: 'cheque_date', type: 'varchar', length: 35, nullable: true })
  chequeDate!: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'paid_by', type: 'varchar', length: 36, nullable: true })
  paidBy!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
