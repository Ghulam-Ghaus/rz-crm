import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { bootstrapBackend, ActiveBackend, CatalogService, UnitsService } from '@rz-crm/backend';

describe('Phase 2 — Catalog, Units, & Barcodes Integration', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-catalog-test-'));
    const dbPath = path.join(tempDir, 'catalog_test.db');

    activeBackend = await bootstrapBackend({
      dbPath,
      runMigrations: true,
    });
  });

  afterEach(async () => {
    if (activeBackend) {
      await activeBackend.appContext.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should seed standard measurement units and conversions via migration #2', async () => {
    const unitsService = activeBackend.appContext.get(UnitsService);
    const units = await unitsService.getUnits();

    expect(units.length).toBeGreaterThanOrEqual(6);
    const codes = units.map((u) => u.code);
    expect(codes).toContain('pcs');
    expect(codes).toContain('dozen');
    expect(codes).toContain('kg');
    expect(codes).toContain('g');
    expect(codes).toContain('l');
    expect(codes).toContain('ml');

    const conversions = await unitsService.getConversions();
    expect(conversions.length).toBeGreaterThanOrEqual(5);
  });

  it('should create new measurement unit successfully without datatype mismatch', async () => {
    const unitsService = activeBackend.appContext.get(UnitsService);
    const created = await unitsService.createUnit({
      code: 'carton',
      name: 'Carton',
      dimension: 'COUNT',
      precision: 0,
      isBase: false,
    });

    expect(created.id).toBeDefined();
    expect(typeof created.id).toBe('number');
    expect(created.code).toBe('carton');
    expect(created.name).toBe('Carton');

    const units = await unitsService.getUnits();
    expect(units.map((u) => u.code)).toContain('carton');
  });

  it('should create categories with uniqueness enforcement', async () => {
    const catalogService = activeBackend.appContext.get(CatalogService);

    const cat = await catalogService.createCategory({
      code: 'BREAD',
      name: 'Breads & Loaves',
      sortOrder: 1,
    });

    expect(cat.id).toBeDefined();
    expect(cat.code).toBe('BREAD');
    expect(cat.name).toBe('Breads & Loaves');

    // Duplicate code must be rejected
    await expect(
      catalogService.createCategory({
        code: 'BREAD',
        name: 'Another Bread Category',
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it('should atomically create product with variant, item, and barcode', async () => {
    const catalogService = activeBackend.appContext.get(CatalogService);

    const cat = await catalogService.createCategory({
      code: 'PASTRY',
      name: 'Pastries',
    });

    const product = await catalogService.createProduct({
      code: 'CROISSANT-01',
      name: 'Butter Croissant',
      categoryId: cat.id,
      sku: 'SKU-CRO-01',
      priceMinorUnits: 350, // $3.50 stored in minor units
      currencyCode: 'USD',
      baseUnitCode: 'pcs',
      barcode: '8901234567890',
    });

    expect(product.id).toBeDefined();
    expect(product.code).toBe('CROISSANT-01');
    expect(product.sku).toBe('SKU-CRO-01');
    expect(product.priceMinorUnits).toBe(350);
    expect(product.barcode).toBe('8901234567890');
    expect(product.categoryName).toBe('Pastries');

    // Duplicate SKU must reject
    await expect(
      catalogService.createProduct({
        code: 'CROISSANT-02',
        name: 'Chocolate Croissant',
        sku: 'SKU-CRO-01', // duplicate sku
        priceMinorUnits: 400,
        baseUnitCode: 'pcs',
      }),
    ).rejects.toThrow(/SKU 'SKU-CRO-01' already exists/i);

    // Duplicate barcode must reject
    await expect(
      catalogService.createProduct({
        code: 'CROISSANT-03',
        name: 'Almond Croissant',
        sku: 'SKU-CRO-03',
        priceMinorUnits: 450,
        baseUnitCode: 'pcs',
        barcode: '8901234567890', // duplicate barcode
      }),
    ).rejects.toThrow(/Barcode '8901234567890' is already in use/i);
  });
});
