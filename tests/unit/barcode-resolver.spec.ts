import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  bootstrapBackend,
  ActiveBackend,
  CatalogService,
  BarcodeService,
} from '@bakery/backend';

describe('Barcode Resolver Service (Unit/Integration Tests)', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-barcode-test-'));
    const dbPath = path.join(tempDir, 'barcode_test.db');

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

  it('should resolve a registered barcode and return product and pricing details', async () => {
    const catalogService = activeBackend.appContext.get(CatalogService);
    const barcodeService = activeBackend.appContext.get(BarcodeService);

    await catalogService.createProduct({
      code: 'BAGEL-01',
      name: 'Everything Bagel',
      sku: 'SKU-BAGEL-01',
      priceMinorUnits: 275, // $2.75
      currencyCode: 'USD',
      baseUnitCode: 'pcs',
      barcode: '123456789012',
    });

    const start = performance.now();
    const result = await barcodeService.resolve('123456789012');
    const elapsed = performance.now() - start;

    expect(result).not.toBeNull();
    expect(result?.barcodeValue).toBe('123456789012');
    expect(result?.product.name).toBe('Everything Bagel');
    expect(result?.variant.sku).toBe('SKU-BAGEL-01');
    expect(result?.variant.priceMinorUnits).toBe(275);
    expect(result?.baseUnitCode).toBe('pcs');
    expect(elapsed).toBeLessThan(50); // Immediate lookup under 50ms (typically ~2ms)
  });

  it('should return null for unknown barcode without throwing errors', async () => {
    const barcodeService = activeBackend.appContext.get(BarcodeService);
    const result = await barcodeService.resolve('999999999999');
    expect(result).toBeNull();
  });
});
