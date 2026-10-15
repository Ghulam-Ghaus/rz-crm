import { MigrationInterface, QueryRunner } from 'typeorm';
import crypto from 'node:crypto';

export class UsersAndRbac1700000006000 implements MigrationInterface {
  name = 'UsersAndRbac1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "store_id" INTEGER NOT NULL DEFAULT 1,
        "username" VARCHAR(50) NOT NULL UNIQUE,
        "display_name" VARCHAR(100) NOT NULL,
        "role" VARCHAR(30) NOT NULL DEFAULT 'cashier',
        "pin_hash" VARCHAR(128),
        "pin_salt" VARCHAR(64),
        "password_hash" VARCHAR(128),
        "password_salt" VARCHAR(64),
        "is_active" BOOLEAN NOT NULL DEFAULT 1,
        "last_login_at_utc" VARCHAR(35),
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_users_store" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_store_id" ON "users" ("store_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users" ("username")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" ("role")`);

    // 2. audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "user_id" INTEGER,
        "username" VARCHAR(50),
        "action" VARCHAR(100) NOT NULL,
        "resource" VARCHAR(100),
        "details_json" TEXT,
        "created_at_utc" VARCHAR(35) NOT NULL,
        CONSTRAINT "fk_audit_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_user_id" ON "audit_logs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_action" ON "audit_logs" ("action")`);

    // 3. Seed Default Admin User (username: admin, default PIN: 1234)
    const now = new Date().toISOString();
    const pinSalt = crypto.randomBytes(16).toString('hex');
    const pinHash = crypto.scryptSync('1234', pinSalt, 64).toString('hex');

    const passSalt = crypto.randomBytes(16).toString('hex');
    const passHash = crypto.scryptSync('admin123', passSalt, 64).toString('hex');

    await queryRunner.query(`
      INSERT OR IGNORE INTO "users" (
        "store_id", "username", "display_name", "role",
        "pin_hash", "pin_salt", "password_hash", "password_salt",
        "is_active", "created_at_utc", "updated_at_utc"
      ) VALUES (
        1, 'admin', 'Store Admin', 'admin',
        ?, ?, ?, ?,
        1, ?, ?
      )
    `, [pinHash, pinSalt, passHash, passSalt, now, now]);

    // 4. Seed Default Cashier (username: cashier, default PIN: 1111)
    const cashPinSalt = crypto.randomBytes(16).toString('hex');
    const cashPinHash = crypto.scryptSync('1111', cashPinSalt, 64).toString('hex');
    await queryRunner.query(`
      INSERT OR IGNORE INTO "users" (
        "store_id", "username", "display_name", "role",
        "pin_hash", "pin_salt",
        "is_active", "created_at_utc", "updated_at_utc"
      ) VALUES (
        1, 'cashier', 'Morning Cashier', 'cashier',
        ?, ?,
        1, ?, ?
      )
    `, [cashPinHash, cashPinSalt, now, now]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
