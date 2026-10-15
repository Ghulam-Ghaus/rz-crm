import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShiftsSalesCashDrawer1700000002000 implements MigrationInterface {
  name = 'ShiftsSalesCashDrawer1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. shifts table (cashier register shift lifecycle)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shifts" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "shift_code" VARCHAR(50) UNIQUE,
        "store_id" INTEGER NOT NULL,
        "register_id" INTEGER,
        "cashier_id" VARCHAR(36) NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'open',
        "opened_at_utc" VARCHAR(35) NOT NULL,
        "closed_at_utc" VARCHAR(35),
        "opening_float_minor_units" INTEGER NOT NULL DEFAULT 0,
        "expected_cash_minor_units" INTEGER NOT NULL DEFAULT 0,
        "closing_counted_minor_units" INTEGER,
        "variance_minor_units" INTEGER,
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_shifts_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_shifts_status" ON "shifts" ("store_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_shifts_code" ON "shifts" ("shift_code")`);

    // 2. cash_transactions table (cash drawer movements)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cash_transactions" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "shift_id" INTEGER NOT NULL,
        "transaction_type" VARCHAR(30) NOT NULL,
        "amount_minor_units" INTEGER NOT NULL,
        "source_id" VARCHAR(50),
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_cash_tx_shift" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_cash_tx_shift" ON "cash_transactions" ("shift_id")`);

    // 3. sales table (Invoice records)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "register_id" INTEGER,
        "shift_id" INTEGER NOT NULL,
        "invoice_number" VARCHAR(50) NOT NULL UNIQUE,
        "cashier_id" VARCHAR(36) NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'completed',
        "subtotal_minor_units" INTEGER NOT NULL,
        "discount_minor_units" INTEGER NOT NULL DEFAULT 0,
        "tax_minor_units" INTEGER NOT NULL DEFAULT 0,
        "total_minor_units" INTEGER NOT NULL,
        "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
        "idempotency_key" VARCHAR(100),
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_sales_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_sales_shift" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sales_invoice" ON "sales" ("invoice_number")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sales_shift" ON "sales" ("shift_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sales_idempotency" ON "sales" ("idempotency_key")`);

    // 4. sale_items table (Line items)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_items" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "sale_id" INTEGER NOT NULL,
        "variant_id" INTEGER NOT NULL,
        "item_id" INTEGER,
        "sku" VARCHAR(50) NOT NULL,
        "product_name" VARCHAR(100) NOT NULL,
        "quantity" REAL NOT NULL,
        "unit_price_minor_units" INTEGER NOT NULL,
        "subtotal_minor_units" INTEGER NOT NULL,
        "tax_minor_units" INTEGER NOT NULL DEFAULT 0,
        "total_minor_units" INTEGER NOT NULL,
        "created_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_sale_items_sale" FOREIGN KEY ("sale_id") REFERENCES "sales" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_sale_items_variant" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sale_items_sale" ON "sale_items" ("sale_id")`);

    // 5. sale_payments table (Payment records)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_payments" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "sale_id" INTEGER NOT NULL,
        "payment_method" VARCHAR(30) NOT NULL DEFAULT 'cash',
        "amount_tendered_minor_units" INTEGER NOT NULL,
        "amount_paid_minor_units" INTEGER NOT NULL,
        "change_due_minor_units" INTEGER NOT NULL DEFAULT 0,
        "status" VARCHAR(20) NOT NULL DEFAULT 'posted',
        "created_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_sale_payments_sale" FOREIGN KEY ("sale_id") REFERENCES "sales" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sale_payments_sale" ON "sale_payments" ("sale_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shifts"`);
  }
}
