export type CliConfig = {
  apiUrl: string;
  apiToken: string;
  projectMapPath?: string;
};

export function loadCliConfig(env: Record<string, string | undefined>) {
  const apiUrl = env.PREQSTATION_API_URL?.replace(/\/+$/, '');
  const apiToken = env.PREQSTATION_API_TOKEN;

  if (!apiUrl || !apiToken) {
    return {
      ok: false as const,
      message: 'PREQSTATION_API_URL and PREQSTATION_API_TOKEN are required.',
    };
  }

  return {
    ok: true as const,
    config: {
      apiUrl,
      apiToken,
      projectMapPath: env.PREQSTATION_PROJECT_MAP,
    },
  };
}
