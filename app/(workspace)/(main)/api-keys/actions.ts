'use server';

import { revalidatePath } from 'next/cache';

import { issueApiToken } from '@/lib/api-tokens';
import { writeAuditLog } from '@/lib/audit';
import { API_TOKEN_NAME_MAX_LENGTH } from '@/lib/content-limits';
import { requireOwnerUser } from '@/lib/owner';

type CreateApiKeyState = {
  token: string | null;
  error: string | null;
};

export async function createApiKeyAction(
  _prev: CreateApiKeyState,
  formData: FormData,
): Promise<CreateApiKeyState> {
  try {
    const owner = await requireOwnerUser();

    const name = String(formData.get('name') || '').trim();
    if (!name || name.length > API_TOKEN_NAME_MAX_LENGTH) {
      return { token: null, error: 'Name is required (max 64 characters).' };
    }

    const expiresInDaysStr = String(formData.get('expiresInDays') || '');
    let expiresAt: Date | null = null;
    const days = Number(expiresInDaysStr);
    if (Number.isFinite(days) && days > 0) {
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    const { token, record } = await issueApiToken({
      ownerId: owner.id,
      name,
      expiresAt,
    });

    await writeAuditLog({
      ownerId: owner.id,
      action: 'api_token.created',
      targetType: 'api_token',
      targetId: record.id,
      meta: { name: record.name, expiresAt: record.expiresAt?.toISOString() ?? null },
    });

    revalidatePath('/api-keys');

    return { token, error: null };
  } catch (error) {
    if (error instanceof Response) {
      return { token: null, error: 'Unauthorized' };
    }
    return { token: null, error: 'Failed to create API key' };
  }
}
