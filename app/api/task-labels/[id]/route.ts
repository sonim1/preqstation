import { NextResponse } from 'next/server';

export async function PATCH(_req: Request, _ctx: { params: Promise<{ id: string }> }) {
  return NextResponse.json(
    {
      error: 'Task labels are project-owned. Use /api/projects/:id/labels/:labelId.',
    },
    { status: 410 },
  );
}

export async function DELETE(_req: Request, _ctx: { params: Promise<{ id: string }> }) {
  return NextResponse.json(
    {
      error: 'Task labels are project-owned. Use /api/projects/:id/labels/:labelId.',
    },
    { status: 410 },
  );
}
