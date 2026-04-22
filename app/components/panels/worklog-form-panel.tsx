'use client';

import { NativeSelect, Stack, TextInput } from '@mantine/core';
import { useActionState, useEffect } from 'react';

import { LiveMarkdownEditor } from '@/app/components/live-markdown-editor';
import { SubmitButton } from '@/app/components/submit-button';
import { showErrorNotification } from '@/lib/notifications';

type ActionState = { ok: true } | { ok: false; message: string } | null;

type WorklogFormPanelProps = {
  createWorkLogAction: (prevState: unknown, formData: FormData) => Promise<ActionState>;
  projects: Array<{ id: string; name: string }>;
  defaultProjectId?: string;
};

export function WorklogFormPanel({
  createWorkLogAction,
  projects,
  defaultProjectId,
}: WorklogFormPanelProps) {
  const [state, formAction] = useActionState(createWorkLogAction, null);

  useEffect(() => {
    if (state && !state.ok) {
      showErrorNotification(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <Stack gap="md">
        <TextInput name="title" label="Log title" placeholder="What did you finish?" required />
        <NativeSelect
          name="projectId"
          label="Project"
          defaultValue={defaultProjectId || ''}
          data={[
            { value: '', label: 'No project' },
            ...projects.map((project) => ({ value: project.id, label: project.name })),
          ]}
        />
        <LiveMarkdownEditor
          name="detailMd"
          label="Work log detail (Markdown)"
          placeholder="## What I did\n- implemented x\n- fixed y"
        />
        <SubmitButton>Save Work Log</SubmitButton>
      </Stack>
    </form>
  );
}
