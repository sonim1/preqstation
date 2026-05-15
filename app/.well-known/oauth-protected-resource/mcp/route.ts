import { buildMcpProtectedResourceMetadata } from '@/lib/mcp/discovery';

export async function GET(request: Request) {
  return Response.json(buildMcpProtectedResourceMetadata(request.url));
}
