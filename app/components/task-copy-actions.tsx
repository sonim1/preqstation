'use client';

import { ActionIcon, Kbd, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import Image from 'next/image';
import {
  type ChangeEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { DispatchPromptPreview } from '@/app/components/dispatch-prompt-preview';
import { DispatchSegmentedControl } from '@/app/components/dispatch-segmented-control';
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
  getEngineShortLabel,
  normalizeEngineKey,
} from '@/lib/engine-icons';
import { showErrorNotification } from '@/lib/notifications';
import type { TaskDispatchObjective } from '@/lib/openclaw-command';
import { extractTaskAskPrompt } from '@/lib/task-ask';
import type { TaskDispatchTarget } from '@/lib/task-dispatch';
import {
  buildHermesTaskTelegramMessage,
  buildTaskTelegramMessage,
  sendTaskTelegramMessage,
} from '@/lib/task-telegram-client';

const engineOptions = Object.values(ENGINE_CONFIGS);
const dispatchFlowHelp = 'Choose an engine, review the prompt, then send it.';
const APPLE_SHORTCUT_PLATFORM_PATTERN = /Mac|iPhone|iPad|iPod/;
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

export function getSendShortcutLabel(platform?: string) {
  const effectivePlatform =
    platform ?? (typeof navigator === 'undefined' ? '' : navigator.platform);

  return APPLE_SHORTCUT_PLATFORM_PATTERN.test(effectivePlatform) ? 'Cmd+Enter' : 'Ctrl+Enter';
}

type TaskCopyActionsProps = {
  taskKey: string;
  branchName?: string | null;
  status: string;
  engine?: string | null;
  dispatchTarget?: TaskDispatchTarget | null;
  noteMarkdown?: string | null;
  telegramEnabled?: boolean;
  hermesTelegramEnabled?: boolean;
  suppressShortcut?: boolean;
  placement?: 'rail' | 'bottom';
  onTaskQueued?: (taskKey: string, queuedAt: string, dispatchTarget: TaskDispatchTarget) => void;
};

type DispatchState = 'idle' | 'loading' | 'success' | 'error';
type TaskDispatchMode = Extract<
  TaskDispatchObjective,
  'plan' | 'implement' | 'ask' | 'review' | 'qa'
>;
type TaskEditDispatchAction = Extract<
  TaskDispatchPreferenceAction,
  'send-telegram' | 'send-hermes-telegram'
>;

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
  return action === 'send-telegram' || action === 'send-hermes-telegram';
}

function resolveTaskEditDispatchActions(
  telegramEnabled: boolean,
  hermesTelegramEnabled: boolean,
): TaskEditDispatchAction[] {
  const actions: TaskEditDispatchAction[] = [];

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
  taskDispatchTarget: TaskDispatchTarget | null | undefined,
  storedAction: TaskDispatchPreferenceAction | TaskEditDispatchAction | null | undefined,
) {
  const taskAction =
    taskDispatchTarget === 'hermes-telegram'
      ? 'send-hermes-telegram'
      : taskDispatchTarget === 'telegram'
        ? 'send-telegram'
        : null;

  if (taskAction && availableActions.includes(taskAction)) return taskAction;
  if (isTaskEditDispatchAction(storedAction) && availableActions.includes(storedAction)) {
    return storedAction;
  }
  return availableActions[0] ?? 'send-telegram';
}

function getTaskEditDispatchActionLabel(action: TaskEditDispatchAction) {
  switch (action) {
    case 'send-telegram':
      return '🦞 Telegram';
    case 'send-hermes-telegram':
      return 'H Telegram';
  }
}

function getTaskEditDispatchTargetName(action: TaskEditDispatchAction) {
  switch (action) {
    case 'send-telegram':
      return 'Telegram';
    case 'send-hermes-telegram':
      return 'Hermes Telegram';
  }
}

function getDispatchStatusMessage(state: DispatchState, action: TaskEditDispatchAction) {
  const noun = action === 'send-hermes-telegram' ? 'Telegram message' : 'Telegram message';

  switch (state) {
    case 'loading':
      return `Sending ${noun}.`;
    case 'success':
      return 'Telegram message sent.';
    case 'error':
      return 'Telegram message failed.';
    default:
      return 'Ready to send Telegram message.';
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
  dispatchTarget,
  noteMarkdown,
  telegramEnabled = false,
  hermesTelegramEnabled,
  suppressShortcut = false,
  placement = 'rail',
  onTaskQueued,
}: TaskCopyActionsProps) {
  const bottomControlId = useId();
  const resolvedHermesTelegramEnabled = hermesTelegramEnabled ?? telegramEnabled;
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
      resolveTaskEditDispatchActions(telegramEnabled, resolvedHermesTelegramEnabled),
      dispatchTarget,
      storedPreference?.action,
    ),
  );
  const [selectedObjective, setSelectedObjective] = useState<TaskDispatchMode>(() =>
    resolveInitialMode(availableModes, storedPreference?.objective),
  );
  const sendDispatchRef = useRef<(() => Promise<void>) | null>(null);
  const suppressShortcutRef = useRef(suppressShortcut);
  const dispatchInFlightRef = useRef(false);
  const dispatchGenerationRef = useRef(0);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dispatchState, setDispatchState] = useState<DispatchState>('idle');
  const [sendShortcutLabel, setSendShortcutLabel] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const isSending = dispatchState === 'loading';
  const clearDispatchResetTimeout = useCallback(() => {
    if (!resetTimeoutRef.current) return;

    clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = null;
  }, []);
  const availableActions = resolveTaskEditDispatchActions(
    telegramEnabled,
    resolvedHermesTelegramEnabled,
  );
  const effectiveObjective = availableModes.includes(selectedObjective)
    ? selectedObjective
    : resolveInitialMode(availableModes, storedPreference?.objective);
  const effectiveAction = availableActions.includes(selectedAction)
    ? selectedAction
    : resolveInitialAction(availableActions, null, selectedAction);
  const visibleModeOptions = dispatchModeOptions.filter((mode) =>
    availableModes.includes(mode.key),
  );
  const { askHint } = extractTaskAskPrompt(noteMarkdown);
  const messageAskHint = messageText.trim();
  const effectiveAskHint =
    placement === 'bottom' && effectiveObjective === 'ask' && messageAskHint
      ? messageAskHint
      : askHint;
  const dispatchAskHint = effectiveObjective === 'ask' ? effectiveAskHint : null;
  const dispatchPrompt =
    effectiveAction === 'send-hermes-telegram'
      ? buildHermesTaskTelegramMessage({
          taskKey,
          status,
          engine: selectedEngine?.key,
          branchName,
          objective: effectiveObjective,
          askHint: dispatchAskHint,
        })
      : buildTaskTelegramMessage({
          taskKey,
          status,
          engine: selectedEngine?.key,
          branchName,
          objective: effectiveObjective,
          askHint: dispatchAskHint,
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
      resolveTaskEditDispatchActions(telegramEnabled, resolvedHermesTelegramEnabled),
      null,
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

  const handleEngineSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextEngine = getEngineConfig(event.currentTarget.value);
    if (nextEngine) {
      selectEngine(nextEngine);
    }
  };

  const handleTargetSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextAction = event.currentTarget.value as TaskEditDispatchAction;
    if (availableActions.includes(nextAction)) {
      selectAction(nextAction);
    }
  };

  const handleModeSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextObjective = event.currentTarget.value as TaskDispatchMode;
    if (availableModes.includes(nextObjective)) {
      selectMode(nextObjective);
    }
  };

  const sendDispatch = async () => {
    if (dispatchInFlightRef.current) return;

    clearDispatchResetTimeout();
    dispatchGenerationRef.current += 1;
    const dispatchGeneration = dispatchGenerationRef.current;
    dispatchInFlightRef.current = true;
    setDispatchState('loading');

    try {
      const isHermesTelegram = effectiveAction === 'send-hermes-telegram';
      const dispatchTarget = isHermesTelegram ? 'hermes-telegram' : 'telegram';
      const result = await sendTaskTelegramMessage(
        taskKey,
        isHermesTelegram
          ? buildHermesTaskTelegramMessage({
              taskKey,
              status,
              engine: selectedEngine?.key,
              branchName,
              objective: effectiveObjective,
              askHint: dispatchAskHint,
            })
          : buildTaskTelegramMessage({
              taskKey,
              status,
              engine: selectedEngine?.key,
              branchName,
              objective: effectiveObjective,
              askHint: dispatchAskHint,
            }),
        dispatchTarget,
      );

      if (!result.ok) {
        if (dispatchGenerationRef.current === dispatchGeneration) {
          setDispatchState('error');
        }
        showErrorNotification(result.error);
      } else {
        const queuedAt = new Date().toISOString();
        onTaskQueued?.(taskKey, queuedAt, dispatchTarget);
        persistDispatchPreference(selectedEngine, effectiveObjective, effectiveAction);
        if (dispatchGenerationRef.current === dispatchGeneration) {
          setDispatchState('success');
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message ? error.message : 'Failed to send Telegram message';
      if (dispatchGenerationRef.current === dispatchGeneration) {
        setDispatchState('error');
      }
      showErrorNotification(errorMessage);
    } finally {
      if (dispatchGenerationRef.current !== dispatchGeneration) return;

      dispatchInFlightRef.current = false;
      resetTimeoutRef.current = setTimeout(() => {
        if (dispatchGenerationRef.current !== dispatchGeneration) return;

        setDispatchState('idle');
        resetTimeoutRef.current = null;
      }, 1500);
    }
  };

  useLayoutEffect(() => {
    sendDispatchRef.current = sendDispatch;
    suppressShortcutRef.current = suppressShortcut;
  });

  useEffect(() => {
    dispatchGenerationRef.current += 1;
    clearDispatchResetTimeout();
    dispatchInFlightRef.current = false;
    setDispatchState('idle');
    setMessageText('');

    return clearDispatchResetTimeout;
  }, [clearDispatchResetTimeout, taskKey]);

  useEffect(() => {
    setSendShortcutLabel(getSendShortcutLabel());
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (suppressShortcutRef.current) return;

      const isSendShortcut = (event.metaKey || event.ctrlKey) && event.key === 'Enter';
      if (!isSendShortcut) return;

      event.preventDefault();
      event.stopPropagation();
      void sendDispatchRef.current?.();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  if (availableModes.length === 0 || availableActions.length === 0) {
    return null;
  }

  if (placement === 'bottom') {
    const engineSelectId = `${bottomControlId}-engine`;
    const targetSelectId = `${bottomControlId}-target`;
    const modeSelectId = `${bottomControlId}-mode`;
    const messageInputId = `${bottomControlId}-message`;

    return (
      <div className="task-dispatch-bottom-bar" data-placement="bottom">
        <div className="task-dispatch-bottom-inner">
          <div className="task-dispatch-bottom-title">
            <Text component="span" size="sm" fw={800} className="openclaw-actions-label">
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

          <div className="task-dispatch-bottom-field task-dispatch-bottom-engine-field">
            <label className="task-dispatch-bottom-label" htmlFor={engineSelectId}>
              Engine
            </label>
            <div className="task-dispatch-bottom-select-wrap">
              {selectedEngine ? (
                <span
                  className="task-dispatch-engine-icon"
                  aria-hidden="true"
                  data-engine-icon={selectedEngine.key}
                  style={
                    {
                      '--engine-color': selectedEngine.iconColor,
                      '--engine-icon': `url(${selectedEngine.icon})`,
                    } as CSSProperties
                  }
                />
              ) : null}
              <select
                id={engineSelectId}
                aria-label="Engine"
                className="task-dispatch-bottom-select"
                value={selectedEngine?.key ?? ''}
                disabled={isSending}
                onChange={handleEngineSelectChange}
              >
                {engineOptions.map((engineOption) => (
                  <option key={engineOption.key} value={engineOption.key}>
                    {getEngineShortLabel(engineOption)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="task-dispatch-bottom-field task-dispatch-bottom-target-field">
            <label className="task-dispatch-bottom-label" htmlFor={targetSelectId}>
              Target
            </label>
            <div className="task-dispatch-bottom-select-wrap">
              {effectiveAction === 'send-telegram' ? (
                <span className="task-dispatch-target-emoji" aria-hidden="true">
                  🦞
                </span>
              ) : (
                <Image
                  className="task-dispatch-target-logo"
                  src="/icons/hermes-agent.png"
                  alt=""
                  width={16}
                  height={16}
                  aria-hidden="true"
                />
              )}
              <select
                id={targetSelectId}
                aria-label="Target"
                className="task-dispatch-bottom-select"
                value={effectiveAction}
                disabled={isSending}
                onChange={handleTargetSelectChange}
              >
                {availableActions.map((action) => (
                  <option key={action} value={action}>
                    {getTaskEditDispatchTargetName(action)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="task-dispatch-bottom-field task-dispatch-bottom-mode-field">
            <label className="task-dispatch-bottom-label" htmlFor={modeSelectId}>
              Mode
            </label>
            <select
              id={modeSelectId}
              aria-label="Mode"
              className="task-dispatch-bottom-select"
              value={effectiveObjective}
              disabled={isSending}
              onChange={handleModeSelectChange}
            >
              {visibleModeOptions.map((mode) => (
                <option key={mode.key} value={mode.key}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>

          <div className="task-dispatch-bottom-field task-dispatch-bottom-message-field">
            <label className="task-dispatch-bottom-label" htmlFor={messageInputId}>
              Message
            </label>
            <input
              id={messageInputId}
              type="text"
              aria-label="Message"
              className="task-dispatch-bottom-message"
              value={messageText}
              disabled={isSending || effectiveObjective !== 'ask'}
              autoComplete="off"
              onChange={(event) => setMessageText(event.currentTarget.value)}
            />
          </div>

          <div className="task-dispatch-bottom-field task-dispatch-bottom-prompt-field">
            <Text component="span" size="xs" fw={700} className="task-dispatch-bottom-label">
              Prompt
            </Text>
            <DispatchPromptPreview
              prompt={dispatchPrompt}
              promptProps={{
                'data-task-dispatch-prompt': true,
                className: 'task-dispatch-bottom-prompt',
              }}
              collapseMode="single-line"
              onCopy={() => persistDispatchPreference()}
            />
          </div>

          <UnstyledButton
            type="button"
            className="task-dispatch-send task-dispatch-bottom-send"
            data-state={dispatchState === 'idle' ? undefined : dispatchState}
            disabled={isSending}
            onClick={() => {
              void sendDispatch();
            }}
          >
            <span>{getSendLabel(dispatchState)}</span>
            {!suppressShortcut && sendShortcutLabel ? (
              <Kbd size="xs" className="task-dispatch-send-shortcut">
                {sendShortcutLabel}
              </Kbd>
            ) : null}
          </UnstyledButton>
        </div>

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
    );
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
        <div className="task-dispatch-main">
          <DispatchSegmentedControl
            label="Engine"
            groupLabel="Engine"
            groupClassName="task-dispatch-engine-segments"
            disabled={isSending}
            onSelect={(value) => {
              const nextEngine = getEngineConfig(value);
              if (nextEngine) {
                selectEngine(nextEngine);
              }
            }}
            options={engineOptions.map((engineOption) => {
              const selected = selectedEngine?.key === engineOption.key;
              const label = getEngineShortLabel(engineOption);

              return {
                value: engineOption.key,
                selected,
                ariaLabel: selected ? `Selected engine: ${label}` : `Select engine: ${label}`,
                content: (
                  <>
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
                  </>
                ),
              };
            })}
          />

          <DispatchSegmentedControl
            label="Target"
            groupLabel="Target"
            groupClassName="task-dispatch-target-segments"
            disabled={isSending}
            onSelect={(value) => selectAction(value)}
            options={availableActions.map((action) => {
              const selected = effectiveAction === action;
              const label = getTaskEditDispatchActionLabel(action);

              return {
                value: action,
                selected,
                ariaLabel: selected ? `Selected target: ${label}` : `Select target: ${label}`,
                content:
                  action === 'send-telegram' ? (
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

          <DispatchSegmentedControl
            label="Mode"
            groupLabel="Mode"
            groupClassName="task-dispatch-mode-segments"
            disabled={isSending}
            onSelect={(value) => selectMode(value)}
            options={visibleModeOptions.map((mode) => {
              const selected = effectiveObjective === mode.key;

              return {
                value: mode.key,
                selected,
                ariaLabel: selected ? `Selected mode: ${mode.label}` : `Select mode: ${mode.label}`,
                content: <span>{mode.label}</span>,
              };
            })}
          />

          <DispatchPromptPreview
            prompt={dispatchPrompt}
            promptProps={{ 'data-task-dispatch-prompt': true }}
            collapseMode="single-line"
            onCopy={() => persistDispatchPreference()}
          />

          <UnstyledButton
            type="button"
            aria-label="Send dispatch"
            className="task-dispatch-send"
            data-state={dispatchState === 'idle' ? undefined : dispatchState}
            disabled={isSending}
            onClick={() => {
              void sendDispatch();
            }}
          >
            <span>{getSendLabel(dispatchState)}</span>
            {!suppressShortcut && sendShortcutLabel ? (
              <Kbd size="xs" className="task-dispatch-send-shortcut">
                {sendShortcutLabel}
              </Kbd>
            ) : null}
          </UnstyledButton>
        </div>

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
