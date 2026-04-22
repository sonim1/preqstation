import { and, eq, gt, isNull, or } from 'drizzle-orm';

import { withAdminDb, withOwnerDb } from '@/lib/db/rls';
import { apiTokens } from '@/lib/db/schema';
import { env } from '@/lib/env';

const INTERNAL_API_TOKEN_PREFIX = 'pmint_';
const INTERNAL_API_TOKEN_MAX_AGE_SECONDS = 60 * 10;

function bytesToBase64Url(bytes: Uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

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

function safeEquals(a: string, b: string) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  const { timingSafeEqual } = require('crypto') as typeof import('crypto');
  return timingSafeEqual(bufA, bufB);
}

async function signInternalToken(data: string) {
  const payload = new TextEncoder().encode(`${env.AUTH_SECRET}:${data}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomTokenPart(size = 24) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function buildRawApiToken() {
  return `preq_${randomTokenPart(24)}`;
}

export async function hashApiToken(rawToken: string) {
  const payload = new TextEncoder().encode(`${env.AUTH_SECRET}:${rawToken}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return toHex(new Uint8Array(digest));
}

export async function createInternalApiToken(input: {
  ownerId: string;
  ownerEmail: string;
  tokenName?: string;
}) {
  const payloadB64 = encodeBase64Url(
    JSON.stringify({
      ownerId: input.ownerId,
      ownerEmail: input.ownerEmail,
      tokenName: input.tokenName || 'MCP OAuth',
      exp: Math.floor(Date.now() / 1000) + INTERNAL_API_TOKEN_MAX_AGE_SECONDS,
    }),
  );
  const sig = await signInternalToken(payloadB64);
  return `${INTERNAL_API_TOKEN_PREFIX}${payloadB64}.${sig}`;
}

async function verifyInternalApiToken(token: string) {
  if (!token.startsWith(INTERNAL_API_TOKEN_PREFIX)) return null;

  const encoded = token.slice(INTERNAL_API_TOKEN_PREFIX.length);
  if ((encoded.match(/\./g) || []).length !== 1) return null;

  const [payloadB64, sig] = encoded.split('.');
  if (!payloadB64 || !sig) return null;

  const expected = await signInternalToken(payloadB64);
  if (!safeEquals(sig, expected)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(payloadB64)) as {
      ownerId: string;
      ownerEmail: string;
      tokenName?: string;
      exp: number;
    };

    if (!payload.ownerId || !payload.ownerEmail || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      tokenId: 'internal-mcp',
      tokenName: payload.tokenName || 'MCP OAuth',
      ownerId: payload.ownerId,
      ownerEmail: payload.ownerEmail,
    };
  } catch {
    return null;
  }
}

export function extractBearerToken(req: Request) {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  const normalized = token.trim();
  return normalized || null;
}

export async function issueApiToken(params: {
  ownerId: string;
  name: string;
  expiresAt?: Date | null;
}) {
  const rawToken = buildRawApiToken();
  const tokenHash = await hashApiToken(rawToken);
  const tokenPrefix = rawToken.slice(0, 14);

  return withOwnerDb(params.ownerId, async (client) => {
    const [record] = await client
      .insert(apiTokens)
      .values({
        ownerId: params.ownerId,
        name: params.name,
        tokenPrefix,
        tokenHash,
        expiresAt: params.expiresAt ?? null,
      })
      .returning({
        id: apiTokens.id,
        ownerId: apiTokens.ownerId,
        name: apiTokens.name,
        tokenPrefix: apiTokens.tokenPrefix,
        lastUsedAt: apiTokens.lastUsedAt,
        expiresAt: apiTokens.expiresAt,
        revokedAt: apiTokens.revokedAt,
        createdAt: apiTokens.createdAt,
      });

    return { token: rawToken, record };
  });
}

export async function authenticateApiToken(req: Request) {
  const token = extractBearerToken(req);
  if (!token) return null;

  const internalAuth = await verifyInternalApiToken(token);
  if (internalAuth) return internalAuth;

  const tokenHash = await hashApiToken(token);
  const now = new Date();

  return withAdminDb(async (client) => {
    const record = await client.query.apiTokens.findFirst({
      where: and(
        eq(apiTokens.tokenHash, tokenHash),
        isNull(apiTokens.revokedAt),
        or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now)),
      ),
      columns: {
        id: true,
        name: true,
      },
      with: {
        owner: {
          columns: { id: true, email: true },
        },
      },
    });

    if (!record) return null;

    // Update usage timestamp as a best-effort side effect.
    void client
      .update(apiTokens)
      .set({ lastUsedAt: now })
      .where(eq(apiTokens.id, record.id))
      .catch(() => null);

    return {
      tokenId: record.id,
      tokenName: record.name,
      ownerId: record.owner.id,
      ownerEmail: record.owner.email,
    };
  });
}
