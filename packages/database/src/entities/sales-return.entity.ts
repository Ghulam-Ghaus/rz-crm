import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import type { SalesReturnLineEntity } from './sales-return-line.entity.js';

@Entity('sales_returns')
export class SalesReturnEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'return_number', type: 'varchar', length: 50, unique: true })
  returnNumber!: string;

  @Column({ name: 'sale_id', type: 'integer', nullable: true })
  saleId!: number | null;

  @Column({ name: 'customer_id', type: 'integer', nullable: true })
  customerId!: number | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 150, nullable: true })
  customerName!: string | null;

  @Column({ name: 'return_date_utc', type: 'varchar', length: 35 })
  returnDateUtc!: string;

  @Column({ type: 'varchar', length: 100 })
  reason!: string;

  @Column({ name: 'refund_method', type: 'varchar', length: 30, default: 'CREDIT_NOTE' })
  refundMethod!: 'CREDIT_NOTE' | 'CASH_REFUND' | 'BANK_REFUND' | 'NO_REFUND';

  @Column({ name: 'total_amount_minor_units', type: 'integer' })
  totalAmountMinorUnits!: number;

  @Column({ name: 'refund_amount_minor_units', type: 'integer' })
  refundAmountMinorUnits!: number;

  @Column({ type: 'varchar', length: 20, default: 'COMPLETED' })
  status!: 'COMPLETED' | 'CANCELLED';

  @Column({ name: 'processed_by', type: 'varchar', length: 50 })
  processedBy!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;

  lines?: SalesReturnLineEntity[];
}
