import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { DatabaseService } from './modules/database/database.service.js';
import { DatabaseManager } from '@bakery/database';
import { resolveAppPaths, ensureAppDirectories } from '@bakery/config';

export interface BackendBootstrapOptions {
  dbPath?: string;
  runMigrations?: boolean;
  baseDir?: string;
}

export interface ActiveBackend {
  appContext: INestApplicationContext;
  dbManager: DatabaseManager;
  dbPath: string;
}

/**
 * Bootstraps the NestJS application context (headless, no HTTP listener)
 * within the Electron main process.
 */
export async function bootstrapBackend(options?: BackendBootstrapOptions): Promise<ActiveBackend> {
  const paths = resolveAppPaths(options?.baseDir);
  ensureAppDirectories(paths);

  const dbPath = options?.dbPath ?? paths.databasePath;

  // 1. Initialize Database Manager with SQLite pragmas & connection
  const dbManager = new DatabaseManager({
    filePath: dbPath,
    busyTimeoutMs: 5000,
    logging: process.env.NODE_ENV === 'development',
  });

  await dbManager.initialize();

  // 2. Run pending migrations if requested or on first startup
  if (options?.runMigrations ?? true) {
    await dbManager.runMigrations();
  }

  // 3. Create NestJS headless Application Context (NO HTTP SERVER)
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // 4. Inject initialized DatabaseManager into DatabaseService
  const dbService = appContext.get(DatabaseService);
  dbService.setManager(dbManager);

  return {
    appContext,
    dbManager,
    dbPath,
  };
}
