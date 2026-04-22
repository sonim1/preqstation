'use client';

import {
  Accordion,
  ActionIcon,
  Badge,
  Code,
  CopyButton,
  Divider,
  Group,
  Image,
  Menu,
  Modal,
  Paper,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconFlask,
  IconInfoCircle,
  IconLoader2,
  IconPlayerPlay,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import { formatDateTimeForDisplay } from '@/lib/date-time';
import { readQaDispatchPreference, writeQaDispatchPreference } from '@/lib/dispatch-preferences';
import {
  DEFAULT_ENGINE_KEY,
  ENGINE_CONFIGS,
  getEngineConfig,
  normalizeEngineKey,
} from '@/lib/engine-icons';
import { showErrorNotification, showSuccessNotification } from '@/lib/notifications';
import type { QaRunView } from '@/lib/qa-runs';
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
  initialRuns: QaRunView[];
  defaultEngine?: string | null;
  size?: number | string;
  iconSize?: number;
};

export const INITIAL_VISIBLE_QA_RUNS = 5;
const QA_ENGINE_OPTIONS = Object.values(ENGINE_CONFIGS);
const qaFlowHelp = 'Choose engine, then press play to queue QA.';

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

export function ReadyQaActions({
  projectId,
  projectKey,
  projectName,
  branchName,
  readyCount,
  telegramEnabled,
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
  const selectedEngineConfig =
    getEngineConfig(selectedEngine) ?? ENGINE_CONFIGS[DEFAULT_ENGINE_KEY];
  const visibleRuns = getVisibleQaRuns(runs, visibleRunCount);

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
          body: JSON.stringify({ engine: selectedEngine }),
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

      setRuns((current) => [payload.run!, ...current.filter((run) => run.id !== payload.run!.id)]);
      const engineKey = normalizeEngineKey(selectedEngine);
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
          <Group gap="xs" wrap="wrap" className="openclaw-actions">
            <Group gap={4} wrap="nowrap" className="openclaw-dispatch-label">
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
            </Group>

            <Paper withBorder radius="xl" px={6} py={2} className="openclaw-action-bar">
              <Group gap={4} wrap="nowrap" className="openclaw-action-bar-inner">
                <Menu position="bottom-end" shadow="md" withinPortal>
                  <Menu.Target>
                    <UnstyledButton
                      type="button"
                      className="openclaw-engine-trigger"
                      aria-label={`Selected engine: ${selectedEngineConfig.label}`}
                      disabled={isSubmitting}
                    >
                      <Group gap={6} wrap="nowrap">
                        <Image
                          src={selectedEngineConfig.icon}
                          alt={selectedEngineConfig.label}
                          w={14}
                          h={14}
                        />
                        <Text size="xs" fw={600} className="openclaw-engine-label">
                          {selectedEngineConfig.label}
                        </Text>
                        <IconChevronDown size={10} />
                      </Group>
                    </UnstyledButton>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {QA_ENGINE_OPTIONS.map((engine) => (
                      <Menu.Item
                        key={engine.key}
                        onClick={() => setSelectedEngine(engine.key)}
                        leftSection={<Image src={engine.icon} alt={engine.label} w={16} h={16} />}
                        rightSection={
                          selectedEngineConfig.key === engine.key ? <IconCheck size={14} /> : null
                        }
                        disabled={isSubmitting}
                      >
                        {engine.label}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>

                <Divider orientation="vertical" />

                <UnstyledButton
                  type="button"
                  className="openclaw-action-trigger"
                  aria-label="Selected action: Run QA"
                  disabled
                >
                  <Group gap={6} wrap="nowrap">
                    <Text size="xs" fw={600} className="openclaw-action-label">
                      Run QA
                    </Text>
                  </Group>
                </UnstyledButton>

                <Divider orientation="vertical" />

                <Tooltip label="Run QA" withArrow>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    aria-label="Execute QA action"
                    color="gray"
                    disabled={!telegramEnabled || readyCount === 0 || isSubmitting}
                    onClick={runQa}
                    className="openclaw-execute-trigger"
                  >
                    {isSubmitting ? <IconLoader2 size={14} /> : <IconPlayerPlay size={14} />}
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Paper>
          </Group>
          {!telegramEnabled ? (
            <Text size="sm" c="red">
              Telegram must be configured before QA runs can be queued.
            </Text>
          ) : null}
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
