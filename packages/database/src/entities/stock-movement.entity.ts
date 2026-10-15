import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stock_movements')
export class StockMovementEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'item_id', type: 'integer' })
  itemId!: number;

  @Column({ name: 'location_id', type: 'integer' })
  locationId!: number;

  @Column({ name: 'signed_base_quantity', type: 'real' })
  signedBaseQuantity!: number;

  @Column({ name: 'movement_type', type: 'varchar', length: 50 })
  movementType!:
    | 'OPENING'
    | 'PURCHASE_RECEIPT'
    | 'PURCHASE_RETURN'
    | 'SALE'
    | 'SALE_REFUND'
    | 'PRODUCTION_CONSUMPTION'
    | 'PRODUCTION_OUTPUT'
    | 'WASTAGE'
    | 'COUNT_ADJUSTMENT'
    | 'TRANSFER_OUT'
    | 'TRANSFER_IN';

  @Column({ name: 'source_type', type: 'varchar', length: 50 })
  sourceType!: string;

  @Column({ name: 'source_id', type: 'varchar', length: 36 })
  sourceId!: string;

  @Column({ name: 'source_line_id', type: 'varchar', length: 36, nullable: true })
  sourceLineId!: string | null;

  @Column({ name: 'cost_per_unit_minor_units', type: 'integer', nullable: true })
  costPerUnitMinorUnits!: number | null;

  @Column({ name: 'actor_id', type: 'varchar', length: 36, nullable: true })
  actorId!: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, nullable: true })
  idempotencyKey!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
