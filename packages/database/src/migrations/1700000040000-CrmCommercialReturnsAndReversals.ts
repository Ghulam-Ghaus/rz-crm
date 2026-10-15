import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrmCommercialReturnsAndReversals1700000040000 implements MigrationInterface {
  name = 'CrmCommercialReturnsAndReversals1700000040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create sales_returns table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_returns" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "return_number" VARCHAR(50) NOT NULL UNIQUE,
        "sale_id" INTEGER,
        "customer_id" INTEGER,
        "customer_name" VARCHAR(150),
        "return_date_utc" VARCHAR(35) NOT NULL,
        "reason" VARCHAR(100) NOT NULL,
        "refund_method" VARCHAR(30) NOT NULL DEFAULT 'CREDIT_NOTE',
        "total_amount_minor_units" INTEGER NOT NULL,
        "refund_amount_minor_units" INTEGER NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
        "processed_by" VARCHAR(50) NOT NULL,
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL
      )
    `);

    // 2. Create sales_return_lines table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_return_lines" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "sales_return_id" INTEGER NOT NULL,
        "sale_item_id" INTEGER,
        "product_variant_id" INTEGER NOT NULL,
        "quantity" REAL NOT NULL,
        "unit_code" VARCHAR(20) NOT NULL,
        "unit_price_minor_units" INTEGER NOT NULL,
        "total_price_minor_units" INTEGER NOT NULL,
        "condition" VARCHAR(20) NOT NULL DEFAULT 'RESTOCK',
        "target_location_id" INTEGER NOT NULL,
        "reason" VARCHAR(100),
        "created_at_utc" VARCHAR(35) NOT NULL,
        FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns" ("id") ON DELETE CASCADE
      )
    `);

    // 3. Create purchase_returns table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_returns" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "return_number" VARCHAR(50) NOT NULL UNIQUE,
        "supplier_id" INTEGER NOT NULL,
        "goods_receipt_id" INTEGER,
        "supplier_invoice_ref" VARCHAR(100),
        "return_date_utc" VARCHAR(35) NOT NULL,
        "reason" VARCHAR(100) NOT NULL,
        "settlement_method" VARCHAR(30) NOT NULL DEFAULT 'DEBIT_NOTE',
        "total_amount_minor_units" INTEGER NOT NULL,
        "refund_amount_minor_units" INTEGER NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
        "processed_by" VARCHAR(50) NOT NULL,
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL
      )
    `);

    // 4. Create purchase_return_lines table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_return_lines" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "purchase_return_id" INTEGER NOT NULL,
        "grn_line_id" INTEGER,
        "product_variant_id" INTEGER NOT NULL,
        "quantity" REAL NOT NULL,
        "unit_code" VARCHAR(20) NOT NULL,
        "unit_cost_minor_units" INTEGER NOT NULL,
        "total_cost_minor_units" INTEGER NOT NULL,
        "source_location_id" INTEGER NOT NULL,
        "lot_number" VARCHAR(50),
        "reason" VARCHAR(100),
        "created_at_utc" VARCHAR(35) NOT NULL,
        FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_return_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_returns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_return_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_returns"`);
  }
}
