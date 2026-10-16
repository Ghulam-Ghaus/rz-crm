import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AuditLogEntity } from '@rz-crm/database';
import {
  AuditLog,
  CreateAuditLogInput,
  ListAuditLogsQuery,
  ListAuditLogsResponse,
  AuditSummaryStats,
  AuditSeverity,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class AuditService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Determine action severity based on operation risk
   */
  private computeSeverity(action: string, customSeverity?: AuditSeverity): AuditSeverity {
    if (customSeverity) return customSeverity;

    const act = action.toUpperCase();
    if (
      act.includes('DELETE') ||
      act.includes('RESTORE') ||
      act.includes('VOID') ||
      act.includes('FAIL') ||
      act.includes('LOCKOUT') ||
      act.includes('PURGE')
    ) {
      return 'CRITICAL';
    }

    if (
      act.includes('ADJUST') ||
      act.includes('OVERRIDE') ||
      act.includes('RETURN') ||
      act.includes('DISCOUNT') ||
      act.includes('CLOSE') ||
      act.includes('PAYOUT')
    ) {
      return 'WARN';
    }

    return 'INFO';
  }

  /**
   * Append an immutable audit entry
   */
  public async log(input: CreateAuditLogInput): Promise<AuditLog> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(AuditLogEntity);

    const severity = this.computeSeverity(input.action, input.severity);
    const detailsObj = {
      ...(input.details || {}),
      _severity: severity,
    };

    const entry = repo.create({
      userId: input.userId ?? null,
      username: input.username ?? 'system',
      action: input.action,
      resource: input.resource ?? null,
      detailsJson: JSON.stringify(detailsObj),
      createdAtUtc: input.createdAtUtc || nowUtcString(),
    });

    const saved = await repo.save(entry);
    return this.mapToDto(saved);
  }

  /**
   * Query filtered audit logs with pagination
   */
  public async listLogs(query?: ListAuditLogsQuery): Promise<ListAuditLogsResponse> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(AuditLogEntity);

    const qb = repo.createQueryBuilder('a');

    if (query?.userId) {
      qb.andWhere('a.user_id = :userId', { userId: query.userId });
    }

    if (query?.action) {
      qb.andWhere('LOWER(a.action) LIKE LOWER(:action)', { action: `%${query.action}%` });
    }

    if (query?.resource) {
      qb.andWhere('LOWER(a.resource) = LOWER(:resource)', { resource: query.resource });
    }

    if (query?.startDate) {
      qb.andWhere('a.created_at_utc >= :startDate', { startDate: query.startDate });
    }

    if (query?.endDate) {
      qb.andWhere('a.created_at_utc <= :endDate', { endDate: query.endDate });
    }

    if (query?.search && query.search.trim()) {
      const q = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(a.action) LIKE :q OR LOWER(COALESCE(a.username, "")) LIKE :q OR LOWER(COALESCE(a.resource, "")) LIKE :q OR LOWER(COALESCE(a.details_json, "")) LIKE :q)',
        { q },
      );
    }

    if (query?.category && query.category !== 'ALL') {
      const cat = query.category;
      if (cat === 'AUTH') {
        qb.andWhere('(a.action LIKE :p1 OR a.action LIKE :p2)', { p1: 'AUTH_%', p2: '%LOGIN%' });
      } else if (cat === 'SALES_AND_PRICING') {
        qb.andWhere('(a.action LIKE :p1 OR a.action LIKE :p2 OR a.action LIKE :p3)', {
          p1: 'SALE_%',
          p2: '%PRICE%',
          p3: '%DISCOUNT%',
        });
      } else if (cat === 'INVENTORY_AND_STOCK') {
        qb.andWhere('(a.action LIKE :p1 OR a.action LIKE :p2)', { p1: 'STOCK_%', p2: 'INVENTORY_%' });
      } else if (cat === 'PURCHASING_AND_RETURNS') {
        qb.andWhere('(a.action LIKE :p1 OR a.action LIKE :p2)', { p1: 'PURCHASE_%', p2: 'RETURN_%' });
      } else if (cat === 'FINANCE_AND_PAYROLL') {
        qb.andWhere('(a.action LIKE :p1 OR a.action LIKE :p2)', { p1: 'EXPENSE_%', p2: 'PAYROLL_%' });
      } else if (cat === 'STAKEHOLDERS_AND_EQUITY') {
        qb.andWhere('a.action LIKE :p1', { p1: 'STAKEHOLDER_%' });
      } else if (cat === 'SYSTEM_AND_BACKUP') {
        qb.andWhere('(a.action LIKE :p1 OR a.action LIKE :p2 OR a.action LIKE :p3)', {
          p1: 'BACKUP_%',
          p2: 'SETTING_%',
          p3: 'SYSTEM_%',
        });
      }
    }

    const totalCount = await qb.getCount();

    const limit = query?.limit ?? 100;
    const offset = query?.offset ?? 0;

    const entities = await qb
      .orderBy('a.created_at_utc', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    const dtos = entities.map(e => this.mapToDto(e));

    // Optional severity in-memory filtering if requested
    const filtered = query?.severity
      ? dtos.filter(d => d.severity === query.severity)
      : dtos;

    return {
      logs: filtered,
      totalCount,
    };
  }

  /**
   * Get high-level audit summary metrics
   */
  public async getSummaryStats(): Promise<AuditSummaryStats> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(AuditLogEntity);

    const totalAuditCount = await repo.count();

    const authEventsCount = await repo
      .createQueryBuilder('a')
      .where('a.action LIKE :p1 OR a.action LIKE :p2', { p1: 'AUTH_%', p2: '%LOGIN%' })
      .getCount();

    const failedLoginsCount = await repo
      .createQueryBuilder('a')
      .where('a.action LIKE :p1', { p1: '%LOGIN_FAILED%' })
      .getCount();

    const stockAdjustmentsCount = await repo
      .createQueryBuilder('a')
      .where('a.action LIKE :p1', { p1: '%STOCK_ADJUST%' })
      .getCount();

    const priceOverridesCount = await repo
      .createQueryBuilder('a')
      .where('a.action LIKE :p1 OR a.action LIKE :p2', { p1: '%PRICE_OVERRIDE%', p2: '%DISCOUNT%' })
      .getCount();

    const criticalEventsCount = await repo
      .createQueryBuilder('a')
      .where(
        '(a.action LIKE :p1 OR a.action LIKE :p2 OR a.action LIKE :p3 OR a.action LIKE :p4 OR a.details_json LIKE :p5)',
        {
          p1: '%VOID%',
          p2: '%RESTORE%',
          p3: '%DELETE%',
          p4: '%LOCKOUT%',
          p5: '%"CRITICAL"%',
        },
      )
      .getCount();

    const lastLog = await repo.findOne({
      order: { createdAtUtc: 'DESC' },
    });

    return {
      totalAuditCount,
      authEventsCount,
      failedLoginsCount,
      stockAdjustmentsCount,
      priceOverridesCount,
      criticalEventsCount,
      lastActivityUtc: lastLog?.createdAtUtc || null,
    };
  }

  /**
   * Export all matching audit logs (up to 5000 records)
   */
  public async exportLogs(query?: ListAuditLogsQuery): Promise<AuditLog[]> {
    const res = await this.listLogs({ ...query, limit: 5000, offset: 0 });
    return res.logs;
  }

  private mapToDto(entity: AuditLogEntity): AuditLog {
    let severity: AuditSeverity = 'INFO';
    if (entity.detailsJson) {
      try {
        const parsed = JSON.parse(entity.detailsJson);
        if (parsed._severity) {
          severity = parsed._severity;
        } else {
          severity = this.computeSeverity(entity.action);
        }
      } catch {
        severity = this.computeSeverity(entity.action);
      }
    } else {
      severity = this.computeSeverity(entity.action);
    }

    return {
      id: entity.id,
      userId: entity.userId ?? null,
      username: entity.username ?? 'system',
      action: entity.action,
      resource: entity.resource ?? null,
      detailsJson: entity.detailsJson ?? null,
      severity,
      createdAtUtc: entity.createdAtUtc,
    };
  }
}
