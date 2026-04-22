import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireOwnerUser } from '@/lib/owner';
import { projectBackgroundCreditSchema } from '@/lib/project-backgrounds';
import { assertSameOrigin } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const selectSchema = z.object({
  regularUrl: z
    .string()
    .trim()
    .url()
    .refine((value) => isHttpsUrl(value)),
  credit: projectBackgroundCreditSchema.extend({ provider: z.literal('openverse') }),
});

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    await requireOwnerUser();
    const payload = selectSchema.parse(await req.json());

    return NextResponse.json({
      bgImage: payload.regularUrl,
      bgImageCredit: payload.credit,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to select project background' }, { status: 500 });
  }
}
