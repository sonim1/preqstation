/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captureKanbanCardRects,
  playKanbanCardMoveAnimations,
} from '@/app/components/use-kanban-card-move-animation';

function makeRect(left: number, top: number, width = 100, height = 40): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
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

  it('does not capture cards with zero width and height', () => {
    const container = document.createElement('div');
    appendCard(container, 'PROJ-1', { left: 10, top: 20 });
    const hiddenCard = appendCard(container, 'PROJ-2', { left: 0, top: 0 });
    hiddenCard.getBoundingClientRect = vi.fn(() => makeRect(0, 0, 0, 0));
    document.body.appendChild(container);

    const rects = captureKanbanCardRects(container);

    expect(rects.has('PROJ-1')).toBe(true);
    expect(rects.has('PROJ-2')).toBe(false);
  });

  it('does not animate cards with zero width and height', () => {
    const container = document.createElement('div');
    const card = appendCard(container, 'PROJ-1', { left: 10, top: 20 });
    document.body.appendChild(container);

    const previousRects = captureKanbanCardRects(container);
    card.getBoundingClientRect = vi.fn(() => makeRect(0, 0, 0, 0));

    playKanbanCardMoveAnimations(container, previousRects);

    expect(card.animate).not.toHaveBeenCalled();
  });

  it('cancels existing kanban move animations before starting a new one', () => {
    const container = document.createElement('div');
    const card = appendCard(container, 'PROJ-1', { left: 10, top: 20 });
    const cancelMoveAnimation = vi.fn();
    const cancelOtherAnimation = vi.fn();
    card.getAnimations = vi.fn(
      () =>
        [
          { id: 'kanban-card-move', cancel: cancelMoveAnimation },
          { id: 'other-animation', cancel: cancelOtherAnimation },
        ] as unknown as Animation[],
    );
    document.body.appendChild(container);

    const previousRects = captureKanbanCardRects(container);
    card.getBoundingClientRect = vi
      .fn()
      .mockReturnValueOnce(makeRect(90, 140))
      .mockReturnValueOnce(makeRect(120, 180));

    playKanbanCardMoveAnimations(container, previousRects);

    expect(cancelMoveAnimation).toHaveBeenCalledTimes(1);
    expect(cancelOtherAnimation).not.toHaveBeenCalled();
    expect(card.animate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ id: 'kanban-card-move' }),
    );
  });

  it('starts replacement move animations from the live in-flight rect', () => {
    const container = document.createElement('div');
    const card = appendCard(container, 'PROJ-1', { left: 10, top: 20 });
    const cancelMoveAnimation = vi.fn();
    card.getAnimations = vi.fn(
      () => [{ id: 'kanban-card-move', cancel: cancelMoveAnimation }] as unknown as Animation[],
    );
    document.body.appendChild(container);

    const previousRects = captureKanbanCardRects(container);
    card.getBoundingClientRect = vi
      .fn()
      .mockReturnValueOnce(makeRect(90, 140))
      .mockReturnValueOnce(makeRect(150, 220));

    playKanbanCardMoveAnimations(container, previousRects);

    expect(cancelMoveAnimation).toHaveBeenCalledTimes(1);
    expect(card.animate).toHaveBeenCalledWith(
      [{ transform: 'translate(-60px, -80px)' }, { transform: 'translate(0, 0)' }],
      expect.objectContaining({ id: 'kanban-card-move' }),
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
