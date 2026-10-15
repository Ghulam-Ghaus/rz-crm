import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  CategoryEntity,
  ProductEntity,
  ProductVariantEntity,
  ItemEntity,
  BarcodeEntity,
} from '@rz-crm/database';
import {
  Category,
  CreateCategoryInput,
  ProductListItem,
  CreateProductInput,
  UpdateProductInput,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class CatalogService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getCategories(): Promise<Category[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(CategoryEntity);
    const records = await repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    return records.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      code: c.code,
      name: c.name,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      createdAtUtc: c.createdAtUtc,
      updatedAtUtc: c.updatedAtUtc,
    }));
  }

  public async createCategory(input: CreateCategoryInput): Promise<Category> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(CategoryEntity);

    // Check unique code
    const existing = await repo.findOne({ where: { code: input.code } });
    if (existing) {
      throw new Error(`Category code '${input.code}' already exists`);
    }

    const now = nowUtcString();
    const category = repo.create({
      code: input.code,
      name: input.name,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
      createdAtUtc: now,
      updatedAtUtc: now,
    });

    await repo.save(category);

    return {
      id: category.id,
      parentId: category.parentId,
      code: category.code,
      name: category.name,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      createdAtUtc: category.createdAtUtc,
      updatedAtUtc: category.updatedAtUtc,
    };
  }

  public async getProducts(): Promise<ProductListItem[]> {
    const ds = this.databaseService.getDataSource();
    const productRepo = ds.getRepository(ProductEntity);
    const variantRepo = ds.getRepository(ProductVariantEntity);
    const barcodeRepo = ds.getRepository(BarcodeEntity);
    const itemRepo = ds.getRepository(ItemEntity);
    const categoryRepo = ds.getRepository(CategoryEntity);

    const products = await productRepo.find({ where: { isActive: true } });
    const categories = await categoryRepo.find();
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const result: ProductListItem[] = [];

    for (const product of products) {
      const variants = await variantRepo.find({ where: { productId: product.id, isActive: true } });
      const primaryVariant = variants[0];

      if (!primaryVariant) continue;

      const barcodeRecord = await barcodeRepo.findOne({
        where: { targetId: primaryVariant.id, isActive: true },
      });

      let baseUnitCode = 'pcs';
      if (primaryVariant.itemId) {
        const item = await itemRepo.findOne({ where: { id: primaryVariant.itemId } });
        if (item) baseUnitCode = item.baseUnitCode;
      }

      result.push({
        id: product.id,
        variantId: primaryVariant.id,
        code: product.code,
        name: product.name,
        categoryId: product.categoryId,
        categoryName: product.categoryId ? categoryMap.get(product.categoryId) ?? null : null,
        sku: primaryVariant.sku,
        priceMinorUnits: primaryVariant.priceMinorUnits,
        costMinorUnits: primaryVariant.costMinorUnits ?? 0,
        currencyCode: primaryVariant.currencyCode,
        barcode: barcodeRecord ? barcodeRecord.barcodeValue : null,
        baseUnitCode,
        isActive: product.isActive,
      });
    }

    return result;
  }

  public async createProduct(input: CreateProductInput): Promise<ProductListItem> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const itemRepo = manager.getRepository(ItemEntity);
      const productRepo = manager.getRepository(ProductEntity);
      const variantRepo = manager.getRepository(ProductVariantEntity);
      const barcodeRepo = manager.getRepository(BarcodeEntity);
      const categoryRepo = manager.getRepository(CategoryEntity);

      // Check unique product code & SKU
      const existingProd = await productRepo.findOne({ where: { code: input.code } });
      if (existingProd) throw new Error(`Product code '${input.code}' already exists`);

      const existingSku = await variantRepo.findOne({ where: { sku: input.sku } });
      if (existingSku) throw new Error(`SKU '${input.sku}' already exists`);

      // Check barcode if provided
      if (input.barcode) {
        const existingBarcode = await barcodeRepo.findOne({ where: { barcodeValue: input.barcode } });
        if (existingBarcode) throw new Error(`Barcode '${input.barcode}' is already in use`);
      }

      const now = nowUtcString();

      // 1. Create linked inventory item
      const item = itemRepo.create({
        code: `ITEM-${input.code}`,
        name: input.name,
        itemType: 'finished_good',
        baseUnitCode: input.baseUnitCode,
        trackInventory: true,
        isActive: true,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
      await itemRepo.save(item);

      // 2. Create customer product
      const product = productRepo.create({
        code: input.code,
        name: input.name,
        categoryId: input.categoryId ?? null,
        description: input.description ?? null,
        isActive: true,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
      await productRepo.save(product);

      // 3. Create default sellable variant
      const variant = variantRepo.create({
        productId: product.id,
        itemId: item.id,
        sku: input.sku,
        name: 'Standard',
        priceMinorUnits: input.priceMinorUnits,
        costMinorUnits: input.costMinorUnits ?? 0,
        currencyCode: input.currencyCode ?? 'PKR',
        taxClassId: null,
        isActive: true,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
      await variantRepo.save(variant);

      // 4. Create barcode if provided
      let savedBarcode: string | null = null;
      if (input.barcode) {
        const barcodeRecord = barcodeRepo.create({
          barcodeValue: input.barcode,
          barcodeType: 'CODE128',
          targetType: 'variant',
          targetId: variant.id,
          isPrimary: true,
          isActive: true,
          createdAtUtc: now,
          updatedAtUtc: now,
        });
        await barcodeRepo.save(barcodeRecord);
        savedBarcode = barcodeRecord.barcodeValue;
      }

      let categoryName: string | null = null;
      if (product.categoryId) {
        const cat = await categoryRepo.findOne({ where: { id: product.categoryId } });
        if (cat) categoryName = cat.name;
      }

      return {
        id: product.id,
        variantId: variant.id,
        code: product.code,
        name: product.name,
        categoryId: product.categoryId,
        categoryName,
        sku: variant.sku,
        priceMinorUnits: variant.priceMinorUnits,
        costMinorUnits: variant.costMinorUnits,
        currencyCode: variant.currencyCode,
        barcode: savedBarcode,
        baseUnitCode: item.baseUnitCode,
        isActive: product.isActive,
      };
    });
  }

  public async updateProduct(input: UpdateProductInput): Promise<ProductListItem> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const productRepo = manager.getRepository(ProductEntity);
      const variantRepo = manager.getRepository(ProductVariantEntity);
      const barcodeRepo = manager.getRepository(BarcodeEntity);
      const itemRepo = manager.getRepository(ItemEntity);
      const categoryRepo = manager.getRepository(CategoryEntity);

      const product = await productRepo.findOne({ where: { id: input.id } });
      if (!product) throw new Error(`Product with ID '${input.id}' not found`);

      const variant = await variantRepo.findOne({ where: { id: input.variantId } });
      if (!variant) throw new Error(`Product variant with ID '${input.variantId}' not found`);

      const now = nowUtcString();

      // Update product name & category
      if (input.name !== undefined) {
        product.name = input.name.trim();
        if (variant.itemId) {
          await itemRepo.update({ id: variant.itemId }, { name: input.name.trim(), updatedAtUtc: now });
        }
      }
      if (input.categoryId !== undefined) {
        product.categoryId = input.categoryId;
      }
      if (input.isActive !== undefined) {
        product.isActive = input.isActive;
        variant.isActive = input.isActive;
      }
      product.updatedAtUtc = now;
      await productRepo.save(product);

      // Update prices
      if (input.priceMinorUnits !== undefined) {
        variant.priceMinorUnits = input.priceMinorUnits;
      }
      if (input.costMinorUnits !== undefined) {
        variant.costMinorUnits = input.costMinorUnits;
      }
      variant.updatedAtUtc = now;
      await variantRepo.save(variant);

      // Update barcode if provided
      let savedBarcode: string | null = null;
      if (input.barcode !== undefined) {
        if (input.barcode && input.barcode.trim()) {
          const cleanBarcode = input.barcode.trim();
          let barcodeRecord = await barcodeRepo.findOne({
            where: { targetId: variant.id, targetType: 'variant' },
          });
          if (barcodeRecord) {
            barcodeRecord.barcodeValue = cleanBarcode;
            barcodeRecord.updatedAtUtc = now;
            await barcodeRepo.save(barcodeRecord);
            savedBarcode = barcodeRecord.barcodeValue;
          } else {
            barcodeRecord = barcodeRepo.create({
              barcodeValue: cleanBarcode,
              barcodeType: 'CODE128',
              targetType: 'variant',
              targetId: variant.id,
              isPrimary: true,
              isActive: true,
              createdAtUtc: now,
              updatedAtUtc: now,
            });
            await barcodeRepo.save(barcodeRecord);
            savedBarcode = barcodeRecord.barcodeValue;
          }
        }
      } else {
        const existingBarcode = await barcodeRepo.findOne({
          where: { targetId: variant.id, isActive: true },
        });
        if (existingBarcode) savedBarcode = existingBarcode.barcodeValue;
      }

      let categoryName: string | null = null;
      if (product.categoryId) {
        const cat = await categoryRepo.findOne({ where: { id: product.categoryId } });
        if (cat) categoryName = cat.name;
      }

      let baseUnitCode = 'pcs';
      if (variant.itemId) {
        const item = await itemRepo.findOne({ where: { id: variant.itemId } });
        if (item) baseUnitCode = item.baseUnitCode;
      }

      return {
        id: product.id,
        variantId: variant.id,
        code: product.code,
        name: product.name,
        categoryId: product.categoryId,
        categoryName,
        sku: variant.sku,
        priceMinorUnits: variant.priceMinorUnits,
        costMinorUnits: variant.costMinorUnits,
        currencyCode: variant.currencyCode,
        barcode: savedBarcode,
        baseUnitCode,
        isActive: product.isActive,
      };
    });
  }
}
