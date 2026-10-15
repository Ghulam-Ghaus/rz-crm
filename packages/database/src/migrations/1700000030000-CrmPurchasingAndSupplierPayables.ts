import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrmPurchasingAndSupplierPayables1700000030000 implements MigrationInterface {
  name = 'CrmPurchasingAndSupplierPayables1700000030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Alter suppliers table with credit limit and balance tracking
    const supplierCols: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info("suppliers")`);
    const hasSupplierCol = (name: string) => supplierCols.some((c) => c.name === name);

    if (!hasSupplierCol('credit_limit_minor_units')) {
      await queryRunner.query(`ALTER TABLE "suppliers" ADD COLUMN "credit_limit_minor_units" INTEGER NOT NULL DEFAULT 0`);
    }
    if (!hasSupplierCol('outstanding_balance_minor_units')) {
      await queryRunner.query(`ALTER TABLE "suppliers" ADD COLUMN "outstanding_balance_minor_units" INTEGER NOT NULL DEFAULT 0`);
    }

    // 2. Alter supplier_payments table with bank and cheque details
    const paymentCols: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info("supplier_payments")`);
    const hasPaymentCol = (name: string) => paymentCols.some((c) => c.name === name);

    if (!hasPaymentCol('bank_name')) {
      await queryRunner.query(`ALTER TABLE "supplier_payments" ADD COLUMN "bank_name" VARCHAR(100)`);
    }
    if (!hasPaymentCol('cheque_date')) {
      await queryRunner.query(`ALTER TABLE "supplier_payments" ADD COLUMN "cheque_date" VARCHAR(35)`);
    }

    // 3. Alter goods_receipts table with receiving location and payment status
    const grnCols: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info("goods_receipts")`);
    const hasGrnCol = (name: string) => grnCols.some((c) => c.name === name);

    if (!hasGrnCol('location_id')) {
      await queryRunner.query(`ALTER TABLE "goods_receipts" ADD COLUMN "location_id" INTEGER`);
    }
    if (!hasGrnCol('payment_status')) {
      await queryRunner.query(`ALTER TABLE "goods_receipts" ADD COLUMN "payment_status" VARCHAR(20) NOT NULL DEFAULT 'UNPAID'`);
    }

    // 4. Ensure at least one default supplier exists for receiving operations
    const existingSuppliers: Array<{ id: number }> = await queryRunner.query(
      `SELECT "id" FROM "suppliers" LIMIT 1`
    );

    if (existingSuppliers.length === 0) {
      const now = new Date().toISOString();
      await queryRunner.query(
        `INSERT INTO "suppliers" (
          "store_id", "code", "name", "contact_person", "phone", "email",
          "tax_number", "address", "payment_terms_days", "credit_limit_minor_units",
          "outstanding_balance_minor_units", "is_active", "created_at_utc", "updated_at_utc"
        ) VALUES (
          1, 'SUP-MAIN', 'RZ Main Wholesale Suppliers', 'Haji Muhammad Aslam',
          '0300-9876543', 'supplies@rz-enterprises.com', '1982734-5',
          'Wholesale Grain & Goods Market, Gujranwala', 30, 50000000, 0, 1, ?, ?
        )`,
        [now, now]
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // SQLite does not support dropping columns in standard ALTER TABLE without rebuilding tables
  }
}
