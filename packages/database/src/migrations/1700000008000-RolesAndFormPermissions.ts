import { MigrationInterface, QueryRunner } from 'typeorm';

export class RolesAndFormPermissions1700000008000 implements MigrationInterface {
  name = 'RolesAndFormPermissions1700000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create roles table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "name" VARCHAR(50) NOT NULL UNIQUE,
        "display_name" VARCHAR(100) NOT NULL,
        "permissions_json" TEXT NOT NULL,
        "is_system" BOOLEAN NOT NULL DEFAULT 0,
        "created_at_utc" VARCHAR(35) NOT NULL,
        "updated_at_utc" VARCHAR(35) NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_roles_name" ON "roles" ("name")`);

    // 2. Add permissions_json to users table
    const table = await queryRunner.getTable('users');
    const hasCol = table?.columns.some((c) => c.name === 'permissions_json');
    if (!hasCol) {
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "permissions_json" TEXT`);
    }

    // 3. Seed System Default Roles
    const now = new Date().toISOString();

    await queryRunner.query(`
      INSERT OR IGNORE INTO "roles" (
        "name", "display_name", "permissions_json", "is_system", "created_at_utc", "updated_at_utc"
      ) VALUES
        ('admin', 'Administrator (Full Access)', '["*"]', 1, ?, ?),
        ('manager', 'Store Manager', '["pos","inventory","products","categories","purchasing","production","custom-orders","scanner","reports"]', 1, ?, ?),
        ('cashier', 'Cashier (Sales / POS)', '["pos","inventory","custom-orders","scanner"]', 1, ?, ?),
        ('purchaser', 'Purchaser (Suppliers / GRN)', '["purchasing","inventory"]', 1, ?, ?),
        ('baker', 'Baker (Production / Recipes)', '["production","inventory"]', 1, ?, ?)
    `, [now, now, now, now, now, now, now, now, now, now]);

    // 4. Backfill default permissions on existing users
    await queryRunner.query(`UPDATE "users" SET "permissions_json" = '["*"]' WHERE "role" = 'admin' AND ("permissions_json" IS NULL OR "permissions_json" = '')`);
    await queryRunner.query(`UPDATE "users" SET "permissions_json" = '["pos","inventory","custom-orders","scanner"]' WHERE "role" = 'cashier' AND ("permissions_json" IS NULL OR "permissions_json" = '')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
  }
}
