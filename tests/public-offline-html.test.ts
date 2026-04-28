import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('public/offline.html', () => {
  it('ships English fallback copy and both recovery actions', async () => {
    const offlineHtml = await readFile(new URL('../public/offline.html', import.meta.url), 'utf8');

    expect(offlineHtml).toContain('You are offline');
    expect(offlineHtml).toContain('Projects are unavailable while you are offline.');
    expect(offlineHtml).toContain('This board has not been saved for offline use yet.');
    expect(offlineHtml).toContain('Retry');
    expect(offlineHtml).toContain('Back to Main');
    expect(offlineHtml).toContain('Back to Board');
    expect(offlineHtml).toContain('location.pathname');
  });
});
