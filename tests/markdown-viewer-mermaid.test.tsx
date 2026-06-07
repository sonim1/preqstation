// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MarkdownViewer } from '@/app/components/markdown-viewer';

const initialize = vi.fn();
const run = vi.fn().mockResolvedValue(undefined);

vi.mock('mermaid', () => ({
  default: {
    initialize,
    run,
  },
}));

describe('MarkdownViewer mermaid hydration', () => {
  it('keeps the Mermaid renderer behind a client-only boundary', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/markdown-viewer.tsx'), 'utf8');

    expect(source).not.toContain("from '@/app/components/mermaid-renderer'");
  });

  it('hydrates mermaid blocks inside the current viewer', async () => {
    render(<MarkdownViewer markdown={'```mermaid\ngraph TD\nA --> B\n```'} />);

    await waitFor(() => {
      expect(initialize).toHaveBeenCalledWith({
        securityLevel: 'strict',
        startOnLoad: false,
      });
      expect(run).toHaveBeenCalledTimes(1);
    });

    const nodes = run.mock.calls[0]?.[0]?.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.classList.contains('mermaid')).toBe(true);
  });

  it('initializes mermaid once across content updates', async () => {
    const runCallCount = run.mock.calls.length;
    const { rerender } = render(<MarkdownViewer markdown={'```mermaid\ngraph TD\nA --> B\n```'} />);

    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(runCallCount + 1);
    });
    const initializeCallCount = initialize.mock.calls.length;

    rerender(<MarkdownViewer markdown={'```mermaid\ngraph TD\nB --> C\n```'} />);

    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(runCallCount + 2);
    });
    expect(initialize).toHaveBeenCalledTimes(initializeCallCount);
  });
});
