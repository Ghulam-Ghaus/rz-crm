import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductionAndRecipes1700000004000 implements MigrationInterface {
  name = 'ProductionAndRecipes1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. recipes table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipes" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(150) NOT NULL,
        "description" TEXT,
        "output_variant_id" INTEGER NOT NULL,
        "expected_yield_quantity" INTEGER NOT NULL DEFAULT 1,
        "output_unit_code" VARCHAR(20) NOT NULL,
        "is_active" INTEGER NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_recipes_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_recipes_output_variant" FOREIGN KEY ("output_variant_id") REFERENCES "product_variants" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recipes_store_active" ON "recipes" ("store_id", "is_active")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recipes_code" ON "recipes" ("code")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recipes_output_variant" ON "recipes" ("output_variant_id")`);

    // 2. recipe_versions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipe_versions" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "recipe_id" INTEGER NOT NULL,
        "version_number" INTEGER NOT NULL DEFAULT 1,
        "is_active" INTEGER NOT NULL DEFAULT 1,
        "notes" TEXT,
        "created_by" VARCHAR(36),
        "created_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_recipe_versions_recipe" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE,
        CONSTRAINT "uq_recipe_version" UNIQUE ("recipe_id", "version_number")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recipe_versions_recipe" ON "recipe_versions" ("recipe_id", "is_active")`);

    // 3. recipe_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipe_items" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "recipe_version_id" INTEGER NOT NULL,
        "input_variant_id" INTEGER NOT NULL,
        "quantity" INTEGER NOT NULL,
        "unit_code" VARCHAR(20) NOT NULL,
        "wastage_percent" INTEGER NOT NULL DEFAULT 0,
        "notes" TEXT,
        CONSTRAINT "fk_recipe_items_version" FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_versions" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_recipe_items_input_variant" FOREIGN KEY ("input_variant_id") REFERENCES "product_variants" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recipe_items_version" ON "recipe_items" ("recipe_version_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recipe_items_input_variant" ON "recipe_items" ("input_variant_id")`);

    // 4. production_runs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "production_runs" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "run_number" VARCHAR(50) NOT NULL UNIQUE,
        "recipe_id" INTEGER NOT NULL,
        "recipe_version_id" INTEGER NOT NULL,
        "output_variant_id" INTEGER NOT NULL,
        "status" VARCHAR(25) NOT NULL DEFAULT 'PLANNED',
        "planned_batch_count" INTEGER NOT NULL DEFAULT 1,
        "planned_output_quantity" INTEGER NOT NULL,
        "actual_output_quantity" INTEGER,
        "output_unit_code" VARCHAR(20) NOT NULL,
        "total_cost_minor_units" INTEGER NOT NULL DEFAULT 0,
        "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
        "planned_date_utc" VARCHAR(35) NOT NULL,
        "completed_at_utc" VARCHAR(35),
        "output_lot_number" VARCHAR(50),
        "output_expiry_date" VARCHAR(20),
        "notes" TEXT,
        "created_by" VARCHAR(36),
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_production_runs_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_production_runs_recipe" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_production_runs_recipe_version" FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_versions" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_production_runs_output_variant" FOREIGN KEY ("output_variant_id") REFERENCES "product_variants" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_production_runs_store_status" ON "production_runs" ("store_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_production_runs_number" ON "production_runs" ("run_number")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_production_runs_recipe" ON "production_runs" ("recipe_id")`);

    // 5. production_run_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "production_run_items" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "production_run_id" INTEGER NOT NULL,
        "input_variant_id" INTEGER NOT NULL,
        "planned_quantity" INTEGER NOT NULL,
        "actual_quantity" INTEGER NOT NULL,
        "unit_code" VARCHAR(20) NOT NULL,
        "unit_cost_minor_units" INTEGER NOT NULL DEFAULT 0,
        "total_cost_minor_units" INTEGER NOT NULL DEFAULT 0,
        "lot_id" INTEGER,
        CONSTRAINT "fk_production_run_items_run" FOREIGN KEY ("production_run_id") REFERENCES "production_runs" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_production_run_items_input_variant" FOREIGN KEY ("input_variant_id") REFERENCES "product_variants" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_production_run_items_run" ON "production_run_items" ("production_run_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_production_run_items_input_variant" ON "production_run_items" ("input_variant_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "production_run_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "production_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recipe_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recipe_versions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recipes"`);
  }
}
