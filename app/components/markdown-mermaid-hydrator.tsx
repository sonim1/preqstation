'use client';

import { type RefObject, useEffect } from 'react';

import { renderMermaidNodes } from '@/app/components/mermaid-renderer';

type MarkdownMermaidHydratorProps = {
  containerRef: RefObject<HTMLElement | null>;
  html: string;
};

export function MarkdownMermaidHydrator({ containerRef, html }: MarkdownMermaidHydratorProps) {
  useEffect(() => {
    const nodes = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('.mermaid') ?? []);
    if (nodes.length === 0) return undefined;

    let cancelled = false;

    void renderMermaidNodes(nodes, () => cancelled).catch((error: unknown) => {
      if (cancelled) return;
      console.error('Failed to render Mermaid diagram', error);
    });

    return () => {
      cancelled = true;
    };
  }, [containerRef, html]);

  return null;
}
