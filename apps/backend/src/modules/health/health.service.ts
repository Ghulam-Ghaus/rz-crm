import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { HealthCheckResponse } from '@bakery/contracts';

export interface HostElectronContext {
  version: string;
  platform: string;
  arch: string;
  userDataPath: string;
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(private readonly databaseService: DatabaseService) {}

  public async checkHealth(hostInfo?: Partial<HostElectronContext>): Promise<HealthCheckResponse> {
    const startCheckTime = performance.now();
    const dbHealth = await this.databaseService.getHealth();

    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const isDbOk = dbHealth.status === 'ok' && dbHealth.integrityOk && dbHealth.foreignKeysEnabled;

    let overallStatus: 'ok' | 'degraded' | 'unhealthy' = 'ok';
    if (!isDbOk) {
      overallStatus = 'unhealthy';
    } else if (dbHealth.journalMode !== 'wal') {
      overallStatus = 'degraded';
    }

    const latencyMs = Math.round((performance.now() - startCheckTime) * 100) / 100;

    return {
      status: overallStatus,
      electron: {
        version: hostInfo?.version ?? process.versions.electron ?? 'development',
        platform: hostInfo?.platform ?? process.platform,
        arch: hostInfo?.arch ?? process.arch,
        userDataPath: hostInfo?.userDataPath ?? 'test',
      },
      nestjs: {
        status: 'ok',
        uptimeSeconds,
      },
      database: {
        status: dbHealth.status,
        driver: dbHealth.driver,
        filePath: dbHealth.filePath,
        foreignKeysEnabled: dbHealth.foreignKeysEnabled,
        journalMode: dbHealth.journalMode,
        integrityOk: dbHealth.integrityOk,
        currentSchemaVersion: dbHealth.currentSchemaVersion,
      },
      timestamp: new Date().toISOString(),
      latencyMs,
    };
  }
}
