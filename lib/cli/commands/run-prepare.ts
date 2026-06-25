import type { CliConfig } from '@/lib/cli/config';
import { requestPreqstationApi } from '@/lib/cli/http';

export async function runPrepare(params: {
  config: CliConfig;
  taskKey: string;
  fetchImpl?: typeof fetch;
}) {
  return requestPreqstationApi({
    config: params.config,
    path: `/api/tasks/${encodeURIComponent(params.taskKey)}/work-graph`,
    fetchImpl: params.fetchImpl,
  });
}
