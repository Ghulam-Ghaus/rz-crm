import { z } from 'zod';
import { AppPaths, resolveAppPaths } from './paths.js';

export const AppConfigSchema = z.object({
  environment: z.enum(['development', 'test', 'production']),
  appVersion: z.string().default('0.1.0'),
  database: z.object({
    filePath: z.string(),
    busyTimeoutMs: z.number().int().positive().default(5000),
    synchronize: z.literal(false),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function createDefaultConfig(overrideBaseDir?: string): {
  config: AppConfig;
  paths: AppPaths;
} {
  const paths = resolveAppPaths(overrideBaseDir);
  const environment =
    (process.env.NODE_ENV as 'development' | 'test' | 'production') || 'development';

  const config: AppConfig = {
    environment,
    appVersion: '0.1.0',
    database: {
      filePath: paths.databasePath,
      busyTimeoutMs: 5000,
      synchronize: false,
    },
  };

  return { config, paths };
}
