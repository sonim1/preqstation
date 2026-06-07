'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';

export function CodeHighlightingPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let cancelled = false;
    let unregister: (() => void) | null = null;

    void import('@lexical/code-prism').then(({ registerCodeHighlighting }) => {
      if (cancelled) return;
      unregister = registerCodeHighlighting(editor);
    });

    return () => {
      cancelled = true;
      unregister?.();
    };
  }, [editor]);

  return null;
}
