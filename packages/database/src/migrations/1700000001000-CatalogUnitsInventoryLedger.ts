import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogUnitsInventoryLedger1700000001000 implements MigrationInterface {
  name = 'CatalogUnitsInventoryLedger1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. units table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "units" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" VARCHAR(20) NOT NULL UNIQUE,
        "name" VARCHAR(50) NOT NULL,
        "dimension" VARCHAR(20) NOT NULL,
        "precision" INTEGER NOT NULL DEFAULT 0,
        "is_base" BOOLEAN NOT NULL DEFAULT 0,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_units_code" ON "units" ("code")`);

    // 2. unit_conversions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "unit_conversions" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "from_unit_code" VARCHAR(20) NOT NULL,
        "to_unit_code" VARCHAR(20) NOT NULL,
        "multiplier" REAL NOT NULL,
        "dimension" VARCHAR(20) NOT NULL,
        "created_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_conversions_from" FOREIGN KEY ("from_unit_code") REFERENCES "units" ("code") ON DELETE RESTRICT,
        CONSTRAINT "fk_conversions_to" FOREIGN KEY ("to_unit_code") REFERENCES "units" ("code") ON DELETE RESTRICT,
        CONSTRAINT "uq_unit_conversions_pair" UNIQUE ("from_unit_code", "to_unit_code")
      )
    `);

    // 3. categories table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "parent_id" INTEGER,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(100) NOT NULL,
        "sort_order" INTEGER NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_categories_parent" FOREIGN KEY ("parent_id") REFERENCES "categories" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_categories_is_active" ON "categories" ("is_active")`);

    // 4. tax_classes table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tax_classes" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(100) NOT NULL,
        "rate_basis_points" INTEGER NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL
      )
    `);

    // 5. items table (Master inventory items)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "items" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(100) NOT NULL,
        "item_type" VARCHAR(30) NOT NULL DEFAULT 'finished_good',
        "base_unit_code" VARCHAR(20) NOT NULL,
        "track_inventory" BOOLEAN NOT NULL DEFAULT 1,
        "is_active" BOOLEAN NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_items_unit" FOREIGN KEY ("base_unit_code") REFERENCES "units" ("code") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_items_code" ON "items" ("code")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_items_type" ON "items" ("item_type")`);

    // 6. products table (Customer-facing product entity)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "category_id" INTEGER,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "is_active" BOOLEAN NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_products_category" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_products_category" ON "products" ("category_id")`);

    // 7. product_variants table (Sellable variants with pricing in minor units)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_variants" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "product_id" INTEGER NOT NULL,
        "item_id" INTEGER,
        "sku" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(100) NOT NULL,
        "price_minor_units" INTEGER NOT NULL,
        "cost_minor_units" INTEGER NOT NULL DEFAULT 0,
        "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
        "tax_class_id" INTEGER,
        "is_active" BOOLEAN NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_variants_product" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_variants_item" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_variants_tax" FOREIGN KEY ("tax_class_id") REFERENCES "tax_classes" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_variants_sku" ON "product_variants" ("sku")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_variants_product_id" ON "product_variants" ("product_id")`);

    // 8. barcodes table (Global unique barcode registry)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "barcodes" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "barcode_value" VARCHAR(100) NOT NULL UNIQUE,
        "barcode_type" VARCHAR(30) NOT NULL DEFAULT 'EAN13',
        "target_type" VARCHAR(30) NOT NULL DEFAULT 'variant',
        "target_id" INTEGER NOT NULL,
        "is_primary" BOOLEAN NOT NULL DEFAULT 1,
        "is_active" BOOLEAN NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_barcodes_value" ON "barcodes" ("barcode_value")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_barcodes_target" ON "barcodes" ("target_type", "target_id")`);

    // 9. stock_locations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_locations" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "code" VARCHAR(50) NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "location_type" VARCHAR(30) NOT NULL DEFAULT 'sales_floor',
        "is_active" BOOLEAN NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_locations_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "uq_locations_store_code" UNIQUE ("store_id", "code")
      )
    `);

    // 10. stock_movements table (Immutable, authoritative stock ledger)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_movements" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "item_id" INTEGER NOT NULL,
        "location_id" INTEGER NOT NULL,
        "signed_base_quantity" REAL NOT NULL,
        "movement_type" VARCHAR(50) NOT NULL,
        "source_type" VARCHAR(50) NOT NULL,
        "source_id" VARCHAR(50) NOT NULL,
        "source_line_id" VARCHAR(50),
        "cost_per_unit_minor_units" INTEGER,
        "actor_id" VARCHAR(50),
        "idempotency_key" VARCHAR(100),
        "created_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_movements_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_movements_item" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_movements_location" FOREIGN KEY ("location_id") REFERENCES "stock_locations" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_movements_item_location" ON "stock_movements" ("item_id", "location_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_movements_source" ON "stock_movements" ("source_type", "source_id")`);

    // 11. opening_stock_sessions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "opening_stock_sessions" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
        "notes" TEXT,
        "confirmed_at_utc" VARCHAR(35),
        "confirmed_by" VARCHAR(100),
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_opening_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT
      )
    `);

    // Baseline Seed for standard units (Pieces, Kilograms, Grams, Liters, Milliliters)
    const now = new Date().toISOString();
    await queryRunner.query(`
      INSERT OR IGNORE INTO "units" ("code", "name", "dimension", "precision", "is_base", "created_at_utc", "updated_at_utc") VALUES
      ('pcs', 'Piece', 'COUNT', 0, 1, '${now}', '${now}'),
      ('dozen', 'Dozen', 'COUNT', 0, 0, '${now}', '${now}'),
      ('kg', 'Kilogram', 'MASS', 3, 1, '${now}', '${now}'),
      ('g', 'Gram', 'MASS', 1, 0, '${now}', '${now}'),
      ('l', 'Liter', 'VOLUME', 3, 1, '${now}', '${now}'),
      ('ml', 'Milliliter', 'VOLUME', 1, 0, '${now}', '${now}')
    `);

    // Standard conversions
    await queryRunner.query(`
      INSERT OR IGNORE INTO "unit_conversions" ("from_unit_code", "to_unit_code", "multiplier", "dimension", "created_at_utc") VALUES
      ('dozen', 'pcs', 12, 'COUNT', '${now}'),
      ('kg', 'g', 1000, 'MASS', '${now}'),
      ('g', 'kg', 0.001, 'MASS', '${now}'),
      ('l', 'ml', 1000, 'VOLUME', '${now}'),
      ('ml', 'l', 0.001, 'VOLUME', '${now}')
    `);

    // Default zero tax class
    await queryRunner.query(`
      INSERT OR IGNORE INTO "tax_classes" ("code", "name", "rate_basis_points", "is_active", "created_at_utc", "updated_at_utc") VALUES
      ('TAX_EXEMPT', 'Tax Exempt (0%)', 0, 1, '${now}', '${now}')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "opening_stock_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_locations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "barcodes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_variants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_classes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "unit_conversions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "units"`);
  }
}
