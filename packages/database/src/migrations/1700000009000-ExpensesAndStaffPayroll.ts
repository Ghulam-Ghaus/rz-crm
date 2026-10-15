import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpensesAndStaffPayroll1700000009000 implements MigrationInterface {
  name = 'ExpensesAndStaffPayroll1700000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Expense Categories Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expense_categories" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "name" VARCHAR(100) NOT NULL UNIQUE,
        "is_system" BOOLEAN NOT NULL DEFAULT 0,
        "created_at_utc" VARCHAR(35) NOT NULL
      )
    `);

    // 2. Expenses Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "category_id" INTEGER NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "amount_minor_units" INTEGER NOT NULL,
        "payment_method" VARCHAR(30) NOT NULL DEFAULT 'cash_drawer',
        "shift_id" INTEGER,
        "voucher_number" VARCHAR(100),
        "paid_to" VARCHAR(150),
        "expense_date" VARCHAR(10) NOT NULL,
        "notes" TEXT,
        "created_by_user_id" INTEGER,
        "created_by_name" VARCHAR(100) NOT NULL,
        "created_at_utc" VARCHAR(35) NOT NULL,
        FOREIGN KEY ("category_id") REFERENCES "expense_categories" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_expenses_store_id" ON "expenses" ("store_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_expenses_category_id" ON "expenses" ("category_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_expenses_date" ON "expenses" ("expense_date")`);

    // 3. Staff Payroll Profiles Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "staff_payroll_profiles" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "user_id" INTEGER NOT NULL UNIQUE,
        "base_monthly_salary_minor_units" INTEGER NOT NULL DEFAULT 0,
        "designation" VARCHAR(100) NOT NULL DEFAULT 'Staff',
        "joining_date" VARCHAR(10),
        "payment_method_preference" VARCHAR(30) NOT NULL DEFAULT 'cash',
        "bank_account_details" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payroll_profiles_user_id" ON "staff_payroll_profiles" ("user_id")`);

    // 4. Salary Advances Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "salary_advances" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "amount_minor_units" INTEGER NOT NULL,
        "advance_date" VARCHAR(10) NOT NULL,
        "payment_method" VARCHAR(30) NOT NULL DEFAULT 'cash_drawer',
        "shift_id" INTEGER,
        "reason" TEXT,
        "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
        "settled_in_salary_payment_id" INTEGER,
        "created_by_user_id" INTEGER,
        "created_by_name" VARCHAR(100) NOT NULL,
        "created_at_utc" VARCHAR(35) NOT NULL,
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_advances_store_user" ON "salary_advances" ("store_id", "user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_advances_status" ON "salary_advances" ("status")`);

    // 5. Salary Payments Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "salary_payments" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "payroll_month" VARCHAR(7) NOT NULL,
        "base_salary_minor_units" INTEGER NOT NULL,
        "advances_deducted_minor_units" INTEGER NOT NULL DEFAULT 0,
        "bonuses_minor_units" INTEGER NOT NULL DEFAULT 0,
        "deductions_minor_units" INTEGER NOT NULL DEFAULT 0,
        "net_paid_minor_units" INTEGER NOT NULL,
        "payment_method" VARCHAR(30) NOT NULL DEFAULT 'cash_hand',
        "shift_id" INTEGER,
        "payment_date" VARCHAR(10) NOT NULL,
        "notes" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'paid',
        "created_by_user_id" INTEGER,
        "created_by_name" VARCHAR(100) NOT NULL,
        "created_at_utc" VARCHAR(35) NOT NULL,
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_salary_payments_store_user" ON "salary_payments" ("store_id", "user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_salary_payments_month" ON "salary_payments" ("payroll_month")`);

    // 6. Pre-seed Standard Bakery Expense Categories
    const now = new Date().toISOString();
    const defaultCategories = [
      'Electricity Bill',
      'Gas & Fuel',
      'Shop Rent',
      'Kitchen & Machine Repairs',
      'Packaging & Boxes',
      'Daily Refreshments & Tea',
      'Cleaning & Hygiene Supplies',
      'Delivery & Transport Fuel',
      'Generator Maintenance & Fuel',
      'Staff Welfare',
      'Miscellaneous Petty Cash',
    ];

    for (const catName of defaultCategories) {
      await queryRunner.query(
        `INSERT OR IGNORE INTO "expense_categories" ("name", "is_system", "created_at_utc") VALUES (?, 1, ?)`,
        [catName, now]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "salary_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "salary_advances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "staff_payroll_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expenses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expense_categories"`);
  }
}
