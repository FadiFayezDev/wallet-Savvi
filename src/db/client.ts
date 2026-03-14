import * as SQLite from 'expo-sqlite';

import { migrations } from '@/src/db/migrations';

const DB_NAME = 'savvi.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

type DbLike = SQLite.SQLiteDatabase & {
  runAsync: (sql: string, params?: unknown[] | Record<string, unknown>) => Promise<unknown>;
  getAllAsync: <T>(sql: string, params?: unknown[] | Record<string, unknown>) => Promise<T[]>;
  getFirstAsync: <T>(sql: string, params?: unknown[] | Record<string, unknown>) => Promise<T | null>;
};

const asDbLike = (db: SQLite.SQLiteDatabase) => db as DbLike;

async function runMigrations(db: SQLite.SQLiteDatabase) {
  const typedDb = asDbLike(db);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = await typedDb.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC;',
  );
  const appliedVersions = new Set(applied.map((row) => row.version));

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;

    await db.execAsync('BEGIN TRANSACTION;');
    try {
      await db.execAsync(migration.sql);
      await typedDb.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
        [migration.version, migration.name, new Date().toISOString()],
      );
      await db.execAsync('COMMIT;');
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      throw error;
    }
  }
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await runMigrations(db);
      return db;
    })();
  }

  return dbPromise;
}

export async function initializeDatabase() {
  await getDb();
}

export async function runQuery(sql: string, params: unknown[] = [], dbArg?: SQLite.SQLiteDatabase) {
  const db = dbArg ?? (await getDb());
  const typedDb = asDbLike(db);
  return typedDb.runAsync(sql, params);
}

export async function getAll<T>(sql: string, params: unknown[] = [], dbArg?: SQLite.SQLiteDatabase) {
  const db = dbArg ?? (await getDb());
  const typedDb = asDbLike(db);
  return typedDb.getAllAsync<T>(sql, params);
}

export async function getFirst<T>(sql: string, params: unknown[] = [], dbArg?: SQLite.SQLiteDatabase) {
  const db = dbArg ?? (await getDb());
  const typedDb = asDbLike(db);
  return typedDb.getFirstAsync<T>(sql, params);
}

export async function runInTransaction<T>(
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    const result = await fn(db);
    await db.execAsync('COMMIT;');
    return result;
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}
