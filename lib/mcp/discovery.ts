export function buildMcpProtectedResourceMetadata(requestUrl: string | URL) {
  const origin = new URL(requestUrl).origin;

  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
  };
}

export function buildMcpBearerChallenge(requestUrl: string | URL) {
  const origin = new URL(requestUrl).origin;

  return `Bearer realm="preqstation", resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`;
}

export function buildOAuthAuthorizationServerMetadata(
  requestUrl: string | URL,
  options: { issuerPath?: string } = {},
) {
  const origin = new URL(requestUrl).origin;
  const issuer = options.issuerPath ? `${origin}${options.issuerPath}` : origin;

  return {
    issuer,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
  };
}
