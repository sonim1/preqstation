import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { KanbanStatusIndicator } from '@/app/components/kanban-status-indicator';

describe('app/components/kanban-status-indicator', () => {
  it('renders Hold as a paused off-flow state instead of midpoint progress', () => {
    const html = renderToStaticMarkup(<KanbanStatusIndicator status="hold" />);

    expect(html).toContain('is-hold');
    expect(html).toContain('is-paused');
    expect(html).toContain('data-paused="true"');
    expect(html).toContain('--kanban-status-fill:0%');
    expect(html).toContain('kanban-status-indicator-paused-dot');
  });
});
