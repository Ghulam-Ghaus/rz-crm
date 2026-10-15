import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stamps the database as an RZ CRM database. Runs before every other migration
 * (earliest timestamp) so a database can never be partially built without identity.
 * The DatabaseManager refuses to open any non-empty database lacking this stamp.
 */
export class AppIdentity1699999999000 implements MigrationInterface {
  name = 'AppIdentity1699999999000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_identity" (
        "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
        "db_name" VARCHAR(50) NOT NULL,
        "created_at_utc" VARCHAR(35) NOT NULL
      )
    `);
    await queryRunner.query(
      `INSERT OR IGNORE INTO "app_identity" ("id", "db_name", "created_at_utc") VALUES (1, 'rz_crm', ?)`,
      [new Date().toISOString()]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "app_identity"`);
  }
}
