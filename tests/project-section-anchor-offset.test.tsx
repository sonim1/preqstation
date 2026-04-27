// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectSectionAnchorOffset } from '@/app/(workspace)/(main)/project/[key]/project-section-anchor-offset';

type ResizeObserverRecord = {
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
  trigger: () => void;
};

const resizeObservers: ResizeObserverRecord[] = [];

describe('ProjectSectionAnchorOffset', () => {
  let navHeight = 72.2;

  beforeEach(() => {
    resizeObservers.length = 0;

    class ResizeObserverMock {
      disconnect = vi.fn();
      observe = vi.fn();

      constructor(private readonly callback: ResizeObserverCallback) {
        resizeObservers.push({
          disconnect: this.disconnect,
          observe: this.observe,
          trigger: () => this.callback([] as ResizeObserverEntry[], this as unknown as ResizeObserver),
        });
      }
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if ((this as HTMLElement).dataset.projectSectionNav === 'true') {
        return {
          bottom: navHeight,
          height: navHeight,
          left: 0,
          right: 0,
          toJSON: () => ({}),
          top: 0,
          width: 0,
          x: 0,
          y: 0,
        } as DOMRect;
      }

      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        toJSON: () => ({}),
        top: 0,
        width: 0,
        x: 0,
        y: 0,
      } as DOMRect;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores the nav height on the shared section container and keeps it in sync', async () => {
    const { container, unmount } = render(
      <div data-testid="project-sections-shell">
        <nav aria-label="Project sections" data-project-section-nav="true" />
        <section id="project-overview" />
        <ProjectSectionAnchorOffset />
      </div>,
    );

    const shell = container.querySelector('[data-testid="project-sections-shell"]');
    expect(shell).not.toBeNull();

    await waitFor(() =>
      expect(shell?.style.getPropertyValue('--project-section-nav-height')).toBe('73px'),
    );

    expect(resizeObservers).toHaveLength(1);

    navHeight = 120.4;
    resizeObservers[0]?.trigger();

    await waitFor(() =>
      expect(shell?.style.getPropertyValue('--project-section-nav-height')).toBe('121px'),
    );

    unmount();

    expect(shell?.style.getPropertyValue('--project-section-nav-height')).toBe('');
    expect(resizeObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
  });
});
