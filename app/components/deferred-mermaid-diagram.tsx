'use client';

import dynamic from 'next/dynamic';

type DeferredMermaidDiagramProps = {
  source: string;
  className?: string;
};

const MermaidDiagram = dynamic(
  () => import('@/app/components/mermaid-renderer').then((module) => module.MermaidDiagram),
  { ssr: false },
);

export function DeferredMermaidDiagram(props: DeferredMermaidDiagramProps) {
  return <MermaidDiagram {...props} />;
}
