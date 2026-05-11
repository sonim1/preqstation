'use client';

import { useEffect, useRef, useState } from 'react';

let mermaidInitialized = false;

export async function renderMermaidNodes(nodes: HTMLElement[], shouldCancel?: () => boolean) {
  if (nodes.length === 0) return;

  const { default: mermaid } = await import('mermaid');
  if (shouldCancel?.()) return;

  if (!mermaidInitialized) {
    mermaid.initialize({ securityLevel: 'strict', startOnLoad: false });
    mermaidInitialized = true;
  }
  await mermaid.run({ nodes });
}

type MermaidDiagramProps = {
  source: string;
  className?: string;
};

export function MermaidDiagram({ source, className = 'mermaid' }: MermaidDiagramProps) {
  const diagramRef = useRef<HTMLPreElement | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const node = diagramRef.current;
    if (!node) return undefined;

    node.removeAttribute('data-processed');
    node.textContent = source;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset fallback state before hydrating the latest diagram source
    setHasError(false);

    let cancelled = false;

    void renderMermaidNodes([node], () => cancelled).catch((error: unknown) => {
      if (cancelled) return;
      console.error('Failed to render Mermaid diagram', error);
      node.textContent = source;
      setHasError(true);
    });

    return () => {
      cancelled = true;
    };
  }, [source]);

  return (
    <div className="live-editor-mermaid">
      <pre
        ref={diagramRef}
        className={className}
        style={hasError ? { display: 'none' } : undefined}
      >
        {source}
      </pre>
      {hasError ? <pre className="live-editor-mermaid-source">{source}</pre> : null}
    </div>
  );
}
