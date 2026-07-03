import { readFileSync } from 'node:fs';

import type { CliConfig } from '@/lib/cli/config';
import { requestPreqstationApi } from '@/lib/cli/http';

function optionValue(argv: string[], name: string) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

function readOptionalFile(path: string | null) {
  return path ? readFileSync(path, 'utf8') : undefined;
}

export async function runGraphCommand(params: {
  config: CliConfig;
  argv: string[];
  fetchImpl?: typeof fetch;
}) {
  const [subcommand, subcommand2, subcommand3] = params.argv;

  if (subcommand === 'init') {
    const taskKey = params.argv[1];
    return requestPreqstationApi({
      config: params.config,
      path: `/api/tasks/${encodeURIComponent(taskKey)}/work-graph/init`,
      method: 'POST',
      body: {},
      fetchImpl: params.fetchImpl,
    });
  }

  if (subcommand === 'state') {
    const taskKey = params.argv[1];
    return requestPreqstationApi({
      config: params.config,
      path: `/api/tasks/${encodeURIComponent(taskKey)}/work-graph`,
      fetchImpl: params.fetchImpl,
    });
  }

  if (subcommand === 'node' && subcommand2 === 'create') {
    const taskKey = params.argv[2];
    return requestPreqstationApi({
      config: params.config,
      path: `/api/tasks/${encodeURIComponent(taskKey)}/work-graph/nodes`,
      method: 'POST',
      body: {
        type: optionValue(params.argv, '--type'),
        title: optionValue(params.argv, '--title'),
      },
      fetchImpl: params.fetchImpl,
    });
  }

  if (subcommand === 'node' && ['start', 'complete', 'fail'].includes(subcommand2 ?? '')) {
    const nodeId = params.argv[2];
    const action = subcommand2 === 'start' ? 'start' : subcommand2;
    const summary =
      subcommand2 === 'complete'
        ? readOptionalFile(optionValue(params.argv, '--summary-file'))
        : undefined;
    const error =
      subcommand2 === 'fail'
        ? readOptionalFile(optionValue(params.argv, '--error-file'))
        : undefined;

    return requestPreqstationApi({
      config: params.config,
      path: `/api/work-nodes/${encodeURIComponent(nodeId)}`,
      method: 'PATCH',
      body: {
        action,
        ...(summary ? { result_summary: summary } : {}),
        ...(error ? { result_summary: error } : {}),
      },
      fetchImpl: params.fetchImpl,
    });
  }

  if (subcommand === 'evidence' && subcommand2 === 'attach') {
    const nodeId = params.argv[2];
    const evidencePath = optionValue(params.argv, '--file');
    const evidence = evidencePath ? JSON.parse(readFileSync(evidencePath, 'utf8')) : {};
    return requestPreqstationApi({
      config: params.config,
      path: `/api/work-nodes/${encodeURIComponent(nodeId)}/evidence`,
      method: 'POST',
      body: {
        kind: optionValue(params.argv, '--kind') ?? evidence.kind,
        ...evidence,
      },
      fetchImpl: params.fetchImpl,
    });
  }

  if (subcommand === 'memory' && subcommand2 === 'append') {
    const taskKey = params.argv[2];
    const file = optionValue(params.argv, '--file');
    return requestPreqstationApi({
      config: params.config,
      path: `/api/tasks/${encodeURIComponent(taskKey)}/work-graph/memory`,
      method: 'POST',
      body: { append_markdown: file ? readFileSync(file, 'utf8') : '' },
      fetchImpl: params.fetchImpl,
    });
  }

  return {
    ok: false as const,
    status: 1,
    payload: {
      error: {
        code: 'usage_error',
        message: `Unknown graph command: ${[subcommand, subcommand2, subcommand3]
          .filter(Boolean)
          .join(' ')}`,
      },
    },
  };
}
