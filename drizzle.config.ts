import { defineConfig } from 'drizzle-kit';

import { requireDatabaseUrl } from './lib/database-url';
import { loadOptionalEnvFile } from './lib/load-optional-env-file';

loadOptionalEnvFile('.env.local');

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: requireDatabaseUrl(process.env),
  },
});
