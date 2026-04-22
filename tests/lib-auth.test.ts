import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER_PASSWORD_HASH = '$2b$10$PSdZJHm2pA.E9a370dBL/OaMQFOBZyZnzPVZkB2tqq84tFvowRasG';
const TEST_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

const cookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

const mocked = vi.hoisted(() => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
  },
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
  withAdminDb: vi.fn(),
  createBrowserSession: vi.fn(),
  getBrowserSessionForOwner: vi.fn(),
  revokeBrowserSession: vi.fn(),
  touchBrowserSession: vi.fn(),
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    AUTH_SECRET: 'test-auth-secret-that-is-long-enough-32chars',
  },
}));

vi.mock('@/lib/db/rls', () => ({
  withAdminDb: mocked.withAdminDb,
}));

vi.mock('@/lib/security-events', () => ({
  writeSecurityEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/browser-sessions', () => ({
  BROWSER_SESSION_MAX_AGE_SECONDS: 60 * 60 * 24 * 7,
  createBrowserSession: mocked.createBrowserSession,
  getBrowserSessionForOwner: mocked.getBrowserSessionForOwner,
  revokeBrowserSession: mocked.revokeBrowserSession,
  touchBrowserSession: mocked.touchBrowserSession,
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: mocked.getRequestContext,
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(cookieStore),
}));

import { auth, SESSION_COOKIE_NAME, signInWithPassword, verifySessionToken } from '@/lib/auth';
import { createOwnerAccount, hasOwnerAccount, signOut } from '@/lib/auth';
import { writeSecurityEvent } from '@/lib/security-events';

async function buildToken(payload: {
  sub: string;
  email: string;
  isOwner: boolean;
  exp: number;
  sid?: string;
}) {
  const AUTH_SECRET = 'test-auth-secret-that-is-long-enough-32chars';

  async function signTokenPayload(payloadValue: Record<string, unknown>) {
    const payloadB64 = encodeBase64Url(JSON.stringify(payloadValue));

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(AUTH_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
    const sig = bytesToBase64Url(new Uint8Array(signature));

    return `${payloadB64}.${sig}`;
  }

  function encodeBase64Url(input: string) {
    return Buffer.from(input, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  function bytesToBase64Url(bytes: Uint8Array) {
    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  return signTokenPayload({
    ...payload,
    sid: payload.sid ?? 'browser-session-1',
  });
}

async function buildLegacyToken(payload: {
  sub: string;
  email: string;
  isOwner: boolean;
  exp: number;
}) {
  const AUTH_SECRET = 'test-auth-secret-that-is-long-enough-32chars';

  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const sig = Buffer.from(sigBytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${payloadB64}.${sig}`;
}

function futureExp() {
  return Math.floor(Date.now() / 1000) + 3600;
}

function pastExp() {
  return Math.floor(Date.now() / 1000) - 1;
}

function buildPersistedBrowserSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'browser-session-1',
    ownerId: 'owner-1',
    ipAddress: '203.0.113.10',
    userAgent: TEST_USER_AGENT,
    browserName: 'Chrome',
    osName: 'macOS',
    lastUsedAt: new Date('2026-03-25T12:00:00.000Z'),
    expiresAt: new Date('2026-05-01T12:00:00.000Z'),
    revokedAt: null,
    createdAt: new Date('2026-03-25T12:00:00.000Z'),
    updatedAt: new Date('2026-03-25T12:00:00.000Z'),
    ...overrides,
  };
}

describe('signInWithPassword', () => {
  beforeEach(() => {
    cookieStore.set.mockClear();
    cookieStore.get.mockReset();
    mocked.db.query.users.findFirst.mockReset();
    mocked.db.insert.mockReset();
    mocked.insertValues.mockReset();
    mocked.insertReturning.mockReset();
    mocked.withAdminDb.mockReset();
    mocked.createBrowserSession.mockReset();
    mocked.getBrowserSessionForOwner.mockReset();
    mocked.revokeBrowserSession.mockReset();
    mocked.touchBrowserSession.mockReset();
    mocked.getRequestContext.mockReset();
    mocked.db.insert.mockReturnValue({
      values: mocked.insertValues,
    });
    mocked.insertValues.mockReturnValue({
      returning: mocked.insertReturning,
    });
    mocked.withAdminDb.mockImplementation(async (callback: (client: typeof mocked.db) => unknown) =>
      callback(mocked.db),
    );
    mocked.db.query.users.findFirst.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      passwordHash: OWNER_PASSWORD_HASH,
    });
    mocked.createBrowserSession.mockResolvedValue(buildPersistedBrowserSession());
    mocked.getBrowserSessionForOwner.mockResolvedValue(buildPersistedBrowserSession());
    mocked.revokeBrowserSession.mockResolvedValue(buildPersistedBrowserSession());
    mocked.touchBrowserSession.mockResolvedValue(buildPersistedBrowserSession());
    mocked.getRequestContext.mockResolvedValue({
      ipAddress: '203.0.113.10',
      userAgent: TEST_USER_AGENT,
      path: '/login',
    });
    (writeSecurityEvent as ReturnType<typeof vi.fn>).mockClear();
  });

  it('returns true and sets a session cookie on valid owner credentials', async () => {
    const result = await signInWithPassword({
      email: 'owner@example.com',
      password: 'plaintext-password-123',
    });

    expect(result).toBe(true);
    expect(cookieStore.set).toHaveBeenCalledOnce();
    const [cookieName, cookieValue, cookieOpts] = cookieStore.set.mock.calls[0];
    expect(cookieName).toBe(SESSION_COOKIE_NAME);
    expect(typeof cookieValue).toBe('string');
    expect(cookieValue.length).toBeGreaterThan(10);
    expect(cookieOpts).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    expect(mocked.withAdminDb).toHaveBeenCalledOnce();
  });

  it('creates a persisted browser session and signs its id into the owner cookie', async () => {
    const result = await signInWithPassword({
      email: 'owner@example.com',
      password: 'plaintext-password-123',
    });

    expect(result).toBe(true);
    expect(mocked.createBrowserSession).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        ipAddress: '203.0.113.10',
        userAgent: TEST_USER_AGENT,
      }),
    );

    const [, cookieValue] = cookieStore.set.mock.calls[0];
    const payload = await verifySessionToken(cookieValue);
    expect(payload?.sid).toBe('browser-session-1');
  });

  it('falls back to a stateless owner cookie when browser session storage is unavailable', async () => {
    mocked.createBrowserSession.mockRejectedValueOnce(
      Object.assign(new Error('Failed query'), {
        cause: Object.assign(new Error('relation "browser_sessions" does not exist'), {
          code: '42P01',
        }),
      }),
    );

    const result = await signInWithPassword({
      email: 'owner@example.com',
      password: 'plaintext-password-123',
    });

    expect(result).toBe(true);
    expect(cookieStore.set).toHaveBeenCalledOnce();
    const [, cookieValue] = cookieStore.set.mock.calls[0];
    const payload = await verifySessionToken(cookieValue);
    expect(payload?.sid).toBeUndefined();
  });

  it('returns false and does not set a cookie for the wrong password', async () => {
    const result = await signInWithPassword({
      email: 'owner@example.com',
      password: 'wrong-password',
    });

    expect(result).toBe(false);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it('returns false and does not set a cookie when the owner email is not found', async () => {
    mocked.db.query.users.findFirst.mockResolvedValueOnce(null);

    const result = await signInWithPassword({
      email: 'attacker@evil.com',
      password: 'plaintext-password-123',
    });

    expect(result).toBe(false);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it('returns false when the owner exists but has no password hash yet', async () => {
    mocked.db.query.users.findFirst.mockResolvedValueOnce({
      id: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      passwordHash: null,
    });

    const result = await signInWithPassword({
      email: 'owner@example.com',
      password: 'plaintext-password-123',
    });

    expect(result).toBe(false);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it('writes a security event with outcome=allowed on success', async () => {
    await signInWithPassword({ email: 'owner@example.com', password: 'plaintext-password-123' });

    expect(writeSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'allowed', eventType: 'auth.password_sign_in' }),
    );
  });

  it('writes a security event with outcome=blocked on failure', async () => {
    await signInWithPassword({ email: 'owner@example.com', password: 'bad' });

    expect(writeSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'blocked', eventType: 'auth.password_sign_in' }),
    );
  });

  it('accepts trimmed and uppercased owner email input', async () => {
    const result = await signInWithPassword({
      email: '  OWNER@EXAMPLE.COM  ',
      password: 'plaintext-password-123',
    });

    expect(result).toBe(true);
  });
});

describe('hasOwnerAccount', () => {
  beforeEach(() => {
    mocked.db.query.users.findFirst.mockReset();
  });

  it('returns true when an owner row exists', async () => {
    mocked.db.query.users.findFirst.mockResolvedValueOnce({ id: 'owner-1' });

    await expect(hasOwnerAccount()).resolves.toBe(true);
    expect(mocked.withAdminDb).toHaveBeenCalledOnce();
  });

  it('returns false when no owner row exists', async () => {
    mocked.db.query.users.findFirst.mockResolvedValueOnce(null);

    await expect(hasOwnerAccount()).resolves.toBe(false);
    expect(mocked.withAdminDb).toHaveBeenCalledOnce();
  });
});

describe('createOwnerAccount', () => {
  beforeEach(() => {
    cookieStore.set.mockClear();
    mocked.createBrowserSession.mockReset();
    mocked.getRequestContext.mockReset();
    mocked.db.query.users.findFirst.mockReset();
    mocked.db.insert.mockReset();
    mocked.insertValues.mockReset();
    mocked.insertReturning.mockReset();
    mocked.db.insert.mockReturnValue({
      values: mocked.insertValues,
    });
    mocked.insertValues.mockReturnValue({
      returning: mocked.insertReturning,
    });
    mocked.createBrowserSession.mockResolvedValue(buildPersistedBrowserSession());
    mocked.getRequestContext.mockResolvedValue({
      ipAddress: '203.0.113.10',
      userAgent: TEST_USER_AGENT,
      path: '/login',
    });
    (writeSecurityEvent as ReturnType<typeof vi.fn>).mockClear();
  });

  it('creates the first owner, sets a session cookie, and returns the new owner', async () => {
    mocked.db.query.users.findFirst.mockResolvedValueOnce(null);
    mocked.insertReturning.mockResolvedValueOnce([
      {
        id: 'owner-1',
        email: 'owner@example.com',
        isOwner: true,
      },
    ]);

    const result = await createOwnerAccount({
      email: ' OWNER@EXAMPLE.COM ',
      password: 'plaintext-password-123',
      path: '/login',
    });

    expect(result).toEqual({
      ok: true,
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        isOwner: true,
      },
    });
    expect(mocked.db.insert).toHaveBeenCalledOnce();
    expect(mocked.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'owner@example.com',
        isOwner: true,
        passwordHash: expect.any(String),
      }),
    );
    expect(cookieStore.set).toHaveBeenCalledOnce();
    expect(writeSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'auth.owner_setup', outcome: 'allowed' }),
    );
    expect(mocked.withAdminDb).toHaveBeenCalledOnce();
  });

  it('creates a persisted browser session during owner setup and signs its id into the cookie', async () => {
    mocked.db.query.users.findFirst.mockResolvedValueOnce(null);
    mocked.insertReturning.mockResolvedValueOnce([
      {
        id: 'owner-1',
        email: 'owner@example.com',
        isOwner: true,
      },
    ]);

    const result = await createOwnerAccount({
      email: 'owner@example.com',
      password: 'plaintext-password-123',
      path: '/login',
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
      }),
    );
    expect(mocked.createBrowserSession).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        ipAddress: '203.0.113.10',
        userAgent: TEST_USER_AGENT,
      }),
    );

    const [, cookieValue] = cookieStore.set.mock.calls[0];
    const payload = await verifySessionToken(cookieValue);
    expect(payload?.sid).toBe('browser-session-1');
  });

  it('falls back to a stateless owner cookie during setup when browser session storage is unavailable', async () => {
    mocked.db.query.users.findFirst.mockResolvedValueOnce(null);
    mocked.insertReturning.mockResolvedValueOnce([
      {
        id: 'owner-1',
        email: 'owner@example.com',
        isOwner: true,
      },
    ]);
    mocked.createBrowserSession.mockRejectedValueOnce(
      Object.assign(new Error('Failed query'), {
        cause: Object.assign(new Error('relation "browser_sessions" does not exist'), {
          code: '42P01',
        }),
      }),
    );

    const result = await createOwnerAccount({
      email: 'owner@example.com',
      password: 'plaintext-password-123',
      path: '/login',
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
      }),
    );
    expect(cookieStore.set).toHaveBeenCalledOnce();
    const [, cookieValue] = cookieStore.set.mock.calls[0];
    const payload = await verifySessionToken(cookieValue);
    expect(payload?.sid).toBeUndefined();
  });

  it('returns owner_exists and does not insert when an owner already exists', async () => {
    mocked.db.query.users.findFirst.mockResolvedValueOnce({ id: 'owner-1' });

    const result = await createOwnerAccount({
      email: 'owner@example.com',
      password: 'plaintext-password-123',
      path: '/login',
    });

    expect(result).toEqual({ ok: false, reason: 'owner_exists' });
    expect(mocked.db.insert).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(mocked.withAdminDb).toHaveBeenCalledOnce();
  });
});

describe('verifySessionToken', () => {
  it('returns payload for a valid token', async () => {
    const token = await buildToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: futureExp(),
      sid: 'browser-session-1',
    });
    const payload = await verifySessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('owner-1');
    expect(payload?.email).toBe('owner@example.com');
    expect(payload?.isOwner).toBe(true);
    expect(payload?.sid).toBe('browser-session-1');
  });

  it('returns null for null input', async () => {
    expect(await verifySessionToken(null)).toBeNull();
  });

  it('returns null for undefined input', async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
  });

  it('returns null for empty string', async () => {
    expect(await verifySessionToken('')).toBeNull();
  });

  it('returns null for malformed token (no dot)', async () => {
    expect(await verifySessionToken('notadotanywhere')).toBeNull();
  });

  it('returns null for token with more than one dot', async () => {
    expect(await verifySessionToken('a.b.c')).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const token = await buildToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: pastExp(),
    });
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('returns null when the token is not marked as an owner session', async () => {
    const token = await buildToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: false,
      exp: futureExp(),
    });
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('returns payload when the token omits the browser session id for legacy fallback mode', async () => {
    const token = await buildLegacyToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: futureExp(),
    });

    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sid).toBeUndefined();
  });

  it('returns null when signature is tampered', async () => {
    const token = await buildToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: futureExp(),
    });
    const [payloadB64] = token.split('.');
    const badToken = `${payloadB64}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(await verifySessionToken(badToken)).toBeNull();
  });

  it('returns null when payload is not valid JSON', async () => {
    const AUTH_SECRET = 'test-auth-secret-that-is-long-enough-32chars';
    const garbled = Buffer.from('not-json').toString('base64').replace(/=/g, '');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(AUTH_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(garbled));
    const sig = Buffer.from(sigBytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    expect(await verifySessionToken(`${garbled}.${sig}`)).toBeNull();
  });
});

describe('timing-safe verification', () => {
  it('does not throw when signature lengths differ during token verification', async () => {
    const token = await buildToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: futureExp(),
    });
    const payloadB64 = token.split('.')[0];
    const shortSig = 'abc';
    await expect(verifySessionToken(`${payloadB64}.${shortSig}`)).resolves.toBeNull();
  });
});

describe('auth()', () => {
  afterEach(() => {
    cookieStore.get.mockReset();
  });

  it('returns a user object when the session cookie contains a valid token', async () => {
    const token = await buildToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: futureExp(),
    });
    cookieStore.get.mockReturnValue({ value: token });

    const session = await auth();

    expect(session).not.toBeNull();
    expect(session?.user).toEqual({
      id: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
    });
    expect(mocked.getBrowserSessionForOwner).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      sessionId: 'browser-session-1',
    });
    expect(mocked.touchBrowserSession).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      sessionId: 'browser-session-1',
      lastUsedAt: expect.any(Date),
    });
  });

  it('returns a user object for legacy stateless session cookies', async () => {
    mocked.getBrowserSessionForOwner.mockClear();
    mocked.touchBrowserSession.mockClear();

    const token = await buildLegacyToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: futureExp(),
    });
    cookieStore.get.mockReturnValue({ value: token });

    const session = await auth();

    expect(session).not.toBeNull();
    expect(session?.user).toEqual({
      id: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
    });
    expect(session?.browserSessionId).toBeNull();
    expect(mocked.getBrowserSessionForOwner).not.toHaveBeenCalled();
    expect(mocked.touchBrowserSession).not.toHaveBeenCalled();
  });

  it('returns null when no session cookie is present', async () => {
    cookieStore.get.mockReturnValue(undefined);

    const session = await auth();
    expect(session).toBeNull();
  });

  it('returns null when the cookie contains an expired token', async () => {
    const token = await buildToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: pastExp(),
    });
    cookieStore.get.mockReturnValue({ value: token });

    const session = await auth();
    expect(session).toBeNull();
  });

  it('returns null when the cookie value is garbage', async () => {
    cookieStore.get.mockReturnValue({ value: 'total-garbage-not-a-token' });

    const session = await auth();
    expect(session).toBeNull();
  });

  it('returns null when the persisted browser session row is missing', async () => {
    const token = await buildToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: futureExp(),
    });
    cookieStore.get.mockReturnValue({ value: token });
    mocked.getBrowserSessionForOwner.mockResolvedValueOnce(null);

    await expect(auth()).resolves.toBeNull();
    expect(mocked.touchBrowserSession).not.toHaveBeenCalled();
  });

  it('returns null when the persisted browser session has been revoked', async () => {
    const token = await buildToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: futureExp(),
    });
    cookieStore.get.mockReturnValue({ value: token });
    mocked.getBrowserSessionForOwner.mockResolvedValueOnce(
      buildPersistedBrowserSession({
        revokedAt: new Date('2026-03-25T13:00:00.000Z'),
      }),
    );

    await expect(auth()).resolves.toBeNull();
    expect(mocked.touchBrowserSession).not.toHaveBeenCalled();
  });

  it('returns null when the persisted browser session has expired', async () => {
    const token = await buildToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: futureExp(),
    });
    cookieStore.get.mockReturnValue({ value: token });
    mocked.getBrowserSessionForOwner.mockResolvedValueOnce(
      buildPersistedBrowserSession({
        expiresAt: new Date('2026-03-24T12:00:00.000Z'),
      }),
    );

    await expect(auth()).resolves.toBeNull();
    expect(mocked.touchBrowserSession).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  beforeEach(() => {
    cookieStore.get.mockReset();
  });

  it('revokes the current browser session before clearing the cookie', async () => {
    const token = await buildToken({
      sub: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      exp: futureExp(),
    });
    cookieStore.get.mockReturnValue({ value: token });

    await signOut();

    expect(mocked.revokeBrowserSession).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      sessionId: 'browser-session-1',
      revokedAt: expect.any(Date),
    });
    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      '',
      expect.objectContaining({
        expires: new Date(0),
      }),
    );
  });
});
