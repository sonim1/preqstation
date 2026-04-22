import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  function MockTabs({
    children,
    hiddenFrom: _hiddenFrom,
    value: _value,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    children?: React.ReactNode;
    hiddenFrom?: string;
    value?: string;
  }) {
    return (
      <div data-tabs-root="true" {...props}>
        {children}
      </div>
    );
  }

  function MockTabsList({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    children?: React.ReactNode;
  }) {
    return (
      <div data-tabs-list="true" {...props}>
        {children}
      </div>
    );
  }

  function MockTabsTab({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
  }) {
    return (
      <button type="button" data-tabs-tab="true" {...props}>
        {children}
      </button>
    );
  }

  function MockTabsPanel({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    children?: React.ReactNode;
  }) {
    return (
      <div data-tabs-panel="true" {...props}>
        {children}
      </div>
    );
  }

  return {
    ...actual,
    Tabs: MockTabs,
    TabsList: MockTabsList,
    TabsTab: MockTabsTab,
    TabsPanel: MockTabsPanel,
  };
});

import { BoardLoadingShell } from '@/app/components/board-loading-shell';

describe('app/components/board-loading-shell RSC compatibility', () => {
  it('renders when compound Tabs statics are unavailable across the server boundary', () => {
    expect(() =>
      renderToStaticMarkup(
        <MantineProvider>
          <BoardLoadingShell />
        </MantineProvider>,
      ),
    ).not.toThrow();
  });
});
