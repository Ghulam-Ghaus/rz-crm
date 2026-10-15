import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CustomerEntity } from '@bakery/database';
import { Customer, CreateCustomerInput } from '@bakery/contracts';
import { nowUtcString } from '@bakery/shared';

@Injectable()
export class CustomersService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async searchCustomers(storeId: number, query: string): Promise<Customer[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(CustomerEntity);

    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      const customers = await repo.find({
        where: { storeId },
        order: { createdAtUtc: 'DESC' },
        take: 30,
      });
      return customers.map(this.mapToDto);
    }

    const customers = await repo
      .createQueryBuilder('c')
      .where('c.store_id = :storeId', { storeId })
      .andWhere('(LOWER(c.name) LIKE :q OR LOWER(c.phone) LIKE :q OR LOWER(c.code) LIKE :q)', {
        q: `%${trimmed}%`,
      })
      .orderBy('c.created_at_utc', 'DESC')
      .take(30)
      .getMany();

    return customers.map(this.mapToDto);
  }

  public async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(CustomerEntity);

    const storeId = input.storeId ?? 1;
    let code = input.code?.trim();
    if (!code) {
      const count = await repo.count({ where: { storeId } });
      code = `CUST-${String(count + 1).padStart(4, '0')}`;
    }

    const now = nowUtcString();
    const customer = repo.create({
      storeId,
      code,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      createdAtUtc: now,
      updatedAtUtc: now,
    });

    const saved = await repo.save(customer);
    return this.mapToDto(saved);
  }

  public async getCustomerById(id: number): Promise<Customer | null> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(CustomerEntity);
    const found = await repo.findOne({ where: { id } });
    if (!found) return null;
    return this.mapToDto(found);
  }

  public mapToDto(entity: CustomerEntity): Customer {
    return {
      id: entity.id,
      storeId: entity.storeId,
      code: entity.code,
      name: entity.name,
      phone: entity.phone,
      email: entity.email,
      address: entity.address,
      notes: entity.notes,
      createdAtUtc: entity.createdAtUtc,
      updatedAtUtc: entity.updatedAtUtc,
    };
  }
}
