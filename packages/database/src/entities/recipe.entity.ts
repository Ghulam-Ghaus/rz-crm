import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('recipes')
export class RecipeEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'output_variant_id', type: 'integer' })
  outputVariantId!: number;

  @Column({ name: 'expected_yield_quantity', type: 'integer', default: 1 })
  expectedYieldQuantity!: number;

  @Column({ name: 'output_unit_code', type: 'varchar', length: 20 })
  outputUnitCode!: string;

  @Column({ name: 'is_active', type: 'integer', default: 1 })
  isActive!: number;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
