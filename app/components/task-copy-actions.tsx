'use client';

import { ActionIcon, Kbd, Menu, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconCheck, IconChevronDown, IconInfoCircle } from '@tabler/icons-react';
import Image from 'next/image';
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
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
  telegramEnabled?: boolean;
  hermesTelegramEnabled?: boolean;
  suppressShortcut?: boolean;
  placement?: 'rail' | 'bottom';
  onTaskQueued?: (taskKey: string, queuedAt: string, dispatchTarget: TaskDispatchTarget) => void;
};

type DispatchState = 'idle' | 'loading' | 'success' | 'error';
type TaskDispatchMode = Extract<TaskDispatchObjective, 'plan' | 'implement' | 'review' | 'qa'>;
type TaskEditDispatchAction = Extract<
  TaskDispatchPreferenceAction,
  'send-telegram' | 'send-hermes-telegram'
>;
type BottomDispatchPickerOption<T extends string> = {
  value: T;
  label: string;
  detail?: string;
  icon?: ReactNode;
};
type BottomDispatchPickerProps<T extends string> = {
  label: string;
  value: T;
  selectedLabel: string;
  selectedIcon?: ReactNode;
  options: Array<BottomDispatchPickerOption<T>>;
  disabled?: boolean;
  onSelect: (value: T) => void;
};

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
    objective === 'review' ||
    objective === 'qa'
  );
}

function getDispatchModesForStatus(status: string): TaskDispatchMode[] {
  switch (status) {
    case 'inbox':
      return ['plan'];
    case 'todo':
    case 'hold':
      return ['implement'];
    case 'ready':
      return ['review', 'qa'];
    case 'done':
      return ['qa'];
    default:
      return [];
  }
}

function resolveInitialMode(
  availableModes: TaskDispatchMode[],
  objective: TaskDispatchObjective | null | undefined,
) {
  if (isTaskDispatchMode(objective) && availableModes.includes(objective)) return objective;
  return availableModes[0] ?? 'plan';
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

function getDispatchModeDetail(mode: TaskDispatchMode) {
  switch (mode) {
    case 'plan':
      return 'Plan only';
    case 'implement':
      return 'Run the task';
    case 'review':
      return 'Verify ready work';
    case 'qa':
      return 'Browser QA';
  }
}

function renderEngineIcon(engineOption: EngineConfig) {
  return (
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
  );
}

function renderTargetIcon(action: TaskEditDispatchAction) {
  return action === 'send-telegram' ? (
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
  );
}

function BottomDispatchPicker<T extends string>({
  label,
  value,
  selectedLabel,
  selectedIcon,
  options,
  disabled = false,
  onSelect,
}: BottomDispatchPickerProps<T>) {
  const [opened, setOpened] = useState(false);
  const handleMenuItemKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      setOpened(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    const menu = event.currentTarget.closest('[role="menu"]');
    const items = Array.from(
      menu?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
    );
    const currentIndex = items.indexOf(event.currentTarget);
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + offset + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div className="task-dispatch-bottom-field">
      <Text component="span" size="xs" fw={700} className="task-dispatch-bottom-label">
        {label}
      </Text>
      <Menu opened={opened} onChange={setOpened} position="top-start" shadow="md" withinPortal>
        <Menu.Target>
          <UnstyledButton
            type="button"
            className="task-dispatch-bottom-picker"
            aria-label={`${label}: ${selectedLabel}`}
            disabled={disabled}
          >
            <span className="task-dispatch-bottom-picker-main">
              {selectedIcon}
              <span>{selectedLabel}</span>
            </span>
            <IconChevronDown size={14} aria-hidden="true" />
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown className="task-dispatch-bottom-menu">
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <UnstyledButton
                key={option.value}
                type="button"
                className="task-dispatch-bottom-menu-item"
                role="menuitemradio"
                aria-checked={selected}
                data-selected={selected ? 'true' : undefined}
                onClick={() => {
                  onSelect(option.value);
                  setOpened(false);
                }}
                onKeyDown={handleMenuItemKeyDown}
              >
                {option.icon ? (
                  <span className="task-dispatch-bottom-option-icon">{option.icon}</span>
                ) : null}
                <span className="task-dispatch-bottom-option-text">
                  <span className="task-dispatch-bottom-option-label">{option.label}</span>
                  {option.detail ? (
                    <span className="task-dispatch-bottom-option-detail">{option.detail}</span>
                  ) : null}
                </span>
                <span className="task-dispatch-bottom-option-check">
                  {selected ? <IconCheck size={14} aria-hidden="true" /> : null}
                </span>
              </UnstyledButton>
            );
          })}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
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
  telegramEnabled = false,
  hermesTelegramEnabled,
  suppressShortcut = false,
  placement = 'rail',
  onTaskQueued,
}: TaskCopyActionsProps) {
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
  const dispatchPrompt =
    effectiveAction === 'send-hermes-telegram'
      ? buildHermesTaskTelegramMessage({
          taskKey,
          status,
          engine: selectedEngine?.key,
          branchName,
          objective: effectiveObjective,
        })
      : buildTaskTelegramMessage({
          taskKey,
          status,
          engine: selectedEngine?.key,
          branchName,
          objective: effectiveObjective,
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
            })
          : buildTaskTelegramMessage({
              taskKey,
              status,
              engine: selectedEngine?.key,
              branchName,
              objective: effectiveObjective,
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
    const selectedEngineLabel = selectedEngine ? getEngineShortLabel(selectedEngine) : 'Engine';
    const selectedActionLabel = getTaskEditDispatchTargetName(effectiveAction);
    const selectedModeLabel =
      visibleModeOptions.find((mode) => mode.key === effectiveObjective)?.label ??
      effectiveObjective;

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

          <div className="task-dispatch-bottom-engine-field">
            <BottomDispatchPicker
              label="Engine"
              value={selectedEngine?.key ?? ''}
              selectedLabel={selectedEngineLabel}
              selectedIcon={selectedEngine ? renderEngineIcon(selectedEngine) : null}
              options={engineOptions.map((engineOption) => ({
                value: engineOption.key,
                label: getEngineShortLabel(engineOption),
                detail: engineOption.label,
                icon: renderEngineIcon(engineOption),
              }))}
              disabled={isSending}
              onSelect={(value) => {
                const nextEngine = getEngineConfig(value);
                if (nextEngine) {
                  selectEngine(nextEngine);
                }
              }}
            />
          </div>

          <div className="task-dispatch-bottom-target-field">
            <BottomDispatchPicker
              label="Target"
              value={effectiveAction}
              selectedLabel={selectedActionLabel}
              selectedIcon={renderTargetIcon(effectiveAction)}
              options={availableActions.map((action) => ({
                value: action,
                label:
                  action === 'send-telegram'
                    ? 'OpenClaw Telegram'
                    : getTaskEditDispatchTargetName(action),
                detail: action === 'send-telegram' ? 'Telegram' : 'Hermes Telegram',
                icon: renderTargetIcon(action),
              }))}
              disabled={isSending}
              onSelect={selectAction}
            />
          </div>

          <div className="task-dispatch-bottom-mode-field">
            <BottomDispatchPicker
              label="Mode"
              value={effectiveObjective}
              selectedLabel={selectedModeLabel}
              options={visibleModeOptions.map((mode) => ({
                value: mode.key,
                label: mode.label,
                detail: getDispatchModeDetail(mode.key),
              }))}
              disabled={isSending}
              onSelect={selectMode}
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
