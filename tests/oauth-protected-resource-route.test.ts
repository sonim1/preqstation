import { describe, expect, it } from 'vitest';

import { GET as mcpGET } from '@/app/.well-known/oauth-protected-resource/mcp/route';
import { GET as rootGET } from '@/app/.well-known/oauth-protected-resource/route';

import { TEST_BASE_URL } from './test-utils';

const expectedMetadata = {
  resource: `${TEST_BASE_URL}/mcp`,
  authorization_servers: [TEST_BASE_URL],
  bearer_methods_supported: ['header'],
};

describe('app/.well-known/oauth-protected-resource/route', () => {
  it('returns MCP protected resource metadata from the root well-known fallback', async () => {
    const response = await rootGET(
      new Request(`${TEST_BASE_URL}/.well-known/oauth-protected-resource`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expectedMetadata);
  });
});

describe('app/.well-known/oauth-protected-resource/mcp/route', () => {
  it('returns MCP protected resource metadata from the path-aware well-known route', async () => {
    const response = await mcpGET(
      new Request(`${TEST_BASE_URL}/.well-known/oauth-protected-resource/mcp`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expectedMetadata);
  });
});
