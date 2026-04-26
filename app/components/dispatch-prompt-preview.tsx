'use client';

import { ActionIcon, Tooltip } from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import { type HTMLAttributes, useRef, useState } from 'react';

type PromptPreviewDivProps = HTMLAttributes<HTMLDivElement> & Record<string, unknown>;

type DispatchPromptPreviewProps = {
  prompt: string;
  promptAriaLabel?: string;
  promptProps?: PromptPreviewDivProps;
  onCopy?: () => void;
};

export function DispatchPromptPreview({
  prompt,
  promptAriaLabel = 'Dispatch prompt',
  promptProps,
  onCopy,
}: DispatchPromptPreviewProps) {
  const promptRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const { className: promptClassName, ...restPromptProps } = promptProps ?? {};

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
        role="textbox"
        aria-readonly="true"
        tabIndex={0}
      >
        {prompt}
      </div>
      <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow>
        <ActionIcon
          variant="subtle"
          color={copied ? 'green' : 'gray'}
          size="sm"
          radius="sm"
          aria-label="Copy dispatch prompt"
          className="task-dispatch-copy"
          onClick={copyPrompt}
        >
          <IconCopy size={15} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
