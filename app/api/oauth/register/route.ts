import { registerOAuthClient } from '@/lib/mcp/connections';

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function isStringArray(values: unknown) {
  if (values == null) return true;
  if (!Array.isArray(values) || values.length === 0) return false;
  return values.every((value) => typeof value === 'string' && value.trim().length > 0);
}

function readRedirectUris(body: Record<string, unknown>) {
  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return null;
  }

  const normalized = redirectUris
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  if (normalized.length !== redirectUris.length) {
    return null;
  }

  try {
    normalized.forEach((value) => {
      new URL(value);
    });
  } catch {
    return null;
  }

  return normalized;
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return jsonError('invalid_client_metadata', 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError('invalid_client_metadata', 400);
  }

  const redirectUris = readRedirectUris(body);
  const tokenEndpointAuthMethod = body.token_endpoint_auth_method;
  const clientName = typeof body.client_name === 'string' ? body.client_name : undefined;

  if (!redirectUris) {
    return jsonError('invalid_client_metadata', 400);
  }

  if (tokenEndpointAuthMethod != null && typeof tokenEndpointAuthMethod !== 'string') {
    return jsonError('invalid_client_metadata', 400);
  }

  if (!isStringArray(body.grant_types)) {
    return jsonError('invalid_client_metadata', 400);
  }

  if (!isStringArray(body.response_types)) {
    return jsonError('invalid_client_metadata', 400);
  }

  const client = await registerOAuthClient({
    clientName,
    redirectUris,
  });

  return Response.json(
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    { status: 201 },
  );
}
