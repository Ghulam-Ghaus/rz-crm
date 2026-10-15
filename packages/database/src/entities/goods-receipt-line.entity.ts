import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('goods_receipt_lines')
export class GoodsReceiptLineEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'goods_receipt_id', type: 'integer' })
  goodsReceiptId!: number;

  @Column({ name: 'po_line_id', type: 'integer', nullable: true })
  poLineId!: number | null;

  @Column({ name: 'product_variant_id', type: 'integer' })
  productVariantId!: number;

  @Column({ name: 'received_quantity', type: 'integer' })
  receivedQuantity!: number;

  @Column({ name: 'unit_code', type: 'varchar', length: 20 })
  unitCode!: string;

  @Column({ name: 'unit_cost_minor_units', type: 'integer' })
  unitCostMinorUnits!: number;

  @Column({ name: 'total_cost_minor_units', type: 'integer' })
  totalCostMinorUnits!: number;

  @Column({ name: 'lot_number', type: 'varchar', length: 100, nullable: true })
  lotNumber!: string | null;

  @Column({ name: 'expiry_date_utc', type: 'varchar', length: 35, nullable: true })
  expiryDateUtc!: string | null;

  @Column({ name: 'stock_location_id', type: 'integer' })
  stockLocationId!: number;
}
