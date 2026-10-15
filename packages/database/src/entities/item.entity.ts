import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('items')
export class ItemEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'item_type', type: 'varchar', length: 30, default: 'finished_good' })
  itemType!: 'ingredient' | 'packaging' | 'finished_good' | 'resale_good' | 'service';

  @Column({ name: 'base_unit_code', type: 'varchar', length: 20 })
  baseUnitCode!: string;

  @Column({ name: 'track_inventory', type: 'boolean', default: true })
  trackInventory!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
