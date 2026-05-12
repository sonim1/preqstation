import * as OTPAuth from 'otpauth';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    AUTH_SECRET: 'test-auth-secret-that-is-long-enough-32chars',
  },
}));

import {
  buildTotpUri,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  generateTwoFactorSetup,
  normalizeTotpCode,
  verifyTotpCode,
  verifyTwoFactorSetupToken,
} from '@/lib/two-factor';

describe('lib/two-factor', () => {
  it('normalizes six digit TOTP codes and rejects other input', () => {
    expect(normalizeTotpCode(' 123 456 ')).toBe('123456');
    expect(normalizeTotpCode('12345')).toBeNull();
    expect(normalizeTotpCode('1234567')).toBeNull();
    expect(normalizeTotpCode('abcdef')).toBeNull();
  });

  it('builds otpauth setup URIs with PREQSTATION issuer and owner email label', () => {
    const secret = new OTPAuth.Secret().base32;
    const uri = buildTotpUri('owner@example.com', secret);

    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('issuer=PREQSTATION');
    expect(decodeURIComponent(uri)).toContain('owner@example.com');
  });

  it('encrypts the stored secret without retaining plaintext and decrypts it later', async () => {
    const secret = new OTPAuth.Secret().base32;
    const encrypted = await encryptTwoFactorSecret(secret);

    expect(encrypted).not.toContain(secret);
    await expect(decryptTwoFactorSecret(encrypted)).resolves.toBe(secret);
  });

  it('accepts a valid current TOTP code and rejects invalid code formats', () => {
    const secret = new OTPAuth.Secret().base32;
    const code = new OTPAuth.TOTP({
      issuer: 'PREQSTATION',
      label: 'owner@example.com',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    }).generate();

    expect(verifyTotpCode(secret, code)).toBe(true);
    expect(verifyTotpCode(secret, '000000')).toBe(false);
    expect(verifyTotpCode(secret, '12345')).toBe(false);
    expect(verifyTotpCode(secret, 'abc123')).toBe(false);
  });

  it('creates setup tokens that verify until expiry and fail after tampering', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T12:00:00.000Z'));

    const setup = await generateTwoFactorSetup('owner@example.com');
    expect(setup.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.otpauthUri).toMatch(/^otpauth:\/\/totp\//);

    await expect(verifyTwoFactorSetupToken(setup.setupToken)).resolves.toBe(setup.secret);
    await expect(verifyTwoFactorSetupToken(`${setup.setupToken}tampered`)).resolves.toBeNull();
    await expect(verifyTwoFactorSetupToken(`${setup.setupToken}.extra`)).resolves.toBeNull();

    vi.setSystemTime(new Date('2026-05-12T12:11:00.000Z'));
    await expect(verifyTwoFactorSetupToken(setup.setupToken)).resolves.toBeNull();
    vi.useRealTimers();
  });
});
