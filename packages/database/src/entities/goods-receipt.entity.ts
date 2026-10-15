import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('goods_receipts')
export class GoodsReceiptEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'grn_number', type: 'varchar', length: 50, unique: true })
  grnNumber!: string;

  @Column({ name: 'purchase_order_id', type: 'integer', nullable: true })
  purchaseOrderId!: number | null;

  @Column({ name: 'supplier_id', type: 'integer' })
  supplierId!: number;

  @Column({ name: 'supplier_invoice_ref', type: 'varchar', length: 100 })
  supplierInvoiceRef!: string;

  @Column({ name: 'received_date_utc', type: 'varchar', length: 35 })
  receivedDateUtc!: string;

  @Column({ type: 'varchar', length: 20, default: 'POSTED' })
  status!: 'DRAFT' | 'POSTED' | 'CANCELLED';

  @Column({ name: 'total_amount_minor_units', type: 'integer', default: 0 })
  totalAmountMinorUnits!: number;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'PKR' })
  currencyCode!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'received_by', type: 'varchar', length: 36, nullable: true })
  receivedBy!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
