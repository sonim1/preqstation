import { exchangeMcpAuthorizationCode } from '@/lib/mcp/auth';

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

async function readTokenRequest(request: Request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = (await request.json()) as Record<string, unknown>;
    return {
      grantType: String(body.grant_type || ''),
      code: String(body.code || ''),
      redirectUri: String(body.redirect_uri || ''),
      codeVerifier: String(body.code_verifier || ''),
    };
  }

  const form = await request.formData();
  return {
    grantType: String(form.get('grant_type') || ''),
    code: String(form.get('code') || ''),
    redirectUri: String(form.get('redirect_uri') || ''),
    codeVerifier: String(form.get('code_verifier') || ''),
  };
}

export async function POST(request: Request) {
  const body = await readTokenRequest(request);

  if (body.grantType !== 'authorization_code') {
    return jsonError('unsupported_grant_type', 400);
  }

  if (!body.code || !body.redirectUri || !body.codeVerifier) {
    return jsonError('invalid_request', 400);
  }

  const result = await exchangeMcpAuthorizationCode({
    code: body.code,
    codeVerifier: body.codeVerifier,
    redirectUri: body.redirectUri,
  });

  if (!result) {
    return jsonError('invalid_grant', 400);
  }

  return Response.json({
    access_token: result.accessToken,
    token_type: 'bearer',
    expires_in: result.expiresIn,
  });
}
