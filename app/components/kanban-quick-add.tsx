'use client';

import {
  Badge,
  Button,
  Group,
  MultiSelect,
  NativeSelect,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';

import { useTerminology } from '@/app/components/terminology-provider';
import type { KanbanTask } from '@/lib/kanban-helpers';
import { parseTaskPriority, taskPriorityOptionData } from '@/lib/task-meta';

type ProjectOption = { id: string; name: string };
type LabelOption = { id: string; name: string; color: string };

type KanbanQuickAddProps = {
  selectedProject: ProjectOption | null;
  projectOptions: ProjectOption[];
  projectLabelOptionsByProjectId?: Record<string, LabelOption[]>;
  editHrefBase: string;
  editHrefJoiner: string;
  onClose: () => void;
  onTaskCreated?: (task: KanbanTask) => void;
};

export function KanbanQuickAdd({
  selectedProject,
  projectOptions,
  projectLabelOptionsByProjectId = {},
  editHrefBase,
  editHrefJoiner,
  onClose,
  onTaskCreated,
}: KanbanQuickAddProps) {
  const router = useRouter();
  const terminology = useTerminology();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(selectedProject?.id ?? '');
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [taskPriority, setTaskPriority] = useState('none');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const taskPriorityOptions = useMemo(() => taskPriorityOptionData(), []);
  const activeProjectId = selectedProject ? selectedProject.id : projectId;
  const availableLabels = activeProjectId
    ? (projectLabelOptionsByProjectId[activeProjectId] ?? [])
    : [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;

    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required.');
      return;
    }

    const pid = activeProjectId;
    if (!pid) {
      setError('Project is required.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: trimmed,
          note: '',
          projectId: pid || '',
          labelIds,
          taskPriority: parseTaskPriority(taskPriority),
          priority: 1,
        }),
      });

      if (!response.ok) {
        let message = `Failed to create ${terminology.task.singularLower}.`;
        try {
          const payload = (await response.json()) as { error?: unknown };
          if (typeof payload.error === 'string' && payload.error.trim()) message = payload.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }

      const data = (await response.json()) as {
        todo?: { taskKey?: string };
        boardTask?: KanbanTask;
      };
      if (data.boardTask) {
        onTaskCreated?.(data.boardTask);
      }
      onClose();
      const nextTaskKey = data.boardTask?.taskKey ?? data.todo?.taskKey;
      if (nextTaskKey) {
        router.push(`${editHrefBase}${editHrefJoiner}taskId=${encodeURIComponent(nextTaskKey)}`);
      } else {
        setError(
          `${terminology.task.singular} created, but the editor could not be opened automatically.`,
        );
      }
    } catch (err) {
      console.error('[kanban] failed to create todo:', err);
      setError(
        err instanceof Error ? err.message : `Failed to create ${terminology.task.singularLower}.`,
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Paper withBorder p="xs" radius="md" mb="sm" className="kanban-quickadd-panel">
        <Stack gap="xs">
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            placeholder={`${terminology.task.singular} title...`}
            aria-label={`${terminology.task.singular} title`}
            required
            autoFocus
          />
          {selectedProject ? (
            <Badge variant="light" color="blue" w="fit-content">
              {selectedProject.name}
            </Badge>
          ) : (
            <NativeSelect
              value={projectId}
              onChange={(e) => {
                setProjectId(e.currentTarget.value);
                setLabelIds([]);
              }}
              aria-label="Project"
              required
              data={[
                { value: '', label: 'Select a project' },
                ...projectOptions.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          )}
          <MultiSelect
            value={labelIds}
            onChange={setLabelIds}
            data={availableLabels.map((label) => ({ value: label.id, label: label.name }))}
            placeholder={activeProjectId ? 'Select labels' : 'Select a project first'}
            aria-label="Labels"
            searchable
            clearable
            disabled={!activeProjectId}
          />
          <NativeSelect
            value={taskPriority}
            onChange={(e) => setTaskPriority(e.currentTarget.value)}
            aria-label="Priority"
            data={taskPriorityOptions}
          />
          <Group justify="flex-end" gap="xs">
            <Button
              type="button"
              size="compact-sm"
              variant="default"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" size="compact-sm" loading={isCreating} disabled={isCreating}>
              {`Add ${terminology.task.singular}`}
            </Button>
          </Group>
          {error ? (
            <Text size="xs" c="red">
              {error}
            </Text>
          ) : null}
        </Stack>
      </Paper>
    </form>
  );
}
