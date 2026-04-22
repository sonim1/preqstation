import { describe, expect, it } from 'vitest';

import { GET } from '@/app/.well-known/oauth-authorization-server/route';

import { TEST_BASE_URL } from './test-utils';

describe('app/.well-known/oauth-authorization-server/route', () => {
  it('advertises dynamic client registration for public clients', async () => {
    const response = await GET(
      new Request(`${TEST_BASE_URL}/.well-known/oauth-authorization-server`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      issuer: TEST_BASE_URL,
      authorization_endpoint: `${TEST_BASE_URL}/api/oauth/authorize`,
      token_endpoint: `${TEST_BASE_URL}/api/oauth/token`,
      registration_endpoint: `${TEST_BASE_URL}/api/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
    });
  });
});
