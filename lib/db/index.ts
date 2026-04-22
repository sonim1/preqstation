import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { requireDatabaseUrl } from '@/lib/database-url';

import * as relations from './relations';
import * as schema from './schema';

// Disable prepared statements so pooled managed Postgres endpoints work consistently.
const client = postgres(requireDatabaseUrl(process.env), { prepare: false });
export const db = drizzle({ client, schema: { ...schema, ...relations } });
export const adminDb = db;
