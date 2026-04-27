'use client';

import { useEffect } from 'react';

const PROJECT_SECTION_NAV_SELECTOR = '[data-project-section-nav="true"]';
const PROJECT_SECTION_NAV_HEIGHT_VAR = '--project-section-nav-height';

export function ProjectSectionAnchorOffset() {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(PROJECT_SECTION_NAV_SELECTOR);
    const container = nav?.parentElement;
    if (!nav || !container) return;

    const syncNavHeight = () => {
      container.style.setProperty(
        PROJECT_SECTION_NAV_HEIGHT_VAR,
        `${Math.ceil(nav.getBoundingClientRect().height)}px`,
      );
    };

    syncNavHeight();

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        container.style.removeProperty(PROJECT_SECTION_NAV_HEIGHT_VAR);
      };
    }

    const observer = new ResizeObserver(() => {
      syncNavHeight();
    });

    observer.observe(nav);

    return () => {
      observer.disconnect();
      container.style.removeProperty(PROJECT_SECTION_NAV_HEIGHT_VAR);
    };
  }, []);

  return null;
}
