import Database from 'better-sqlite3';
import fs from 'node:fs';
import { assertRzCrmDatabase } from './identity-guard.js';
import type { RestoreDrillResult } from '@rz-crm/contracts';

/**
 * Executes an isolated, read-only restore drill on a candidate backup snapshot.
 * Verifies app identity, runs SQLite PRAGMA integrity_check and PRAGMA foreign_key_check,
 * audits all table counts, and returns a comprehensive health report without mutating live production state.
 */
export async function simulateRestoreDrill(
  snapshotPath: string,
  filename: string
): Promise<RestoreDrillResult> {
  const startTime = Date.now();

  if (!fs.existsSync(snapshotPath)) {
    return {
      snapshotFilename: filename,
      drillExecutedAtUtc: new Date().toISOString(),
      passed: false,
      integrityCheckResult: 'Snapshot file not found on disk',
      foreignKeyCheckPassed: false,
      tablesVerifiedCount: 0,
      recordCounts: {},
      durationMs: Date.now() - startTime,
      message: `File '${filename}' does not exist on disk.`,
    };
  }

  // 1. Identity Guard Check
  try {
    assertRzCrmDatabase(snapshotPath);
  } catch (err: any) {
    return {
      snapshotFilename: filename,
      drillExecutedAtUtc: new Date().toISOString(),
      passed: false,
      integrityCheckResult: err?.message || 'Database identity verification failed',
      foreignKeyCheckPassed: false,
      tablesVerifiedCount: 0,
      recordCounts: {},
      durationMs: Date.now() - startTime,
      message: `Identity guard rejected file: ${err?.message}`,
    };
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(snapshotPath, { readonly: true, fileMustExist: true });

    // 2. PRAGMA integrity_check
    const integrityRows = db.prepare('PRAGMA integrity_check;').all() as Array<{ integrity_check: string }>;
    const integrityOk = integrityRows.length === 1 && integrityRows[0]?.integrity_check === 'ok';
    const integrityText = integrityRows.map((r) => r.integrity_check).join('; ') || 'unknown';

    // 3. PRAGMA foreign_key_check
    const fkRows = db.prepare('PRAGMA foreign_key_check;').all() as Array<any>;
    const foreignKeyCheckPassed = fkRows.length === 0;

    // 4. Tables and record counts
    const tableRows = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;`)
      .all() as Array<{ name: string }>;

    const recordCounts: Record<string, number> = {};
    for (const table of tableRows) {
      try {
        const countRow = db.prepare(`SELECT COUNT(*) as count FROM "${table.name}";`).get() as { count: number };
        recordCounts[table.name] = Number(countRow?.count ?? 0);
      } catch {
        recordCounts[table.name] = -1;
      }
    }

    const passed = integrityOk && foreignKeyCheckPassed;
    const durationMs = Date.now() - startTime;

    return {
      snapshotFilename: filename,
      drillExecutedAtUtc: new Date().toISOString(),
      passed,
      integrityCheckResult: integrityText,
      foreignKeyCheckPassed,
      tablesVerifiedCount: tableRows.length,
      recordCounts,
      durationMs,
      message: passed
        ? `Simulation passed: All ${tableRows.length} tables verified with 0 foreign key violations.`
        : `Simulation failed: ${!integrityOk ? `Integrity check failed (${integrityText}). ` : ''}${!foreignKeyCheckPassed ? `Found ${fkRows.length} foreign key violation(s).` : ''}`,
    };
  } catch (err: any) {
    return {
      snapshotFilename: filename,
      drillExecutedAtUtc: new Date().toISOString(),
      passed: false,
      integrityCheckResult: err?.message || 'Exception occurred during drill execution',
      foreignKeyCheckPassed: false,
      tablesVerifiedCount: 0,
      recordCounts: {},
      durationMs: Date.now() - startTime,
      message: `Drill execution error: ${err?.message}`,
    };
  } finally {
    if (db) {
      db.close();
    }
  }
}
