// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkNodeDetailPanel } from '@/app/components/work-node-detail-panel';

describe('WorkNodeDetailPanel', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders runtime, result, failure, and evidence details', () => {
    render(
      <MantineProvider>
        <WorkNodeDetailPanel
          node={{
            id: 'node-1',
            parent_id: null,
            type: 'test',
            status: 'failed',
            title: 'Run unit tests',
            body: 'Execute focused tests.',
            engine: 'codex',
            runtime_target: 'local',
            result_summary: 'One assertion failed.',
            waiting_reason: null,
          }}
          evidence={[
            {
              id: 'evidence-1',
              node_id: 'node-1',
              kind: 'test',
              title: 'Vitest',
              summary: '1 failed, 20 passed',
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('Run unit tests')).toBeTruthy();
    expect(screen.getByText('codex')).toBeTruthy();
    expect(screen.getByText('local')).toBeTruthy();
    expect(screen.getByText('One assertion failed.')).toBeTruthy();
    expect(screen.getByText('Vitest')).toBeTruthy();
    expect(screen.getByText('1 failed, 20 passed')).toBeTruthy();
  });
});
