import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

describe('db adapter neutrality', () => {
  it('uses a generic postgres drizzle adapter instead of Neon-specific wiring', () => {
    const dbIndex = readProjectFile('lib/db/index.ts');
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      dependencies?: Record<string, string>;
    };

    expect(dbIndex).not.toContain('@neondatabase/serverless');
    expect(dbIndex).not.toContain('drizzle-orm/neon-serverless');
    expect(dbIndex).toContain("from 'drizzle-orm/postgres-js'");
    expect(dbIndex).toContain("from 'postgres'");

    expect(packageJson.dependencies).not.toHaveProperty('@neondatabase/serverless');
    expect(packageJson.dependencies).toHaveProperty('postgres');
  });
});
