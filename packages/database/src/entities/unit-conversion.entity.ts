import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('unit_conversions')
export class UnitConversionEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'from_unit_code', type: 'varchar', length: 20 })
  fromUnitCode!: string;

  @Column({ name: 'to_unit_code', type: 'varchar', length: 20 })
  toUnitCode!: string;

  @Column({ type: 'real' })
  multiplier!: number;

  @Column({ type: 'varchar', length: 20 })
  dimension!: string;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
