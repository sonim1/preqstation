import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { requireDatabaseUrl } from '@/lib/database-url';

import * as relations from './relations';
import * as schema from './schema';

function createDb() {
  // Disable prepared statements so pooled managed Postgres endpoints work consistently.
  const client = postgres(requireDatabaseUrl(process.env), { prepare: false });
  return drizzle({ client, schema: { ...schema, ...relations } });
}

type Database = ReturnType<typeof createDb>;

let cachedDb: Database | null = null;

export function getDb() {
  cachedDb ??= createDb();
  return cachedDb;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = getDb();
    const value = Reflect.get(database, property, database);
    return typeof value === 'function' ? value.bind(database) : value;
  },
}) as Database;
export const adminDb = db;
