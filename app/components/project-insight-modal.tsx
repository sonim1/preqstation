'use client';

import { Button, type CSSProperties, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { DispatchPromptPreview } from '@/app/components/dispatch-prompt-preview';
import { DispatchSegmentedControl } from '@/app/components/dispatch-segmented-control';
import { INSIGHT_PROMPT_MAX_LENGTH } from '@/lib/content-limits';
import {
  ENGINE_CONFIGS,
  getEngineConfig,
  getEngineShortLabel,
  normalizeEngineKey,
} from '@/lib/engine-icons';
import { showErrorNotification, showSuccessNotification } from '@/lib/notifications';
import { encodeDispatchPromptMetadata } from '@/lib/openclaw-command';
import type { TaskDispatchTarget } from '@/lib/task-dispatch';
import { queueClaudeCodeInsightDispatch } from '@/lib/task-dispatch-client';
import {
  buildProjectInsightDispatchMessage,
  sendProjectInsightTelegramMessage,
} from '@/lib/task-telegram-client';

type SelectedProject = {
  id: string;
  name: string;
  projectKey: string;
};

type ProjectInsightTarget = TaskDispatchTarget;
type ProjectInsightTargetOption = { value: ProjectInsightTarget; label: string };

type ProjectInsightModalProps = {
  opened: boolean;
  onClose: () => void;
  selectedProject: SelectedProject | null;
  telegramEnabled?: boolean;
  hermesTelegramEnabled?: boolean;
  defaultEngine?: string | null;
};

const insightPlaceholder =
  '예: Connections 페이지 개편 작업을 나눠줘\n브라우저 알림 추가를 위한 다음 작업들을 정리해줘';
const claudeTargetConfig = ENGINE_CONFIGS['claude-code'];
const claudeTargetIconStyles = {
  '--engine-color': claudeTargetConfig.iconColor,
  '--engine-icon': `url(${claudeTargetConfig.icon})`,
} as CSSProperties;

function getProjectDispatchTargetLabel(target: ProjectInsightTarget) {
  switch (target) {
    case 'claude-code-channel':
      return 'Channels';
    case 'hermes-telegram':
      return 'H Telegram';
    case 'telegram':
    default:
      return '🦞 Telegram';
  }
}

export function resolveInsightTargets({
  engineKey,
  telegramEnabled,
  hermesTelegramEnabled,
}: {
  engineKey: string | null;
  telegramEnabled: boolean;
  hermesTelegramEnabled: boolean;
}) {
  const targets: ProjectInsightTargetOption[] = [];
  const normalizedEngineKey = normalizeEngineKey(engineKey);

  if (normalizedEngineKey === 'claude-code') {
    targets.push({ value: 'claude-code-channel', label: 'Channels' });
  }
  if (telegramEnabled) {
    targets.push({ value: 'telegram', label: '🦞 Telegram' });
  }
  if (hermesTelegramEnabled) {
    targets.push({ value: 'hermes-telegram', label: 'H Telegram' });
  }
  if (normalizedEngineKey !== 'claude-code') {
    targets.push({ value: 'claude-code-channel', label: 'Channels' });
  }

  return targets;
}

export function resolveInitialInsightTarget(
  targetOptions: ProjectInsightTargetOption[],
  target: ProjectInsightTarget | null,
) {
  if (targetOptions.some((option) => option.value === target)) {
    return target;
  }

  return targetOptions[0]?.value ?? null;
}

export function isInsightExecuteDisabled({
  opened,
  selectedProject,
  target,
  targetOptions,
  prompt,
  isSubmitting,
}: {
  opened: boolean;
  selectedProject: SelectedProject | null;
  target: ProjectInsightTarget | null;
  targetOptions: ProjectInsightTargetOption[];
  prompt: string;
  isSubmitting: boolean;
}) {
  const trimmedPrompt = prompt.trim();
  const selectedTarget = resolveInitialInsightTarget(targetOptions, target);

  return (
    !opened ||
    !selectedProject ||
    !selectedTarget ||
    !trimmedPrompt ||
    trimmedPrompt.length > INSIGHT_PROMPT_MAX_LENGTH ||
    isSubmitting
  );
}

export function ProjectInsightModal({
  opened,
  onClose,
  selectedProject,
  telegramEnabled = false,
  hermesTelegramEnabled = false,
  defaultEngine = null,
}: ProjectInsightModalProps) {
  const initialEngineKey = normalizeEngineKey(defaultEngine) ?? 'codex';
  const [engineKey, setEngineKey] = useState<string>(() => initialEngineKey);
  const [target, setTarget] = useState<ProjectInsightTarget | null>(() =>
    resolveInitialInsightTarget(
      resolveInsightTargets({
        engineKey: initialEngineKey,
        telegramEnabled,
        hermesTelegramEnabled,
      }),
      null,
    ),
  );
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedEngine = getEngineConfig(engineKey) ?? ENGINE_CONFIGS.codex;
  const targetOptions = useMemo(
    () =>
      resolveInsightTargets({
        engineKey: resolvedEngine.key,
        telegramEnabled,
        hermesTelegramEnabled,
      }),
    [resolvedEngine.key, telegramEnabled, hermesTelegramEnabled],
  );
  const selectedTarget = resolveInitialInsightTarget(targetOptions, target);
  const executeDisabled = isInsightExecuteDisabled({
    opened,
    selectedProject,
    target,
    targetOptions,
    prompt,
    isSubmitting,
  });

  useEffect(() => {
    if (opened) return;
    const nextEngineKey = normalizeEngineKey(defaultEngine) ?? 'codex';
    const nextTargetOptions = resolveInsightTargets({
      engineKey: nextEngineKey,
      telegramEnabled,
      hermesTelegramEnabled,
    });

    setPrompt('');
    setEngineKey(nextEngineKey);
    setTarget(resolveInitialInsightTarget(nextTargetOptions, null));
    setIsSubmitting(false);
  }, [defaultEngine, hermesTelegramEnabled, opened, telegramEnabled]);

  const trimmedPrompt = prompt.trim();
  const dispatchPrompt =
    selectedProject && selectedTarget
      ? buildProjectInsightDispatchMessage({
          projectKey: selectedProject.projectKey,
          engine: resolvedEngine.key,
          insightPrompt: trimmedPrompt || null,
          dispatchTarget: selectedTarget,
        })
      : '';

  const handleEngineChange = (nextEngineKey: string) => {
    const nextTargetOptions = resolveInsightTargets({
      engineKey: nextEngineKey,
      telegramEnabled,
      hermesTelegramEnabled,
    });

    setEngineKey(nextEngineKey);
    setTarget(resolveInitialInsightTarget(nextTargetOptions, selectedTarget));
  };

  const executeInsight = async () => {
    if (!selectedProject || !selectedTarget || executeDisabled) {
      return;
    }

    setIsSubmitting(true);

    try {
      const insightPromptB64 = encodeDispatchPromptMetadata(trimmedPrompt);
      if (!insightPromptB64) {
        showErrorNotification('Insight prompt is required.');
        return;
      }

      if (selectedTarget === 'claude-code-channel') {
        const result = await queueClaudeCodeInsightDispatch({
          projectKey: selectedProject.projectKey,
          engine: resolvedEngine.key,
          insightPromptB64,
        });

        if (!result.ok) {
          showErrorNotification(result.error);
          return;
        }

        showSuccessNotification(`Insight queued for ${selectedProject.projectKey}.`);
        onClose();
        return;
      }

      const result = await sendProjectInsightTelegramMessage(
        selectedProject.projectKey,
        dispatchPrompt,
        selectedTarget,
      );
      if (!result.ok) {
        showErrorNotification(result.error);
        return;
      }

      showSuccessNotification(`Insight sent for ${selectedProject.projectKey}.`);
      onClose();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to dispatch project insight';
      showErrorNotification(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create Inbox Tasks from Insight"
      closeButtonProps={{ 'aria-label': 'Close Insight dialog' }}
      centered
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          현재 프로젝트와 입력한 내용을 바탕으로 다음 작업 인사이트를 정리하고 Inbox에 추가합니다.
        </Text>

        <DispatchSegmentedControl
          label="Engine"
          groupLabel="Engine"
          groupClassName="task-dispatch-engine-segments"
          onSelect={handleEngineChange}
          options={Object.values(ENGINE_CONFIGS).map((engine) => {
            const selected = resolvedEngine.key === engine.key;
            const label = getEngineShortLabel(engine);

            return {
              value: engine.key,
              selected,
              ariaLabel: selected ? `Selected engine: ${label}` : `Select engine: ${label}`,
              content: (
                <>
                  <span
                    className="task-dispatch-engine-icon"
                    aria-hidden="true"
                    data-engine-icon={engine.key}
                    style={
                      {
                        '--engine-color': engine.iconColor,
                        '--engine-icon': `url(${engine.icon})`,
                      } as CSSProperties
                    }
                  />
                  <span>{label}</span>
                </>
              ),
            };
          })}
        />

        <DispatchSegmentedControl
          label="Target"
          groupLabel="Target"
          groupClassName="task-dispatch-target-segments"
          onSelect={(value) => setTarget(value)}
          options={targetOptions.map((option) => {
            const selected = selectedTarget === option.value;
            const label = getProjectDispatchTargetLabel(option.value);

            return {
              value: option.value,
              selected,
              ariaLabel: selected ? `Selected target: ${label}` : `Select target: ${label}`,
              content:
                option.value === 'claude-code-channel' ? (
                  <>
                    <span
                      className="task-dispatch-engine-icon task-dispatch-target-icon"
                      aria-hidden="true"
                      data-engine-icon="claude-code"
                      style={claudeTargetIconStyles}
                    />
                    <span>{option.label}</span>
                  </>
                ) : option.value === 'telegram' ? (
                  <span className="task-dispatch-target-option">
                    <span className="task-dispatch-target-emoji" aria-hidden="true">
                      🦞
                    </span>
                    <span>Telegram</span>
                  </span>
                ) : (
                  <span className="task-dispatch-target-option">
                    <Image
                      className="task-dispatch-target-logo"
                      src="/icons/hermes-agent.png"
                      alt=""
                      width={16}
                      height={16}
                      aria-hidden="true"
                    />
                    <span>Telegram</span>
                  </span>
                ),
            };
          })}
        />

        <Textarea
          label="What should we break down?"
          aria-label="Insight prompt"
          autosize
          minRows={5}
          maxRows={10}
          maxLength={INSIGHT_PROMPT_MAX_LENGTH}
          value={prompt}
          onChange={(event) => setPrompt(event.currentTarget.value)}
          placeholder={insightPlaceholder}
        />

        <Group justify="space-between" align="flex-start" gap="sm">
          <Text size="xs" c="dimmed">
            현재 프로젝트에서 필요한 다음 작업을 간단히 적어주세요. 줄바꿈은 그대로 보존되고,
            transport에서는 안전하게 인코딩됩니다.
          </Text>
          <Text size="xs" c={prompt.length > INSIGHT_PROMPT_MAX_LENGTH ? 'red' : 'dimmed'}>
            {prompt.length}/{INSIGHT_PROMPT_MAX_LENGTH}
          </Text>
        </Group>

        <DispatchPromptPreview
          prompt={dispatchPrompt}
          onCopy={() => showSuccessNotification('Dispatch prompt copied.')}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={executeInsight} loading={isSubmitting} disabled={executeDisabled}>
            {selectedTarget === 'claude-code-channel' ? 'Queue Insight' : 'Send Insight'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
