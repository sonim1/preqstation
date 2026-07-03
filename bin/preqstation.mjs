#!/usr/bin/env node

const SCHEMA_VERSION = 'preqstation.v2.0';

function envelope(data) {
  return { ok: true, schema_version: SCHEMA_VERSION, data, warnings: [] };
}

function errorEnvelope(code, message, details) {
  return { ok: false, schema_version: SCHEMA_VERSION, error: { code, message, details }, warnings: [] };
}

function helpText() {
  return [
    'preqstation help',
    'preqstation agent guide --json',
    'preqstation run prepare PREQ-123 --json',
    'preqstation graph init PREQ-123 --json',
    'preqstation graph state PREQ-123 --json',
    'preqstation graph node create PREQ-123 --type analyze --title "Inspect CLI" --json',
  ].join('\n');
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

function config() {
  const apiUrl = process.env.PREQSTATION_API_URL?.replace(/\/+$/, '');
  const apiToken = process.env.PREQSTATION_API_TOKEN;
  if (!apiUrl || !apiToken) return null;
  return { apiUrl, apiToken };
}

async function apiRequest(cfg, path, method = 'GET', body) {
  const response = await fetch(`${cfg.apiUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${cfg.apiToken}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

async function main() {
  const json = process.argv.includes('--json');
  const args = process.argv.slice(2).filter((arg) => arg !== '--json');
  const [command, subcommand] = args;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    if (json) process.stdout.write(`${JSON.stringify(envelope({ help: helpText() }))}\n`);
    else process.stdout.write(`${helpText()}\n`);
    return 0;
  }

  if (command === 'agent' && subcommand === 'guide') {
    process.stdout.write(
      `${JSON.stringify(
        envelope({
          product: 'PreqStation',
          runtime_agnostic: true,
          engine: optionValue(args, '--engine'),
          rules: [
            'Read the task and work graph from Core before acting.',
            'Create or update work nodes for meaningful execution steps.',
            'Attach bounded evidence.',
          ],
        }),
      )}\n`,
    );
    return 0;
  }

  const cfg = config();
  if (!cfg) {
    const message = 'PREQSTATION_API_URL and PREQSTATION_API_TOKEN are required.';
    if (json) process.stdout.write(`${JSON.stringify(errorEnvelope('config_error', message))}\n`);
    else process.stderr.write(`${message}\n`);
    return 2;
  }

  let result = null;
  if (command === 'run' && subcommand === 'prepare') {
    result = await apiRequest(cfg, `/api/tasks/${encodeURIComponent(args[2] ?? '')}/work-graph`);
  } else if (command === 'graph' && subcommand === 'init') {
    result = await apiRequest(
      cfg,
      `/api/tasks/${encodeURIComponent(args[2] ?? '')}/work-graph/init`,
      'POST',
      {},
    );
  } else if (command === 'graph' && subcommand === 'state') {
    result = await apiRequest(cfg, `/api/tasks/${encodeURIComponent(args[2] ?? '')}/work-graph`);
  } else if (command === 'graph' && subcommand === 'node' && args[2] === 'create') {
    result = await apiRequest(
      cfg,
      `/api/tasks/${encodeURIComponent(args[3] ?? '')}/work-graph/nodes`,
      'POST',
      { type: optionValue(args, '--type'), title: optionValue(args, '--title') },
    );
  }

  if (!result) {
    process.stdout.write(`${JSON.stringify(errorEnvelope('usage_error', `Unknown command: ${args.join(' ')}`))}\n`);
    return 1;
  }

  if (!result.ok) {
    const apiError = result.payload?.error;
    process.stdout.write(
      `${JSON.stringify(
        errorEnvelope(apiError?.code ?? 'api_error', apiError?.message ?? 'PreqStation API request failed.', {
          status: result.status,
        }),
      )}\n`,
    );
    return 1;
  }

  process.stdout.write(`${JSON.stringify(result.payload)}\n`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
