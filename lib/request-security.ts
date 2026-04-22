import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { writeSecurityEvent } from '@/lib/security-events';

function normalizeOrigin(input: string | null | undefined) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed === 'null') return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    try {
      return new URL(`https://${trimmed}`).origin;
    } catch {
      return null;
    }
  }
}

function getForwardedOrigin(req: Request) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!host) return null;

  const proto =
    req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(/:$/, '') || 'https';

  return normalizeOrigin(`${proto}://${host}`);
}

function getAllowedOrigins(req: Request, requestOrigin: string) {
  const fromEnv = (env.ALLOWED_ORIGINS || '')
    .split(/[\n,]/)
    .map((v) => normalizeOrigin(v))
    .filter((v): v is string => Boolean(v));
  const forwardedOrigin = getForwardedOrigin(req);

  return new Set([requestOrigin, ...(forwardedOrigin ? [forwardedOrigin] : []), ...fromEnv]);
}

export async function assertSameOrigin(req: Request) {
  const url = new URL(req.url);
  const origin = normalizeOrigin(req.headers.get('origin'));
  const refererOrigin = normalizeOrigin(req.headers.get('referer'));
  const secFetchSite = req.headers.get('sec-fetch-site');
  const allowedOrigins = getAllowedOrigins(req, url.origin);
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip');
  const userAgent = req.headers.get('user-agent');

  if (origin && allowedOrigins.has(origin)) {
    return null;
  }

  if (!origin) {
    const canFallbackByReferer =
      refererOrigin &&
      allowedOrigins.has(refererOrigin) &&
      (!secFetchSite ||
        secFetchSite === 'same-origin' ||
        secFetchSite === 'same-site' ||
        secFetchSite === 'none');
    const canFallbackByFetchSite = secFetchSite === 'same-origin' || secFetchSite === 'none';

    if (canFallbackByReferer || canFallbackByFetchSite) {
      return null;
    }

    await writeSecurityEvent({
      eventType: 'request.origin_check',
      outcome: 'blocked',
      ipAddress,
      userAgent,
      path: url.pathname,
      detail: { reason: 'missing_origin', refererOrigin, secFetchSite },
    });
    return NextResponse.json({ error: 'Missing origin' }, { status: 403 });
  }

  await writeSecurityEvent({
    eventType: 'request.origin_check',
    outcome: 'blocked',
    ipAddress,
    userAgent,
    path: url.pathname,
    detail: { reason: 'invalid_origin', origin, refererOrigin, secFetchSite },
  });
  return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
}
