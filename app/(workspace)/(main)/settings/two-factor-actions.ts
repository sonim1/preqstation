'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { withOwnerDb } from '@/lib/db/rls';
import { users } from '@/lib/db/schema';
import { requireOwnerUser } from '@/lib/owner';
import { writeSecurityEvent } from '@/lib/security-events';
import {
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  generateTwoFactorSetup,
  verifyTotpCode,
  verifyTwoFactorSetupToken,
} from '@/lib/two-factor';

export type StartTwoFactorSetupResult =
  | { ok: true; otpauthUri: string; setupToken: string }
  | { ok: false; message: string };

export type TwoFactorActionState = { ok: true; message: string } | { ok: false; message: string };

export async function startTwoFactorSetupAction(): Promise<StartTwoFactorSetupResult> {
  const owner = await requireOwnerUser();
  const setup = await generateTwoFactorSetup(owner.email);

  return {
    ok: true,
    otpauthUri: setup.otpauthUri,
    setupToken: setup.setupToken,
  };
}

export async function confirmTwoFactorSetupAction(
  _prevState: TwoFactorActionState | null,
  formData: FormData,
): Promise<TwoFactorActionState> {
  const owner = await requireOwnerUser();
  const setupToken = String(formData.get('setupToken') || '');
  const totpCode = String(formData.get('totpCode') || '');
  const secret = await verifyTwoFactorSetupToken(setupToken);

  if (!secret) {
    await writeSecurityEvent({
      ownerId: owner.id,
      actorEmail: owner.email,
      eventType: 'auth.2fa_setup',
      outcome: 'blocked',
      detail: { reason: 'invalid_setup_token' },
    });
    return { ok: false, message: 'Setup expired. Start setup again.' };
  }

  if (!verifyTotpCode(secret, totpCode)) {
    await writeSecurityEvent({
      ownerId: owner.id,
      actorEmail: owner.email,
      eventType: 'auth.2fa_setup',
      outcome: 'blocked',
      detail: { reason: 'invalid_code' },
    });
    return { ok: false, message: 'Invalid authentication code.' };
  }

  const encryptedSecret = await encryptTwoFactorSecret(secret);
  await withOwnerDb(owner.id, (client) =>
    client
      .update(users)
      .set({
        twoFactorEnabled: true,
        twoFactorSecret: encryptedSecret,
      })
      .where(eq(users.id, owner.id)),
  );

  await writeSecurityEvent({
    ownerId: owner.id,
    actorEmail: owner.email,
    eventType: 'auth.2fa_setup',
    outcome: 'allowed',
  });
  revalidatePath('/settings');
  return { ok: true, message: 'Two-factor authentication enabled.' };
}

export async function disableTwoFactorAction(
  _prevState: TwoFactorActionState | null,
  formData: FormData,
): Promise<TwoFactorActionState> {
  const owner = await requireOwnerUser();
  const totpCode = String(formData.get('totpCode') || '');

  if (!owner.twoFactorEnabled || !owner.twoFactorSecret) {
    return { ok: false, message: 'Two-factor authentication is not enabled.' };
  }

  let secret: string;
  try {
    secret = await decryptTwoFactorSecret(owner.twoFactorSecret);
  } catch {
    await writeSecurityEvent({
      ownerId: owner.id,
      actorEmail: owner.email,
      eventType: 'auth.2fa_disable',
      outcome: 'error',
      detail: { reason: 'secret_decrypt_failed' },
    });
    return { ok: false, message: 'Unable to disable two-factor authentication.' };
  }

  if (!verifyTotpCode(secret, totpCode)) {
    await writeSecurityEvent({
      ownerId: owner.id,
      actorEmail: owner.email,
      eventType: 'auth.2fa_disable',
      outcome: 'blocked',
      detail: { reason: 'invalid_code' },
    });
    return { ok: false, message: 'Invalid authentication code.' };
  }

  await withOwnerDb(owner.id, (client) =>
    client
      .update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
      })
      .where(eq(users.id, owner.id)),
  );

  await writeSecurityEvent({
    ownerId: owner.id,
    actorEmail: owner.email,
    eventType: 'auth.2fa_disable',
    outcome: 'allowed',
  });
  revalidatePath('/settings');
  return { ok: true, message: 'Two-factor authentication disabled.' };
}
