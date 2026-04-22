type DatabaseEnv = Record<string, string | undefined>;

export function requireDatabaseUrl(env: DatabaseEnv = process.env) {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required.');
  }

  return url;
}
