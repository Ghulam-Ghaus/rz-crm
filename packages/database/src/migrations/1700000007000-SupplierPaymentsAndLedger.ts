import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplierPaymentsAndLedger1700000007000 implements MigrationInterface {
  name = 'SupplierPaymentsAndLedger1700000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "supplier_payments" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "supplier_id" INTEGER NOT NULL,
        "payment_number" VARCHAR(50) NOT NULL UNIQUE,
        "payment_date_utc" VARCHAR(35) NOT NULL,
        "amount_minor_units" INTEGER NOT NULL,
        "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
        "payment_method" VARCHAR(30) NOT NULL DEFAULT 'CASH',
        "reference" VARCHAR(100),
        "notes" TEXT,
        "paid_by" VARCHAR(36),
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_supplier_payments_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_supplier_payments_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_supplier_payments_supplier" ON "supplier_payments" ("supplier_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_supplier_payments_store" ON "supplier_payments" ("store_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_supplier_payments_number" ON "supplier_payments" ("payment_number")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_supplier_payments_date" ON "supplier_payments" ("payment_date_utc")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_payments"`);
  }
}
