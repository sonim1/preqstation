export function isNextRedirectError(error: unknown): error is { digest: string } {
  if (!error || typeof error !== 'object') return false;
  if (!('digest' in error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT');
}
