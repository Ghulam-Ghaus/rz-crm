import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('opening_stock_sessions')
export class OpeningStockSessionEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status!: 'draft' | 'confirmed';

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'confirmed_at_utc', type: 'varchar', length: 35, nullable: true })
  confirmedAtUtc!: string | null;

  @Column({ name: 'confirmed_by', type: 'varchar', length: 100, nullable: true })
  confirmedBy!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
