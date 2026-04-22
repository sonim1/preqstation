import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

describe('db runtime boundaries', () => {
  it('keeps db-backed modules out of proxy and client import chains', () => {
    const authFile = readProjectFile('lib/auth.ts');
    const kanbanHelpersFile = readProjectFile('lib/kanban-helpers.ts');

    expect(authFile).not.toContain("from '@/lib/security-events'");
    expect(kanbanHelpersFile).not.toContain("from '@/lib/task-labels'");
    expect(kanbanHelpersFile).toContain("from '@/lib/task-label-utils'");
  });

  it('defines db-backed auth and oauth schema types', () => {
    const schemaFile = readProjectFile('lib/db/schema.ts');
    const typesFile = readProjectFile('lib/db/types.ts');

    expect(schemaFile).toContain("passwordHash: text('password_hash')");
    expect(schemaFile).toContain('export const oauthCodes = pgTable(');
    expect(typesFile).toContain(
      'export type InsertOauthCode = typeof schema.oauthCodes.$inferInsert;',
    );
    expect(typesFile).toContain(
      'export type SelectOauthCode = typeof schema.oauthCodes.$inferSelect;',
    );
  });
});
