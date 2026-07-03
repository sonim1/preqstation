import { buildAgentGuide } from '@/lib/cli/commands/agent-guide';
import { buildContextDoctor, buildContextFiles } from '@/lib/cli/commands/context';
import { runGraphCommand } from '@/lib/cli/commands/graph';
import { runPrepare } from '@/lib/cli/commands/run-prepare';
import { loadCliConfig } from '@/lib/cli/config';
import { cliError, cliSuccess, formatCliEnvelope } from '@/lib/cli/output';
import { loadProjectMap, resolveProjectEntry } from '@/lib/cli/project-resolve';

type RunCliParams = {
  argv: string[];
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  writeStdout?: (text: string) => void;
  writeStderr?: (text: string) => void;
};

function optionValue(argv: string[], name: string) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

function emitJson(params: RunCliParams, envelope: ReturnType<typeof cliSuccess | typeof cliError>) {
  params.writeStdout?.(formatCliEnvelope(envelope));
}

function emitHuman(params: RunCliParams, text: string) {
  params.writeStdout?.(`${text}\n`);
}

function helpText() {
  return [
    'preqstation help',
    'preqstation agent guide --json',
    'preqstation project resolve PREQ --json',
    'preqstation context files PREQ --json',
    'preqstation context doctor PREQ --json',
    'preqstation run prepare PREQ-123 --json',
    'preqstation graph init PREQ-123 --json',
    'preqstation graph state PREQ-123 --json',
    'preqstation graph node create PREQ-123 --type analyze --title "Inspect CLI" --metadata-file metadata.json --json',
    'preqstation graph node complete NODE-ID --summary-file result.md --metadata-file metadata.json --json',
  ].join('\n');
}

export async function runPreqstationCli({
  argv,
  env = process.env,
  fetchImpl = fetch,
  writeStdout = (text) => process.stdout.write(text),
  writeStderr = (text) => process.stderr.write(text),
}: RunCliParams) {
  const params = { argv, env, fetchImpl, writeStdout, writeStderr };
  const json = argv.includes('--json');
  const args = argv.filter((arg) => arg !== '--json');
  const [command, subcommand] = args;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    if (json) emitJson(params, cliSuccess({ help: helpText() }));
    else emitHuman(params, helpText());
    return 0;
  }

  if (command === 'agent' && subcommand === 'guide') {
    const guide = buildAgentGuide(optionValue(args, '--engine'));
    if (json) emitJson(params, cliSuccess(guide));
    else emitHuman(params, guide.rules.join('\n'));
    return 0;
  }

  const configResult = loadCliConfig(env);
  if (!configResult.ok) {
    const envelope = cliError('config_error', configResult.message);
    if (json) emitJson(params, envelope);
    else writeStderr(`${configResult.message}\n`);
    return 2;
  }

  if (command === 'project' && subcommand === 'resolve') {
    const projectKey = args[2] ?? '';
    const entry = resolveProjectEntry(
      projectKey,
      loadProjectMap(configResult.config.projectMapPath),
    );
    const data = { project_key: projectKey, project: entry };
    if (json) emitJson(params, cliSuccess(data));
    else emitHuman(params, entry?.repo_root ?? '');
    return entry ? 0 : 1;
  }

  if (command === 'context' && subcommand === 'files') {
    emitJson(
      params,
      cliSuccess(buildContextFiles(args[2] ?? '', configResult.config.projectMapPath)),
    );
    return 0;
  }

  if (command === 'context' && subcommand === 'doctor') {
    emitJson(
      params,
      cliSuccess(buildContextDoctor(args[2] ?? '', configResult.config.projectMapPath)),
    );
    return 0;
  }

  const apiResult =
    command === 'run' && subcommand === 'prepare'
      ? await runPrepare({ config: configResult.config, taskKey: args[2] ?? '', fetchImpl })
      : command === 'graph'
        ? await runGraphCommand({ config: configResult.config, argv: args.slice(1), fetchImpl })
        : null;

  if (!apiResult) {
    const message = `Unknown command: ${args.join(' ')}`;
    const envelope = cliError('usage_error', message);
    if (json) emitJson(params, envelope);
    else writeStderr(`${message}\n`);
    return 1;
  }

  if (!apiResult.ok) {
    const error = (apiResult.payload as { error?: { code?: string; message?: string } })?.error;
    emitJson(
      params,
      cliError(error?.code ?? 'api_error', error?.message ?? 'PreqStation API request failed.', {
        status: apiResult.status,
      }),
    );
    return 1;
  }

  if (json) {
    params.writeStdout?.(`${JSON.stringify(apiResult.payload)}\n`);
  } else {
    params.writeStdout?.(`${JSON.stringify(apiResult.payload, null, 2)}\n`);
  }
  return 0;
}
