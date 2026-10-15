import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('held_carts')
export class HeldCartEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ name: 'cart_code', type: 'varchar', length: 50, unique: true })
  cartCode!: string;

  @Column({ name: 'cashier_id', type: 'varchar', length: 36, nullable: true })
  cashierId!: string | null;

  @Column({ name: 'customer_name_or_phone', type: 'varchar', length: 150, nullable: true })
  customerNameOrPhone!: string | null;

  @Column({ name: 'cart_json', type: 'text' })
  cartJson!: string;

  @Column({ name: 'item_count', type: 'integer', default: 0 })
  itemCount!: number;

  @Column({ name: 'subtotal_minor_units', type: 'integer', default: 0 })
  subtotalMinorUnits!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
