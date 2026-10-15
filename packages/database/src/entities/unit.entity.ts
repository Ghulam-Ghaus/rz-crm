import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('units')
export class UnitEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  dimension!: 'MASS' | 'VOLUME' | 'COUNT';

  @Column({ type: 'integer', default: 0 })
  precision!: number;

  @Column({ name: 'is_base', type: 'boolean', default: false })
  isBase!: boolean;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
