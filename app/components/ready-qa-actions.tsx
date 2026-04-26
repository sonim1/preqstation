'use client';

import {
  Accordion,
  ActionIcon,
  Badge,
  Code,
  CopyButton,
  Group,
  Modal,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck, IconCopy, IconFlask, IconInfoCircle } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { type CSSProperties, useState } from 'react';

import { DispatchPromptPreview } from '@/app/components/dispatch-prompt-preview';
import { DispatchSegmentedControl } from '@/app/components/dispatch-segmented-control';
import { formatDateTimeForDisplay } from '@/lib/date-time';
import { readQaDispatchPreference, writeQaDispatchPreference } from '@/lib/dispatch-preferences';
import {
  DEFAULT_ENGINE_KEY,
  ENGINE_CONFIGS,
  getEngineConfig,
  getEngineShortLabel,
  normalizeEngineKey,
} from '@/lib/engine-icons';
import { showErrorNotification, showSuccessNotification } from '@/lib/notifications';
import type { QaRunView } from '@/lib/qa-runs';
import type { TaskDispatchTarget } from '@/lib/task-dispatch';
import { buildProjectQaDispatchMessage } from '@/lib/task-telegram-client';
import { DEFAULT_TERMINOLOGY, type Terminology } from '@/lib/terminology';

import { InfiniteScrollTrigger } from './infinite-scroll-trigger';
import { MarkdownViewer } from './markdown-viewer';
import { useTerminology } from './terminology-provider';
import { useTimeZone } from './timezone-provider';

type ReadyQaActionsProps = {
  projectId: string;
  projectKey: string;
  projectName: string;
  branchName: string;
  readyCount: number;
  telegramEnabled: boolean;
  hermesTelegramEnabled?: boolean;
  initialRuns: QaRunView[];
  defaultEngine?: string | null;
  size?: number | string;
  iconSize?: number;
};

type QaDispatchTarget = TaskDispatchTarget;
type QaDispatchTargetOption = { value: QaDispatchTarget; label: string };

export const INITIAL_VISIBLE_QA_RUNS = 5;
const QA_ENGINE_OPTIONS = Object.values(ENGINE_CONFIGS);
const qaFlowHelp = 'Choose engine, then press play to queue QA.';
const claudeTargetConfig = ENGINE_CONFIGS['claude-code'];
const claudeTargetIconStyles = {
  '--engine-color': claudeTargetConfig.iconColor,
  '--engine-icon': `url(${claudeTargetConfig.icon})`,
} as CSSProperties;

function statusColor(status: QaRunView['status']) {
  switch (status) {
    case 'passed':
      return 'green';
    case 'failed':
      return 'red';
    case 'running':
      return 'blue';
    default:
      return 'gray';
  }
}

function formatSummary(summary: QaRunView['summary']) {
  return `Total ${summary.total} · Critical ${summary.critical} · High ${summary.high} · Medium ${summary.medium} · Low ${summary.low}`;
}

function formatTimestamp(value: string, timeZone: string) {
  return formatDateTimeForDisplay(value, timeZone);
}

function getQaTargetLabel(target: QaDispatchTarget) {
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

function resolveQaTargets({
  telegramEnabled,
  hermesTelegramEnabled,
}: {
  telegramEnabled: boolean;
  hermesTelegramEnabled: boolean;
}) {
  const targets: QaDispatchTargetOption[] = [];

  if (telegramEnabled) {
    targets.push({ value: 'telegram', label: '🦞 Telegram' });
  }
  if (hermesTelegramEnabled) {
    targets.push({ value: 'hermes-telegram', label: 'H Telegram' });
  }
  targets.push({ value: 'claude-code-channel', label: 'Channels' });

  return targets;
}

function resolveInitialQaTarget(
  targetOptions: QaDispatchTargetOption[],
  target: QaDispatchTarget | null,
) {
  if (targetOptions.some((option) => option.value === target)) {
    return target;
  }

  return targetOptions[0]?.value ?? 'claude-code-channel';
}

export function getVisibleQaRuns(runs: QaRunView[], visibleCount: number) {
  return runs.slice(0, visibleCount);
}

export function getNextVisibleQaRunCount(visibleCount: number, totalRuns: number) {
  return Math.min(visibleCount + INITIAL_VISIBLE_QA_RUNS, totalRuns);
}

export function hasMoreQaRuns(totalRuns: number, visibleCount: number) {
  return totalRuns > visibleCount;
}

export function formatReadyQaScopeLabel(
  readyCount: number,
  terminology: Terminology = DEFAULT_TERMINOLOGY,
) {
  const noun = readyCount === 1 ? terminology.task.singularLower : terminology.task.pluralLower;
  return `${readyCount} ready ${noun}`;
}

export function formatReadyQaIntro(
  projectName: string,
  projectKey: string,
  branchName: string,
  readyCount: number,
  terminology: Terminology = DEFAULT_TERMINOLOGY,
) {
  return `QA runs are integration tests for the current Ready ${terminology.task.pluralLower} in ${projectName} (${projectKey}) on ${branchName}. Scope: ${formatReadyQaScopeLabel(readyCount, terminology)}.`;
}

export function buildQaRunCopyText(run: QaRunView) {
  return run.reportMarkdown ?? '';
}

const QUEUED_QA_PROMPT_HELP =
  'Queue QA to generate an executable dispatch prompt for the current ready tasks.';

export function ReadyQaActions({
  projectId,
  projectKey,
  projectName,
  branchName,
  readyCount,
  telegramEnabled,
  hermesTelegramEnabled = false,
  initialRuns,
  defaultEngine = DEFAULT_ENGINE_KEY,
  size = 'lg',
  iconSize = 16,
}: ReadyQaActionsProps) {
  const terminology = useTerminology();
  const timeZone = useTimeZone();
  const [opened, setOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runs, setRuns] = useState(initialRuns);
  const [visibleRunCount, setVisibleRunCount] = useState(INITIAL_VISIBLE_QA_RUNS);
  const [selectedEngine, setSelectedEngine] = useState<string>(
    () => readQaDispatchPreference() ?? normalizeEngineKey(defaultEngine) ?? DEFAULT_ENGINE_KEY,
  );
  const [selectedTarget, setSelectedTarget] = useState<QaDispatchTarget | null>(() =>
    resolveInitialQaTarget(resolveQaTargets({ telegramEnabled, hermesTelegramEnabled }), null),
  );
  const [queuedQaPrompt, setQueuedQaPrompt] = useState<string | null>(null);
  const selectedEngineConfig =
    getEngineConfig(selectedEngine) ?? ENGINE_CONFIGS[DEFAULT_ENGINE_KEY];
  const visibleRuns = getVisibleQaRuns(runs, visibleRunCount);
  const availableTargets = resolveQaTargets({ telegramEnabled, hermesTelegramEnabled });
  const effectiveTarget = resolveInitialQaTarget(availableTargets, selectedTarget);
  const qaPreview = queuedQaPrompt ?? QUEUED_QA_PROMPT_HELP;

  function openRunsModal() {
    setOpened(true);
  }

  function closeRunsModal() {
    setOpened(false);
    setVisibleRunCount(INITIAL_VISIBLE_QA_RUNS);
  }

  function loadMoreRuns() {
    setVisibleRunCount((currentCount) => getNextVisibleQaRunCount(currentCount, runs.length));
  }

  async function runQa() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/qa-runs/trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            engine: selectedEngineConfig.key,
            dispatchTarget: effectiveTarget,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        run?: QaRunView;
        error?: string;
      } | null;

      if (!response.ok || !payload?.run) {
        showErrorNotification(payload?.error || 'Failed to queue QA run');
        return;
      }

      const queuedRun = payload.run;
      setQueuedQaPrompt(
        buildProjectQaDispatchMessage({
          projectKey,
          engine: selectedEngineConfig.key,
          branchName,
          dispatchTarget: effectiveTarget,
          qaRunId: queuedRun.id,
          qaTaskKeys: queuedRun.taskKeys,
        }),
      );
      setRuns((current) => [queuedRun, ...current.filter((run) => run.id !== queuedRun.id)]);
      const engineKey = normalizeEngineKey(selectedEngineConfig.key);
      if (engineKey) {
        writeQaDispatchPreference(engineKey);
      }
      setOpened(true);
      showSuccessNotification(`QA queued for ${branchName}`);
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to queue QA run';
      showErrorNotification(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Tooltip label="QA">
        <ActionIcon
          size={size}
          radius="xl"
          variant="default"
          aria-label="Open QA runs"
          onClick={openRunsModal}
        >
          <IconFlask size={iconSize} />
        </ActionIcon>
      </Tooltip>

      <Modal
        opened={opened}
        onClose={closeRunsModal}
        title="QA Runs"
        size="xl"
        centered
        overlayProps={{ opacity: 0.55, blur: 18 }}
        transitionProps={{ transition: 'fade-up', duration: 180, timingFunction: 'ease' }}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {formatReadyQaIntro(projectName, projectKey, branchName, readyCount, terminology)}
          </Text>

          <div className="task-dispatch-actions">
            <div className="openclaw-dispatch-label">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" className="openclaw-actions-label">
                QA
              </Text>
              <Tooltip label={qaFlowHelp} withArrow multiline w={220}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  radius="xl"
                  aria-label="QA flow help"
                  className="openclaw-dispatch-help"
                >
                  <IconInfoCircle size={14} />
                </ActionIcon>
              </Tooltip>
            </div>

            <div className="task-dispatch-panel">
              <DispatchSegmentedControl
                label="Engine"
                groupLabel="Engine"
                groupClassName="task-dispatch-engine-segments"
                disabled={isSubmitting}
                onSelect={(value) => {
                  setSelectedEngine(value);
                  setQueuedQaPrompt(null);
                }}
                options={QA_ENGINE_OPTIONS.map((engine) => {
                  const selected = selectedEngineConfig.key === engine.key;
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
                disabled={isSubmitting}
                onSelect={(value) => {
                  setSelectedTarget(value);
                  setQueuedQaPrompt(null);
                }}
                options={availableTargets.map((option) => {
                  const selected = effectiveTarget === option.value;
                  const label = getQaTargetLabel(option.value);

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

              <DispatchPromptPreview
                prompt={qaPreview}
                copyDisabled={!queuedQaPrompt}
                copyTooltipLabel={QUEUED_QA_PROMPT_HELP}
                onCopy={() => showSuccessNotification('Dispatch prompt copied.')}
              />

              <UnstyledButton
                type="button"
                className="task-dispatch-send"
                disabled={readyCount === 0 || isSubmitting}
                onClick={() => {
                  void runQa();
                }}
              >
                <span>{isSubmitting ? 'Queueing' : 'Queue QA'}</span>
              </UnstyledButton>
            </div>
          </div>

          {runs.length === 0 ? (
            <Text size="sm" c="dimmed">
              No QA runs yet.
            </Text>
          ) : (
            <>
              <Accordion defaultValue={visibleRuns[0]?.id} variant="separated">
                {visibleRuns.map((run) => (
                  <Accordion.Item key={run.id} value={run.id}>
                    <Accordion.Control>
                      <Group justify="space-between" wrap="nowrap">
                        <Stack gap={2}>
                          <Group gap={8}>
                            <Badge color={statusColor(run.status)} variant="light">
                              {run.status}
                            </Badge>
                            <Text fw={600}>{formatTimestamp(run.createdAt, timeZone)}</Text>
                          </Group>
                          <Text size="sm" c="dimmed">
                            {run.branchName} · {formatSummary(run.summary)}
                          </Text>
                        </Stack>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="sm">
                        <Text size="sm">
                          {`Included ${terminology.task.pluralLower}: `}
                          {run.taskKeys.map((taskKey, index) => (
                            <Text
                              key={taskKey}
                              component={Link}
                              href={`/board/${projectKey}?panel=task-edit&taskId=${encodeURIComponent(taskKey)}`}
                              span
                              inherit
                              fw={600}
                            >
                              {index > 0 ? ', ' : ''}
                              {taskKey}
                            </Text>
                          ))}
                        </Text>
                        {run.targetUrl ? (
                          <Text size="sm">
                            Target URL: <Code>{run.targetUrl}</Code>
                          </Text>
                        ) : null}
                        {run.reportMarkdown ? (
                          <>
                            <MarkdownViewer markdown={run.reportMarkdown} mode="artifacts" />
                            <Group justify="space-between" align="center" gap="xs">
                              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                                Report
                              </Text>
                              <CopyButton value={buildQaRunCopyText(run)} timeout={2000}>
                                {({ copied, copy }) => (
                                  <Tooltip label={copied ? 'Copied' : 'Copy report'} withArrow>
                                    <ActionIcon
                                      type="button"
                                      variant="subtle"
                                      color={copied ? 'green' : 'gray'}
                                      aria-label={`Copy QA report for ${run.id}`}
                                      onClick={copy}
                                    >
                                      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </CopyButton>
                            </Group>
                            <MarkdownViewer markdown={run.reportMarkdown} mode="body" />
                          </>
                        ) : (
                          <Text size="sm" c="dimmed">
                            Report not uploaded yet. Refresh after the QA run finishes.
                          </Text>
                        )}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
              <InfiniteScrollTrigger
                active={opened}
                hasMore={hasMoreQaRuns(runs.length, visibleRunCount)}
                loading={false}
                resetKey={String(visibleRunCount)}
                onLoadMore={loadMoreRuns}
              />
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
