import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  BarcodeEntity,
  ProductVariantEntity,
  ProductEntity,
  ItemEntity,
} from '@bakery/database';
import { ResolvedBarcodeResult } from '@bakery/contracts';

@Injectable()
export class BarcodeService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async resolve(barcodeValue: string): Promise<ResolvedBarcodeResult | null> {
    const ds = this.databaseService.getDataSource();
    const barcodeRepo = ds.getRepository(BarcodeEntity);
    const variantRepo = ds.getRepository(ProductVariantEntity);
    const productRepo = ds.getRepository(ProductEntity);
    const itemRepo = ds.getRepository(ItemEntity);

    // Normalize barcode (trim whitespace, preserving leading zeros)
    const normalized = barcodeValue.trim();
    const barcodeRecord = await barcodeRepo.findOne({
      where: { barcodeValue: normalized, isActive: true },
    });

    if (!barcodeRecord) {
      return null;
    }

    if (barcodeRecord.targetType === 'variant') {
      const variant = await variantRepo.findOne({
        where: { id: barcodeRecord.targetId, isActive: true },
      });
      if (!variant) return null;

      const product = await productRepo.findOne({
        where: { id: variant.productId, isActive: true },
      });
      if (!product) return null;

      let baseUnitCode = 'pcs';
      if (variant.itemId) {
        const item = await itemRepo.findOne({ where: { id: variant.itemId } });
        if (item) baseUnitCode = item.baseUnitCode;
      }

      return {
        barcodeValue: barcodeRecord.barcodeValue,
        product: {
          id: product.id,
          code: product.code,
          name: product.name,
        },
        variant: {
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          priceMinorUnits: variant.priceMinorUnits,
          currencyCode: variant.currencyCode,
        },
        baseUnitCode,
        taxBasisPoints: 0,
      };
    }

    return null;
  }
}
