'use client';

import { ActionIcon, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { type HTMLAttributes, useRef, useState } from 'react';

type PromptPreviewDivProps = HTMLAttributes<HTMLDivElement> & Record<string, unknown>;

type DispatchPromptPreviewProps = {
  prompt: string;
  promptAriaLabel?: string;
  promptProps?: PromptPreviewDivProps;
  onCopy?: () => void;
  copyDisabled?: boolean;
  copyTooltipLabel?: string;
};

export function DispatchPromptPreview({
  prompt,
  promptAriaLabel = 'Dispatch prompt',
  promptProps,
  onCopy,
  copyDisabled = false,
  copyTooltipLabel,
}: DispatchPromptPreviewProps) {
  const promptRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const { className: promptClassName, ...restPromptProps } = promptProps ?? {};
  const copyLabel = copyDisabled ? copyTooltipLabel ?? 'Copy unavailable' : copied ? 'Copied' : 'Copy';

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
        role="textbox"
        aria-readonly="true"
        tabIndex={0}
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
          onClick={copyPrompt}
        >
          {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
