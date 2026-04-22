import { headers } from 'next/headers';

export async function getRequestContext() {
  const h = await headers();
  const ipAddress = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const userAgent = h.get('user-agent') || null;
  const path = h.get('x-pathname') || null;
  return { ipAddress, userAgent, path };
}
