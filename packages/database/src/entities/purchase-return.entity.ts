import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import type { PurchaseReturnLineEntity } from './purchase-return-line.entity.js';

@Entity('purchase_returns')
export class PurchaseReturnEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'return_number', type: 'varchar', length: 50, unique: true })
  returnNumber!: string;

  @Column({ name: 'supplier_id', type: 'integer' })
  supplierId!: number;

  @Column({ name: 'goods_receipt_id', type: 'integer', nullable: true })
  goodsReceiptId!: number | null;

  @Column({ name: 'supplier_invoice_ref', type: 'varchar', length: 100, nullable: true })
  supplierInvoiceRef!: string | null;

  @Column({ name: 'return_date_utc', type: 'varchar', length: 35 })
  returnDateUtc!: string;

  @Column({ type: 'varchar', length: 100 })
  reason!: string;

  @Column({ name: 'settlement_method', type: 'varchar', length: 30, default: 'DEBIT_NOTE' })
  settlementMethod!: 'DEBIT_NOTE' | 'CASH_REFUND' | 'BANK_REFUND';

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

  lines?: PurchaseReturnLineEntity[];
}
