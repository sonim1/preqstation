import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

import { withAdminDb, withOwnerDb } from '@/lib/db/rls';
import { oauthCodes } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { assignOAuthClientOwner, createOrRefreshMcpConnection } from '@/lib/mcp/connections';

export const MCP_OAUTH_LOGIN_COOKIE_NAME = 'pm_mcp_oauth';
export const MCP_OAUTH_CODE_MAX_AGE_SECONDS = 60 * 10;
export const MCP_ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type PendingMcpLoginRequest = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
};

type McpAccessTokenPayload = {
  sub: string;
  email: string;
  isOwner: boolean;
  connectionId: string;
  exp: number;
};

function encodeBase64Url(input: string) {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function bytesToBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sign(data: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEquals(a: string, b: string) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  const { timingSafeEqual } = require('crypto') as typeof import('crypto');
  return timingSafeEqual(bufA, bufB);
}

async function sha256Base64Url(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return bytesToBase64Url(new Uint8Array(digest));
}

function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function redirectUrisMatch(expected: string, actual: string) {
  if (expected === actual) return true;

  try {
    const expectedUrl = new URL(expected);
    const actualUrl = new URL(actual);

    const sameLocation =
      expectedUrl.protocol === actualUrl.protocol &&
      expectedUrl.port === actualUrl.port &&
      expectedUrl.pathname === actualUrl.pathname &&
      expectedUrl.search === actualUrl.search &&
      expectedUrl.hash === actualUrl.hash;

    if (!sameLocation) return false;

    if (expectedUrl.hostname === actualUrl.hostname) return true;

    return isLoopbackHostname(expectedUrl.hostname) && isLoopbackHostname(actualUrl.hostname);
  } catch {
    return false;
  }
}

export async function setMcpLoginRequestCookie(input: PendingMcpLoginRequest) {
  const cookieStore = await cookies();
  cookieStore.set(MCP_OAUTH_LOGIN_COOKIE_NAME, JSON.stringify(input), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MCP_OAUTH_CODE_MAX_AGE_SECONDS,
  });
}

export async function consumeMcpLoginRequestCookie(): Promise<PendingMcpLoginRequest | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MCP_OAUTH_LOGIN_COOKIE_NAME)?.value;

  cookieStore.set(MCP_OAUTH_LOGIN_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingMcpLoginRequest;
    if (
      !parsed.clientId ||
      !parsed.redirectUri ||
      !parsed.codeChallenge ||
      !parsed.codeChallengeMethod
    ) {
      return null;
    }
    return {
      clientId: parsed.clientId,
      redirectUri: parsed.redirectUri,
      state: parsed.state || '',
      codeChallenge: parsed.codeChallenge,
      codeChallengeMethod: parsed.codeChallengeMethod,
    };
  } catch {
    return null;
  }
}

export async function issueMcpAuthorizationCode(input: {
  userId: string;
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
}) {
  const oauthClient = await assignOAuthClientOwner({
    clientId: input.clientId,
    ownerId: input.userId,
  });
  if (!oauthClient) return null;
  if (!oauthClient.redirectUris.some((value) => redirectUrisMatch(value, input.redirectUri))) {
    return null;
  }

  const code = crypto.randomUUID();

  await withOwnerDb(input.userId, async (client) => {
    await client.insert(oauthCodes).values({
      code,
      userId: input.userId,
      clientId: input.clientId,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      redirectUri: input.redirectUri,
      expiresAt: new Date(Date.now() + MCP_OAUTH_CODE_MAX_AGE_SECONDS * 1000),
    });
  });

  return code;
}

async function signMcpAccessToken(payload: Omit<McpAccessTokenPayload, 'exp'>) {
  const tokenPayload: McpAccessTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + MCP_ACCESS_TOKEN_MAX_AGE_SECONDS,
  };

  const payloadRaw = JSON.stringify(tokenPayload);
  const payloadB64 = encodeBase64Url(payloadRaw);
  const sig = await sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifyMcpAccessToken(token?: string | null) {
  if (!token) return null;
  if ((token.match(/\./g) || []).length !== 1) return null;

  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expected = await sign(payloadB64);
  if (!safeEquals(sig, expected)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(payloadB64)) as McpAccessTokenPayload;
    if (
      !payload.sub ||
      !payload.email ||
      !payload.isOwner ||
      !payload.connectionId ||
      !payload.exp
    ) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function exchangeMcpAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  return withAdminDb(async (client) => {
    const record = await client.query.oauthCodes.findFirst({
      where: eq(oauthCodes.code, input.code),
      columns: {
        code: true,
        clientId: true,
        codeChallenge: true,
        codeChallengeMethod: true,
        redirectUri: true,
        expiresAt: true,
      },
      with: {
        client: {
          columns: {
            clientId: true,
            clientName: true,
          },
        },
        user: {
          columns: {
            id: true,
            email: true,
            isOwner: true,
          },
        },
      },
    });

    if (!record?.user?.isOwner) return null;
    if (!record.clientId || !record.client) return null;
    if (!redirectUrisMatch(record.redirectUri, input.redirectUri)) return null;
    if (record.expiresAt.getTime() < Date.now()) return null;
    if (record.codeChallengeMethod !== 'S256') return null;

    const expectedChallenge = await sha256Base64Url(input.codeVerifier);
    if (!safeEquals(expectedChallenge, record.codeChallenge)) return null;

    await client.delete(oauthCodes).where(eq(oauthCodes.code, input.code));

    const expiresAt = new Date(Date.now() + MCP_ACCESS_TOKEN_MAX_AGE_SECONDS * 1000);
    const connection = await createOrRefreshMcpConnection({
      ownerId: record.user.id,
      clientId: record.clientId,
      clientName: record.client.clientName,
      redirectUri: record.redirectUri,
      expiresAt,
    });

    const accessToken = await signMcpAccessToken({
      sub: record.user.id,
      email: record.user.email,
      isOwner: record.user.isOwner,
      connectionId: connection.id,
    });

    return {
      accessToken,
      expiresIn: MCP_ACCESS_TOKEN_MAX_AGE_SECONDS,
    };
  });
}

export function buildMcpAuthorizationRedirect(redirectUri: string, code: string, state: string) {
  const target = new URL(redirectUri);
  target.searchParams.set('code', code);
  if (state) {
    target.searchParams.set('state', state);
  }
  return target.toString();
}
