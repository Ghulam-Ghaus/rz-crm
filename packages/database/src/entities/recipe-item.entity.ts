import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('recipe_items')
export class RecipeItemEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'recipe_version_id', type: 'integer' })
  recipeVersionId!: number;

  @Column({ name: 'input_variant_id', type: 'integer' })
  inputVariantId!: number;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ name: 'unit_code', type: 'varchar', length: 20 })
  unitCode!: string;

  @Column({ name: 'wastage_percent', type: 'integer', default: 0 })
  wastagePercent!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
