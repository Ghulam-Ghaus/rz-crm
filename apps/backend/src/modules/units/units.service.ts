import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { UnitEntity, UnitConversionEntity } from '@bakery/database';
import { Unit, UnitConversion, CreateUnitInput } from '@bakery/contracts';

@Injectable()
export class UnitsService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getUnits(): Promise<Unit[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(UnitEntity);
    const records = await repo.find({ order: { dimension: 'ASC', code: 'ASC' } });

    return records.map((u) => ({
      id: u.id,
      code: u.code,
      name: u.name,
      dimension: u.dimension,
      precision: u.precision,
      isBase: u.isBase,
      createdAtUtc: u.createdAtUtc,
      updatedAtUtc: u.updatedAtUtc,
    }));
  }

  public async createUnit(input: CreateUnitInput): Promise<Unit> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(UnitEntity);

    const normalizedCode = input.code.trim().toLowerCase();
    const existing = await repo.findOne({ where: { code: normalizedCode } });
    if (existing) {
      throw new Error(`Unit with code '${normalizedCode}' already exists`);
    }

    const now = new Date().toISOString();
    const unit = repo.create({
      code: normalizedCode,
      name: input.name.trim(),
      dimension: input.dimension ?? 'COUNT',
      precision: input.precision ?? 0,
      isBase: input.isBase ?? false,
      createdAtUtc: now,
      updatedAtUtc: now,
    });

    await repo.save(unit);

    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      dimension: unit.dimension,
      precision: unit.precision,
      isBase: unit.isBase,
      createdAtUtc: unit.createdAtUtc,
      updatedAtUtc: unit.updatedAtUtc,
    };
  }

  public async getConversions(): Promise<UnitConversion[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(UnitConversionEntity);
    const records = await repo.find();

    return records.map((c) => ({
      id: c.id,
      fromUnitCode: c.fromUnitCode,
      toUnitCode: c.toUnitCode,
      multiplier: c.multiplier,
      dimension: c.dimension,
      createdAtUtc: c.createdAtUtc,
    }));
  }
}

