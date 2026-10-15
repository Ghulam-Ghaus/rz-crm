import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  RecipeEntity,
  RecipeVersionEntity,
  RecipeItemEntity,
  ProductVariantEntity,
  ProductEntity,
} from '@rz-crm/database';
import {
  Recipe,
  RecipeVersion,
  RecipeItem,
  CreateRecipeInput,
  CreateRecipeVersionInput,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class RecipesService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getRecipes(storeId: number): Promise<Recipe[]> {
    const dataSource = this.databaseService.getDataSource();
    const recipeRepo = dataSource.getRepository(RecipeEntity);
    const variantRepo = dataSource.getRepository(ProductVariantEntity);
    const productRepo = dataSource.getRepository(ProductEntity);
    const versionRepo = dataSource.getRepository(RecipeVersionEntity);
    const itemRepo = dataSource.getRepository(RecipeItemEntity);

    const recipes = await recipeRepo.find({
      where: { storeId },
      order: { id: 'DESC' },
    });

    const variants = await variantRepo.find();
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const products = await productRepo.find();
    const productMap = new Map(products.map((p) => [p.id, p]));

    const result: Recipe[] = [];

    for (const r of recipes) {
      const outputVariant = variantMap.get(r.outputVariantId);
      const outputProduct = outputVariant ? productMap.get(outputVariant.productId) : null;

      // Find active or latest version
      const version = await versionRepo.findOne({
        where: { recipeId: r.id, isActive: 1 },
        order: { versionNumber: 'DESC' },
      });

      let currentVersion: RecipeVersion | undefined;
      if (version) {
        const rawItems = await itemRepo.find({
          where: { recipeVersionId: version.id },
        });

        const items: RecipeItem[] = rawItems.map((it) => {
          const inVar = variantMap.get(it.inputVariantId);
          const inProd = inVar ? productMap.get(inVar.productId) : null;
          return {
            id: it.id,
            recipeVersionId: it.recipeVersionId,
            inputVariantId: it.inputVariantId,
            quantity: it.quantity,
            unitCode: it.unitCode,
            wastagePercent: it.wastagePercent,
            notes: it.notes,
            inputVariantName: inProd ? inProd.name : 'Unknown Item',
            inputVariantSku: inVar ? inVar.sku : '',
          };
        });

        currentVersion = {
          id: version.id,
          recipeId: version.recipeId,
          versionNumber: version.versionNumber,
          isActive: version.isActive,
          notes: version.notes,
          createdBy: version.createdBy,
          createdAtUtc: version.createdAtUtc,
          items,
        };
      }

      result.push({
        id: r.id,
        storeId: r.storeId,
        code: r.code,
        name: r.name,
        description: r.description,
        outputVariantId: r.outputVariantId,
        expectedYieldQuantity: r.expectedYieldQuantity,
        outputUnitCode: r.outputUnitCode,
        isActive: r.isActive,
        createdAtUtc: r.createdAtUtc,
        updatedAtUtc: r.updatedAtUtc,
        outputVariantName: outputProduct ? outputProduct.name : 'Unknown Product',
        outputVariantSku: outputVariant ? outputVariant.sku : '',
        currentVersion,
      });
    }

    return result;
  }

  public async getRecipe(recipeId: number): Promise<Recipe> {
    const dataSource = this.databaseService.getDataSource();
    const recipeRepo = dataSource.getRepository(RecipeEntity);
    const variantRepo = dataSource.getRepository(ProductVariantEntity);
    const productRepo = dataSource.getRepository(ProductEntity);
    const versionRepo = dataSource.getRepository(RecipeVersionEntity);
    const itemRepo = dataSource.getRepository(RecipeItemEntity);

    const r = await recipeRepo.findOne({ where: { id: recipeId } });
    if (!r) {
      throw new NotFoundException(`Recipe with ID ${recipeId} not found`);
    }

    const outputVariant = await variantRepo.findOne({ where: { id: r.outputVariantId } });
    const outputProduct = outputVariant
      ? await productRepo.findOne({ where: { id: outputVariant.productId } })
      : null;

    const version = await versionRepo.findOne({
      where: { recipeId: r.id, isActive: 1 },
      order: { versionNumber: 'DESC' },
    });

    let currentVersion: RecipeVersion | undefined;
    if (version) {
      const rawItems = await itemRepo.find({
        where: { recipeVersionId: version.id },
      });

      const items: RecipeItem[] = [];
      for (const it of rawItems) {
        const inVar = await variantRepo.findOne({ where: { id: it.inputVariantId } });
        const inProd = inVar ? await productRepo.findOne({ where: { id: inVar.productId } }) : null;
        items.push({
          id: it.id,
          recipeVersionId: it.recipeVersionId,
          inputVariantId: it.inputVariantId,
          quantity: it.quantity,
          unitCode: it.unitCode,
          wastagePercent: it.wastagePercent,
          notes: it.notes,
          inputVariantName: inProd ? inProd.name : 'Unknown Item',
          inputVariantSku: inVar ? inVar.sku : '',
        });
      }

      currentVersion = {
        id: version.id,
        recipeId: version.recipeId,
        versionNumber: version.versionNumber,
        isActive: version.isActive,
        notes: version.notes,
        createdBy: version.createdBy,
        createdAtUtc: version.createdAtUtc,
        items,
      };
    }

    return {
      id: r.id,
      storeId: r.storeId,
      code: r.code,
      name: r.name,
      description: r.description,
      outputVariantId: r.outputVariantId,
      expectedYieldQuantity: r.expectedYieldQuantity,
      outputUnitCode: r.outputUnitCode,
      isActive: r.isActive,
      createdAtUtc: r.createdAtUtc,
      updatedAtUtc: r.updatedAtUtc,
      outputVariantName: outputProduct ? outputProduct.name : 'Unknown Product',
      outputVariantSku: outputVariant ? outputVariant.sku : '',
      currentVersion,
    };
  }

  public async createRecipe(storeId: number, input: CreateRecipeInput): Promise<Recipe> {
    const dataSource = this.databaseService.getDataSource();

    return await dataSource.transaction(async (manager) => {
      const recipeRepo = manager.getRepository(RecipeEntity);
      const versionRepo = manager.getRepository(RecipeVersionEntity);
      const itemRepo = manager.getRepository(RecipeItemEntity);
      const variantRepo = manager.getRepository(ProductVariantEntity);

      // Validate output variant
      const outVar = await variantRepo.findOne({ where: { id: input.outputVariantId } });
      if (!outVar) {
        throw new BadRequestException(`Output variant with ID ${input.outputVariantId} does not exist`);
      }

      // Generate code if not provided
      let code = input.code?.trim().toUpperCase();
      if (!code) {
        const count = await recipeRepo.count({ where: { storeId } });
        code = `RCP-${String(count + 1).padStart(4, '0')}`;
      } else {
        const existing = await recipeRepo.findOne({ where: { code } });
        if (existing) {
          throw new BadRequestException(`Recipe with code "${code}" already exists`);
        }
      }

      const now = nowUtcString();

      // 1. Create recipe header
      const recipe = recipeRepo.create({
        storeId,
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        outputVariantId: input.outputVariantId,
        expectedYieldQuantity: input.expectedYieldQuantity || 1,
        outputUnitCode: input.outputUnitCode.trim(),
        isActive: 1,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
      const savedRecipe = await recipeRepo.save(recipe);

      // 2. Create version 1
      const version = versionRepo.create({
        recipeId: savedRecipe.id,
        versionNumber: 1,
        isActive: 1,
        notes: input.notes?.trim() || 'Initial version',
        createdBy: null,
        createdAtUtc: now,
      });
      const savedVersion = await versionRepo.save(version);

      // 3. Create items
      const itemsToSave = input.items.map((item) =>
        itemRepo.create({
          recipeVersionId: savedVersion.id,
          inputVariantId: item.inputVariantId,
          quantity: item.quantity,
          unitCode: item.unitCode.trim(),
          wastagePercent: item.wastagePercent || 0,
          notes: item.notes?.trim() || null,
        }),
      );
      await itemRepo.save(itemsToSave);

      return await this.getRecipe(savedRecipe.id);
    });
  }

  public async createRecipeVersion(
    recipeId: number,
    input: CreateRecipeVersionInput,
  ): Promise<RecipeVersion> {
    const dataSource = this.databaseService.getDataSource();

    return await dataSource.transaction(async (manager) => {
      const recipeRepo = manager.getRepository(RecipeEntity);
      const versionRepo = manager.getRepository(RecipeVersionEntity);
      const itemRepo = manager.getRepository(RecipeItemEntity);
      const variantRepo = manager.getRepository(ProductVariantEntity);
      const productRepo = manager.getRepository(ProductEntity);

      const recipe = await recipeRepo.findOne({ where: { id: recipeId } });
      if (!recipe) {
        throw new NotFoundException(`Recipe with ID ${recipeId} not found`);
      }

      // Deactivate previous versions
      await versionRepo.update({ recipeId }, { isActive: 0 });

      // Find max version number
      const latest = await versionRepo.findOne({
        where: { recipeId },
        order: { versionNumber: 'DESC' },
      });
      const nextVersionNumber = latest ? latest.versionNumber + 1 : 1;

      const now = nowUtcString();
      const version = versionRepo.create({
        recipeId,
        versionNumber: nextVersionNumber,
        isActive: 1,
        notes: input.notes?.trim() || `Version ${nextVersionNumber}`,
        createdBy: null,
        createdAtUtc: now,
      });
      const savedVersion = await versionRepo.save(version);

      // Save items
      const itemsToSave = input.items.map((item) =>
        itemRepo.create({
          recipeVersionId: savedVersion.id,
          inputVariantId: item.inputVariantId,
          quantity: item.quantity,
          unitCode: item.unitCode.trim(),
          wastagePercent: item.wastagePercent || 0,
          notes: item.notes?.trim() || null,
        }),
      );
      const savedItems = await itemRepo.save(itemsToSave);

      const items: RecipeItem[] = [];
      for (const it of savedItems) {
        const inVar = await variantRepo.findOne({ where: { id: it.inputVariantId } });
        const inProd = inVar ? await productRepo.findOne({ where: { id: inVar.productId } }) : null;
        items.push({
          id: it.id,
          recipeVersionId: it.recipeVersionId,
          inputVariantId: it.inputVariantId,
          quantity: it.quantity,
          unitCode: it.unitCode,
          wastagePercent: it.wastagePercent,
          notes: it.notes,
          inputVariantName: inProd ? inProd.name : 'Unknown Item',
          inputVariantSku: inVar ? inVar.sku : '',
        });
      }

      return {
        id: savedVersion.id,
        recipeId: savedVersion.recipeId,
        versionNumber: savedVersion.versionNumber,
        isActive: savedVersion.isActive,
        notes: savedVersion.notes,
        createdBy: savedVersion.createdBy,
        createdAtUtc: savedVersion.createdAtUtc,
        items,
      };
    });
  }
}
