import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export const EXPECTED_DB_NAME = 'rz_crm';
const FORBIDDEN_FILE_NAMES = new Set(['bakery.db', 'bakery.sqlite', 'bakery.sqlite3']);

export class DatabaseIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseIdentityError';
  }
}

/**
 * Refuses to open any database that is not an RZ CRM database.
 * Runs BEFORE TypeORM opens the file, using a read-only connection, so a wrong
 * file (for example the legacy bakery.db) is never modified (no WAL pragma, no migrations).
 *
 * Allowed: a missing/empty file (fresh install) or a file stamped app_identity.db_name = 'rz_crm'.
 */
export function assertRzCrmDatabase(filePath: string): void {
  const base = path.basename(filePath).toLowerCase();
  if (FORBIDDEN_FILE_NAMES.has(base)) {
    throw new DatabaseIdentityError(
      `Refusing to open "${base}": it is a legacy Bakery database. RZ CRM only uses rz_crm.db.`
    );
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    return; // fresh database
  }

  const db = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
      .all() as Array<{ name: string }>;

    if (tables.length === 0) return; // empty database

    const hasIdentity = tables.some((t) => t.name === 'app_identity');
    if (!hasIdentity) {
      throw new DatabaseIdentityError(
        `Database "${filePath}" is not an RZ CRM database (no app_identity stamp). Refusing to open or migrate it.`
      );
    }

    const row = db.prepare(`SELECT db_name FROM app_identity WHERE id = 1`).get() as
      | { db_name: string }
      | undefined;
    if (row?.db_name !== EXPECTED_DB_NAME) {
      throw new DatabaseIdentityError(
        `Database "${filePath}" identity is "${row?.db_name ?? 'unknown'}", expected "${EXPECTED_DB_NAME}".`
      );
    }
  } finally {
    db.close();
  }
}
