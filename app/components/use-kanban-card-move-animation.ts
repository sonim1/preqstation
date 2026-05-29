'use client';

import { useCallback, useRef } from 'react';

type CardRectMap = Map<string, DOMRect>;

const CARD_SELECTOR = '[data-kanban-task-key]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DEFAULT_DURATION_MS = 220;
const DEFAULT_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

function shouldSkipCard(element: HTMLElement) {
  return (
    element.dataset.kanbanDragging === 'true' || element.dataset.kanbanDropAnimating === 'true'
  );
}

function formatTranslateValue(value: number) {
  return `${Math.round(value)}px`;
}

export function captureKanbanCardRects(container: HTMLElement | null): CardRectMap {
  const rects: CardRectMap = new Map();
  if (!container) {
    return rects;
  }

  for (const element of Array.from(container.querySelectorAll<HTMLElement>(CARD_SELECTOR))) {
    const taskKey = element.dataset.kanbanTaskKey;
    if (!taskKey || shouldSkipCard(element)) {
      continue;
    }

    rects.set(taskKey, element.getBoundingClientRect());
  }

  return rects;
}

export function playKanbanCardMoveAnimations(
  container: HTMLElement | null,
  previousRects: CardRectMap,
) {
  if (!container || previousRects.size === 0 || prefersReducedMotion()) {
    return;
  }

  for (const element of Array.from(container.querySelectorAll<HTMLElement>(CARD_SELECTOR))) {
    const taskKey = element.dataset.kanbanTaskKey;
    if (!taskKey || shouldSkipCard(element) || typeof element.animate !== 'function') {
      continue;
    }

    const previousRect = previousRects.get(taskKey);
    if (!previousRect) {
      continue;
    }

    const currentRect = element.getBoundingClientRect();
    const deltaX = previousRect.left - currentRect.left;
    const deltaY = previousRect.top - currentRect.top;
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
      continue;
    }

    element.animate(
      [
        {
          transform: `translate(${formatTranslateValue(deltaX)}, ${formatTranslateValue(deltaY)})`,
        },
        { transform: 'translate(0, 0)' },
      ],
      {
        duration: DEFAULT_DURATION_MS,
        easing: DEFAULT_EASING,
      },
    );
  }
}

export function useKanbanCardMoveAnimation() {
  const previousRectsRef = useRef<CardRectMap>(new Map());

  const captureCardRects = useCallback((container: HTMLElement | null) => {
    previousRectsRef.current = captureKanbanCardRects(container);
  }, []);

  const playCardMoveAnimations = useCallback((container: HTMLElement | null) => {
    const previousRects = previousRectsRef.current;
    previousRectsRef.current = new Map();
    playKanbanCardMoveAnimations(container, previousRects);
  }, []);

  return { captureCardRects, playCardMoveAnimations };
}
