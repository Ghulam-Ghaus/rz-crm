import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomOrdersAndHeldCarts1700000005000 implements MigrationInterface {
  name = 'CustomOrdersAndHeldCarts1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. customers table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(150) NOT NULL,
        "phone" VARCHAR(50),
        "email" VARCHAR(150),
        "address" TEXT,
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_customers_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_customers_store" ON "customers" ("store_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_customers_phone" ON "customers" ("phone")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_customers_name" ON "customers" ("name")`);

    // 2. custom_orders table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_orders" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "order_number" VARCHAR(50) NOT NULL UNIQUE,
        "customer_id" INTEGER NOT NULL,
        "due_date_utc" VARCHAR(35) NOT NULL,
        "event_date_utc" VARCHAR(35),
        "status" VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
        "total_amount_minor_units" INTEGER NOT NULL DEFAULT 0,
        "deposit_amount_minor_units" INTEGER NOT NULL DEFAULT 0,
        "balance_amount_minor_units" INTEGER NOT NULL DEFAULT 0,
        "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
        "cake_flavor" VARCHAR(100),
        "cake_size" VARCHAR(50),
        "cake_message" TEXT,
        "decoration_notes" TEXT,
        "allergens_notes" TEXT,
        "created_by" VARCHAR(36),
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_custom_orders_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_custom_orders_customer" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_custom_orders_store_status" ON "custom_orders" ("store_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_custom_orders_due_date" ON "custom_orders" ("due_date_utc")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_custom_orders_customer" ON "custom_orders" ("customer_id")`);

    // 3. custom_order_lines table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_order_lines" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "custom_order_id" INTEGER NOT NULL,
        "product_variant_id" INTEGER,
        "item_name" VARCHAR(150) NOT NULL,
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "unit_price_minor_units" INTEGER NOT NULL DEFAULT 0,
        "total_price_minor_units" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "fk_custom_order_lines_order" FOREIGN KEY ("custom_order_id") REFERENCES "custom_orders" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_custom_order_lines_variant" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_custom_order_lines_order" ON "custom_order_lines" ("custom_order_id")`);

    // 4. custom_order_payments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_order_payments" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "custom_order_id" INTEGER NOT NULL,
        "payment_type" VARCHAR(30) NOT NULL,
        "payment_method" VARCHAR(30) NOT NULL,
        "amount_minor_units" INTEGER NOT NULL,
        "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
        "shift_id" INTEGER,
        "cashier_id" VARCHAR(36),
        "reference_notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_custom_order_payments_order" FOREIGN KEY ("custom_order_id") REFERENCES "custom_orders" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_custom_order_payments_order" ON "custom_order_payments" ("custom_order_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_custom_order_payments_shift" ON "custom_order_payments" ("shift_id")`);

    // 5. held_carts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "held_carts" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "cart_code" VARCHAR(50) NOT NULL UNIQUE,
        "cashier_id" VARCHAR(36),
        "customer_name_or_phone" VARCHAR(150),
        "cart_json" TEXT NOT NULL,
        "item_count" INTEGER NOT NULL DEFAULT 0,
        "subtotal_minor_units" INTEGER NOT NULL DEFAULT 0,
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_held_carts_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_held_carts_store" ON "held_carts" ("store_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "held_carts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_order_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_order_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
  }
}
