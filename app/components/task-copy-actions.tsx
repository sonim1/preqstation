'use client';

import { ActionIcon, Kbd, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconCopy, IconInfoCircle } from '@tabler/icons-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';

import {
  readTaskDispatchPreference,
  type TaskDispatchPreferenceAction,
  type TaskDispatchPreferenceStatus,
  writeTaskDispatchPreference,
} from '@/lib/dispatch-preferences';
import {
  ENGINE_CONFIGS,
  type EngineConfig,
  getEngineConfig,
  normalizeEngineKey,
} from '@/lib/engine-icons';
import { showErrorNotification } from '@/lib/notifications';
import { buildOpenClawTaskCommand, type TaskDispatchObjective } from '@/lib/openclaw-command';
import { extractTaskAskPrompt } from '@/lib/task-ask';
import { queueClaudeCodeDispatch } from '@/lib/task-dispatch-client';
import {
  buildHermesTaskTelegramMessage,
  buildTaskTelegramMessage,
  sendTaskTelegramMessage,
} from '@/lib/task-telegram-client';

const engineOptions = Object.values(ENGINE_CONFIGS);
const dispatchFlowHelp = 'Choose an engine, review the prompt, then send it.';
const SEND_SHORTCUT_LABEL = 'Cmd+Enter';
const TASK_DISPATCH_PREFERENCE_STATUSES: TaskDispatchPreferenceStatus[] = [
  'inbox',
  'todo',
  'hold',
  'ready',
  'done',
];
const dispatchModeOptions = [
  { key: 'plan', label: 'Plan' },
  { key: 'implement', label: 'Implement' },
  { key: 'ask', label: 'Ask' },
  { key: 'review', label: 'Review' },
  { key: 'qa', label: 'QA' },
] satisfies Array<{ key: TaskDispatchMode; label: string }>;
const visuallyHiddenStyles = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

type TaskCopyActionsProps = {
  taskKey: string;
  branchName?: string | null;
  status: string;
  engine?: string | null;
  noteMarkdown?: string | null;
  telegramEnabled?: boolean;
  hermesTelegramEnabled?: boolean;
  onTaskQueued?: (taskKey: string, queuedAt: string) => void;
};

type DispatchState = 'idle' | 'loading' | 'success' | 'error';
type TaskDispatchMode = Extract<
  TaskDispatchObjective,
  'plan' | 'implement' | 'ask' | 'review' | 'qa'
>;
type TaskEditDispatchAction = Extract<
  TaskDispatchPreferenceAction,
  'send-claude-code' | 'send-telegram' | 'send-hermes-telegram'
>;

const claudeTargetConfig = ENGINE_CONFIGS['claude-code'];
const claudeTargetIconStyles = {
  '--engine-color': claudeTargetConfig.iconColor,
  '--engine-icon': `url(${claudeTargetConfig.icon})`,
} as CSSProperties;

function normalizeTaskDispatchPreferenceStatus(
  status: string,
): TaskDispatchPreferenceStatus | null {
  return TASK_DISPATCH_PREFERENCE_STATUSES.includes(status as TaskDispatchPreferenceStatus)
    ? (status as TaskDispatchPreferenceStatus)
    : null;
}

function isTaskDispatchMode(objective: TaskDispatchObjective | null | undefined) {
  return (
    objective === 'plan' ||
    objective === 'implement' ||
    objective === 'ask' ||
    objective === 'review' ||
    objective === 'qa'
  );
}

function getDispatchModesForStatus(status: string): TaskDispatchMode[] {
  switch (status) {
    case 'inbox':
      return ['plan', 'ask'];
    case 'todo':
    case 'hold':
      return ['implement', 'ask'];
    case 'ready':
      return ['review', 'qa', 'ask'];
    case 'done':
      return ['qa', 'ask'];
    default:
      return [];
  }
}

function resolveInitialMode(
  availableModes: TaskDispatchMode[],
  objective: TaskDispatchObjective | null | undefined,
) {
  if (isTaskDispatchMode(objective) && availableModes.includes(objective)) return objective;
  return availableModes[0] ?? 'ask';
}

function isTaskEditDispatchAction(
  action: TaskDispatchPreferenceAction | TaskEditDispatchAction | null | undefined,
): action is TaskEditDispatchAction {
  return (
    action === 'send-claude-code' || action === 'send-telegram' || action === 'send-hermes-telegram'
  );
}

function resolveTaskEditDispatchActions(
  engineKey: string | null,
  telegramEnabled: boolean,
  hermesTelegramEnabled: boolean,
): TaskEditDispatchAction[] {
  const normalizedEngineKey = normalizeEngineKey(engineKey);
  const actions: TaskEditDispatchAction[] = [];

  if (normalizedEngineKey === 'claude-code' || (!telegramEnabled && !hermesTelegramEnabled)) {
    actions.push('send-claude-code');
  }

  if (telegramEnabled) {
    actions.push('send-telegram');
  }
  if (hermesTelegramEnabled) {
    actions.push('send-hermes-telegram');
  }

  return actions;
}

function resolveInitialAction(
  availableActions: TaskEditDispatchAction[],
  action: TaskDispatchPreferenceAction | TaskEditDispatchAction | null | undefined,
) {
  if (isTaskEditDispatchAction(action) && availableActions.includes(action)) return action;
  return availableActions[0] ?? 'send-telegram';
}

function toEngineShortLabel(engineConfig: EngineConfig | null) {
  switch (engineConfig?.key) {
    case 'claude-code':
      return 'Claude';
    case 'codex':
      return 'Codex';
    case 'gemini-cli':
      return 'Gemini';
    default:
      return 'Engine';
  }
}

function getTaskEditDispatchActionLabel(action: TaskEditDispatchAction) {
  switch (action) {
    case 'send-claude-code':
      return 'Channels';
    case 'send-telegram':
      return '🦞 Telegram';
    case 'send-hermes-telegram':
      return 'H Telegram';
  }
}

function getDispatchStatusMessage(state: DispatchState, action: TaskEditDispatchAction) {
  const noun = action === 'send-claude-code' ? 'Channels dispatch' : 'Telegram message';

  switch (state) {
    case 'loading':
      return `Sending ${noun}.`;
    case 'success':
      return action === 'send-claude-code' ? 'Channels dispatch sent.' : 'Telegram message sent.';
    case 'error':
      return action === 'send-claude-code'
        ? 'Channels dispatch failed.'
        : 'Telegram message failed.';
    default:
      return action === 'send-claude-code'
        ? 'Ready to send Channels dispatch.'
        : 'Ready to send Telegram message.';
  }
}

function getSendLabel(state: DispatchState) {
  switch (state) {
    case 'loading':
      return 'Sending';
    case 'success':
      return 'Sent';
    case 'error':
      return 'Retry';
    default:
      return 'Send';
  }
}

export function TaskCopyActions({
  taskKey,
  branchName,
  status,
  engine,
  noteMarkdown,
  telegramEnabled = false,
  hermesTelegramEnabled = telegramEnabled,
  onTaskQueued,
}: TaskCopyActionsProps) {
  const preferenceStatus = normalizeTaskDispatchPreferenceStatus(status);
  const availableModes = getDispatchModesForStatus(status);
  const [storedPreference] = useState(() =>
    preferenceStatus ? readTaskDispatchPreference(preferenceStatus) : null,
  );
  const initialEngine =
    getEngineConfig(storedPreference?.engine) ?? getEngineConfig(engine) ?? ENGINE_CONFIGS.codex;
  const [selectedEngine, setSelectedEngine] = useState<EngineConfig | null>(() => initialEngine);
  const [selectedAction, setSelectedAction] = useState<TaskEditDispatchAction>(() =>
    resolveInitialAction(
      resolveTaskEditDispatchActions(initialEngine.key, telegramEnabled, hermesTelegramEnabled),
      storedPreference?.action,
    ),
  );
  const [selectedObjective, setSelectedObjective] = useState<TaskDispatchMode>(() =>
    resolveInitialMode(availableModes, storedPreference?.objective),
  );
  const sendDispatchRef = useRef<(() => Promise<void>) | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [dispatchState, setDispatchState] = useState<DispatchState>('idle');
  const isSending = dispatchState === 'loading';
  const availableActions = resolveTaskEditDispatchActions(
    selectedEngine?.key ?? null,
    telegramEnabled,
    hermesTelegramEnabled,
  );
  const effectiveObjective = availableModes.includes(selectedObjective)
    ? selectedObjective
    : resolveInitialMode(availableModes, storedPreference?.objective);
  const effectiveAction = availableActions.includes(selectedAction)
    ? selectedAction
    : resolveInitialAction(availableActions, selectedAction);
  const visibleModeOptions = dispatchModeOptions.filter((mode) =>
    availableModes.includes(mode.key),
  );
  const selectedEngineIndex = Math.max(
    0,
    engineOptions.findIndex((engineOption) => selectedEngine?.key === engineOption.key),
  );
  const selectedActionIndex = Math.max(
    0,
    availableActions.findIndex((action) => effectiveAction === action),
  );
  const selectedModeIndex = Math.max(
    0,
    visibleModeOptions.findIndex((mode) => effectiveObjective === mode.key),
  );
  const { askHint } = extractTaskAskPrompt(noteMarkdown);
  const dispatchPrompt =
    effectiveAction === 'send-hermes-telegram'
      ? buildHermesTaskTelegramMessage({
          taskKey,
          status,
          engine: selectedEngine?.key,
          branchName,
          objective: effectiveObjective,
          askHint,
        })
      : buildOpenClawTaskCommand({
          taskKey,
          status,
          engineKey: selectedEngine?.key,
          branchName,
          objective: effectiveObjective,
          askHint,
        });

  const persistDispatchPreference = (
    nextEngine: EngineConfig | null = selectedEngine,
    nextObjective: TaskDispatchMode = effectiveObjective,
    nextAction: TaskEditDispatchAction = effectiveAction,
  ) => {
    if (!preferenceStatus) return;

    const engineKey = normalizeEngineKey(nextEngine?.key);
    if (!engineKey) return;

    writeTaskDispatchPreference(preferenceStatus, {
      engine: engineKey,
      action: nextAction,
      objective: nextObjective,
    });
  };

  const selectEngine = (nextEngine: EngineConfig) => {
    const nextAction = resolveInitialAction(
      resolveTaskEditDispatchActions(nextEngine.key, telegramEnabled, hermesTelegramEnabled),
      effectiveAction,
    );
    setSelectedEngine(nextEngine);
    setSelectedAction(nextAction);
    setDispatchState('idle');
    persistDispatchPreference(nextEngine, effectiveObjective, nextAction);
  };

  const selectAction = (nextAction: TaskEditDispatchAction) => {
    setSelectedAction(nextAction);
    setDispatchState('idle');
    persistDispatchPreference(selectedEngine, effectiveObjective, nextAction);
  };

  const selectMode = (nextObjective: TaskDispatchMode) => {
    setSelectedObjective(nextObjective);
    setDispatchState('idle');
    persistDispatchPreference(selectedEngine, nextObjective, effectiveAction);
  };

  const copyPromptFallback = () => {
    const prompt = document.querySelector<HTMLElement>('[data-task-dispatch-prompt]');
    const selection = window.getSelection?.();

    if (!prompt || !selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(prompt);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('copy');
    selection.removeAllRanges();
  };

  const copyDispatchPrompt = async () => {
    try {
      await navigator.clipboard.writeText(dispatchPrompt);
    } catch {
      copyPromptFallback();
    }
    persistDispatchPreference();
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 1500);
  };

  const sendDispatch = async () => {
    if (isSending) return;

    setDispatchState('loading');

    try {
      let result: Awaited<ReturnType<typeof queueClaudeCodeDispatch>>;

      if (effectiveAction === 'send-claude-code') {
        result = await queueClaudeCodeDispatch({
          taskKey,
          engine: selectedEngine?.key,
          branchName,
          objective: effectiveObjective,
          askHint: effectiveObjective === 'ask' ? askHint : null,
        });
      } else {
        const isHermesTelegram = effectiveAction === 'send-hermes-telegram';
        result = await sendTaskTelegramMessage(
          taskKey,
          isHermesTelegram
            ? buildHermesTaskTelegramMessage({
                taskKey,
                status,
                engine: selectedEngine?.key,
                branchName,
                objective: effectiveObjective,
                askHint: effectiveObjective === 'ask' ? askHint : null,
              })
            : buildTaskTelegramMessage({
                taskKey,
                status,
                engine: selectedEngine?.key,
                branchName,
                objective: effectiveObjective,
                askHint: effectiveObjective === 'ask' ? askHint : null,
              }),
          isHermesTelegram ? 'hermes-telegram' : 'telegram',
        );
      }

      if (!result.ok) {
        setDispatchState('error');
        showErrorNotification(result.error);
      } else {
        const queuedAt = new Date().toISOString();
        onTaskQueued?.(taskKey, queuedAt);
        persistDispatchPreference(selectedEngine, effectiveObjective, effectiveAction);
        setDispatchState('success');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : effectiveAction === 'send-claude-code'
            ? 'Failed to send Channels dispatch'
            : 'Failed to send Telegram message';
      setDispatchState('error');
      showErrorNotification(errorMessage);
    }

    setTimeout(() => {
      setDispatchState('idle');
    }, 1500);
  };

  useEffect(() => {
    sendDispatchRef.current = sendDispatch;
  }, [sendDispatch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isSending) return;

      const isSendShortcut = (event.metaKey || event.ctrlKey) && event.key === 'Enter';
      if (!isSendShortcut) return;

      event.preventDefault();
      event.stopPropagation();
      void sendDispatchRef.current?.();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isSending]);

  if (availableModes.length === 0) {
    return null;
  }

  return (
    <div className="openclaw-actions task-dispatch-actions">
      <div className="openclaw-dispatch-label">
        <Text component="h2" size="sm" fw={700} className="openclaw-actions-label">
          Dispatch
        </Text>
        <Tooltip label={dispatchFlowHelp} withArrow multiline w={220}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            radius="xl"
            aria-label="Dispatch help"
            className="openclaw-dispatch-help"
          >
            <IconInfoCircle size={16} />
          </ActionIcon>
        </Tooltip>
      </div>

      <div className="task-dispatch-panel">
        <div className="task-dispatch-field">
          <Text size="xs" fw={700} className="task-dispatch-field-label">
            Engine
          </Text>
          <div
            className="task-dispatch-segmented-control task-dispatch-engine-segments"
            role="group"
            aria-label="Engine"
            data-option-count={engineOptions.length}
            data-selected-index={selectedEngineIndex}
          >
            {engineOptions.map((engineOption) => {
              const selected = selectedEngine?.key === engineOption.key;
              const label = toEngineShortLabel(engineOption);
              return (
                <UnstyledButton
                  key={engineOption.key}
                  type="button"
                  className="task-dispatch-segment"
                  data-selected={selected ? 'true' : undefined}
                  aria-pressed={selected}
                  aria-label={selected ? `Selected engine: ${label}` : `Select engine: ${label}`}
                  disabled={isSending}
                  onClick={() => selectEngine(engineOption)}
                >
                  <span
                    className="task-dispatch-engine-icon"
                    aria-hidden="true"
                    data-engine-icon={engineOption.key}
                    style={
                      {
                        '--engine-color': engineOption.iconColor,
                        '--engine-icon': `url(${engineOption.icon})`,
                      } as CSSProperties
                    }
                  />
                  <span>{label}</span>
                </UnstyledButton>
              );
            })}
          </div>
        </div>

        <div className="task-dispatch-field">
          <Text size="xs" fw={700} className="task-dispatch-field-label">
            Target
          </Text>
          <div
            className="task-dispatch-segmented-control task-dispatch-target-segments"
            role="group"
            aria-label="Target"
            data-option-count={availableActions.length}
            data-selected-index={selectedActionIndex}
          >
            {availableActions.map((action) => {
              const selected = effectiveAction === action;
              const label = getTaskEditDispatchActionLabel(action);

              return (
                <UnstyledButton
                  key={action}
                  type="button"
                  className="task-dispatch-segment"
                  data-selected={selected ? 'true' : undefined}
                  aria-pressed={selected}
                  aria-label={selected ? `Selected target: ${label}` : `Select target: ${label}`}
                  disabled={isSending}
                  onClick={() => selectAction(action)}
                >
                  {action === 'send-claude-code' ? (
                    <>
                      <span
                        className="task-dispatch-engine-icon task-dispatch-target-icon"
                        aria-hidden="true"
                        data-engine-icon="claude-code"
                        style={claudeTargetIconStyles}
                      />
                      <span>{label}</span>
                    </>
                  ) : action === 'send-telegram' ? (
                    <span className="task-dispatch-target-option">
                      <span className="task-dispatch-target-emoji" aria-hidden="true">
                        🦞
                      </span>
                      <span>Telegram</span>
                    </span>
                  ) : (
                    <span className="task-dispatch-target-option">
                      <img
                        className="task-dispatch-target-logo"
                        src="/icons/hermes-agent.png"
                        alt=""
                        aria-hidden="true"
                      />
                      <span>Telegram</span>
                    </span>
                  )}
                </UnstyledButton>
              );
            })}
          </div>
        </div>

        <div className="task-dispatch-field">
          <Text size="xs" fw={700} className="task-dispatch-field-label">
            Mode
          </Text>
          <div
            className="task-dispatch-segmented-control task-dispatch-mode-segments"
            role="group"
            aria-label="Mode"
            data-option-count={visibleModeOptions.length}
            data-selected-index={selectedModeIndex}
          >
            {visibleModeOptions.map((mode) => {
              const selected = effectiveObjective === mode.key;
              return (
                <UnstyledButton
                  key={mode.key}
                  type="button"
                  className="task-dispatch-segment"
                  data-selected={selected ? 'true' : undefined}
                  aria-pressed={selected}
                  aria-label={
                    selected ? `Selected mode: ${mode.label}` : `Select mode: ${mode.label}`
                  }
                  disabled={isSending}
                  onClick={() => selectMode(mode.key)}
                >
                  <span>{mode.label}</span>
                </UnstyledButton>
              );
            })}
          </div>
        </div>

        <div className="task-dispatch-prompt-shell">
          <div
            className="task-dispatch-prompt"
            aria-label="Dispatch prompt"
            role="textbox"
            aria-readonly="true"
            tabIndex={0}
            data-task-dispatch-prompt
          >
            {dispatchPrompt}
          </div>
          <Tooltip label={promptCopied ? 'Copied' : 'Copy'} withArrow>
            <ActionIcon
              variant="subtle"
              color={promptCopied ? 'green' : 'gray'}
              size="sm"
              radius="sm"
              aria-label="Copy dispatch prompt"
              className="task-dispatch-copy"
              onClick={copyDispatchPrompt}
            >
              <IconCopy size={15} />
            </ActionIcon>
          </Tooltip>
        </div>

        <UnstyledButton
          type="button"
          aria-label="Send dispatch"
          className="task-dispatch-send"
          data-state={dispatchState === 'idle' ? undefined : dispatchState}
          disabled={isSending}
          onClick={sendDispatch}
        >
          <span>{getSendLabel(dispatchState)}</span>
          <Kbd size="xs" className="task-dispatch-send-shortcut">
            {SEND_SHORTCUT_LABEL}
          </Kbd>
        </UnstyledButton>

        <Text
          component="span"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={visuallyHiddenStyles}
        >
          {getDispatchStatusMessage(dispatchState, effectiveAction)}
        </Text>
      </div>
    </div>
  );
}
