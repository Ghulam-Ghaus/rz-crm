import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('recipe_versions')
export class RecipeVersionEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'recipe_id', type: 'integer' })
  recipeId!: number;

  @Column({ name: 'version_number', type: 'integer', default: 1 })
  versionNumber!: number;

  @Column({ name: 'is_active', type: 'integer', default: 1 })
  isActive!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
