import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    AUTH_SECRET: 'test-auth-secret-1234567890',
  },
}));

import { decryptTelegramToken, encryptTelegramToken } from '@/lib/telegram-crypto';

function base64UrlToBytes(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function bytesToBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

describe('lib/telegram-crypto', () => {
  it('encrypts and decrypts a telegram token', async () => {
    const encrypted = await encryptTelegramToken('123456:ABCDEF');

    expect(encrypted.startsWith('v1.')).toBe(true);
    await expect(decryptTelegramToken(encrypted)).resolves.toBe('123456:ABCDEF');
  });

  it('throws on invalid payload format', async () => {
    await expect(decryptTelegramToken('invalid-payload')).rejects.toThrow(
      'Invalid encrypted Telegram token payload',
    );
  });

  it('throws when payload is tampered', async () => {
    const encrypted = await encryptTelegramToken('123456:ABCDEF');
    const [prefix, ivPart, cipherPart] = encrypted.split('.');
    const cipherBytes = base64UrlToBytes(cipherPart);
    cipherBytes[0] ^= 0xff;
    const tamperedCipherPart = bytesToBase64Url(cipherBytes);
    const tamperedPayload = `${prefix}.${ivPart}.${tamperedCipherPart}`;

    await expect(decryptTelegramToken(tamperedPayload)).rejects.toThrow(
      'Failed to decrypt Telegram bot token',
    );
  });
});
