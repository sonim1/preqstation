import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

describe('neon maintenance removal', () => {
  it('removes Neon-specific maintenance wiring from the app', () => {
    const settingsPage = readProjectFile('app/(workspace)/(main)/settings/page.tsx');
    const envFile = readProjectFile('lib/env.ts');

    expect(settingsPage).not.toContain('Configure Outbox Cleanup Cron');
    expect(settingsPage).not.toContain('Database Maintenance');
    expect(settingsPage).not.toContain('MaintenanceCronForm');
    expect(settingsPage).not.toContain('setupEventOutboxCleanupCron');

    expect(envFile).not.toContain('NEON_API_KEY');
    expect(envFile).not.toContain('NEON_PROJECT_ID');
    expect(envFile).not.toContain('NEON_ENDPOINT_ID');

    expect(fs.existsSync(path.join(rootDir, 'lib/neon-cron.ts'))).toBe(false);
  });
});
