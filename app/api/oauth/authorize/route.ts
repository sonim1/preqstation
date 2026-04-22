import { auth } from '@/lib/auth';
import {
  buildMcpAuthorizationRedirect,
  issueMcpAuthorizationCode,
  redirectUrisMatch,
  setMcpLoginRequestCookie,
} from '@/lib/mcp/auth';
import { getOAuthClientById } from '@/lib/mcp/connections';

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id')?.trim() || '';
  const redirectUri = searchParams.get('redirect_uri')?.trim() || '';
  const state = searchParams.get('state')?.trim() || '';
  const codeChallenge = searchParams.get('code_challenge')?.trim() || '';
  const codeChallengeMethod = searchParams.get('code_challenge_method')?.trim() || 'S256';

  if (!clientId || !redirectUri || !codeChallenge) {
    return badRequest('invalid_request');
  }

  try {
    new URL(redirectUri);
  } catch {
    return badRequest('invalid_request');
  }

  if (codeChallengeMethod !== 'S256') {
    return badRequest('invalid_request');
  }

  const oauthClient = await getOAuthClientById(clientId);
  if (!oauthClient) {
    return badRequest('invalid_request');
  }
  if (!oauthClient.redirectUris.some((value) => redirectUrisMatch(value, redirectUri))) {
    return badRequest('invalid_request');
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.isOwner) {
    await setMcpLoginRequestCookie({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
    });
    return Response.redirect(new URL('/login?oauth=1', request.url));
  }

  const code = await issueMcpAuthorizationCode({
    userId: session.user.id,
    clientId,
    codeChallenge,
    codeChallengeMethod,
    redirectUri,
  });
  if (!code) {
    return badRequest('invalid_request');
  }

  return Response.redirect(buildMcpAuthorizationRedirect(redirectUri, code, state));
}
