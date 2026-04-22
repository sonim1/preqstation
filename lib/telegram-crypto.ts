import { env } from '@/lib/env';

const TELEGRAM_TOKEN_SALT = 'telegram-bot-token';
const TELEGRAM_TOKEN_PREFIX = 'v1';

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

function base64UrlToBytes(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

let derivedKeyPromise: Promise<CryptoKey> | null = null;

async function getTelegramCryptoKey() {
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
          salt: new TextEncoder().encode(TELEGRAM_TOKEN_SALT),
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

export async function encryptTelegramToken(token: string) {
  const key = await getTelegramCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token),
  );

  return `${TELEGRAM_TOKEN_PREFIX}.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptTelegramToken(payload: string) {
  const [prefix, ivPart, cipherPart] = payload.split('.');
  if (prefix !== TELEGRAM_TOKEN_PREFIX || !ivPart || !cipherPart) {
    throw new Error('Invalid encrypted Telegram token payload');
  }

  const iv = base64UrlToBytes(ivPart);
  if (iv.length !== 12) {
    throw new Error('Invalid encrypted Telegram token payload');
  }

  try {
    const key = await getTelegramCryptoKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64UrlToBytes(cipherPart),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Failed to decrypt Telegram bot token');
  }
}
