// @vitest-environment jsdom

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
});
