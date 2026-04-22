import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'Task labels are project-owned. Use /api/projects/:id/labels.',
    },
    { status: 410 },
  );
}

export async function POST(_req: Request) {
  return NextResponse.json(
    {
      error: 'Task labels are project-owned. Use /api/projects/:id/labels.',
    },
    { status: 410 },
  );
}
