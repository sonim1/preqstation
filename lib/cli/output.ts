export const CLI_SCHEMA_VERSION = 'preqstation.v2.0';

export type CliEnvelope =
  | {
      ok: true;
      schema_version: typeof CLI_SCHEMA_VERSION;
      data: unknown;
      warnings: string[];
    }
  | {
      ok: false;
      schema_version: typeof CLI_SCHEMA_VERSION;
      error: { code: string; message: string; details?: Record<string, unknown> };
      warnings: string[];
    };

export function cliSuccess(data: unknown, warnings: string[] = []): CliEnvelope {
  return {
    ok: true,
    schema_version: CLI_SCHEMA_VERSION,
    data,
    warnings,
  };
}

export function cliError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): CliEnvelope {
  return {
    ok: false,
    schema_version: CLI_SCHEMA_VERSION,
    error: { code, message, details },
    warnings: [],
  };
}

export function formatCliEnvelope(envelope: CliEnvelope) {
  return `${JSON.stringify(envelope)}\n`;
}
