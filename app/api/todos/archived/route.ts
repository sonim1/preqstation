import { NextResponse } from 'next/server';

import { queryArchivedTasks } from '@/lib/archived-task-query';
import { requireOwnerUser } from '@/lib/owner';

function parseOptionalNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isSummaryOnlyFlag(value: string | null) {
  return value === '1' || value === 'true';
}

export async function GET(request: Request) {
  try {
    const owner = await requireOwnerUser();
    const { searchParams } = new URL(request.url);

    const result = await queryArchivedTasks({
      ownerId: owner.id,
      projectId: searchParams.get('projectId')?.trim() || null,
      query: searchParams.get('q'),
      limit: parseOptionalNumber(searchParams.get('limit')),
      offset: parseOptionalNumber(searchParams.get('offset')),
      summaryOnly: isSummaryOnlyFlag(searchParams.get('summaryOnly')),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to load archived tasks' }, { status: 500 });
  }
}
