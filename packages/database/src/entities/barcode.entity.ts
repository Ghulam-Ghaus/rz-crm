import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('barcodes')
export class BarcodeEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'barcode_value', type: 'varchar', length: 100, unique: true })
  barcodeValue!: string;

  @Column({ name: 'barcode_type', type: 'varchar', length: 30, default: 'EAN13' })
  barcodeType!: 'EAN13' | 'UPCA' | 'CODE128' | 'INTERNAL';

  @Column({ name: 'target_type', type: 'varchar', length: 30, default: 'variant' })
  targetType!: 'variant' | 'item';

  @Column({ name: 'target_id', type: 'integer' })
  targetId!: number;

  @Column({ name: 'is_primary', type: 'boolean', default: true })
  isPrimary!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
