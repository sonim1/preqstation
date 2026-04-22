'use client';

import { Accordion, Badge, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import {
  IconAdjustmentsHorizontal,
  IconChecklist,
  IconCircleDot,
  IconClipboardCheck,
  IconFlag,
  IconGitBranch,
  IconMessageCircle,
  IconPencil,
} from '@tabler/icons-react';
import Image from 'next/image';
import { type ReactNode, useState } from 'react';

import { MarkdownViewer } from '@/app/components/markdown-viewer';
import {
  formatDateForDisplay,
  formatDateTimeForDisplay,
  formatTimeForDisplay,
  getDayRangeForTimeZone,
} from '@/lib/date-time';
import { getEngineConfig, normalizeEngineKey } from '@/lib/engine-icons';
import {
  parseFieldChangesFromDetail,
  parseTaskNoteChangeDetail,
  type TaskFieldChange,
  type TaskNoteChangeDetail,
} from '@/lib/task-worklog';

import { useTimeZone } from './timezone-provider';

export type WorkLogTimelineItem = {
  id: string;
  title: string;
  detail?: string | null;
  engine?: string | null;
  workedAt: Date;
  project?: { name: string } | null;
  todo?: { engine: string | null } | null;
  task?: { engine: string | null } | null;
};

type WorkLogTimelineProps = {
  logs: WorkLogTimelineItem[];
  emptyText: string;
  emptyState?: ReactNode;
  showProjectName?: boolean;
  variant?: 'accordion' | 'ledger' | 'activity';
};

type WorkLogActionMeta = {
  key: string;
  label: string;
  tooltip: string;
  color: string;
  background: string;
  Icon: typeof IconCircleDot;
};

type WorkLogDetailState =
  | { status: 'loading' }
  | { status: 'ready'; detail: string | null }
  | { status: 'error'; message: string };

function getWorkLogActionMeta(title: string): WorkLogActionMeta {
  const normalizedTitle = title.toLowerCase();

  if (normalizedTitle.includes('comment')) {
    return {
      key: 'comment',
      label: 'Comment',
      tooltip: 'Comment',
      color: 'var(--mantine-color-cyan-4)',
      background: 'color-mix(in srgb, var(--mantine-color-cyan-9), transparent 64%)',
      Icon: IconMessageCircle,
    };
  }

  if (normalizedTitle.includes('fields updated')) {
    return {
      key: 'fields',
      label: 'Fields updated',
      tooltip: 'Fields updated',
      color: 'var(--mantine-color-teal-4)',
      background: 'color-mix(in srgb, var(--mantine-color-teal-9), transparent 64%)',
      Icon: IconAdjustmentsHorizontal,
    };
  }

  if (normalizedTitle.includes('preqstation plan')) {
    return {
      key: 'plan',
      label: 'PREQSTATION plan',
      tooltip: 'PREQSTATION plan',
      color: 'var(--mantine-color-violet-3)',
      background: 'color-mix(in srgb, var(--mantine-color-violet-9), transparent 66%)',
      Icon: IconChecklist,
    };
  }

  if (normalizedTitle.includes('preqstation result')) {
    return {
      key: 'result',
      label: 'PREQSTATION result',
      tooltip: 'PREQSTATION result',
      color: 'var(--mantine-color-lime-4)',
      background: 'color-mix(in srgb, var(--mantine-color-lime-9), transparent 68%)',
      Icon: IconClipboardCheck,
    };
  }

  if (normalizedTitle.includes('note updated')) {
    return {
      key: 'note',
      label: 'Note updated',
      tooltip: 'Note updated',
      color: 'var(--mantine-color-yellow-4)',
      background: 'color-mix(in srgb, var(--mantine-color-yellow-9), transparent 70%)',
      Icon: IconPencil,
    };
  }

  if (title.includes('->')) {
    return {
      key: 'status',
      label: 'Status changed',
      tooltip: 'Status changed',
      color: 'var(--mantine-color-orange-4)',
      background: 'color-mix(in srgb, var(--mantine-color-orange-9), transparent 68%)',
      Icon: IconGitBranch,
    };
  }

  return {
    key: 'event',
    label: 'Work log',
    tooltip: 'Work log',
    color: 'var(--mantine-color-gray-4)',
    background: 'color-mix(in srgb, var(--mantine-color-gray-9), transparent 68%)',
    Icon: IconFlag,
  };
}

function isEmptyChangeValue(value: string) {
  return value === '(empty)' || value === '(none)';
}

function summarizeFieldChange(change: TaskFieldChange) {
  const field = change.field.toLowerCase();

  if (field === 'labels') {
    const fromEmpty = isEmptyChangeValue(change.from);
    const toEmpty = isEmptyChangeValue(change.to);
    if (fromEmpty && !toEmpty) return 'Label added';
    if (!fromEmpty && toEmpty) return 'Label removed';
    return 'Labels updated';
  }

  if (field === 'title') return 'Title changed';
  if (field === 'task priority') return 'Priority changed';
  if (field === 'note') return 'Note updated';
  if (field === 'run state') return 'Run state updated';
  if (field === 'due date') return 'Due date updated';
  if (field === 'description') return 'Description updated';
  if (field === 'acceptance criteria') return 'Acceptance criteria updated';

  return `${change.field} updated`;
}

function stripTaskKeyTitlePrefix(title: string) {
  const parts = title.split(' · ');
  return parts.length > 1 ? parts.slice(1).join(' · ') : title;
}

function getWorkLogDisplayTitle(log: Pick<WorkLogTimelineItem, 'title' | 'detail'>) {
  const normalizedTitle = log.title.toLowerCase();

  if (normalizedTitle.includes('fields updated')) {
    const changes = parseFieldChangesFromDetail(log.detail ?? '');
    if (changes) return changes.map(summarizeFieldChange).join(', ');
    const explicitSummary = log.title.match(/Fields Updated \(\d+\)\s*·\s*(.+)$/i)?.[1]?.trim();
    if (explicitSummary) return explicitSummary;
  }

  if (normalizedTitle.includes('note updated')) return 'Note updated';

  return stripTaskKeyTitlePrefix(log.title);
}

function formatLedgerDayLabel(workedAt: Date, now: Date, timeZone: string) {
  const today = formatDateForDisplay(now, timeZone);
  const yesterday = formatDateForDisplay(
    new Date(getDayRangeForTimeZone(timeZone, now).start.getTime() - 1),
    timeZone,
  );
  const workedDay = formatDateForDisplay(workedAt, timeZone);

  if (workedDay === today) return 'Today';
  if (workedDay === yesterday) return 'Yesterday';
  return workedDay;
}

function formatLedgerTime(workedAt: Date, timeZone: string) {
  return formatTimeForDisplay(workedAt, timeZone);
}

export function resolveWorkLogEngine(log: Pick<WorkLogTimelineItem, 'engine' | 'todo' | 'task'>) {
  const workLogEngine = normalizeEngineKey(log.engine);
  if (workLogEngine) return workLogEngine;

  const todoEngine = normalizeEngineKey(log.todo?.engine ?? log.task?.engine);
  if (todoEngine) return todoEngine;

  return null;
}

function NoteChangeInspector({ noteChange }: { noteChange: TaskNoteChangeDetail }) {
  const previousNote = noteChange.previousNote.trim() ? noteChange.previousNote : '_Empty_';
  const updatedNote = noteChange.updatedNote.trim() ? noteChange.updatedNote : '_Empty_';

  return (
    <div className="worklog-note-change" data-work-log-note-change="true">
      <div className="worklog-note-change-summary">
        <span>View note change</span>
        <span className="worklog-note-change-delta">previous · updated</span>
      </div>

      <div className="worklog-note-change-body">
        <section className="worklog-note-change-panel" aria-label="Previous note">
          <div className="worklog-note-change-label">
            <span className="worklog-note-change-dot worklog-note-change-dot-old" />
            Previous
          </div>
          <MarkdownViewer
            markdown={previousNote}
            className="markdown-output worklog-note-change-markdown"
            mode="body"
          />
        </section>

        <section className="worklog-note-change-panel" aria-label="Updated note">
          <div className="worklog-note-change-label">
            <span className="worklog-note-change-dot worklog-note-change-dot-new" />
            Updated
          </div>
          <MarkdownViewer
            markdown={updatedNote}
            className="markdown-output worklog-note-change-markdown"
            mode="body"
          />
        </section>
      </div>
    </div>
  );
}

function getResolvedWorkLogDetail(log: WorkLogTimelineItem, state: WorkLogDetailState | undefined) {
  if (log.detail !== undefined) return log.detail;
  if (state?.status === 'ready') return state.detail;
  return undefined;
}

export function WorkLogTimeline({
  logs,
  emptyText,
  emptyState,
  showProjectName = false,
  variant = 'accordion',
}: WorkLogTimelineProps) {
  const timeZone = useTimeZone();
  const [openLogIds, setOpenLogIds] = useState<Record<string, boolean>>({});
  const [detailStates, setDetailStates] = useState<Record<string, WorkLogDetailState>>({});

  async function loadWorkLogDetail(log: WorkLogTimelineItem) {
    if (log.detail !== undefined) return;
    if (detailStates[log.id]?.status === 'loading' || detailStates[log.id]?.status === 'ready') {
      return;
    }

    setDetailStates((current) => ({
      ...current,
      [log.id]: { status: 'loading' },
    }));

    try {
      const response = await fetch(`/api/work-logs/${log.id}`, { credentials: 'same-origin' });
      if (!response.ok) {
        throw new Error('Failed to load detail.');
      }

      const body = (await response.json()) as {
        workLog?: { detail?: string | null };
      };
      setDetailStates((current) => ({
        ...current,
        [log.id]: { status: 'ready', detail: body.workLog?.detail ?? null },
      }));
    } catch (error) {
      setDetailStates((current) => ({
        ...current,
        [log.id]: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to load detail.',
        },
      }));
    }
  }

  if (logs.length === 0) {
    return emptyState ?? <Text c="dimmed">{emptyText}</Text>;
  }

  if (variant === 'activity') {
    return (
      <div
        role="list"
        data-work-log-variant="activity"
        style={{ display: 'grid', gap: 0, minWidth: 0 }}
      >
        {logs.map((log, index) => {
          const action = getWorkLogActionMeta(log.title);
          const engineConfig = getEngineConfig(resolveWorkLogEngine(log));
          const showProjectBadge = Boolean(showProjectName && log.project);
          const Icon = action.Icon;
          const isLast = index === logs.length - 1;
          const isOpen = Boolean(openLogIds[log.id]);
          const detailState = detailStates[log.id];
          const detail = getResolvedWorkLogDetail(log, detailState);
          const displayTitle = getWorkLogDisplayTitle({ title: log.title, detail });
          const noteChange =
            isOpen && log.title.toLowerCase().includes('note updated')
              ? parseTaskNoteChangeDetail(detail)
              : null;

          return (
            <div
              key={log.id}
              role="listitem"
              data-work-log-action={action.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px minmax(0, 1fr)',
                columnGap: 10,
                minWidth: 0,
                paddingBottom: isLast ? 0 : 16,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  minHeight: 24,
                  alignItems: 'flex-start',
                }}
              >
                {!isLast ? (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 27,
                      bottom: -16,
                      width: 1,
                      background:
                        'color-mix(in srgb, var(--ui-border), var(--mantine-color-gray-5) 28%)',
                    }}
                  />
                ) : null}
                <Tooltip label={action.tooltip} withArrow>
                  <div
                    data-work-log-action-icon={action.key}
                    title={action.tooltip}
                    aria-label={action.tooltip}
                    role="img"
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      width: 24,
                      height: 24,
                      borderRadius: 7,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: action.color,
                      background: action.background,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${action.color}, transparent 62%)`,
                    }}
                  >
                    <Icon size={14} stroke={1.8} />
                  </div>
                </Tooltip>
              </div>

              <div style={{ minWidth: 0 }}>
                <details
                  className="worklog-activity-disclosure"
                  onToggle={(event) => {
                    const nextOpen = event.currentTarget.open;
                    setOpenLogIds((current) => ({ ...current, [log.id]: nextOpen }));
                    if (nextOpen) void loadWorkLogDetail(log);
                  }}
                >
                  <summary className="worklog-activity-summary">
                    <Group gap={6} align="center" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Text
                        fw={700}
                        size="sm"
                        style={{
                          flex: '1 1 auto',
                          minWidth: 0,
                          lineHeight: 1.35,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {displayTitle}
                      </Text>
                      {engineConfig ? (
                        <Group
                          gap={4}
                          align="center"
                          wrap="nowrap"
                          style={{ flex: '0 0 auto', minWidth: 0 }}
                        >
                          <Image
                            src={engineConfig.icon}
                            alt={engineConfig.label}
                            width={10}
                            height={10}
                          />
                          <Text
                            size="xs"
                            c="dimmed"
                            data-work-log-inline-engine={engineConfig.key}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {engineConfig.label}
                          </Text>
                        </Group>
                      ) : null}
                      <Text
                        component="time"
                        dateTime={log.workedAt.toISOString()}
                        size="xs"
                        c="dimmed"
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatDateTimeForDisplay(log.workedAt, timeZone)}
                      </Text>
                    </Group>
                  </summary>

                  {isOpen ? (
                    <div className="worklog-activity-detail">
                      {detailState?.status === 'loading' ? (
                        <Text size="sm" c="dimmed">
                          Loading detail...
                        </Text>
                      ) : detailState?.status === 'error' ? (
                        <Text size="sm" c="red">
                          {detailState.message}
                        </Text>
                      ) : noteChange ? (
                        <NoteChangeInspector noteChange={noteChange} />
                      ) : detail ? (
                        <MarkdownViewer
                          markdown={detail}
                          className="markdown-output worklog-timeline-markdown worklog-activity-markdown"
                          persistence={{ endpoint: `/api/work-logs/${log.id}`, field: 'detail' }}
                        />
                      ) : (
                        <Text size="sm" c="dimmed">
                          No detail.
                        </Text>
                      )}
                    </div>
                  ) : null}
                </details>

                {showProjectBadge ? (
                  <Group gap={6} mt={4} wrap="wrap">
                    {log.project ? (
                      <Badge size="xs" variant="outline" color="gray">
                        {log.project.name}
                      </Badge>
                    ) : null}
                  </Group>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === 'ledger') {
    const now = new Date();
    const groups = logs.reduce<Array<{ label: string; logs: WorkLogTimelineItem[] }>>(
      (acc, log) => {
        const label = formatLedgerDayLabel(log.workedAt, now, timeZone);
        const existing = acc.find((group) => group.label === label);
        if (existing) {
          existing.logs.push(log);
          return acc;
        }
        acc.push({ label, logs: [log] });
        return acc;
      },
      [],
    );

    return (
      <Stack gap="md" data-work-log-variant="ledger">
        {groups.map((group) => (
          <div key={group.label}>
            <Group gap="xs" mb="xs" wrap="nowrap">
              <Text
                size="10px"
                fw={800}
                tt="uppercase"
                style={{ letterSpacing: '0.12em', color: '#8ea3b8', whiteSpace: 'nowrap' }}
              >
                {group.label}
              </Text>
              <div
                aria-hidden="true"
                style={{ flex: 1, height: 1, background: 'rgba(142, 163, 184, 0.18)' }}
              />
            </Group>
            <Stack gap="xs">
              {group.logs.map((log) => {
                const engineConfig = getEngineConfig(resolveWorkLogEngine(log));
                const showIdentityBadges = Boolean(
                  engineConfig || (showProjectName && log.project),
                );
                return (
                  <Paper
                    key={log.id}
                    withBorder
                    radius="md"
                    p="sm"
                    style={{
                      background: 'rgba(13, 23, 36, 0.72)',
                      borderColor: 'rgba(142, 163, 184, 0.14)',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '58px 14px minmax(0, 1fr)',
                        gap: 10,
                        alignItems: 'start',
                      }}
                    >
                      <Text
                        component="time"
                        dateTime={log.workedAt.toISOString()}
                        size="xs"
                        fw={700}
                        style={{
                          color: '#e7eff9',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatLedgerTime(log.workedAt, timeZone)}
                      </Text>

                      <div
                        aria-hidden="true"
                        style={{
                          position: 'relative',
                          display: 'flex',
                          justifyContent: 'center',
                          minHeight: 40,
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: -6,
                            bottom: -6,
                            width: 1,
                            background: 'rgba(142, 163, 184, 0.18)',
                          }}
                        />
                        <div
                          style={{
                            marginTop: 6,
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: engineConfig
                              ? 'rgba(94, 167, 255, 0.95)'
                              : 'rgba(166, 183, 200, 0.9)',
                            boxShadow: engineConfig
                              ? '0 0 0 4px rgba(94, 167, 255, 0.14)'
                              : '0 0 0 4px rgba(166, 183, 200, 0.12)',
                          }}
                        />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <Stack gap={6}>
                          <Text
                            fw={700}
                            size="sm"
                            style={{
                              lineHeight: 1.35,
                              color: '#eef5ff',
                              overflowWrap: 'break-word',
                            }}
                          >
                            {log.title}
                          </Text>
                          {showIdentityBadges ? (
                            <Group gap={6} wrap="wrap">
                              {engineConfig ? (
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color="gray"
                                  leftSection={
                                    <Image
                                      src={engineConfig.icon}
                                      alt={engineConfig.label}
                                      width={12}
                                      height={12}
                                    />
                                  }
                                >
                                  {engineConfig.label}
                                </Badge>
                              ) : null}
                              {showProjectName && log.project ? (
                                <Badge size="xs" variant="outline" color="gray">
                                  {log.project.name}
                                </Badge>
                              ) : null}
                            </Group>
                          ) : null}
                        </Stack>
                      </div>
                    </div>
                  </Paper>
                );
              })}
            </Stack>
          </div>
        ))}
      </Stack>
    );
  }

  return (
    <Accordion variant="separated" radius="md" chevronPosition="left">
      {logs.map((log) => {
        const engineConfig = getEngineConfig(resolveWorkLogEngine(log));
        return (
          <Accordion.Item key={log.id} value={log.id}>
            <Accordion.Control>
              <Group gap="sm" wrap="nowrap" justify="space-between">
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                  <Text fw={600} size="sm" style={{ lineHeight: 1.35, wordBreak: 'break-word' }}>
                    {log.title}
                  </Text>
                  {engineConfig ? (
                    <Badge
                      size="xs"
                      variant="light"
                      color="gray"
                      leftSection={
                        <Image
                          src={engineConfig.icon}
                          alt={engineConfig.label}
                          width={12}
                          height={12}
                        />
                      }
                    >
                      {engineConfig.label}
                    </Badge>
                  ) : null}
                  {showProjectName && log.project ? (
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {log.project.name}
                    </Text>
                  ) : null}
                </Group>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {formatDateTimeForDisplay(log.workedAt, timeZone)}
                </Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              {log.detail ? (
                <MarkdownViewer
                  markdown={log.detail}
                  className="markdown-output worklog-timeline-markdown"
                  persistence={{ endpoint: `/api/work-logs/${log.id}`, field: 'detail' }}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  No detail.
                </Text>
              )}
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}
