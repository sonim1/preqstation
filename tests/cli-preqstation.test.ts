import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    expect(packageJson.bin).toEqual({ 'preqstation-agent': 'bin/preqstation.mjs' });
  });

  it('builds the production bin from the tested CLI source', () => {
    execFileSync('node', ['scripts/build-cli.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const help = execFileSync('node', ['bin/preqstation.mjs', 'help'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const guide = execFileSync('node', ['bin/preqstation.mjs', 'agent', 'guide', '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(help).toContain('preqstation-agent graph node complete');
    expect(help).toContain('--metadata-file');
    expect(JSON.parse(guide)).toMatchObject({
      ok: true,
      data: {
        workflow_profile: {
          metadata_namespace: 'workflow_profile',
        },
      },
    });
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

  it('exposes the workflow profile contract in the agent guide', async () => {
    const io = makeIo();
    const exitCode = await runPreqstationCli({
      argv: ['agent', 'guide', '--json'],
      env: {},
      writeStdout: io.writeStdout.bind(io),
      writeStderr: io.writeStderr.bind(io),
    });

    expect(exitCode).toBe(0);
    const data = JSON.parse(io.stdout).data;
    expect(data.workflow_profile).toMatchObject({
      default: { requested: 'auto', manual_command: null },
      metadata_namespace: 'workflow_profile',
      core_chooses_workflow: false,
      dispatch_command_metadata: false,
      cli_metadata_file: '--metadata-file',
      resolved_fields: ['resolved', 'resolved_command', 'resolved_reason'],
    });
    expect(data.rules).toContain(
      'When workflow profile is auto, the harness chooses the concrete workflow and records the resolved choice in metadata.workflow_profile.',
    );
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

  it('passes graph node metadata files to the work graph node API', async () => {
    const io = makeIo();
    const tempDir = mkdtempSync(join(tmpdir(), 'preqstation-cli-'));
    const metadataPath = join(tempDir, 'metadata.json');
    const metadata = {
      workflow_profile: {
        requested: 'auto',
        manual_command: null,
        resolved: 'gstack-plan-eng-review',
        resolved_command: '/plan-eng-review',
        resolved_reason: 'Architecture review needed before implementation.',
      },
    };
    writeFileSync(metadataPath, JSON.stringify(metadata), 'utf8');
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

    try {
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
          '--metadata-file',
          metadataPath,
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
          body: JSON.stringify({ type: 'analyze', title: 'Analyze', metadata }),
        }),
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns a JSON error when a graph metadata file is missing', async () => {
    const io = makeIo();
    const fetchImpl = vi.fn();
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
        '--metadata-file',
        '/tmp/preqstation-missing-metadata.json',
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

    expect(exitCode).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(JSON.parse(io.stdout)).toMatchObject({
      ok: false,
      error: {
        code: 'usage_error',
        message: '--metadata-file: cannot read file: /tmp/preqstation-missing-metadata.json',
      },
    });
  });

  it('returns a JSON error when a graph metadata file is invalid JSON', async () => {
    const io = makeIo();
    const tempDir = mkdtempSync(join(tmpdir(), 'preqstation-cli-'));
    const metadataPath = join(tempDir, 'metadata.json');
    writeFileSync(metadataPath, '{', 'utf8');
    const fetchImpl = vi.fn();

    try {
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
          '--metadata-file',
          metadataPath,
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

      expect(exitCode).toBe(1);
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(JSON.parse(io.stdout)).toMatchObject({
        ok: false,
        error: {
          code: 'usage_error',
          message: `--metadata-file: file does not contain valid JSON: ${metadataPath}`,
        },
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('passes metadata files when completing graph nodes', async () => {
    const io = makeIo();
    const tempDir = mkdtempSync(join(tmpdir(), 'preqstation-cli-'));
    const metadataPath = join(tempDir, 'metadata.json');
    const summaryPath = join(tempDir, 'summary.md');
    const metadata = {
      workflow_profile: {
        requested: 'auto',
        manual_command: null,
        resolved: 'gstack-plan-eng-review',
        resolved_command: '/plan-eng-review',
        resolved_reason: 'Architecture review needed before implementation.',
      },
    };
    writeFileSync(metadataPath, JSON.stringify(metadata), 'utf8');
    writeFileSync(summaryPath, 'Completed analysis.', 'utf8');
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          schema_version: 'preqstation.v2.0',
          request_id: 'req_test',
          data: { node: { id: 'node-1', status: 'completed' } },
          warnings: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    try {
      const exitCode = await runPreqstationCli({
        argv: [
          'graph',
          'node',
          'complete',
          'node-1',
          '--summary-file',
          summaryPath,
          '--metadata-file',
          metadataPath,
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
        'https://preq.example/api/work-nodes/node-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            action: 'complete',
            result_summary: 'Completed analysis.',
            metadata,
          }),
        }),
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
