import * as OTPAuth from 'otpauth';

import { env } from '@/lib/env';

const TWO_FACTOR_ISSUER = 'PREQSTATION';
const TWO_FACTOR_SECRET_SALT = 'owner-totp-secret';
const TWO_FACTOR_SECRET_PREFIX = 'v1';
const TWO_FACTOR_SETUP_TOKEN_PREFIX = 'v1';
const TWO_FACTOR_SETUP_MAX_AGE_SECONDS = 60 * 10;

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

function base64UrlToBytes(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function decodeBase64Url(input: string) {
  return Buffer.from(base64UrlToBytes(input)).toString('utf8');
}

function safeEquals(a: string, b: string) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    const { timingSafeEqual } = require('crypto') as typeof import('crypto');
    timingSafeEqual(bufA, bufA);
    return false;
  }
  const { timingSafeEqual } = require('crypto') as typeof import('crypto');
  return timingSafeEqual(bufA, bufB);
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

let derivedKeyPromise: Promise<CryptoKey> | null = null;

async function getTwoFactorCryptoKey() {
  if (!derivedKeyPromise) {
    derivedKeyPromise = (async () => {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(env.AUTH_SECRET),
        'HKDF',
        false,
        ['deriveKey'],
      );

      return crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new TextEncoder().encode(TWO_FACTOR_SECRET_SALT),
          info: new Uint8Array(),
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    })();
  }

  return derivedKeyPromise;
}

export function normalizeTotpCode(input: string) {
  const code = input.trim().replace(/\s+/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

export function buildTotpUri(email: string, secret: string) {
  const totp = new OTPAuth.TOTP({
    issuer: TWO_FACTOR_ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

async function createTwoFactorSetupToken(secret: string) {
  const payload = {
    secret,
    exp: Math.floor(Date.now() / 1000) + TWO_FACTOR_SETUP_MAX_AGE_SECONDS,
  };
  const payloadB64 = encodeBase64Url(JSON.stringify(payload));
  const sig = await sign(payloadB64);
  return `${TWO_FACTOR_SETUP_TOKEN_PREFIX}.${payloadB64}.${sig}`;
}

export async function generateTwoFactorSetup(email: string) {
  const secret = new OTPAuth.Secret().base32;
  return {
    secret,
    otpauthUri: buildTotpUri(email, secret),
    setupToken: await createTwoFactorSetupToken(secret),
  };
}

export async function verifyTwoFactorSetupToken(token?: string | null) {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [prefix, payloadB64, sig] = parts;
  if (prefix !== TWO_FACTOR_SETUP_TOKEN_PREFIX || !payloadB64 || !sig) return null;

  const expected = await sign(payloadB64);
  if (!safeEquals(sig, expected)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(payloadB64)) as { secret?: string; exp?: number };
    if (!payload.secret || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.secret;
  } catch {
    return null;
  }
}

export async function encryptTwoFactorSecret(secret: string) {
  const key = await getTwoFactorCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(secret),
  );

  return `${TWO_FACTOR_SECRET_PREFIX}.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptTwoFactorSecret(payload: string) {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted TOTP secret payload');
  }

  const [prefix, ivPart, cipherPart] = parts;
  if (prefix !== TWO_FACTOR_SECRET_PREFIX || !ivPart || !cipherPart) {
    throw new Error('Invalid encrypted TOTP secret payload');
  }

  const iv = base64UrlToBytes(ivPart);
  if (iv.length !== 12) {
    throw new Error('Invalid encrypted TOTP secret payload');
  }

  try {
    const key = await getTwoFactorCryptoKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64UrlToBytes(cipherPart),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Failed to decrypt TOTP secret');
  }
}

export function verifyTotpCode(secret: string, input: string) {
  const code = normalizeTotpCode(input);
  if (!code) return false;

  try {
    const totp = new OTPAuth.TOTP({
      issuer: TWO_FACTOR_ISSUER,
      label: 'owner',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    return totp.validate({ token: code, window: 1 }) !== null;
  } catch {
    return false;
  }
}
