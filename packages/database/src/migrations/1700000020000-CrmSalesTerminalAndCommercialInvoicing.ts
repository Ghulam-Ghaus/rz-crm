import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrmSalesTerminalAndCommercialInvoicing1700000020000 implements MigrationInterface {
  name = 'CrmSalesTerminalAndCommercialInvoicing1700000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Alter customers table with commercial and wholesale columns
    const customerCols: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info("customers")`);
    const hasCol = (name: string) => customerCols.some((c) => c.name === name);

    if (!hasCol('company_name')) {
      await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN "company_name" VARCHAR(150)`);
    }
    if (!hasCol('tax_number')) {
      await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN "tax_number" VARCHAR(50)`);
    }
    if (!hasCol('credit_limit_minor_units')) {
      await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN "credit_limit_minor_units" INTEGER NOT NULL DEFAULT 0`);
    }
    if (!hasCol('payment_terms_days')) {
      await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN "payment_terms_days" INTEGER NOT NULL DEFAULT 0`);
    }
    if (!hasCol('outstanding_balance_minor_units')) {
      await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN "outstanding_balance_minor_units" INTEGER NOT NULL DEFAULT 0`);
    }
    if (!hasCol('customer_type')) {
      await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN "customer_type" VARCHAR(20) NOT NULL DEFAULT 'retail'`);
    }

    // 2. Alter sales table with commercial invoicing & wholesale columns
    const salesCols: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info("sales")`);
    const hasSaleCol = (name: string) => salesCols.some((c) => c.name === name);

    if (!hasSaleCol('customer_id')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "customer_id" INTEGER`);
    }
    if (!hasSaleCol('customer_name')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "customer_name" VARCHAR(150)`);
    }
    if (!hasSaleCol('order_type')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "order_type" VARCHAR(20) NOT NULL DEFAULT 'retail'`);
    }
    if (!hasSaleCol('price_tier')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "price_tier" VARCHAR(20) NOT NULL DEFAULT 'retail'`);
    }
    if (!hasSaleCol('location_id')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "location_id" INTEGER`);
    }
    if (!hasSaleCol('payment_status')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "payment_status" VARCHAR(20) NOT NULL DEFAULT 'paid'`);
    }
    if (!hasSaleCol('payment_method')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "payment_method" VARCHAR(30) NOT NULL DEFAULT 'cash'`);
    }
    if (!hasSaleCol('amount_paid_minor_units')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "amount_paid_minor_units" INTEGER NOT NULL DEFAULT 0`);
    }
    if (!hasSaleCol('balance_due_minor_units')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "balance_due_minor_units" INTEGER NOT NULL DEFAULT 0`);
    }
    if (!hasSaleCol('due_date')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "due_date" VARCHAR(10)`);
    }
    if (!hasSaleCol('payment_terms')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "payment_terms" VARCHAR(50)`);
    }
    if (!hasSaleCol('reference_note')) {
      await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "reference_note" VARCHAR(255)`);
    }

    // 3. Alter sale_payments table with bank/cheque details
    const paymentCols: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info("sale_payments")`);
    const hasPayCol = (name: string) => paymentCols.some((c) => c.name === name);

    if (!hasPayCol('reference')) {
      await queryRunner.query(`ALTER TABLE "sale_payments" ADD COLUMN "reference" VARCHAR(100)`);
    }
    if (!hasPayCol('bank_name')) {
      await queryRunner.query(`ALTER TABLE "sale_payments" ADD COLUMN "bank_name" VARCHAR(100)`);
    }
    if (!hasPayCol('cheque_date')) {
      await queryRunner.query(`ALTER TABLE "sale_payments" ADD COLUMN "cheque_date" VARCHAR(10)`);
    }
    if (!hasPayCol('notes')) {
      await queryRunner.query(`ALTER TABLE "sale_payments" ADD COLUMN "notes" TEXT`);
    }

    // 4. Ensure default Walk-In customer exists
    const stores: Array<{ id: number }> = await queryRunner.query(`SELECT id FROM "stores" LIMIT 1`);
    const storeId = stores[0] ? stores[0].id : 1;
    const now = new Date().toISOString();

    const existingWalkIn: Array<{ id: number }> = await queryRunner.query(
      `SELECT id FROM "customers" WHERE "code" = 'CUST-WALKIN' AND "store_id" = ?`,
      [storeId]
    );

    if (existingWalkIn.length === 0) {
      await queryRunner.query(
        `INSERT INTO "customers" (
          "store_id", "code", "name", "phone", "email", "address", "notes",
          "company_name", "tax_number", "credit_limit_minor_units", "payment_terms_days",
          "outstanding_balance_minor_units", "customer_type", "created_at_utc", "updated_at_utc"
        ) VALUES (
          ?, 'CUST-WALKIN', 'Walk-In Customer', NULL, NULL, 'Counter Retail Sale', 'Standard cash counter client',
          'Retail Counter', NULL, 0, 0, 0, 'retail', ?, ?
        )`,
        [storeId, now, now]
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    void _queryRunner;
  }
}
