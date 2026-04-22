'use client';

import { useEffect } from 'react';

const ROOT_SELECTOR = '[data-portfolio-module="triage"]';
const MATRIX_TRIGGER_SELECTOR = '[data-matrix-project-ids]';
const ACTIVITY_SELECTOR = '[data-activity-project-id]';

function getMatrixProjectIds(trigger: Element | null) {
  return trigger?.getAttribute('data-matrix-project-ids')?.split(' ').filter(Boolean) ?? [];
}

function clearHighlights(root: Element) {
  root.querySelectorAll(ACTIVITY_SELECTOR).forEach((element) => {
    element.setAttribute('data-activity-highlighted', 'false');
  });
}

function applyHighlights(root: Element, projectIds: string[]) {
  clearHighlights(root);

  projectIds.forEach((projectId) => {
    root
      .querySelectorAll(`[data-activity-project-id="${projectId}"]`)
      .forEach((element) => element.setAttribute('data-activity-highlighted', 'true'));
  });
}

function syncHighlightsFromElement(root: Element, target: EventTarget | null) {
  if (!(target instanceof Element)) {
    clearHighlights(root);
    return;
  }

  const trigger = target.closest(MATRIX_TRIGGER_SELECTOR);

  if (!trigger || !root.contains(trigger)) {
    clearHighlights(root);
    return;
  }

  const projectIds = getMatrixProjectIds(trigger);

  if (projectIds.length === 0) {
    clearHighlights(root);
    return;
  }

  applyHighlights(root, projectIds);
}

function syncFromRelatedTarget(root: Element, relatedTarget: EventTarget | null) {
  if (!(relatedTarget instanceof Element)) {
    clearHighlights(root);
    return;
  }

  const nextTrigger = relatedTarget.closest(MATRIX_TRIGGER_SELECTOR);

  if (!nextTrigger || !root.contains(nextTrigger)) {
    clearHighlights(root);
    return;
  }

  applyHighlights(root, getMatrixProjectIds(nextTrigger));
}

export function DashboardPortfolioOverviewHighlightBridge() {
  useEffect(() => {
    const root = document.querySelector(ROOT_SELECTOR);

    if (!root) return;

    clearHighlights(root);

    const handlePointerOver = (event: Event) => {
      syncHighlightsFromElement(root, event.target);
    };

    const handlePointerOut = (event: Event) => {
      syncFromRelatedTarget(root, (event as PointerEvent).relatedTarget);
    };

    const handleFocusIn = (event: Event) => {
      syncHighlightsFromElement(root, event.target);
    };

    const handleFocusOut = (event: Event) => {
      syncFromRelatedTarget(root, (event as FocusEvent).relatedTarget);
    };

    const handlePress = (event: Event) => {
      syncHighlightsFromElement(root, event.target);
    };

    root.addEventListener('pointerover', handlePointerOver);
    root.addEventListener('pointerout', handlePointerOut);
    root.addEventListener('focusin', handleFocusIn);
    root.addEventListener('focusout', handleFocusOut);
    root.addEventListener('touchstart', handlePress, { passive: true });
    root.addEventListener('click', handlePress);

    return () => {
      root.removeEventListener('pointerover', handlePointerOver);
      root.removeEventListener('pointerout', handlePointerOut);
      root.removeEventListener('focusin', handleFocusIn);
      root.removeEventListener('focusout', handleFocusOut);
      root.removeEventListener('touchstart', handlePress);
      root.removeEventListener('click', handlePress);
    };
  }, []);

  return null;
}
