import { buildMcpProtectedResourceMetadata } from '@/lib/mcp/discovery';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return Response.json({ ...buildMcpProtectedResourceMetadata(request.url), resource: origin });
}
