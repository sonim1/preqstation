/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captureKanbanCardRects,
  playKanbanCardMoveAnimations,
} from '@/app/components/use-kanban-card-move-animation';

function makeRect(left: number, top: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + 100,
    bottom: top + 40,
    width: 100,
    height: 40,
    toJSON: () => ({}),
  } as DOMRect;
}

function appendCard(container: HTMLElement, taskKey: string, rect: { left: number; top: number }) {
  const card = document.createElement('div');
  card.dataset.kanbanTaskKey = taskKey;
  card.getBoundingClientRect = vi.fn(() => makeRect(rect.left, rect.top));
  card.animate = vi.fn();
  container.appendChild(card);
  return card;
}

describe('kanban card move animation helper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('animates cards from their previous rect to their current rect', () => {
    const container = document.createElement('div');
    const card = appendCard(container, 'PROJ-1', { left: 10, top: 20 });
    document.body.appendChild(container);

    const previousRects = captureKanbanCardRects(container);
    card.getBoundingClientRect = vi.fn(() => makeRect(90, 140));

    playKanbanCardMoveAnimations(container, previousRects);

    expect(card.animate).toHaveBeenCalledWith(
      [{ transform: 'translate(-80px, -120px)' }, { transform: 'translate(0, 0)' }],
      expect.objectContaining({
        duration: 220,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      }),
    );
  });

  it('does not animate when reduced motion is requested', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    const container = document.createElement('div');
    const card = appendCard(container, 'PROJ-1', { left: 10, top: 20 });
    document.body.appendChild(container);

    const previousRects = captureKanbanCardRects(container);
    card.getBoundingClientRect = vi.fn(() => makeRect(90, 140));

    playKanbanCardMoveAnimations(container, previousRects);

    expect(card.animate).not.toHaveBeenCalled();
  });

  it('skips cards currently controlled by drag and drop', () => {
    const container = document.createElement('div');
    const card = appendCard(container, 'PROJ-1', { left: 10, top: 20 });
    document.body.appendChild(container);

    const previousRects = captureKanbanCardRects(container);
    card.dataset.kanbanDragging = 'true';
    card.getBoundingClientRect = vi.fn(() => makeRect(90, 140));

    playKanbanCardMoveAnimations(container, previousRects);

    expect(card.animate).not.toHaveBeenCalled();
  });
});
