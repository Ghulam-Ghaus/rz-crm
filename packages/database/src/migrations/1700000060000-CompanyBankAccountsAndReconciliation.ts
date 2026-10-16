import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyBankAccountsAndReconciliation1700000060000 implements MigrationInterface {
  name = 'CompanyBankAccountsAndReconciliation1700000060000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. company_bank_accounts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_bank_accounts" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL DEFAULT 1,
        "bank_name" VARCHAR(100) NOT NULL,
        "account_title" VARCHAR(150) NOT NULL,
        "account_number" VARCHAR(50) NOT NULL,
        "iban" VARCHAR(50),
        "branch_name" VARCHAR(100),
        "opening_balance_minor_units" INTEGER NOT NULL DEFAULT 0,
        "current_balance_minor_units" INTEGER NOT NULL DEFAULT 0,
        "is_active" INTEGER NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL
      )
    `);

    // 2. bank_transactions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_transactions" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "account_id" INTEGER NOT NULL,
        "txn_type" VARCHAR(40) NOT NULL,
        "amount_minor_units" INTEGER NOT NULL,
        "running_balance_minor_units" INTEGER NOT NULL,
        "reference" VARCHAR(100),
        "cheque_direction" VARCHAR(20),
        "cheque_id" INTEGER,
        "attachment_path" VARCHAR(255),
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        FOREIGN KEY ("account_id") REFERENCES "company_bank_accounts" ("id") ON DELETE RESTRICT
      )
    `);

    // 3. Create Indexes individually for SQLite
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bank_tx_account_id" ON "bank_transactions" ("account_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bank_tx_created" ON "bank_transactions" ("created_at_utc")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bank_tx_cheque" ON "bank_transactions" ("cheque_direction", "cheque_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "company_bank_accounts"`);
  }
}
