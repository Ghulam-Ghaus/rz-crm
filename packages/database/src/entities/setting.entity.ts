import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { StoreEntity } from './store.entity.js';

@Entity('settings')
export class SettingEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: true })
  storeId!: number | null;

  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'store_id' })
  store?: StoreEntity | null;

  @Column({ type: 'varchar', length: 100 })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @Column({ type: 'varchar', length: 50, default: 'store' })
  scope!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 100, nullable: true })
  updatedBy!: string | null;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
