import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  BROWSER_SESSION_MAX_AGE_SECONDS,
  createBrowserSession,
  getBrowserSessionForOwner,
  revokeBrowserSession,
  touchBrowserSession,
} from '@/lib/browser-sessions';
import { withAdminDb } from '@/lib/db/rls';
import { users } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { getRequestContext } from '@/lib/request-context';
import { decryptTwoFactorSecret, verifyTotpCode } from '@/lib/two-factor';

export const SESSION_COOKIE_NAME = 'pm_owner_session';
export const TWO_FACTOR_CHALLENGE_COOKIE_NAME = 'pm_owner_2fa';
const TWO_FACTOR_CHALLENGE_MAX_AGE_SECONDS = 60 * 5;

type SessionPayload = {
  sub: string;
  email: string;
  isOwner: boolean;
  sid?: string;
  exp: number;
};

type TwoFactorChallengePayload = {
  sub: string;
  email: string;
  isOwner: true;
  exp: number;
};

type SecurityEventPayload = {
  ownerId?: string | null;
  actorEmail?: string | null;
  eventType: string;
  outcome: 'allowed' | 'blocked' | 'error';
  ipAddress?: string | null;
  userAgent?: string | null;
  path?: string | null;
  detail?: unknown;
};

export type OwnerAuthUser = {
  id: string;
  email: string;
  isOwner: boolean;
};

export type CreateOwnerAccountResult =
  | {
      ok: true;
      user: OwnerAuthUser;
    }
  | {
      ok: false;
      reason: 'owner_exists';
    };

export type SignInWithPasswordResult =
  | { ok: true; twoFactorRequired: false; user: OwnerAuthUser }
  | { ok: true; twoFactorRequired: true; email: string }
  | { ok: false; reason: 'invalid_credentials' };

export type CompleteTwoFactorSignInResult =
  | { ok: true; user: OwnerAuthUser }
  | { ok: false; reason: 'invalid_totp' };

function encodeBase64Url(input: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  return atob(padded);
}

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
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  const maxLength = Math.max(bytesA.length, bytesB.length);
  let mismatch = bytesA.length ^ bytesB.length;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (bytesA[index] ?? 0) ^ (bytesB[index] ?? 0);
  }

  return mismatch === 0;
}

async function createSignedToken(input: {
  userId: string;
  email: string;
  isOwner: boolean;
  sessionId?: string;
  expiresAt?: Date;
}) {
  const expiresAt =
    input.expiresAt ?? new Date(Date.now() + BROWSER_SESSION_MAX_AGE_SECONDS * 1000);
  const payload: SessionPayload = {
    sub: input.userId,
    email: input.email,
    isOwner: input.isOwner,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };
  if (input.sessionId) {
    payload.sid = input.sessionId;
  }

  const payloadRaw = JSON.stringify(payload);
  const payloadB64 = encodeBase64Url(payloadRaw);
  const sig = await sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

async function createTwoFactorChallengeToken(input: { userId: string; email: string }) {
  const payload: TwoFactorChallengePayload = {
    sub: input.userId,
    email: input.email,
    isOwner: true,
    exp: Math.floor(Date.now() / 1000) + TWO_FACTOR_CHALLENGE_MAX_AGE_SECONDS,
  };
  const payloadB64 = encodeBase64Url(JSON.stringify(payload));
  const sig = await sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: BROWSER_SESSION_MAX_AGE_SECONDS,
  });
}

async function setTwoFactorChallengeCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(TWO_FACTOR_CHALLENGE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: TWO_FACTOR_CHALLENGE_MAX_AGE_SECONDS,
  });
}

function clearCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, name: string) {
  cookieStore.set(name, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: new Date(0),
  });
}

async function logSecurityEvent(event: SecurityEventPayload) {
  const { writeSecurityEvent } = await import('@/lib/security-events');
  await writeSecurityEvent(event);
}

function isMissingBrowserSessionsRelation(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as {
    code?: string;
    message?: string;
    cause?: { code?: string; message?: string };
  };
  const candidates = [maybeError, maybeError.cause].filter(Boolean);

  return candidates.some(
    (candidate) =>
      candidate?.code === '42P01' && candidate.message?.includes('browser_sessions') === true,
  );
}

async function createOwnerSessionToken(input: {
  userId: string;
  email: string;
  isOwner: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    const browserSession = await createBrowserSession({
      ownerId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    if (!browserSession?.id) {
      throw new Error('Failed to create browser session');
    }

    return createSignedToken({
      userId: input.userId,
      email: input.email,
      isOwner: input.isOwner,
      sessionId: browserSession.id,
      expiresAt: browserSession.expiresAt,
    });
  } catch (error) {
    // Keep legacy login working until the browser_sessions migration has been applied everywhere.
    if (!isMissingBrowserSessionsRelation(error)) {
      throw error;
    }

    return createSignedToken({
      userId: input.userId,
      email: input.email,
      isOwner: input.isOwner,
    });
  }
}

export async function verifySessionToken(token?: string | null) {
  if (!token) return null;
  if ((token.match(/\./g) || []).length !== 1) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expected = await sign(payloadB64);
  if (!safeEquals(sig, expected)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(payloadB64)) as SessionPayload;
    if (!payload?.sub || !payload?.email || !payload?.exp) return null;
    if (!payload.isOwner) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function verifyTwoFactorChallengeToken(token?: string | null) {
  if (!token) return null;
  if ((token.match(/\./g) || []).length !== 1) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expected = await sign(payloadB64);
  if (!safeEquals(sig, expected)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(payloadB64)) as TwoFactorChallengePayload;
    if (!payload?.sub || !payload?.email || !payload?.exp) return null;
    if (payload.isOwner !== true) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function auth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  let browserSessionId: string | null = payload.sid ?? null;
  if (payload.sid) {
    try {
      const browserSession = await getBrowserSessionForOwner({
        ownerId: payload.sub,
        sessionId: payload.sid,
      });
      if (!browserSession?.id || browserSession.revokedAt) {
        return null;
      }
      if (browserSession.expiresAt.getTime() < Date.now()) {
        return null;
      }

      await touchBrowserSession({
        ownerId: payload.sub,
        sessionId: payload.sid,
        lastUsedAt: new Date(),
      });
    } catch (error) {
      if (!isMissingBrowserSessionsRelation(error)) {
        throw error;
      }
      browserSessionId = null;
    }
  }

  return {
    user: {
      id: payload.sub,
      email: payload.email,
      isOwner: payload.isOwner,
    },
    browserSessionId,
  };
}

export function isOwnerEmail(email?: string | null) {
  return Boolean(email?.trim());
}

export async function hasOwnerAccount() {
  const owner = await withAdminDb((client) =>
    client.query.users.findFirst({
      where: eq(users.isOwner, true),
      columns: { id: true },
    }),
  );

  return Boolean(owner);
}

export async function createOwnerAccount(input: {
  email: string;
  password: string;
  path?: string | null;
}): Promise<CreateOwnerAccountResult> {
  const email = input.email.trim().toLowerCase();
  const requestContext = await getRequestContext();

  const owner = await withAdminDb(async (client) => {
    const existingOwner = await client.query.users.findFirst({
      where: eq(users.isOwner, true),
      columns: { id: true },
    });

    if (existingOwner) {
      return null;
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const [createdOwner] = await client
      .insert(users)
      .values({
        email,
        passwordHash,
        isOwner: true,
        twoFactorEnabled: false,
      })
      .returning({
        id: users.id,
        email: users.email,
        isOwner: users.isOwner,
      });

    return createdOwner;
  });

  if (!owner) {
    await logSecurityEvent({
      actorEmail: email || null,
      eventType: 'auth.owner_setup',
      outcome: 'blocked',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      path: input.path ?? requestContext.path ?? null,
    });
    return { ok: false, reason: 'owner_exists' };
  }

  const token = await createOwnerSessionToken({
    userId: owner.id,
    email: owner.email,
    isOwner: owner.isOwner,
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
  });
  await setSessionCookie(token);

  await logSecurityEvent({
    ownerId: owner.id,
    actorEmail: owner.email,
    eventType: 'auth.owner_setup',
    outcome: 'allowed',
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
    path: input.path ?? requestContext.path ?? null,
  });

  return { ok: true, user: owner };
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
  path?: string | null;
}): Promise<SignInWithPasswordResult> {
  const email = input.email.trim().toLowerCase();
  const requestContext = await getRequestContext();
  const owner = await withAdminDb((client) =>
    client.query.users.findFirst({
      where: and(eq(users.isOwner, true), eq(users.email, email)),
      columns: {
        id: true,
        email: true,
        isOwner: true,
        passwordHash: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    }),
  );

  const passwordHash = typeof owner?.passwordHash === 'string' ? owner.passwordHash : '';
  const ok =
    Boolean(owner?.isOwner) &&
    Boolean(passwordHash) &&
    (await bcrypt.compare(input.password, passwordHash));

  await logSecurityEvent({
    actorEmail: email || null,
    eventType: 'auth.password_sign_in',
    outcome: ok ? 'allowed' : 'blocked',
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
    path: input.path ?? requestContext.path ?? null,
    detail: ok ? { twoFactorRequired: owner?.twoFactorEnabled === true } : undefined,
  });

  if (!ok || !owner) return { ok: false, reason: 'invalid_credentials' };

  if (owner.twoFactorEnabled) {
    if (!owner.twoFactorSecret) {
      await logSecurityEvent({
        ownerId: owner.id,
        actorEmail: owner.email,
        eventType: 'auth.2fa_challenge',
        outcome: 'blocked',
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        path: input.path ?? requestContext.path ?? null,
        detail: { reason: 'missing_secret' },
      });
      return { ok: false, reason: 'invalid_credentials' };
    }

    const challengeToken = await createTwoFactorChallengeToken({
      userId: owner.id,
      email: owner.email,
    });
    await setTwoFactorChallengeCookie(challengeToken);
    await logSecurityEvent({
      ownerId: owner.id,
      actorEmail: owner.email,
      eventType: 'auth.2fa_challenge',
      outcome: 'allowed',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      path: input.path ?? requestContext.path ?? null,
    });

    return { ok: true, twoFactorRequired: true, email: owner.email };
  }

  const token = await createOwnerSessionToken({
    userId: owner.id,
    email: owner.email,
    isOwner: owner.isOwner,
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
  });
  await setSessionCookie(token);

  return {
    ok: true,
    twoFactorRequired: false,
    user: {
      id: owner.id,
      email: owner.email,
      isOwner: owner.isOwner,
    },
  };
}

export async function completeTwoFactorSignIn(input: {
  code: string;
  path?: string | null;
}): Promise<CompleteTwoFactorSignInResult> {
  const requestContext = await getRequestContext();
  const cookieStore = await cookies();
  const challengeToken = cookieStore.get(TWO_FACTOR_CHALLENGE_COOKIE_NAME)?.value;
  const challenge = await verifyTwoFactorChallengeToken(challengeToken);

  async function block(reason: string, owner?: { id?: string | null; email?: string | null }) {
    await logSecurityEvent({
      ownerId: owner?.id ?? challenge?.sub ?? null,
      actorEmail: owner?.email ?? challenge?.email ?? null,
      eventType: 'auth.2fa_verify',
      outcome: 'blocked',
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      path: input.path ?? requestContext.path ?? null,
      detail: { reason },
    });
    return { ok: false, reason: 'invalid_totp' } as const;
  }

  if (!challenge) {
    return block('invalid_challenge');
  }

  const owner = await withAdminDb((client) =>
    client.query.users.findFirst({
      where: and(eq(users.isOwner, true), eq(users.id, challenge.sub)),
      columns: {
        id: true,
        email: true,
        isOwner: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    }),
  );

  if (!owner?.isOwner || !owner.twoFactorEnabled || !owner.twoFactorSecret) {
    return block('missing_secret', owner);
  }

  let secret: string;
  try {
    secret = await decryptTwoFactorSecret(owner.twoFactorSecret);
  } catch {
    return block('secret_decryption_failed', owner);
  }

  if (!verifyTotpCode(secret, input.code)) {
    return block('invalid_code', owner);
  }

  const token = await createOwnerSessionToken({
    userId: owner.id,
    email: owner.email,
    isOwner: owner.isOwner,
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
  });
  await setSessionCookie(token);
  clearCookie(cookieStore, TWO_FACTOR_CHALLENGE_COOKIE_NAME);

  await logSecurityEvent({
    ownerId: owner.id,
    actorEmail: owner.email,
    eventType: 'auth.2fa_verify',
    outcome: 'allowed',
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
    path: input.path ?? requestContext.path ?? null,
  });

  return {
    ok: true,
    user: {
      id: owner.id,
      email: owner.email,
      isOwner: owner.isOwner,
    },
  };
}

export async function signOut(options?: { redirectTo?: string }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);
  if (payload?.sub && payload.sid) {
    try {
      await revokeBrowserSession({
        ownerId: payload.sub,
        sessionId: payload.sid,
        revokedAt: new Date(),
      });
    } catch (error) {
      if (!isMissingBrowserSessionsRelation(error)) {
        throw error;
      }
    }
  }
  clearCookie(cookieStore, SESSION_COOKIE_NAME);
  clearCookie(cookieStore, TWO_FACTOR_CHALLENGE_COOKIE_NAME);

  await logSecurityEvent({
    eventType: 'auth.sign_out',
    outcome: 'allowed',
  });

  if (options?.redirectTo) {
    redirect(options.redirectTo);
  }

  return null;
}
