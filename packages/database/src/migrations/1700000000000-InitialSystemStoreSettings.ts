import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSystemStoreSettings1700000000000 implements MigrationInterface {
  name = 'InitialSystemStoreSettings1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. schema_metadata
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schema_metadata" (
        "id" VARCHAR(36) PRIMARY KEY NOT NULL,
        "schema_version" VARCHAR(50) NOT NULL,
        "app_version" VARCHAR(50) NOT NULL,
        "installed_at_utc" VARCHAR(35) NOT NULL,
        "last_checked_at_utc" VARCHAR(35) NOT NULL
      )
    `);

    // 2. stores
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stores" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(100) NOT NULL,
        "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Karachi',
        "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
        "tax_number" VARCHAR(50),
        "address" VARCHAR(255),
        "phone" VARCHAR(50),
        "receipt_header" TEXT,
        "receipt_footer" TEXT,
        "is_active" BOOLEAN NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_stores_is_active" ON "stores" ("is_active")
    `);

    // 3. installations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "installations" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "device_id" VARCHAR(100) NOT NULL UNIQUE,
        "store_id" INTEGER,
        "app_version" VARCHAR(50) NOT NULL,
        "install_state" VARCHAR(50) NOT NULL DEFAULT 'pending_onboarding',
        "registered_at_utc" VARCHAR(35),
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_installations_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_installations_device_id" ON "installations" ("device_id")
    `);

    // 4. registers
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "registers" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL,
        "code" VARCHAR(50) NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_registers_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "uq_registers_store_code" UNIQUE ("store_id", "code")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_registers_store_id" ON "registers" ("store_id")
    `);

    // 5. settings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "settings" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER,
        "key" VARCHAR(100) NOT NULL,
        "value" TEXT NOT NULL,
        "scope" VARCHAR(50) NOT NULL DEFAULT 'store',
        "description" TEXT,
        "updated_by" VARCHAR(100),
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_settings_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT,
        CONSTRAINT "uq_settings_store_key" UNIQUE ("store_id", "key")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_settings_store_key" ON "settings" ("store_id", "key")
    `);

    // Baseline metadata record
    const now = new Date().toISOString();
    await queryRunner.query(`
      INSERT OR IGNORE INTO "schema_metadata" ("id", "schema_version", "app_version", "installed_at_utc", "last_checked_at_utc")
      VALUES ('00000000-0000-0000-0000-000000000001', '1.0.0', '0.1.0', '${now}', '${now}')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "registers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "installations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "schema_metadata"`);
  }
}
