import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  OpeningStockSessionEntity,
  StockMovementEntity,
  StockLocationEntity,
} from '@bakery/database';
import {
  OpeningStockSession,
  ConfirmOpeningStockInput,
  StockBalanceItem,
  GetStockBalancesQuery,
  StockMovementLogItem,
} from '@bakery/contracts';
import { nowUtcString } from '@bakery/shared';

@Injectable()
export class InventoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getOpeningStockSession(storeId: number): Promise<OpeningStockSession | null> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(OpeningStockSessionEntity);
    const session = await repo.findOne({ where: { storeId } });

    if (!session) return null;

    return {
      id: session.id,
      storeId: session.storeId,
      status: session.status,
      notes: session.notes,
      confirmedAtUtc: session.confirmedAtUtc,
      confirmedBy: session.confirmedBy,
      createdAtUtc: session.createdAtUtc,
      updatedAtUtc: session.updatedAtUtc,
    };
  }

  public async confirmOpeningStock(input: ConfirmOpeningStockInput): Promise<OpeningStockSession> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(OpeningStockSessionEntity);
      const movementRepo = manager.getRepository(StockMovementEntity);
      const locationRepo = manager.getRepository(StockLocationEntity);

      let session = await sessionRepo.findOne({ where: { storeId: input.storeId } });
      if (session && session.status === 'confirmed') {
        throw new Error('Opening stock session has already been confirmed and locked');
      }

      const now = nowUtcString();

      if (!session) {
        session = sessionRepo.create({
          storeId: input.storeId,
          status: 'confirmed',
          notes: input.notes ?? 'Initial Opening Stock Confirmation',
          confirmedAtUtc: now,
          confirmedBy: input.confirmedBy ?? 'system',
          createdAtUtc: now,
          updatedAtUtc: now,
        });
      } else {
        session.status = 'confirmed';
        session.notes = input.notes ?? session.notes;
        session.confirmedAtUtc = now;
        session.confirmedBy = input.confirmedBy ?? 'system';
        session.updatedAtUtc = now;
      }
      await sessionRepo.save(session);

      // Verify or create a default location if needed
      let defaultLocation = await locationRepo.findOne({ where: { storeId: input.storeId } });
      if (!defaultLocation) {
        defaultLocation = locationRepo.create({
          storeId: input.storeId,
          code: 'MAIN_FLOOR',
          name: 'Main Sales Floor',
          locationType: 'sales_floor',
          isActive: true,
          createdAtUtc: now,
          updatedAtUtc: now,
        });
        await locationRepo.save(defaultLocation);
      }

      // Write immutable ledger movements
      for (const row of input.rows) {
        const movement = movementRepo.create({
          storeId: input.storeId,
          itemId: row.itemId,
          locationId: row.locationId || defaultLocation.id,
          signedBaseQuantity: row.quantity,
          movementType: 'OPENING',
          sourceType: 'OPENING_SESSION',
          sourceId: String(session.id),
          sourceLineId: null,
          costPerUnitMinorUnits: row.costPerUnitMinorUnits ?? 0,
          actorId: input.confirmedBy ?? 'admin',
          idempotencyKey: `OPENING-${session.id}-${row.itemId}`,
          createdAtUtc: now,
        });
        await movementRepo.save(movement);
      }

      return {
        id: session.id,
        storeId: session.storeId,
        status: session.status,
        notes: session.notes,
        confirmedAtUtc: session.confirmedAtUtc,
        confirmedBy: session.confirmedBy,
        createdAtUtc: session.createdAtUtc,
        updatedAtUtc: session.updatedAtUtc,
      };
    });
  }

  public async getStockBalances(query?: GetStockBalancesQuery): Promise<StockBalanceItem[]> {
    const ds = this.databaseService.getDataSource();

    const raw = await ds.query(`
      SELECT 
        i.id AS itemId,
        i.code AS itemCode,
        i.name AS itemName,
        i.base_unit_code AS baseUnitCode,
        pv.sku AS sku,
        b.barcode_value AS barcode,
        c.name AS categoryName,
        sl.id AS locationId,
        sl.name AS locationName,
        COALESCE(SUM(sm.signed_base_quantity), 0) AS onHandQuantity
      FROM items i
      LEFT JOIN product_variants pv ON pv.item_id = i.id
      LEFT JOIN products p ON p.id = pv.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN barcodes b ON b.target_id = pv.id AND b.target_type = 'variant' AND b.is_active = 1
      LEFT JOIN stock_movements sm ON sm.item_id = i.id
      LEFT JOIN stock_locations sl ON sl.id = sm.location_id
      WHERE i.is_active = 1
      GROUP BY i.id
      ORDER BY i.name ASC
    `);

    let items: StockBalanceItem[] = raw.map((r: any) => {
      const qty = Number(r.onHandQuantity) || 0;
      let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
      if (qty <= 0) {
        status = 'out_of_stock';
      } else if (qty <= 10) {
        status = 'low_stock';
      }

      return {
        itemId: Number(r.itemId),
        itemCode: r.itemCode,
        itemName: r.itemName,
        sku: r.sku || r.itemCode,
        barcode: r.barcode || null,
        categoryName: r.categoryName || 'General',
        locationId: r.locationId ? Number(r.locationId) : null,
        locationName: r.locationName || 'Main Floor',
        onHandQuantity: qty,
        baseUnitCode: r.baseUnitCode,
        lowStockThreshold: 10,
        status,
      };
    });

    if (query?.search && query.search.trim()) {
      const s = query.search.trim().toLowerCase();
      items = items.filter(
        (it) =>
          it.itemName.toLowerCase().includes(s) ||
          it.sku.toLowerCase().includes(s) ||
          (it.barcode && it.barcode.toLowerCase().includes(s)) ||
          it.categoryName?.toLowerCase().includes(s)
      );
    }

    if (query?.status) {
      items = items.filter((it) => it.status === query.status);
    }

    return items;
  }

  public async getMovements(storeId: number, itemId?: number): Promise<StockMovementLogItem[]> {
    const ds = this.databaseService.getDataSource();

    let sql = `
      SELECT 
        sm.id AS id,
        sm.item_id AS itemId,
        i.code AS itemCode,
        i.name AS itemName,
        COALESCE(sl.name, 'Main Floor') AS locationName,
        sm.movement_type AS movementType,
        sm.signed_base_quantity AS signedBaseQuantity,
        sm.source_type AS sourceType,
        sm.source_id AS sourceId,
        sm.created_at_utc AS occurredAtUtc
      FROM stock_movements sm
      JOIN items i ON i.id = sm.item_id
      LEFT JOIN stock_locations sl ON sl.id = sm.location_id
      WHERE sm.store_id = ?
    `;
    const params: any[] = [storeId];
    if (itemId) {
      sql += ` AND sm.item_id = ?`;
      params.push(itemId);
    }
    sql += ` ORDER BY sm.id DESC LIMIT 100`;

    const rows = await ds.query(sql, params);
    return rows.map((r: any) => ({
      id: Number(r.id),
      itemId: Number(r.itemId),
      itemCode: r.itemCode,
      itemName: r.itemName,
      locationName: r.locationName,
      movementType: r.movementType,
      signedBaseQuantity: Number(r.signedBaseQuantity),
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      occurredAtUtc: r.occurredAtUtc,
    }));
  }

  public async recordStockAdjustment(input: {
    storeId: number;
    itemId: number;
    newQuantity: number;
    reason: string;
    actorId?: number;
  }): Promise<{ success: boolean; variance: number }> {
    const ds = this.databaseService.getDataSource();
    return await ds.transaction(async (manager) => {
      const stockMovementRepo = manager.getRepository(StockMovementEntity);
      const stockLocationRepo = manager.getRepository(StockLocationEntity);

      let location = await stockLocationRepo.findOne({
        where: { storeId: input.storeId, isActive: true },
      });
      if (!location) {
        location = await stockLocationRepo.findOne({ where: {} });
      }
      if (!location) {
        location = stockLocationRepo.create({
          storeId: input.storeId,
          code: 'LOC-MAIN',
          name: 'Main Sales Floor',
          locationType: 'sales_floor',
          isActive: true,
          createdAtUtc: new Date().toISOString(),
          updatedAtUtc: new Date().toISOString(),
        });
        await stockLocationRepo.save(location);
      }

      // Query current balance for this item
      const balanceRaw = await stockMovementRepo
        .createQueryBuilder('sm')
        .select('COALESCE(SUM(sm.signed_base_quantity), 0)', 'total')
        .where('sm.item_id = :itemId', { itemId: input.itemId })
        .getRawOne();
      const currentBalance = Number(balanceRaw?.total || 0);
      const variance = input.newQuantity - currentBalance;

      if (variance === 0) {
        return { success: true, variance: 0 };
      }

      const now = new Date().toISOString();
      const movement = stockMovementRepo.create({
        storeId: input.storeId,
        itemId: input.itemId,
        locationId: location.id,
        signedBaseQuantity: variance,
        movementType: 'COUNT_ADJUSTMENT',
        sourceType: 'STOCK_COUNT',
        sourceId: `ADJ-${Date.now()}`,
        sourceLineId: input.reason,
        costPerUnitMinorUnits: null,
        actorId: input.actorId ? String(input.actorId) : null,
        idempotencyKey: `ADJ-${input.itemId}-${Date.now()}`,
        createdAtUtc: now,
      });
      await stockMovementRepo.save(movement);

      return { success: true, variance };
    });
  }
}
