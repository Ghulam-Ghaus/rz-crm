import { MigrationInterface, QueryRunner } from 'typeorm';

export class PurchasingAndGoodsReceiving1700000003000 implements MigrationInterface {
  name = 'PurchasingAndGoodsReceiving1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. suppliers table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "suppliers" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(150) NOT NULL,
        "contact_person" VARCHAR(100),
        "phone" VARCHAR(50),
        "email" VARCHAR(100),
        "tax_number" VARCHAR(50),
        "address" TEXT,
        "payment_terms_days" INTEGER NOT NULL DEFAULT 0,
        "is_active" INTEGER NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_suppliers_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_suppliers_store" ON "suppliers" ("store_id", "is_active")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_suppliers_code" ON "suppliers" ("code")`);

    // 2. purchase_orders table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_orders" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "po_number" VARCHAR(50) NOT NULL UNIQUE,
        "supplier_id" INTEGER NOT NULL,
        "status" VARCHAR(25) NOT NULL DEFAULT 'DRAFT',
        "order_date_utc" VARCHAR(35) NOT NULL,
        "expected_delivery_date_utc" VARCHAR(35),
        "subtotal_minor_units" INTEGER NOT NULL DEFAULT 0,
        "tax_minor_units" INTEGER NOT NULL DEFAULT 0,
        "total_cost_minor_units" INTEGER NOT NULL DEFAULT 0,
        "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
        "notes" TEXT,
        "created_by" VARCHAR(36),
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_po_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_po_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_po_store_status" ON "purchase_orders" ("store_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_po_supplier" ON "purchase_orders" ("supplier_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_po_number" ON "purchase_orders" ("po_number")`);

    // 3. purchase_order_lines table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_order_lines" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "purchase_order_id" INTEGER NOT NULL,
        "product_variant_id" INTEGER NOT NULL,
        "ordered_quantity" INTEGER NOT NULL,
        "received_quantity" INTEGER NOT NULL DEFAULT 0,
        "unit_code" VARCHAR(20) NOT NULL,
        "unit_cost_minor_units" INTEGER NOT NULL,
        "total_cost_minor_units" INTEGER NOT NULL,
        "notes" TEXT,
        CONSTRAINT "fk_pol_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_pol_variant" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_pol_order" ON "purchase_order_lines" ("purchase_order_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_pol_variant" ON "purchase_order_lines" ("product_variant_id")`);

    // 4. inventory_lots table (Lot / Batch & Expiry tracking)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_lots" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "product_variant_id" INTEGER NOT NULL,
        "lot_number" VARCHAR(100) NOT NULL,
        "supplier_id" INTEGER,
        "manufacture_date_utc" VARCHAR(35),
        "expiry_date_utc" VARCHAR(35),
        "unit_cost_minor_units" INTEGER NOT NULL DEFAULT 0,
        "initial_quantity" INTEGER NOT NULL,
        "current_quantity" INTEGER NOT NULL,
        "created_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_lots_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_lots_variant" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_lots_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lots_variant" ON "inventory_lots" ("product_variant_id", "lot_number")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lots_expiry" ON "inventory_lots" ("expiry_date_utc")`);

    // 5. goods_receipts table (GRN)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "goods_receipts" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "grn_number" VARCHAR(50) NOT NULL UNIQUE,
        "purchase_order_id" INTEGER,
        "supplier_id" INTEGER NOT NULL,
        "supplier_invoice_ref" VARCHAR(100) NOT NULL,
        "received_date_utc" VARCHAR(35) NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'POSTED',
        "total_amount_minor_units" INTEGER NOT NULL DEFAULT 0,
        "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
        "notes" TEXT,
        "received_by" VARCHAR(36),
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_grn_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_grn_po" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_grn_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_grn_store" ON "goods_receipts" ("store_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_grn_po" ON "goods_receipts" ("purchase_order_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_grn_supplier" ON "goods_receipts" ("supplier_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_grn_number" ON "goods_receipts" ("grn_number")`);

    // 6. goods_receipt_lines table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "goods_receipt_lines" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "goods_receipt_id" INTEGER NOT NULL,
        "po_line_id" INTEGER,
        "product_variant_id" INTEGER NOT NULL,
        "received_quantity" INTEGER NOT NULL,
        "unit_code" VARCHAR(20) NOT NULL,
        "unit_cost_minor_units" INTEGER NOT NULL,
        "total_cost_minor_units" INTEGER NOT NULL,
        "lot_number" VARCHAR(100),
        "expiry_date_utc" VARCHAR(35),
        "stock_location_id" INTEGER NOT NULL,
        CONSTRAINT "fk_grl_receipt" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_grl_poline" FOREIGN KEY ("po_line_id") REFERENCES "purchase_order_lines" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_grl_variant" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_grl_location" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_grl_receipt" ON "goods_receipt_lines" ("goods_receipt_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_grl_variant" ON "goods_receipt_lines" ("product_variant_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "goods_receipt_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "goods_receipts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_lots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_order_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
  }
}
