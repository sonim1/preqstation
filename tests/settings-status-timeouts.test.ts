import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const timezoneSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/timezone-settings.tsx'),
  'utf8',
);
const kitchenSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/kitchen-mode-settings.tsx'),
  'utf8',
);
const syncSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/sync-settings.tsx'),
  'utf8',
);

describe('settings success-status timer cleanup', () => {
  it('cleans up transient success timers in save-on-change settings controls', () => {
    expect(timezoneSource).toContain('clearTimeout');
    expect(kitchenSource).toContain('clearTimeout');
    expect(syncSource).toContain('clearTimeout');
  });
});
