import { describe, expect, it, vi } from 'vitest';

import { runPreqstationCli } from '@/lib/cli';
import packageJson from '@/package.json' with { type: 'json' };

function makeIo() {
  return {
    stdout: '',
    stderr: '',
    writeStdout(text: string) {
      this.stdout += text;
    },
    writeStderr(text: string) {
      this.stderr += text;
    },
  };
}

describe('preqstation CLI', () => {
  it('registers the preqstation binary', () => {
    expect(packageJson.bin).toEqual({ preqstation: 'bin/preqstation.mjs' });
  });

  it('prints valid JSON for agent guide without requiring API config', async () => {
    const io = makeIo();
    const exitCode = await runPreqstationCli({
      argv: ['agent', 'guide', '--json'],
      env: {},
      writeStdout: io.writeStdout.bind(io),
      writeStderr: io.writeStderr.bind(io),
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(io.stdout)).toMatchObject({
      ok: true,
      schema_version: 'preqstation.v2.0',
      data: {
        product: 'PreqStation',
        runtime_agnostic: true,
      },
    });
  });

  it('returns exit code 2 for API commands when config is missing', async () => {
    const io = makeIo();
    const exitCode = await runPreqstationCli({
      argv: ['graph', 'state', 'PREQ-1', '--json'],
      env: {},
      writeStdout: io.writeStdout.bind(io),
      writeStderr: io.writeStderr.bind(io),
    });

    expect(exitCode).toBe(2);
    expect(JSON.parse(io.stdout)).toMatchObject({
      ok: false,
      error: { code: 'config_error' },
    });
  });

  it('maps graph node create to the work graph node API', async () => {
    const io = makeIo();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          schema_version: 'preqstation.v2.0',
          request_id: 'req_test',
          data: { node: { id: 'node-1' } },
          warnings: [],
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );

    const exitCode = await runPreqstationCli({
      argv: [
        'graph',
        'node',
        'create',
        'PREQ-1',
        '--type',
        'analyze',
        '--title',
        'Analyze',
        '--json',
      ],
      env: {
        PREQSTATION_API_URL: 'https://preq.example',
        PREQSTATION_API_TOKEN: 'preq_token',
      },
      fetchImpl,
      writeStdout: io.writeStdout.bind(io),
      writeStderr: io.writeStderr.bind(io),
    });

    expect(exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://preq.example/api/tasks/PREQ-1/work-graph/nodes',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer preq_token',
          'content-type': 'application/json',
        }),
        body: JSON.stringify({ type: 'analyze', title: 'Analyze' }),
      }),
    );
    expect(JSON.parse(io.stdout)).toMatchObject({ ok: true, data: { node: { id: 'node-1' } } });
  });
});
