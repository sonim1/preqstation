import { CodeNode } from '@lexical/code-core';
import { type ElementTransformer } from '@lexical/markdown';
import {
  $applyNodeReplacement,
  $getRoot,
  DecoratorNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { type ReactNode } from 'react';

import { DeferredMermaidDiagram } from '@/app/components/deferred-mermaid-diagram';

type SerializedLiveMermaidNode = Spread<
  {
    source: string;
  },
  SerializedLexicalNode
>;

const NEVER_MATCH_MERMAID_IMPORT = /(?!)/;

export class LiveMermaidNode extends DecoratorNode<ReactNode> {
  __source: string;

  static getType(): string {
    return 'live-mermaid';
  }

  static clone(node: LiveMermaidNode): LiveMermaidNode {
    return new LiveMermaidNode(node.__source, node.__key);
  }

  constructor(source: string, key?: NodeKey) {
    super(key);
    this.__source = source;
  }

  getSource(): string {
    return (this.getLatest() as LiveMermaidNode).__source;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    element.className = 'live-editor-mermaid-block';
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  decorate(): ReactNode {
    return (
      <DeferredMermaidDiagram
        source={this.getSource()}
        className="mermaid live-editor-mermaid-diagram"
      />
    );
  }

  getTextContent(): string {
    return this.getSource();
  }

  static importJSON(serializedNode: SerializedLiveMermaidNode): LiveMermaidNode {
    return $createLiveMermaidNode(serializedNode.source);
  }

  exportJSON(): SerializedLiveMermaidNode {
    return {
      source: this.getSource(),
      type: 'live-mermaid',
      version: 1,
    };
  }
}

export function $createLiveMermaidNode(source: string): LiveMermaidNode {
  return $applyNodeReplacement(new LiveMermaidNode(source));
}

export function $isLiveMermaidNode(node: LexicalNode | null | undefined): node is LiveMermaidNode {
  return node instanceof LiveMermaidNode;
}

export function $replaceMermaidCodeNode(node: CodeNode) {
  if (node.getLanguage() !== 'mermaid') return;
  node.replace($createLiveMermaidNode(node.getTextContent()));
}

export function $replaceMermaidCodeNodes() {
  for (const child of $getRoot().getChildren()) {
    if (child instanceof CodeNode) {
      $replaceMermaidCodeNode(child);
    }
  }
}

export const LIVE_MERMAID_TRANSFORMER: ElementTransformer = {
  dependencies: [LiveMermaidNode],
  export: (node) =>
    $isLiveMermaidNode(node) ? `\`\`\`mermaid\n${node.getSource()}\n\`\`\`` : null,
  regExp: NEVER_MATCH_MERMAID_IMPORT,
  replace: () => false,
  type: 'element',
};
