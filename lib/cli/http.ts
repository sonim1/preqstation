import type { CliConfig } from '@/lib/cli/config';

export async function requestPreqstationApi({
  config,
  path,
  method = 'GET',
  body,
  fetchImpl = fetch,
}: {
  config: CliConfig;
  path: string;
  method?: string;
  body?: unknown;
  fetchImpl?: typeof fetch;
}) {
  const response = await fetchImpl(`${config.apiUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.apiToken}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      payload,
    };
  }

  return {
    ok: true as const,
    status: response.status,
    payload,
  };
}
