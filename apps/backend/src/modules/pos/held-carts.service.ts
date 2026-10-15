import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { HeldCartEntity } from '@bakery/database';
import { HeldCart, CreateHeldCartInput } from '@bakery/contracts';
import { nowUtcString } from '@bakery/shared';

@Injectable()
export class HeldCartsService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async holdCart(input: CreateHeldCartInput): Promise<HeldCart> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(HeldCartEntity);

    const storeId = input.storeId ?? 1;
    const count = await repo.count({ where: { storeId } });
    const cartCode = `HOLD-${String(count + 1).padStart(4, '0')}`;
    const now = nowUtcString();

    const heldCart = repo.create({
      storeId,
      cartCode,
      cashierId: input.cashierId || null,
      customerNameOrPhone: input.customerNameOrPhone?.trim() || null,
      cartJson: input.cartJson,
      itemCount: input.itemCount,
      subtotalMinorUnits: input.subtotalMinorUnits,
      notes: input.notes?.trim() || null,
      createdAtUtc: now,
    });

    const saved = await repo.save(heldCart);
    return this.mapToDto(saved);
  }

  public async getHeldCarts(storeId: number): Promise<HeldCart[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(HeldCartEntity);

    const carts = await repo.find({
      where: { storeId },
      order: { createdAtUtc: 'DESC' },
    });

    return carts.map(this.mapToDto);
  }

  public async restoreHeldCart(cartId: number): Promise<HeldCart> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(HeldCartEntity);

    const cart = await repo.findOne({ where: { id: cartId } });
    if (!cart) {
      throw new Error(`Held cart #${cartId} not found.`);
    }

    const dto = this.mapToDto(cart);
    await repo.remove(cart);
    return dto;
  }

  public async discardHeldCart(cartId: number): Promise<void> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(HeldCartEntity);
    await repo.delete({ id: cartId });
  }

  private mapToDto(entity: HeldCartEntity): HeldCart {
    return {
      id: entity.id,
      storeId: entity.storeId,
      cartCode: entity.cartCode,
      cashierId: entity.cashierId,
      customerNameOrPhone: entity.customerNameOrPhone,
      cartJson: entity.cartJson,
      itemCount: entity.itemCount,
      subtotalMinorUnits: entity.subtotalMinorUnits,
      notes: entity.notes,
      createdAtUtc: entity.createdAtUtc,
    };
  }
}
