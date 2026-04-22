'use client';

import { Anchor, Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useState, useTransition } from 'react';

import {
  extractMarkdownArtifacts,
  renderMarkdownToHtml,
  toggleChecklistItem,
} from '@/lib/markdown';

type MarkdownPersistence = {
  endpoint: string;
  field: 'note' | 'detail' | 'description';
};

type MarkdownViewerProps = {
  markdown?: string | null;
  className?: string;
  persistence?: MarkdownPersistence;
  mode?: 'artifacts' | 'body' | 'full';
};

export function MarkdownViewer({
  markdown,
  className = 'markdown-output',
  persistence,
  mode = 'full',
}: MarkdownViewerProps) {
  const [source, setSource] = useState(markdown || '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- source is also modified by checklist toggle, not purely derived
    setSource(markdown || '');
  }, [markdown]);

  const html = useMemo(() => renderMarkdownToHtml(source), [source]);
  const artifacts = useMemo(() => extractMarkdownArtifacts(source), [source]);

  async function persistChecklist(nextSource: string, previousSource: string) {
    if (!persistence) return;

    const response = await fetch(persistence.endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ [persistence.field]: nextSource }),
    });

    if (!response.ok) {
      setSource(previousSource);
      setSaveError(`Save failed (${response.status}).`);
      return;
    }

    setSaveError(null);
  }

  const body =
    mode === 'artifacts' ? null : (
      <div
        className={className}
        style={isPending ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
        onChange={(event) => {
          const target = event.target;
          if (!(target instanceof HTMLInputElement)) return;
          if (!target.classList.contains('task-list-checkbox')) return;

          const rawIndex = target.dataset.taskIndex;
          const taskIndex = rawIndex ? Number.parseInt(rawIndex, 10) : Number.NaN;
          if (!Number.isInteger(taskIndex) || taskIndex < 0) return;

          const previousSource = source;
          const nextSource = toggleChecklistItem(source, taskIndex, target.checked);
          if (nextSource === previousSource) return;

          setSource(nextSource);
          startTransition(() => {
            void persistChecklist(nextSource, previousSource);
          });
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );

  const artifactList =
    mode === 'body' || artifacts.length === 0 ? null : (
      <Stack gap="xs" mt="sm" data-slot="markdown-artifacts">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">
          Artifacts
        </Text>
        {artifacts.map((artifact) => (
          <Paper key={`${artifact.type}:${artifact.url}`} withBorder radius="md" p="sm">
            <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
              <Stack gap={4} style={{ minWidth: 0 }}>
                <Group gap="xs" wrap="wrap">
                  <Badge size="xs" variant="light">
                    {artifact.type}
                  </Badge>
                  {artifact.access ? (
                    <Badge size="xs" variant="light" color="gray">
                      {artifact.access}
                    </Badge>
                  ) : null}
                  {artifact.provider ? (
                    <Badge size="xs" variant="outline" color="gray">
                      {artifact.provider}
                    </Badge>
                  ) : null}
                </Group>
                <Text fw={600} size="sm">
                  {artifact.title}
                </Text>
                {artifact.expires ? (
                  <Text size="xs" c="dimmed">
                    Expires: {artifact.expires}
                  </Text>
                ) : null}
              </Stack>
              <Anchor href={artifact.url} target="_blank" rel="noreferrer" size="sm">
                Open
              </Anchor>
            </Group>
          </Paper>
        ))}
      </Stack>
    );

  return (
    <>
      {body}
      {artifactList}
      {saveError && mode !== 'artifacts' ? (
        <div className="markdown-persist-error">{saveError}</div>
      ) : null}
    </>
  );
}
