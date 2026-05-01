'use client';

import { ActionIcon, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import {
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useRef,
  useState,
} from 'react';

type PromptPreviewDivProps = HTMLAttributes<HTMLDivElement> & Record<string, unknown>;

type DispatchPromptPreviewProps = {
  prompt: string;
  promptAriaLabel?: string;
  promptProps?: PromptPreviewDivProps;
  onCopy?: () => void;
  copyDisabled?: boolean;
  copyTooltipLabel?: string;
  collapseMode?: 'single-line';
  defaultExpanded?: boolean;
};

export function DispatchPromptPreview({
  prompt,
  promptAriaLabel = 'Dispatch prompt',
  promptProps,
  onCopy,
  copyDisabled = false,
  copyTooltipLabel,
  collapseMode,
  defaultExpanded = false,
}: DispatchPromptPreviewProps) {
  const promptRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const {
    className: promptClassName,
    onClick: promptOnClick,
    onKeyDown: promptOnKeyDown,
    ...restPromptProps
  } = promptProps ?? {};
  const collapsible = collapseMode === 'single-line';
  const [expanded, setExpanded] = useState(defaultExpanded);
  const copyLabel = copyDisabled
    ? (copyTooltipLabel ?? 'Copy unavailable')
    : copied
      ? 'Copied'
      : 'Copy';

  const toggleExpanded = useCallback(() => {
    setExpanded((current) => !current);
  }, []);

  const handlePromptClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    promptOnClick?.(event);
    if (event.defaultPrevented || !collapsible) {
      return;
    }

    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    toggleExpanded();
  }, [promptOnClick, collapsible, toggleExpanded]);

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    promptOnKeyDown?.(event);
    if (event.defaultPrevented || !collapsible) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleExpanded();
    }
  };

  const copyPromptFallback = () => {
    const selection = window.getSelection?.();
    if (!promptRef.current || !selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(promptRef.current);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('copy');
    selection.removeAllRanges();
  };

  const copyPrompt = async () => {
    if (copyDisabled) {
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      copyPromptFallback();
    }

    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="task-dispatch-prompt-shell">
      <div
        {...restPromptProps}
        ref={promptRef}
        className={['task-dispatch-prompt', promptClassName].filter(Boolean).join(' ')}
        aria-label={promptAriaLabel}
        role={collapsible ? 'button' : 'textbox'}
        aria-multiline={collapsible ? undefined : 'true'}
        aria-readonly={collapsible ? undefined : 'true'}
        aria-expanded={collapsible ? expanded : undefined}
        data-collapsible={collapsible ? 'true' : undefined}
        data-expanded={collapsible ? String(expanded) : undefined}
        tabIndex={0}
        onClick={collapsible ? handlePromptClick : promptOnClick}
        onKeyDown={collapsible ? handlePromptKeyDown : promptOnKeyDown}
      >
        {prompt}
      </div>
      <Tooltip label={copyLabel} withArrow>
        <ActionIcon
          variant="subtle"
          color={copied ? 'green' : 'gray'}
          size="sm"
          radius="sm"
          disabled={copyDisabled}
          aria-label="Copy dispatch prompt"
          className="task-dispatch-copy"
          onClick={() => {
            void copyPrompt();
          }}
        >
          {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
