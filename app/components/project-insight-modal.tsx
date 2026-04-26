'use client';

import { Button, Group, Modal, NativeSelect, Stack, Text, Textarea } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';

import { INSIGHT_PROMPT_MAX_LENGTH } from '@/lib/content-limits';
import { ENGINE_CONFIGS, getEngineConfig, normalizeEngineKey } from '@/lib/engine-icons';
import { showErrorNotification, showSuccessNotification } from '@/lib/notifications';
import {
  buildProjectInsightTelegramMessage,
  sendProjectInsightTelegramMessage,
} from '@/lib/task-telegram-client';

type SelectedProject = {
  id: string;
  name: string;
  projectKey: string;
};

type ProjectInsightAction = 'send-telegram' | 'copy-telegram';
type ProjectInsightActionOption = { value: ProjectInsightAction; label: string };

type ProjectInsightModalProps = {
  opened: boolean;
  onClose: () => void;
  selectedProject: SelectedProject | null;
  telegramEnabled?: boolean;
  defaultEngine?: string | null;
};

const insightPlaceholder =
  '예: Connections 페이지 개편 작업을 나눠줘\n브라우저 알림 추가를 위한 다음 작업들을 정리해줘';

export function resolveInsightActions({
  engineKey,
  telegramEnabled,
}: {
  engineKey: string | null;
  telegramEnabled: boolean;
}) {
  const actions: ProjectInsightActionOption[] = [];
  if (telegramEnabled) {
    actions.push({ value: 'send-telegram', label: 'Send to Telegram' });
  }
  actions.push({ value: 'copy-telegram', label: 'Copy Telegram' });

  return actions;
}

export function resolveInitialInsightAction(
  actionOptions: ProjectInsightActionOption[],
  action: ProjectInsightAction | null,
) {
  if (actionOptions.some((option) => option.value === action)) {
    return action;
  }

  return actionOptions[0]?.value ?? null;
}

export function isInsightExecuteDisabled({
  opened,
  selectedProject,
  action,
  actionOptions,
  prompt,
  isSubmitting,
}: {
  opened: boolean;
  selectedProject: SelectedProject | null;
  action: ProjectInsightAction | null;
  actionOptions: ProjectInsightActionOption[];
  prompt: string;
  isSubmitting: boolean;
}) {
  const trimmedPrompt = prompt.trim();
  const selectedAction = resolveInitialInsightAction(actionOptions, action);

  return (
    !opened ||
    !selectedProject ||
    !selectedAction ||
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
  defaultEngine = null,
}: ProjectInsightModalProps) {
  const initialEngineKey = normalizeEngineKey(defaultEngine) ?? 'codex';
  const [engineKey, setEngineKey] = useState<string>(() => initialEngineKey);
  const [action, setAction] = useState<ProjectInsightAction | null>(() =>
    resolveInitialInsightAction(
      resolveInsightActions({ engineKey: initialEngineKey, telegramEnabled }),
      null,
    ),
  );
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedEngine = getEngineConfig(engineKey) ?? ENGINE_CONFIGS.codex;
  const actionOptions = useMemo(
    () => resolveInsightActions({ engineKey: resolvedEngine.key, telegramEnabled }),
    [resolvedEngine.key, telegramEnabled],
  );
  const selectedAction = resolveInitialInsightAction(actionOptions, action);
  const executeDisabled = isInsightExecuteDisabled({
    opened,
    selectedProject,
    action,
    actionOptions,
    prompt,
    isSubmitting,
  });

  useEffect(() => {
    if (opened) return;
    const nextEngineKey = normalizeEngineKey(defaultEngine) ?? 'codex';
    const nextActionOptions = resolveInsightActions({
      engineKey: nextEngineKey,
      telegramEnabled,
    });

    setPrompt('');
    setEngineKey(nextEngineKey);
    setAction(resolveInitialInsightAction(nextActionOptions, null));
    setIsSubmitting(false);
  }, [defaultEngine, opened, telegramEnabled]);

  const trimmedPrompt = prompt.trim();

  const handleEngineChange = (nextEngineKey: string) => {
    const nextActionOptions = resolveInsightActions({
      engineKey: nextEngineKey,
      telegramEnabled,
    });

    setEngineKey(nextEngineKey);
    setAction(resolveInitialInsightAction(nextActionOptions, selectedAction));
  };

  const executeInsight = async () => {
    if (!selectedProject || !selectedAction || executeDisabled) {
      return;
    }

    setIsSubmitting(true);

    try {
      const message = buildProjectInsightTelegramMessage({
        projectKey: selectedProject.projectKey,
        engine: resolvedEngine.key,
        insightPrompt: trimmedPrompt,
      });

      if (selectedAction === 'copy-telegram') {
        await navigator.clipboard.writeText(message);
        showSuccessNotification('Telegram message copied.');
        onClose();
        return;
      }

      const result = await sendProjectInsightTelegramMessage(selectedProject.projectKey, message);
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

        <NativeSelect
          label="Engine"
          aria-label="Insight engine"
          value={resolvedEngine.key}
          onChange={(event) => handleEngineChange(event.currentTarget.value)}
          data={Object.values(ENGINE_CONFIGS).map((engine) => ({
            value: engine.key,
            label: engine.label,
          }))}
        />

        <NativeSelect
          label="Action"
          aria-label="Insight action"
          value={selectedAction ?? ''}
          onChange={(event) => setAction(event.currentTarget.value as ProjectInsightAction)}
          data={actionOptions}
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

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={executeInsight} loading={isSubmitting} disabled={executeDisabled}>
            {selectedAction === 'copy-telegram' ? 'Copy' : 'Send'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
