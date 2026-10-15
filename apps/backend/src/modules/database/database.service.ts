import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabaseManager, DatabaseHealthInfo } from '@rz-crm/database';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private manager: DatabaseManager | null = null;

  public setManager(manager: DatabaseManager): void {
    this.manager = manager;
  }

  public getManager(): DatabaseManager {
    if (!this.manager) {
      throw new Error('DatabaseManager has not been initialized');
    }
    return this.manager;
  }

  public getDataSource(): DataSource {
    return this.getManager().getDataSource();
  }

  public async getHealth(): Promise<DatabaseHealthInfo> {
    if (!this.manager) {
      return {
        status: 'down',
        driver: 'better-sqlite3',
        filePath: 'unassigned',
        foreignKeysEnabled: false,
        journalMode: 'unknown',
        integrityOk: false,
        currentSchemaVersion: null,
      };
    }
    return this.manager.getHealth();
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.manager) {
      await this.manager.close();
      this.manager = null;
    }
  }
}
