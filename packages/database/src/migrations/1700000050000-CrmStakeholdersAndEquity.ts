import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrmStakeholdersAndEquity1700000050000 implements MigrationInterface {
  name = 'CrmStakeholdersAndEquity1700000050000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create stakeholders table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stakeholders" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL DEFAULT 1,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "full_name" VARCHAR(150) NOT NULL,
        "cnic_or_tax_id" VARCHAR(50),
        "phone" VARCHAR(50),
        "email" VARCHAR(100),
        "address" TEXT,
        "stakeholder_type" VARCHAR(30) NOT NULL DEFAULT 'PARTNER',
        "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        "joined_date" VARCHAR(35) NOT NULL,
        "user_id" INTEGER,
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL
      )
    `);

    // 2. Create stakeholder_equity table (versioned equity and profit/loss sharing ratios)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stakeholder_equity" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "stakeholder_id" INTEGER NOT NULL,
        "effective_from" VARCHAR(35) NOT NULL,
        "effective_to" VARCHAR(35),
        "share_mode" VARCHAR(30) NOT NULL DEFAULT 'FIXED_PERCENT',
        "ownership_bps" INTEGER NOT NULL DEFAULT 0,
        "profit_share_bps" INTEGER NOT NULL DEFAULT 0,
        "loss_share_bps" INTEGER NOT NULL DEFAULT 0,
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        FOREIGN KEY ("stakeholder_id") REFERENCES "stakeholders" ("id") ON DELETE CASCADE
      )
    `);

    // 3. Create stakeholder_transactions table (immutable capital ledger)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stakeholder_transactions" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL DEFAULT 1,
        "stakeholder_id" INTEGER NOT NULL,
        "txn_number" VARCHAR(50) NOT NULL UNIQUE,
        "type" VARCHAR(40) NOT NULL,
        "amount_minor_units" INTEGER NOT NULL,
        "payment_method" VARCHAR(30) NOT NULL DEFAULT 'BANK_TRANSFER',
        "reference" VARCHAR(100),
        "notes" TEXT,
        "period_id" INTEGER,
        "txn_date" VARCHAR(35) NOT NULL,
        "created_by" VARCHAR(50) NOT NULL,
        "created_at_utc" VARCHAR(35) NOT NULL,
        FOREIGN KEY ("stakeholder_id") REFERENCES "stakeholders" ("id")
      )
    `);

    // 4. Create fiscal_periods table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fiscal_periods" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL DEFAULT 1,
        "period_code" VARCHAR(50) NOT NULL UNIQUE,
        "label" VARCHAR(100) NOT NULL,
        "start_date" VARCHAR(35) NOT NULL,
        "end_date" VARCHAR(35) NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        "closed_by" VARCHAR(50),
        "closed_at_utc" VARCHAR(35),
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL
      )
    `);

    // 5. Create profit_distribution_runs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "profit_distribution_runs" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL DEFAULT 1,
        "run_number" VARCHAR(50) NOT NULL UNIQUE,
        "period_id" INTEGER NOT NULL,
        "revenue_minor_units" INTEGER NOT NULL DEFAULT 0,
        "cogs_minor_units" INTEGER NOT NULL DEFAULT 0,
        "gross_profit_minor_units" INTEGER NOT NULL DEFAULT 0,
        "operating_expenses_minor_units" INTEGER NOT NULL DEFAULT 0,
        "staff_cost_minor_units" INTEGER NOT NULL DEFAULT 0,
        "net_profit_minor_units" INTEGER NOT NULL DEFAULT 0,
        "distributable_profit_minor_units" INTEGER NOT NULL DEFAULT 0,
        "retained_earnings_minor_units" INTEGER NOT NULL DEFAULT 0,
        "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        "created_by" VARCHAR(50) NOT NULL,
        "approved_by" VARCHAR(50),
        "approved_at_utc" VARCHAR(35),
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        FOREIGN KEY ("period_id") REFERENCES "fiscal_periods" ("id")
      )
    `);

    // 6. Create profit_distribution_lines table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "profit_distribution_lines" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "run_id" INTEGER NOT NULL,
        "stakeholder_id" INTEGER NOT NULL,
        "stakeholder_name" VARCHAR(150) NOT NULL,
        "share_mode" VARCHAR(30) NOT NULL,
        "share_bps" INTEGER NOT NULL,
        "capital_balance_minor_units" INTEGER NOT NULL DEFAULT 0,
        "allocated_amount_minor_units" INTEGER NOT NULL,
        "paid_amount_minor_units" INTEGER NOT NULL DEFAULT 0,
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "payout_txn_id" INTEGER,
        "notes" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        FOREIGN KEY ("run_id") REFERENCES "profit_distribution_runs" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("stakeholder_id") REFERENCES "stakeholders" ("id")
      )
    `);

    // Create Indexes for high-performance financial reporting and ledger lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_stakeholder_equity_stakeholder_id" ON "stakeholder_equity" ("stakeholder_id");
      CREATE INDEX IF NOT EXISTS "idx_stakeholder_tx_stakeholder_id" ON "stakeholder_transactions" ("stakeholder_id");
      CREATE INDEX IF NOT EXISTS "idx_stakeholder_tx_type" ON "stakeholder_transactions" ("type");
      CREATE INDEX IF NOT EXISTS "idx_stakeholder_tx_date" ON "stakeholder_transactions" ("txn_date");
      CREATE INDEX IF NOT EXISTS "idx_distribution_lines_run_id" ON "profit_distribution_lines" ("run_id");
      CREATE INDEX IF NOT EXISTS "idx_distribution_lines_stakeholder_id" ON "profit_distribution_lines" ("stakeholder_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "profit_distribution_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "profit_distribution_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fiscal_periods"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stakeholder_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stakeholder_equity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stakeholders"`);
  }
}
