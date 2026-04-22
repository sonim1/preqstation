import { NextResponse } from 'next/server';
import { z } from 'zod';

import { rebuildDashboardWorkLogRollups } from '@/lib/dashboard-rollups';
import { isSupportedTimeZone } from '@/lib/date-time';
import { withOwnerDb } from '@/lib/db/rls';
import { ENTITY_SETTING, SETTING_UPDATED, writeOutboxEventStandalone } from '@/lib/outbox';
import { getOwnerUserOrNull } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { getUserSettings, SETTING_KEYS, setUserSetting } from '@/lib/user-settings';

export const dynamic = 'force-dynamic';

const VALID_KEYS = new Set(Object.values(SETTING_KEYS));

const patchSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export async function GET() {
  try {
    const owner = await getOwnerUserOrNull();
    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getUserSettings(owner.id);
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await getOwnerUserOrNull();
    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = patchSchema.parse(await req.json());

    if (!VALID_KEYS.has(body.key as (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS])) {
      return NextResponse.json({ error: 'Invalid setting key' }, { status: 400 });
    }

    const nextValue = body.value.trim();
    if (body.key === SETTING_KEYS.TIMEZONE && nextValue && !isSupportedTimeZone(nextValue)) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
    }

    await withOwnerDb(owner.id, async (client) => {
      await setUserSetting(owner.id, body.key, nextValue, client);

      if (body.key === SETTING_KEYS.TIMEZONE) {
        await rebuildDashboardWorkLogRollups(owner.id, nextValue, client);
      }

      await writeOutboxEventStandalone(
        {
          ownerId: owner.id,
          eventType: SETTING_UPDATED,
          entityType: ENTITY_SETTING,
          entityId: body.key,
          payload: { value: nextValue },
        },
        client,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
