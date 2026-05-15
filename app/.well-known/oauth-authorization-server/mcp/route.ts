import { buildOAuthAuthorizationServerMetadata } from '@/lib/mcp/discovery';

export async function GET(request: Request) {
  return Response.json(buildOAuthAuthorizationServerMetadata(request.url, { issuerPath: '/mcp' }));
}
