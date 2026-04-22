'use client';

import { CodeHighlightNode, CodeNode, registerCodeHighlighting } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  type ElementTransformer,
  HEADING,
  type Transformer,
  TRANSFORMERS,
  UNORDERED_LIST,
} from '@lexical/markdown';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { ClickableLinkPlugin } from '@lexical/react/LexicalClickableLinkPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { $isHeadingNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { Box, Group, SegmentedControl, Text } from '@mantine/core';
import { KEY_ARROW_RIGHT_COMMAND, KEY_BACKSPACE_COMMAND, KEY_SPACE_COMMAND } from 'lexical';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  type EditorState,
  PASTE_COMMAND,
  type RangeSelection,
} from 'lexical';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { resolveAutoSaveContentChange } from '@/app/hooks/use-auto-save';
import { normalizeUnsupportedBlockAlignment } from '@/lib/live-markdown-alignment';
import {
  detectClosedCodeFence,
  shouldExitCodeBlockOnArrowRight,
  splitCodeNodeAtClosingFence,
} from '@/lib/live-markdown-code-block';
import {
  $applyLiveHeadingShortcut,
  $collapseLiveHeadingSourceNode,
  $exitLiveHeadingSourceOnArrowRight,
  $isLiveHeadingSourceNode,
  $revealHeadingAsLiveSource,
  $syncLiveHeadingSourceNode,
  LIVE_HEADING_SOURCE_SYNC_TAG,
  LIVE_HEADING_SOURCE_TRANSFORMER,
  LiveHeadingSourceNode,
  shouldExitLiveHeadingSourceOnArrowRight,
  shouldPreserveLiveHeadingSourceOnBackspace,
} from '@/lib/live-markdown-heading-source';
import {
  applyMarkdownEnterShortcut,
  applyMarkdownShiftTabShortcut,
  applyMarkdownTabShortcut,
} from '@/lib/live-markdown-shortcuts';
import {
  getOrderedListBlocksForImport,
  preserveTightHeadingParagraphSpacing,
  stripPreqChoiceBlocks,
} from '@/lib/markdown';

type LiveMarkdownEditorProps = {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  externalUpdate?: { markdown: string; version: number; cursorIndex?: number | null } | null;
  onContentChange?: (markdown: string) => void;
  onExternalUpdateApplied?: (markdown: string) => void;
  onBlur?: () => void;
  onSaveShortcut?: () => void;
  showHeader?: boolean;
  mode?: EditorMode;
  onModeChange?: (mode: EditorMode) => void;
};

export type EditorMode = 'live' | 'markdown';

type LiveEditorBridge = {
  readMarkdown: () => string;
};

const LIVE_MARKDOWN_HEADING_TRANSFORMER: ElementTransformer = {
  ...HEADING,
  replace: (parentNode, children, match, isImport) => {
    if (!isImport && $isLiveHeadingSourceNode(parentNode)) return false;
    return HEADING.replace(parentNode, children, match, isImport);
  },
};

const MARKDOWN_TRANSFORMERS: Transformer[] = TRANSFORMERS.flatMap((transformer) =>
  transformer === HEADING
    ? [LIVE_HEADING_SOURCE_TRANSFORMER, LIVE_MARKDOWN_HEADING_TRANSFORMER]
    : transformer === UNORDERED_LIST
      ? [CHECK_LIST, transformer]
      : [transformer],
);

const MARKDOWN_SHORTCUT_TRANSFORMERS: Transformer[] = MARKDOWN_TRANSFORMERS.filter(
  (transformer) =>
    transformer !== LIVE_HEADING_SOURCE_TRANSFORMER &&
    transformer !== LIVE_MARKDOWN_HEADING_TRANSFORMER,
);

const LIVE_MARKDOWN_LINK_ATTRIBUTES = { rel: 'noopener noreferrer', target: '_blank' };

const URL_MATCHERS = [
  (text: string) => {
    const match = /https?:\/\/[^\s)]+/.exec(text);
    if (match === null) return null;
    const fullMatch = match[0];
    return {
      index: match.index,
      length: fullMatch.length,
      text: fullMatch,
      url: fullMatch,
      attributes: LIVE_MARKDOWN_LINK_ATTRIBUTES,
    };
  },
];

function clearActiveLineDecorations(element: HTMLElement | null) {
  if (!element) return;
  delete element.dataset.liveEditorActive;
  delete element.dataset.liveEditorEmpty;
}
function getBlockNodeOffset(
  node: ReturnType<RangeSelection['anchor']['getNode']>,
  blockNode: CodeNode | LiveHeadingSourceNode | ListItemNode,
) {
  let offset = 0;
  let current = node;

  while (current !== blockNode) {
    let sibling = current.getPreviousSibling();
    while (sibling) {
      offset += sibling.getTextContentSize();
      sibling = sibling.getPreviousSibling();
    }

    const parent = current.getParent();
    if (!parent) {
      break;
    }

    current = parent;
  }

  return offset;
}

function resolveCodeBlockCursor(selection: RangeSelection, codeNode: CodeNode) {
  const anchor = selection.anchor;
  const anchorNode = anchor.getNode();
  const textLength = codeNode.getTextContentSize();

  if (anchorNode === codeNode) {
    let cursor = 0;

    for (let index = 0; index < anchor.offset; index += 1) {
      cursor += codeNode.getChildAtIndex(index)?.getTextContentSize() ?? 0;
    }

    return {
      cursor,
      selectionLength: selection.getTextContent().length,
      textLength,
    };
  }

  return {
    cursor: getBlockNodeOffset(anchorNode, codeNode) + anchor.offset,
    selectionLength: selection.getTextContent().length,
    textLength,
  };
}

function resolveLiveHeadingSourceCursor(
  selection: RangeSelection,
  sourceNode: LiveHeadingSourceNode,
) {
  const anchor = selection.anchor;
  const anchorNode = anchor.getNode();
  const textLength = sourceNode.getTextContentSize();

  if (anchorNode === sourceNode) {
    let cursor = 0;

    for (let index = 0; index < anchor.offset; index += 1) {
      cursor += sourceNode.getChildAtIndex(index)?.getTextContentSize() ?? 0;
    }

    return {
      cursor,
      selectionLength: selection.getTextContent().length,
      textLength,
    };
  }

  return {
    cursor: getBlockNodeOffset(anchorNode, sourceNode) + anchor.offset,
    selectionLength: selection.getTextContent().length,
    textLength,
  };
}

function resolveListItemCursor(selection: RangeSelection, listItemNode: ListItemNode) {
  const anchor = selection.anchor;
  const anchorNode = anchor.getNode();
  const textLength = listItemNode.getTextContentSize();

  if (anchorNode === listItemNode) {
    let cursor = 0;

    for (let index = 0; index < anchor.offset; index += 1) {
      cursor += listItemNode.getChildAtIndex(index)?.getTextContentSize() ?? 0;
    }

    return {
      cursor,
      selectionLength: selection.getTextContent().length,
      textLength,
    };
  }

  return {
    cursor: getBlockNodeOffset(anchorNode, listItemNode) + anchor.offset,
    selectionLength: selection.getTextContent().length,
    textLength,
  };
}

function getSelectedListItemNode(selection: RangeSelection) {
  let current = selection.anchor.getNode();

  while (current) {
    if (current instanceof ListItemNode) {
      return current;
    }

    const parent = current.getParent();
    if (!parent) {
      return null;
    }

    current = parent;
  }

  return null;
}

function exitListItemAtStart(listItemNode: ListItemNode) {
  const paragraph = $createParagraphNode();
  listItemNode.replace(paragraph, true);
  paragraph.selectStart();
  return true;
}

function ensureParagraphAfterCodeNode(codeNode: CodeNode) {
  const nextSibling = codeNode.getNextSibling();
  if ($isParagraphNode(nextSibling)) {
    return nextSibling;
  }

  const paragraph = $createParagraphNode();
  codeNode.insertAfter(paragraph);
  return paragraph;
}
function InitializeFromMarkdownPlugin({ markdown }: { markdown: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      const shouldPreserveNewLines = getOrderedListBlocksForImport(markdown).length > 1;
      $convertFromMarkdownString(
        markdown,
        MARKDOWN_TRANSFORMERS,
        undefined,
        shouldPreserveNewLines,
      );
    });
  }, [editor, markdown]);

  return null;
}

function ActiveLineDecorationsPlugin() {
  const [editor] = useLexicalComposerContext();
  const activeElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const rootElement = editor.getRootElement();
        clearActiveLineDecorations(activeElementRef.current);
        activeElementRef.current = null;
        rootElement?.querySelectorAll('[data-live-editor-empty="true"]').forEach((element) => {
          delete (element as HTMLElement).dataset.liveEditorEmpty;
        });
        rootElement
          ?.querySelectorAll('.live-editor-li, .live-editor-li-unchecked, .live-editor-li-checked')
          .forEach((element) => {
            if ((element.textContent ?? '').trim().length === 0) {
              (element as HTMLElement).dataset.liveEditorEmpty = 'true';
            }
          });

        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const blockNode = selection.anchor.getNode().getTopLevelElement();
        if (!blockNode) return;

        const blockElement = editor.getElementByKey(blockNode.getKey());
        if (!(blockElement instanceof HTMLElement) || !(rootElement instanceof HTMLElement)) return;

        blockElement.dataset.liveEditorActive = 'true';

        if (blockNode instanceof ListItemNode && blockNode.getTextContent().trim().length === 0) {
          blockElement.dataset.liveEditorEmpty = 'true';
        }

        activeElementRef.current = blockElement;
      });
    });
  }, [editor]);

  useEffect(() => {
    return () => {
      clearActiveLineDecorations(activeElementRef.current);
    };
  }, []);

  return null;
}

function UnsupportedAlignmentNormalizationPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      () => {
        queueMicrotask(() => {
          // Lexical preserves DOM text alignment during rich-text paste/import, but live markdown
          // only supports left/start alignment, so normalize block formatting right after paste.
          editor.update(
            () => {
              normalizeUnsupportedBlockAlignment($getRoot());
            },
            { tag: 'normalize-unsupported-alignment' },
          );
        });

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}

function EditorStateBridgePlugin({ onReady }: { onReady: (bridge: LiveEditorBridge) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    onReady({
      readMarkdown: () =>
        editor
          .getEditorState()
          .read(() => stripPreqChoiceBlocks($convertToMarkdownString(MARKDOWN_TRANSFORMERS))),
    });
  }, [editor, onReady]);

  return null;
}

function CodeHighlightingPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerCodeHighlighting(editor);
  }, [editor]);

  return null;
}

function CodeBlockExitPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const unregisterUpdate = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

        const codeNode = selection.anchor.getNode().getTopLevelElement();
        if (!(codeNode instanceof CodeNode)) return;

        if (!detectClosedCodeFence(codeNode.getTextContent())) return;
        const codeNodeKey = codeNode.getKey();

        editor.update(() => {
          const currentCodeNode = $getNodeByKey(codeNodeKey);
          if (!(currentCodeNode instanceof CodeNode)) return;

          const paragraph = splitCodeNodeAtClosingFence(currentCodeNode);
          paragraph?.selectStart();
        });
      });
    });

    const unregisterArrowRight = editor.registerCommand(
      KEY_ARROW_RIGHT_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        const codeNode = selection.anchor.getNode().getTopLevelElement();
        if (!(codeNode instanceof CodeNode)) return false;
        if (!shouldExitCodeBlockOnArrowRight(resolveCodeBlockCursor(selection, codeNode))) {
          return false;
        }

        ensureParagraphAfterCodeNode(codeNode).selectStart();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      unregisterUpdate();
      unregisterArrowRight();
    };
  }, [editor]);

  return null;
}

function LiveHeadingSourcePlugin() {
  const [editor] = useLexicalComposerContext();
  const activeSourceKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const unregisterUpdate = editor.registerUpdateListener(({ editorState, tags }) => {
      if (tags.has(LIVE_HEADING_SOURCE_SYNC_TAG)) return;

      let headingKeyToReveal: string | null = null;
      let activeSourceKey: string | null = null;

      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const blockNode = selection.anchor.getNode().getTopLevelElement();
        if (!blockNode) return;

        if ($isHeadingNode(blockNode)) {
          headingKeyToReveal = blockNode.getKey();
          return;
        }

        if ($isLiveHeadingSourceNode(blockNode)) {
          activeSourceKey = blockNode.getKey();
        }
      });

      const previousSourceKey = activeSourceKeyRef.current;
      const sourceKeyToCollapse =
        previousSourceKey && previousSourceKey !== activeSourceKey ? previousSourceKey : null;

      if (!headingKeyToReveal && !sourceKeyToCollapse && !activeSourceKey) return;

      editor.update(
        () => {
          if (sourceKeyToCollapse) {
            const sourceNode = $getNodeByKey(sourceKeyToCollapse);
            if ($isLiveHeadingSourceNode(sourceNode)) {
              $collapseLiveHeadingSourceNode(sourceNode);
            }
          }

          if (!headingKeyToReveal) {
            if (activeSourceKey) {
              const activeSourceNode = $getNodeByKey(activeSourceKey);
              if ($isLiveHeadingSourceNode(activeSourceNode)) {
                $syncLiveHeadingSourceNode(activeSourceNode);
              }
            }
            activeSourceKeyRef.current = activeSourceKey;
            return;
          }

          const headingNode = $getNodeByKey(headingKeyToReveal);
          activeSourceKeyRef.current = $isHeadingNode(headingNode)
            ? $revealHeadingAsLiveSource(headingNode).getKey()
            : null;
        },
        { tag: LIVE_HEADING_SOURCE_SYNC_TAG },
      );
    });

    const unregisterBlur = editor.registerCommand(
      BLUR_COMMAND,
      () => {
        const sourceKey = activeSourceKeyRef.current;
        if (!sourceKey) return false;

        editor.update(
          () => {
            const sourceNode = $getNodeByKey(sourceKey);
            if ($isLiveHeadingSourceNode(sourceNode)) {
              $collapseLiveHeadingSourceNode(sourceNode);
            }
            activeSourceKeyRef.current = null;
          },
          { tag: LIVE_HEADING_SOURCE_SYNC_TAG },
        );

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const unregisterArrowRight = editor.registerCommand(
      KEY_ARROW_RIGHT_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        const sourceNode = selection.anchor.getNode().getTopLevelElement();
        if (!$isLiveHeadingSourceNode(sourceNode)) return false;
        if (
          !shouldExitLiveHeadingSourceOnArrowRight(
            resolveLiveHeadingSourceCursor(selection, sourceNode),
          )
        ) {
          return false;
        }

        $exitLiveHeadingSourceOnArrowRight(sourceNode);
        activeSourceKeyRef.current = null;
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      unregisterUpdate();
      unregisterBlur();
      unregisterArrowRight();
    };
  }, [editor]);

  return null;
}

function LiveHeadingShortcutPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_SPACE_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        const anchorNode = selection.anchor.getNode();
        const parentNode = anchorNode.getParent();
        if (!$isElementNode(parentNode)) return false;

        const didApply = $applyLiveHeadingShortcut(parentNode, anchorNode, selection.anchor.offset);
        if (!didApply) return false;

        event.preventDefault();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}

function LiveBackspacePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        const blockNode = selection.anchor.getNode().getTopLevelElement();
        if ($isLiveHeadingSourceNode(blockNode)) {
          if (
            !shouldPreserveLiveHeadingSourceOnBackspace(
              resolveLiveHeadingSourceCursor(selection, blockNode),
            )
          ) {
            return false;
          }

          event?.preventDefault();
          return true;
        }

        const listItemNode = getSelectedListItemNode(selection);
        if (!(listItemNode instanceof ListItemNode)) return false;
        if (resolveListItemCursor(selection, listItemNode).cursor !== 0) return false;

        event?.preventDefault();
        return exitListItemAtStart(listItemNode);
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}

export function LiveMarkdownEditor({
  name,
  label,
  placeholder = 'Write notes using Markdown shortcuts: #, ##, -, - [ ], **bold**, `code`, [link](url)',
  defaultValue = '',
  externalUpdate = null,
  onContentChange,
  onExternalUpdateApplied,
  onBlur,
  onSaveShortcut,
  showHeader = true,
  mode,
  onModeChange,
}: LiveMarkdownEditorProps) {
  const [markdown, setMarkdown] = useState(() => stripPreqChoiceBlocks(defaultValue));
  const [renderMode, setRenderMode] = useState<EditorMode>(mode ?? 'live');
  const [editorSeed, setEditorSeed] = useState(0);
  const [editorInitialMarkdown, setEditorInitialMarkdown] = useState(() =>
    stripPreqChoiceBlocks(defaultValue),
  );
  const [shouldAutoFocusEditor, setShouldAutoFocusEditor] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursorRef = useRef<number | null>(null);
  const isDirtyRef = useRef(false);
  const hasBootstrappedRef = useRef(false);
  const lastAppliedExternalVersionRef = useRef<number | null>(null);
  const pendingExternalUpdateRef = useRef<{ markdown: string; version: number } | null>(null);
  const previousMarkdownRef = useRef(stripPreqChoiceBlocks(defaultValue));
  const liveEditorBridgeRef = useRef<LiveEditorBridge | null>(null);
  const resolvedMode = renderMode;

  const handleLiveEditorBridgeReady = useCallback((bridge: LiveEditorBridge) => {
    liveEditorBridgeRef.current = bridge;
  }, []);

  const reconcileLiveMarkdown = useCallback(
    (nextMarkdown: string) =>
      preserveTightHeadingParagraphSpacing(markdown, stripPreqChoiceBlocks(nextMarkdown)),
    [markdown],
  );

  const reseedLiveEditor = useCallback((nextMarkdown: string, shouldAutoFocus: boolean) => {
    hasBootstrappedRef.current = false;
    previousMarkdownRef.current = nextMarkdown;
    setEditorInitialMarkdown(nextMarkdown);
    setEditorSeed((value) => value + 1);
    setShouldAutoFocusEditor(shouldAutoFocus);
  }, []);

  const syncLiveMarkdownBeforeModeChange = useCallback(() => {
    const nextMarkdown = reconcileLiveMarkdown(
      liveEditorBridgeRef.current?.readMarkdown() ?? markdown,
    );

    if (nextMarkdown !== markdown) {
      hasBootstrappedRef.current = true;
      isDirtyRef.current = true;
      previousMarkdownRef.current = nextMarkdown;
      setMarkdown(nextMarkdown);
      onContentChange?.(nextMarkdown);
    }

    return nextMarkdown;
  }, [markdown, onContentChange, reconcileLiveMarkdown]);

  useEffect(() => {
    if (isDirtyRef.current) return; // user has edited — do not reset
    const sanitizedDefaultValue = stripPreqChoiceBlocks(defaultValue);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset editor state when external defaultValue changes
    setMarkdown(sanitizedDefaultValue);
    setEditorInitialMarkdown(sanitizedDefaultValue);
    setEditorSeed((value) => value + 1);
    setShouldAutoFocusEditor(true);
    hasBootstrappedRef.current = false;
    previousMarkdownRef.current = sanitizedDefaultValue;
  }, [defaultValue]);

  useEffect(() => {
    if (pendingCursorRef.current !== null && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = pendingCursorRef.current;
      textareaRef.current.selectionEnd = pendingCursorRef.current;
      pendingCursorRef.current = null;
    }
  }, [markdown, resolvedMode]);

  useEffect(() => {
    if (!externalUpdate) return;
    if (lastAppliedExternalVersionRef.current === externalUpdate.version) return;

    const sanitizedExternalMarkdown = stripPreqChoiceBlocks(externalUpdate.markdown);
    lastAppliedExternalVersionRef.current = externalUpdate.version;
    pendingExternalUpdateRef.current = {
      markdown: sanitizedExternalMarkdown,
      version: externalUpdate.version,
    };
    pendingCursorRef.current = externalUpdate.cursorIndex ?? null;
    isDirtyRef.current = false;
    hasBootstrappedRef.current = false;
    previousMarkdownRef.current = sanitizedExternalMarkdown;

    const frame = requestAnimationFrame(() => {
      setMarkdown(sanitizedExternalMarkdown);
      setEditorInitialMarkdown(sanitizedExternalMarkdown);
      setEditorSeed((value) => value + 1);
      setShouldAutoFocusEditor(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [externalUpdate]);

  useEffect(() => {
    if (mode === undefined || mode === renderMode) return;

    const frame = requestAnimationFrame(() => {
      const nextMarkdown = renderMode === 'live' ? syncLiveMarkdownBeforeModeChange() : markdown;

      if (mode === 'live') {
        reseedLiveEditor(nextMarkdown, true);
      }

      setRenderMode(mode);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [markdown, mode, renderMode, reseedLiveEditor, syncLiveMarkdownBeforeModeChange]);

  useEffect(() => {
    const pendingExternalUpdate = pendingExternalUpdateRef.current;
    if (!pendingExternalUpdate) return;
    if (pendingExternalUpdate.markdown !== markdown) return;

    pendingExternalUpdateRef.current = null;
    onExternalUpdateApplied?.(markdown);
  }, [markdown, onExternalUpdateApplied]);

  const initialConfig = useMemo(
    () => ({
      namespace: `live-md-${name}`,
      onError: (error: Error) => {
        throw error;
      },
      theme: {
        paragraph: 'live-editor-paragraph',
        heading: {
          h1: 'live-editor-h1',
          h2: 'live-editor-h2',
          h3: 'live-editor-h3',
          h4: 'live-editor-h4',
          h5: 'live-editor-h5',
          h6: 'live-editor-h6',
        },
        quote: 'live-editor-quote',
        text: {
          bold: 'live-editor-bold',
          italic: 'live-editor-italic',
          code: 'live-editor-code',
        },
        link: 'live-editor-link',
        list: {
          ul: 'live-editor-ul',
          ol: 'live-editor-ol',
          listitem: 'live-editor-li',
          listitemChecked: 'live-editor-li-checked',
          listitemUnchecked: 'live-editor-li-unchecked',
        },
        code: 'live-editor-code-block',
        codeHighlight: {
          atrule: 'live-editor-tokenAttr',
          attr: 'live-editor-tokenAttr',
          boolean: 'live-editor-tokenProperty',
          builtin: 'live-editor-tokenSelector',
          cdata: 'live-editor-tokenComment',
          char: 'live-editor-tokenSelector',
          class: 'live-editor-tokenFunction',
          'class-name': 'live-editor-tokenFunction',
          comment: 'live-editor-tokenComment',
          constant: 'live-editor-tokenProperty',
          deleted: 'live-editor-tokenProperty',
          doctype: 'live-editor-tokenComment',
          entity: 'live-editor-tokenOperator',
          function: 'live-editor-tokenFunction',
          important: 'live-editor-tokenVariable',
          inserted: 'live-editor-tokenSelector',
          keyword: 'live-editor-tokenAttr',
          namespace: 'live-editor-tokenVariable',
          number: 'live-editor-tokenProperty',
          operator: 'live-editor-tokenOperator',
          prolog: 'live-editor-tokenComment',
          property: 'live-editor-tokenProperty',
          punctuation: 'live-editor-tokenPunctuation',
          regex: 'live-editor-tokenVariable',
          selector: 'live-editor-tokenSelector',
          string: 'live-editor-tokenSelector',
          symbol: 'live-editor-tokenProperty',
          tag: 'live-editor-tokenProperty',
          url: 'live-editor-tokenOperator',
          variable: 'live-editor-tokenVariable',
        },
      },
      nodes: [
        HeadingNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        CodeNode,
        CodeHighlightNode,
        LiveHeadingSourceNode,
        LinkNode,
        AutoLinkNode,
      ],
    }),
    [name],
  );

  function handleModeChange(nextMode: string) {
    if (nextMode !== 'live' && nextMode !== 'markdown') return;
    if (nextMode === resolvedMode) return;

    const nextMarkdown = resolvedMode === 'live' ? syncLiveMarkdownBeforeModeChange() : markdown;

    if (nextMode === 'live') {
      reseedLiveEditor(nextMarkdown, true);
    }

    setRenderMode(nextMode);
    onModeChange?.(nextMode);
  }

  function applyMarkdownUpdate(nextMarkdown: string, nextCursor: number | null) {
    const sanitizedMarkdown = stripPreqChoiceBlocks(nextMarkdown);
    hasBootstrappedRef.current = true;
    isDirtyRef.current = true;
    previousMarkdownRef.current = sanitizedMarkdown;
    pendingCursorRef.current = nextCursor;
    setMarkdown(sanitizedMarkdown);
    onContentChange?.(sanitizedMarkdown);
  }

  function handleSaveShortcut(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key.toLowerCase() !== 's') return false;
    if (!event.metaKey && !event.ctrlKey) return false;

    event.preventDefault();
    onSaveShortcut?.();
    return true;
  }

  function handleLiveEditorKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (handleSaveShortcut(event)) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.blur();
    }
  }

  function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (handleSaveShortcut(event)) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.blur();
      return;
    }

    const textarea = event.currentTarget;
    const { value, selectionStart, selectionEnd } = textarea;
    if (selectionStart !== selectionEnd) return;

    if (event.key === 'Enter') {
      const result = applyMarkdownEnterShortcut(value, selectionStart);
      if (!result) return;
      event.preventDefault();
      applyMarkdownUpdate(result.nextMarkdown, result.nextCursor);
      return;
    }

    if (event.key !== 'Tab') return;

    event.preventDefault();

    if (event.shiftKey) {
      const result = applyMarkdownShiftTabShortcut(value, selectionStart);
      if (result) {
        applyMarkdownUpdate(result.nextMarkdown, result.nextCursor);
      }
      return;
    }

    const result = applyMarkdownTabShortcut(value, selectionStart);
    if (result) {
      applyMarkdownUpdate(result.nextMarkdown, result.nextCursor);
      return;
    }

    const nextMarkdown = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
    applyMarkdownUpdate(nextMarkdown, selectionStart + 2);
  }

  return (
    <Box className="live-markdown-editor">
      {showHeader ? (
        <Group justify="space-between" align="center" gap="xs">
          <Text fw={500} size="sm">
            {label}
          </Text>
          <SegmentedControl
            aria-label={`${label} mode`}
            value={resolvedMode}
            onChange={handleModeChange}
            size="xs"
            className="live-editor-mode-toggle"
            data={[
              { value: 'live', label: 'Live' },
              { value: 'markdown', label: 'Markdown' },
            ]}
          />
        </Group>
      ) : null}

      {resolvedMode === 'live' ? (
        <LexicalComposer key={`${name}-${editorSeed}`} initialConfig={initialConfig}>
          <div className="live-editor-shell">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="live-editor-input"
                  aria-label={`${label} live editor`}
                  onKeyDown={handleLiveEditorKeyDown}
                  onBlur={() => onBlur?.()}
                />
              }
              placeholder={<div className="live-editor-placeholder">{placeholder}</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <CheckListPlugin />
            <LinkPlugin attributes={LIVE_MARKDOWN_LINK_ATTRIBUTES} />
            <ClickableLinkPlugin newTab />
            <AutoLinkPlugin matchers={URL_MATCHERS} />
            <LiveHeadingShortcutPlugin />
            <LiveBackspacePlugin />
            <MarkdownShortcutPlugin transformers={MARKDOWN_SHORTCUT_TRANSFORMERS} />
            <CodeHighlightingPlugin />
            <CodeBlockExitPlugin />
            <LiveHeadingSourcePlugin />
            <OnChangePlugin
              onChange={(editorState: EditorState, _editor, tags) => {
                if (tags.has(LIVE_HEADING_SOURCE_SYNC_TAG)) return;

                editorState.read(() => {
                  const md = reconcileLiveMarkdown($convertToMarkdownString(MARKDOWN_TRANSFORMERS));
                  const contentChange = resolveAutoSaveContentChange({
                    currentMarkdown: markdown,
                    hasBootstrapped: hasBootstrappedRef.current,
                    previousMarkdown: previousMarkdownRef.current,
                    nextMarkdown: md,
                  });
                  if (!hasBootstrappedRef.current) {
                    hasBootstrappedRef.current = true;
                    previousMarkdownRef.current = md;
                    return;
                  }

                  if (!contentChange.shouldPropagate) {
                    return;
                  }

                  previousMarkdownRef.current = md;
                  isDirtyRef.current = true;
                  setMarkdown(contentChange.markdown);
                  onContentChange?.(contentChange.markdown);
                });
              }}
            />
            <InitializeFromMarkdownPlugin markdown={editorInitialMarkdown} />
            <EditorStateBridgePlugin onReady={handleLiveEditorBridgeReady} />
            <UnsupportedAlignmentNormalizationPlugin />
            <ActiveLineDecorationsPlugin />
            {shouldAutoFocusEditor ? <AutoFocusPlugin /> : null}
          </div>
        </LexicalComposer>
      ) : (
        <textarea
          ref={textareaRef}
          className="live-editor-raw-input"
          value={markdown}
          onChange={(event) => {
            hasBootstrappedRef.current = true;
            isDirtyRef.current = true;
            const val = stripPreqChoiceBlocks(event.currentTarget.value);
            previousMarkdownRef.current = val;
            setMarkdown(val);
            onContentChange?.(val);
          }}
          onKeyDown={handleTextareaKeyDown}
          onBlur={() => onBlur?.()}
          placeholder={placeholder}
          aria-label={`${label} markdown source`}
          spellCheck={false}
        />
      )}

      <input type="hidden" name={name} value={markdown} />
      <Text c="dimmed" size="xs">
        Live mode renders formatted content while editing. Markdown mode shows raw markdown text.
      </Text>
    </Box>
  );
}
