import { NextRequest, NextResponse } from 'next/server';

import { isOwnerEmail, SESSION_COOKIE_NAME, verifySessionToken } from './lib/auth';
import { checkRateLimit, getClientIp } from './lib/rate-limit';
import { setSecurityHeaders } from './lib/security-headers';

function isPublicPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/mcp' ||
    pathname === '/.well-known/oauth-authorization-server' ||
    pathname === '/api/oauth/authorize' ||
    pathname === '/api/oauth/register' ||
    pathname === '/api/oauth/token' ||
    pathname === '/api/health' ||
    pathname === '/api/ping' ||
    pathname === '/favicon.ico'
  );
}

function isBearerApiPath(pathname: string) {
  return (
    pathname === '/mcp' ||
    pathname.startsWith('/api/tasks') ||
    pathname.startsWith('/api/qa-runs/') ||
    /^\/api\/projects\/[^/]+\/settings$/.test(pathname)
  );
}

function isServerActionRequest(req: NextRequest) {
  return req.headers.has('next-action');
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;
  const ip = getClientIp(req.headers);
  const pathHeaders = new Headers(req.headers);
  pathHeaders.set('x-pathname', pathname);
  const isServerAction = isServerActionRequest(req);

  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/health')) {
    const rate = checkRateLimit(`api:${ip}`, 120, 60_000);
    if (!rate.allowed) {
      return setSecurityHeaders(
        NextResponse.json(
          { error: 'Too many requests' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
            },
          },
        ),
      );
    }
  }

  // Do not rate-limit GET for login pages; limit only actual login attempts (POST).
  if ((pathname === '/' || pathname === '/login') && method === 'POST') {
    const rate = checkRateLimit(`auth:${ip}`, 10, 60_000);
    if (!rate.allowed) {
      return setSecurityHeaders(
        NextResponse.json(
          { error: 'Too many authentication attempts' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
            },
          },
        ),
      );
    }

    if (!isServerAction) {
      const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      const session = await verifySessionToken(token);
      if (isOwnerEmail(session?.email)) {
        return setSecurityHeaders(NextResponse.redirect(new URL('/dashboard', req.url)));
      }
    }
  }

  // PREQSTATION bearer-token APIs authenticate in the route handlers.
  // Defense-in-depth: require an Authorization: Bearer header at the middleware layer too.
  if (isBearerApiPath(pathname)) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return setSecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }
    return setSecurityHeaders(NextResponse.next({ request: { headers: pathHeaders } }));
  }

  const isPublic = isPublicPath(pathname);

  if (isPublic) {
    return setSecurityHeaders(NextResponse.next({ request: { headers: pathHeaders } }));
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  const email = session?.email;

  if (!isOwnerEmail(email)) {
    const loginUrl = new URL('/login?reason=auth', req.url);
    return setSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return setSecurityHeaders(NextResponse.next({ request: { headers: pathHeaders } }));
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
