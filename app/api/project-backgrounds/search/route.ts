import { NextResponse } from 'next/server';
import { z } from 'zod';

import { OpenverseError, searchOpenversePhotos } from '@/lib/openverse';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

export async function GET(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    await requireOwnerUser();

    const { searchParams } = new URL(req.url);
    const query = querySchema.parse({
      q: searchParams.get('q') || '',
    });

    const photos = await searchOpenversePhotos(query.q);
    return NextResponse.json({ photos });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query', issues: error.issues }, { status: 400 });
    }
    if (error instanceof OpenverseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to search project backgrounds' }, { status: 500 });
  }
}
