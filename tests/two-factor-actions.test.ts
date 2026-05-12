import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireOwnerUser: vi.fn(),
  withOwnerDb: vi.fn(),
  generateTwoFactorSetup: vi.fn(),
  verifyTwoFactorSetupToken: vi.fn(),
  verifyTotpCode: vi.fn(),
  encryptTwoFactorSecret: vi.fn(),
  decryptTwoFactorSecret: vi.fn(),
  writeSecurityEvent: vi.fn(),
  ownerClient: {
    update: vi.fn(),
  },
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocked.revalidatePath,
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: mocked.withOwnerDb,
}));

vi.mock('@/lib/two-factor', () => ({
  generateTwoFactorSetup: mocked.generateTwoFactorSetup,
  verifyTwoFactorSetupToken: mocked.verifyTwoFactorSetupToken,
  verifyTotpCode: mocked.verifyTotpCode,
  encryptTwoFactorSecret: mocked.encryptTwoFactorSecret,
  decryptTwoFactorSecret: mocked.decryptTwoFactorSecret,
}));

vi.mock('@/lib/security-events', () => ({
  writeSecurityEvent: mocked.writeSecurityEvent,
}));

import {
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  startTwoFactorSetupAction,
} from '@/app/(workspace)/(main)/settings/two-factor-actions';

function buildConfirmFormData(code = '123456') {
  const formData = new FormData();
  formData.set('setupToken', 'setup-token');
  formData.set('totpCode', code);
  return formData;
}

function buildDisableFormData(code = '123456') {
  const formData = new FormData();
  formData.set('totpCode', code);
  return formData;
}

describe('two factor settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      isOwner: true,
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted-secret',
    });
    mocked.withOwnerDb.mockImplementation(
      async (_ownerId: string, callback: (client: typeof mocked.ownerClient) => unknown) =>
        callback(mocked.ownerClient),
    );
    mocked.ownerClient.update.mockReturnValue({ set: mocked.updateSet });
    mocked.updateSet.mockReturnValue({ where: mocked.updateWhere });
    mocked.generateTwoFactorSetup.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUri: 'otpauth://totp/PREQSTATION:owner@example.com',
      setupToken: 'setup-token',
    });
    mocked.verifyTwoFactorSetupToken.mockResolvedValue('JBSWY3DPEHPK3PXP');
    mocked.verifyTotpCode.mockReturnValue(true);
    mocked.encryptTwoFactorSecret.mockResolvedValue('encrypted-secret');
    mocked.decryptTwoFactorSecret.mockResolvedValue('JBSWY3DPEHPK3PXP');
  });

  it('starts setup for an authenticated owner', async () => {
    const result = await startTwoFactorSetupAction();

    expect(result).toEqual({
      ok: true,
      otpauthUri: 'otpauth://totp/PREQSTATION:owner@example.com',
      setupToken: 'setup-token',
    });
    expect(mocked.generateTwoFactorSetup).toHaveBeenCalledWith('owner@example.com');
  });

  it('does not update the user when setup confirmation code is wrong', async () => {
    mocked.verifyTotpCode.mockReturnValueOnce(false);

    const result = await confirmTwoFactorSetupAction(null, buildConfirmFormData('000000'));

    expect(result).toEqual({ ok: false, message: 'Invalid authentication code.' });
    expect(mocked.ownerClient.update).not.toHaveBeenCalled();
  });

  it('stores an encrypted secret and enables 2FA when setup confirmation is valid', async () => {
    const result = await confirmTwoFactorSetupAction(null, buildConfirmFormData());

    expect(result).toEqual({ ok: true, message: 'Two-factor authentication enabled.' });
    expect(mocked.encryptTwoFactorSecret).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
    expect(mocked.updateSet).toHaveBeenCalledWith({
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted-secret',
    });
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/settings');
  });

  it('disables 2FA and removes the stored secret', async () => {
    const result = await disableTwoFactorAction(null, buildDisableFormData());

    expect(result).toEqual({ ok: true, message: 'Two-factor authentication disabled.' });
    expect(mocked.decryptTwoFactorSecret).toHaveBeenCalledWith('encrypted-secret');
    expect(mocked.verifyTotpCode).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP', '123456');
    expect(mocked.updateSet).toHaveBeenCalledWith({
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/settings');
  });

  it('does not disable 2FA when the current code is wrong', async () => {
    mocked.verifyTotpCode.mockReturnValueOnce(false);

    const result = await disableTwoFactorAction(null, buildDisableFormData('000000'));

    expect(result).toEqual({ ok: false, message: 'Invalid authentication code.' });
    expect(mocked.ownerClient.update).not.toHaveBeenCalled();
    expect(mocked.writeSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'auth.2fa_disable', outcome: 'blocked' }),
    );
  });
});
