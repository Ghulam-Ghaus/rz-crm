import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrmProductWholesaleAndStockEnhancements1700000010000 implements MigrationInterface {
  name = 'CrmProductWholesaleAndStockEnhancements1700000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add wholesale_price_minor_units and reorder_point to product_variants if not already present
    const columns: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info("product_variants")`);
    const hasWholesale = columns.some((c) => c.name === 'wholesale_price_minor_units');
    if (!hasWholesale) {
      await queryRunner.query(
        `ALTER TABLE "product_variants" ADD COLUMN "wholesale_price_minor_units" INTEGER NOT NULL DEFAULT 0`
      );
    }

    const hasReorder = columns.some((c) => c.name === 'reorder_point');
    if (!hasReorder) {
      await queryRunner.query(
        `ALTER TABLE "product_variants" ADD COLUMN "reorder_point" REAL NOT NULL DEFAULT 10`
      );
    }

    // 2. Ensure multi-location inventory locations exist (Central Warehouse and Main Showroom)
    const now = new Date().toISOString();
    const stores: Array<{ id: number }> = await queryRunner.query(`SELECT id FROM "stores" LIMIT 1`);
    const firstStore = stores[0];
    const storeId = firstStore ? firstStore.id : 1;

    const existingWh: Array<{ id: number }> = await queryRunner.query(
      `SELECT id FROM "stock_locations" WHERE "code" = 'WH-MAIN' AND "store_id" = ?`,
      [storeId]
    );
    if (existingWh.length === 0) {
      await queryRunner.query(
        `INSERT INTO "stock_locations" ("store_id", "code", "name", "location_type", "is_active", "created_at_utc", "updated_at_utc")
         VALUES (?, 'WH-MAIN', 'Central Warehouse', 'warehouse', 1, ?, ?)`,
        [storeId, now, now]
      );
    }

    const existingSr: Array<{ id: number }> = await queryRunner.query(
      `SELECT id FROM "stock_locations" WHERE "code" = 'SR-MAIN' AND "store_id" = ?`,
      [storeId]
    );
    if (existingSr.length === 0) {
      await queryRunner.query(
        `INSERT INTO "stock_locations" ("store_id", "code", "name", "location_type", "is_active", "created_at_utc", "updated_at_utc")
         VALUES (?, 'SR-MAIN', 'Main Showroom', 'sales_floor', 1, ?, ?)`,
        [storeId, now, now]
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    void _queryRunner;
    // SQLite does not support dropping columns without table copy; keep safe no-op
  }
}
