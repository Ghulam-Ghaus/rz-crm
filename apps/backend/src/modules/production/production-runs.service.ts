import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  ProductionRunEntity,
  ProductionRunItemEntity,
  RecipeEntity,
  RecipeVersionEntity,
  RecipeItemEntity,
  ProductVariantEntity,
  ProductEntity,
  StockMovementEntity,
  StockLocationEntity,
  InventoryLotEntity,
} from '@rz-crm/database';
import {
  ProductionRun,
  ProductionRunItem,
  CreateProductionRunInput,
  UpdateProductionRunStatusInput,
  CompleteProductionRunInput,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class ProductionRunsService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getProductionRuns(storeId: number): Promise<ProductionRun[]> {
    const dataSource = this.databaseService.getDataSource();
    const runRepo = dataSource.getRepository(ProductionRunEntity);
    const recipeRepo = dataSource.getRepository(RecipeEntity);
    const variantRepo = dataSource.getRepository(ProductVariantEntity);
    const productRepo = dataSource.getRepository(ProductEntity);

    const runs = await runRepo.find({
      where: { storeId },
      order: { id: 'DESC' },
    });

    const recipes = await recipeRepo.find({ where: { storeId } });
    const recipeMap = new Map(recipes.map((r) => [r.id, r.name]));

    const variants = await variantRepo.find();
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const products = await productRepo.find();
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    return runs.map((run) => {
      const outVar = variantMap.get(run.outputVariantId);
      const outProdName = outVar ? productMap.get(outVar.productId) : 'Unknown Product';
      return {
        id: run.id,
        storeId: run.storeId,
        runNumber: run.runNumber,
        recipeId: run.recipeId,
        recipeVersionId: run.recipeVersionId,
        outputVariantId: run.outputVariantId,
        status: run.status,
        plannedBatchCount: run.plannedBatchCount,
        plannedOutputQuantity: run.plannedOutputQuantity,
        actualOutputQuantity: run.actualOutputQuantity,
        outputUnitCode: run.outputUnitCode,
        totalCostMinorUnits: run.totalCostMinorUnits,
        currencyCode: run.currencyCode,
        plannedDateUtc: run.plannedDateUtc,
        completedAtUtc: run.completedAtUtc,
        outputLotNumber: run.outputLotNumber,
        outputExpiryDate: run.outputExpiryDate,
        notes: run.notes,
        createdBy: run.createdBy,
        createdAtUtc: run.createdAtUtc,
        updatedAtUtc: run.updatedAtUtc,
        recipeName: recipeMap.get(run.recipeId) ?? 'Unknown Recipe',
        outputVariantName: outProdName ?? 'Unknown Product',
        outputVariantSku: outVar?.sku ?? '',
      };
    });
  }

  public async getProductionRun(runId: number): Promise<ProductionRun> {
    const dataSource = this.databaseService.getDataSource();
    const runRepo = dataSource.getRepository(ProductionRunEntity);
    const itemRepo = dataSource.getRepository(ProductionRunItemEntity);
    const recipeRepo = dataSource.getRepository(RecipeEntity);
    const variantRepo = dataSource.getRepository(ProductVariantEntity);
    const productRepo = dataSource.getRepository(ProductEntity);

    const run = await runRepo.findOne({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException(`Production run with ID ${runId} not found`);
    }

    const recipe = await recipeRepo.findOne({ where: { id: run.recipeId } });
    const outVar = await variantRepo.findOne({ where: { id: run.outputVariantId } });
    const outProd = outVar ? await productRepo.findOne({ where: { id: outVar.productId } }) : null;

    const rawItems = await itemRepo.find({ where: { productionRunId: run.id } });
    const items: ProductionRunItem[] = [];

    for (const it of rawItems) {
      const inVar = await variantRepo.findOne({ where: { id: it.inputVariantId } });
      const inProd = inVar ? await productRepo.findOne({ where: { id: inVar.productId } }) : null;
      items.push({
        id: it.id,
        productionRunId: it.productionRunId,
        inputVariantId: it.inputVariantId,
        plannedQuantity: it.plannedQuantity,
        actualQuantity: it.actualQuantity,
        unitCode: it.unitCode,
        unitCostMinorUnits: it.unitCostMinorUnits,
        totalCostMinorUnits: it.totalCostMinorUnits,
        lotId: it.lotId,
        inputVariantName: inProd ? inProd.name : 'Unknown Item',
        inputVariantSku: inVar?.sku ?? '',
      });
    }

    return {
      id: run.id,
      storeId: run.storeId,
      runNumber: run.runNumber,
      recipeId: run.recipeId,
      recipeVersionId: run.recipeVersionId,
      outputVariantId: run.outputVariantId,
      status: run.status,
      plannedBatchCount: run.plannedBatchCount,
      plannedOutputQuantity: run.plannedOutputQuantity,
      actualOutputQuantity: run.actualOutputQuantity,
      outputUnitCode: run.outputUnitCode,
      totalCostMinorUnits: run.totalCostMinorUnits,
      currencyCode: run.currencyCode,
      plannedDateUtc: run.plannedDateUtc,
      completedAtUtc: run.completedAtUtc,
      outputLotNumber: run.outputLotNumber,
      outputExpiryDate: run.outputExpiryDate,
      notes: run.notes,
      createdBy: run.createdBy,
      createdAtUtc: run.createdAtUtc,
      updatedAtUtc: run.updatedAtUtc,
      recipeName: recipe ? recipe.name : 'Unknown Recipe',
      outputVariantName: outProd ? outProd.name : 'Unknown Product',
      outputVariantSku: outVar?.sku ?? '',
      items,
    };
  }

  public async createProductionRun(
    storeId: number,
    input: CreateProductionRunInput,
  ): Promise<ProductionRun> {
    const dataSource = this.databaseService.getDataSource();

    return await dataSource.transaction(async (manager) => {
      const runRepo = manager.getRepository(ProductionRunEntity);
      const itemRepo = manager.getRepository(ProductionRunItemEntity);
      const recipeRepo = manager.getRepository(RecipeEntity);
      const versionRepo = manager.getRepository(RecipeVersionEntity);
      const recipeItemRepo = manager.getRepository(RecipeItemEntity);

      const recipe = await recipeRepo.findOne({ where: { id: input.recipeId, storeId } });
      if (!recipe) {
        throw new NotFoundException(`Recipe with ID ${input.recipeId} not found`);
      }

      const activeVersion = await versionRepo.findOne({
        where: { recipeId: recipe.id, isActive: 1 },
        order: { versionNumber: 'DESC' },
      });
      if (!activeVersion) {
        throw new BadRequestException(`Recipe ${recipe.name} has no active version`);
      }

      const recipeItems = await recipeItemRepo.find({
        where: { recipeVersionId: activeVersion.id },
      });
      if (recipeItems.length === 0) {
        throw new BadRequestException(`Recipe version has no ingredients defined`);
      }

      // Generate Run Number PRD-YYYYMMDD-XXXX
      const datePart = nowUtcString().slice(0, 10).replace(/-/g, '');
      const countToday = await runRepo
        .createQueryBuilder('run')
        .where('run.store_id = :storeId', { storeId })
        .andWhere('run.run_number LIKE :prefix', { prefix: `PRD-${datePart}-%` })
        .getCount();

      const sequence = String(countToday + 1).padStart(4, '0');
      const runNumber = `PRD-${datePart}-${sequence}`;

      const batchCount = Math.max(1, input.plannedBatchCount || 1);
      const plannedOutputQuantity = recipe.expectedYieldQuantity * batchCount;
      const now = nowUtcString();

      const run = runRepo.create({
        storeId,
        runNumber,
        recipeId: recipe.id,
        recipeVersionId: activeVersion.id,
        outputVariantId: recipe.outputVariantId,
        status: 'PLANNED',
        plannedBatchCount: batchCount,
        plannedOutputQuantity,
        actualOutputQuantity: null,
        outputUnitCode: recipe.outputUnitCode,
        totalCostMinorUnits: 0,
        currencyCode: 'PKR',
        plannedDateUtc: input.plannedDateUtc || now,
        completedAtUtc: null,
        outputLotNumber: null,
        outputExpiryDate: null,
        notes: input.notes?.trim() || null,
        createdBy: null,
        createdAtUtc: now,
        updatedAtUtc: now,
      });

      const savedRun = await runRepo.save(run);

      // Create Run Items scaled by batch count
      const runItems = recipeItems.map((ri) => {
        const plannedQty = ri.quantity * batchCount;
        return itemRepo.create({
          productionRunId: savedRun.id,
          inputVariantId: ri.inputVariantId,
          plannedQuantity: plannedQty,
          actualQuantity: plannedQty,
          unitCode: ri.unitCode,
          unitCostMinorUnits: 0,
          totalCostMinorUnits: 0,
          lotId: null,
        });
      });

      await itemRepo.save(runItems);

      return await this.getProductionRun(savedRun.id);
    });
  }

  public async updateProductionRunStatus(
    input: UpdateProductionRunStatusInput,
  ): Promise<ProductionRun> {
    const dataSource = this.databaseService.getDataSource();
    const runRepo = dataSource.getRepository(ProductionRunEntity);

    const run = await runRepo.findOne({ where: { id: input.runId } });
    if (!run) {
      throw new NotFoundException(`Production run with ID ${input.runId} not found`);
    }

    if (run.status === 'COMPLETED' || run.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot change status of a ${run.status} production run`);
    }

    run.status = input.status;
    if (input.notes) {
      run.notes = run.notes ? `${run.notes}\n${input.notes}` : input.notes;
    }
    run.updatedAtUtc = nowUtcString();

    await runRepo.save(run);
    return await this.getProductionRun(run.id);
  }

  public async completeProductionRun(
    storeId: number,
    input: CompleteProductionRunInput,
  ): Promise<ProductionRun> {
    const dataSource = this.databaseService.getDataSource();

    return await dataSource.transaction(async (manager) => {
      const runRepo = manager.getRepository(ProductionRunEntity);
      const itemRepo = manager.getRepository(ProductionRunItemEntity);
      const movementRepo = manager.getRepository(StockMovementEntity);
      const locationRepo = manager.getRepository(StockLocationEntity);
      const lotRepo = manager.getRepository(InventoryLotEntity);
      const variantRepo = manager.getRepository(ProductVariantEntity);

      const run = await runRepo.findOne({ where: { id: input.runId, storeId } });
      if (!run) {
        throw new NotFoundException(`Production run with ID ${input.runId} not found`);
      }

      if (run.status === 'COMPLETED') {
        throw new BadRequestException(`Production run ${run.runNumber} is already completed`);
      }
      if (run.status === 'CANCELLED') {
        throw new BadRequestException(`Cannot complete a cancelled production run`);
      }

      const runItems = await itemRepo.find({ where: { productionRunId: run.id } });
      if (runItems.length === 0) {
        throw new BadRequestException(`Production run has no items`);
      }

      const outputVariant = await variantRepo.findOne({ where: { id: run.outputVariantId } });
      if (!outputVariant) {
        throw new BadRequestException(`Output variant #${run.outputVariantId} not found`);
      }

      const now = nowUtcString();

      // Default stock location
      let location = await locationRepo.findOne({ where: { storeId, isActive: true } });
      if (!location) {
        location = locationRepo.create({
          storeId,
          code: 'MAIN',
          name: 'Main Storage Room',
          locationType: 'store',
          isActive: true,
          createdAtUtc: now,
          updatedAtUtc: now,
        });
        location = await locationRepo.save(location);
      }

      // 1. Process Raw Material Consumptions (Negative Movements)
      let totalCalculatedCostMinor = 0;
      const actualQtyMap = new Map(
        (input.actualItemQuantities || []).map((q) => [q.inputVariantId, q.actualQuantity]),
      );

      for (const item of runItems) {
        const actualQty = actualQtyMap.get(item.inputVariantId) ?? item.plannedQuantity;
        item.actualQuantity = actualQty;

        const inputVariant = await variantRepo.findOne({ where: { id: item.inputVariantId } });
        if (!inputVariant) {
          throw new BadRequestException(`Input variant #${item.inputVariantId} not found`);
        }

        // Idempotency guard for ingredient consumption
        const idempotencyKey = `PRD-CONSUME-${run.id}-${item.inputVariantId}`;
        const existingMovement = await movementRepo.findOne({ where: { idempotencyKey } });

        if (!existingMovement && inputVariant.itemId) {
          const movement = movementRepo.create({
            storeId,
            itemId: inputVariant.itemId,
            locationId: location.id,
            signedBaseQuantity: -actualQty,
            movementType: 'PRODUCTION_CONSUMPTION',
            sourceType: 'PRODUCTION_RUN',
            sourceId: run.runNumber,
            sourceLineId: String(item.id),
            costPerUnitMinorUnits: item.unitCostMinorUnits,
            actorId: 'STAFF',
            idempotencyKey,
            createdAtUtc: now,
          });
          await movementRepo.save(movement);
        }

        totalCalculatedCostMinor += item.totalCostMinorUnits;
      }
      await itemRepo.save(runItems);

      // 2. Process Finished Goods Output (Positive Movement)
      const actualOutputQty = Math.max(1, input.actualOutputQuantity);
      const outputIdempotencyKey = `PRD-OUTPUT-${run.id}`;
      const existingOutputMovement = await movementRepo.findOne({
        where: { idempotencyKey: outputIdempotencyKey },
      });

      if (!existingOutputMovement && outputVariant.itemId) {
        const outputMovement = movementRepo.create({
          storeId,
          itemId: outputVariant.itemId,
          locationId: location.id,
          signedBaseQuantity: actualOutputQty,
          movementType: 'PRODUCTION_OUTPUT',
          sourceType: 'PRODUCTION_RUN',
          sourceId: run.runNumber,
          sourceLineId: '0',
          costPerUnitMinorUnits:
            actualOutputQty > 0 ? Math.round(totalCalculatedCostMinor / actualOutputQty) : 0,
          actorId: 'STAFF',
          idempotencyKey: outputIdempotencyKey,
          createdAtUtc: now,
        });
        await movementRepo.save(outputMovement);
      }

      // 3. Create Lot for Finished Goods if lot number or expiry provided
      if (input.outputLotNumber || input.outputExpiryDate) {
        const lotNumber = input.outputLotNumber?.trim() || `LOT-${run.runNumber}`;
        const lot = lotRepo.create({
          storeId,
          productVariantId: run.outputVariantId,
          lotNumber,
          supplierId: null,
          manufactureDateUtc: now,
          expiryDateUtc: input.outputExpiryDate || null,
          unitCostMinorUnits:
            actualOutputQty > 0 ? Math.round(totalCalculatedCostMinor / actualOutputQty) : 0,
          initialQuantity: actualOutputQty,
          currentQuantity: actualOutputQty,
          createdAtUtc: now,
        });
        await lotRepo.save(lot);
      }

      // 4. Mark Production Run COMPLETED
      run.status = 'COMPLETED';
      run.actualOutputQuantity = actualOutputQty;
      run.outputLotNumber = input.outputLotNumber?.trim() || null;
      run.outputExpiryDate = input.outputExpiryDate || null;
      run.totalCostMinorUnits = totalCalculatedCostMinor;
      run.completedAtUtc = now;
      run.updatedAtUtc = now;
      if (input.notes) {
        run.notes = run.notes ? `${run.notes}\n${input.notes}` : input.notes;
      }

      await runRepo.save(run);

      return await this.getProductionRun(run.id);
    });
  }
}
