'use client';

import { NativeSelect, Stack, TextInput } from '@mantine/core';
import { useActionState, useEffect } from 'react';

import { LiveMarkdownEditor } from '@/app/components/live-markdown-editor';
import controlClasses from '@/app/components/settings-controls.module.css';
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
    <form action={formAction} className={controlClasses.panelForm}>
      <Stack gap="md" className={controlClasses.panelStack}>
        <TextInput
          name="title"
          label="Log title"
          placeholder="What did you finish?"
          required
          className={controlClasses.touchInput}
        />
        <NativeSelect
          name="projectId"
          label="Project"
          defaultValue={defaultProjectId || ''}
          data={[
            { value: '', label: 'No project' },
            ...projects.map((project) => ({ value: project.id, label: project.name })),
          ]}
          className={controlClasses.touchInput}
        />
        <LiveMarkdownEditor
          name="detailMd"
          label="Work log detail (Markdown)"
          placeholder="## What I did\n- implemented x\n- fixed y"
        />
        <SubmitButton className={controlClasses.touchButton}>Save Work Log</SubmitButton>
      </Stack>
    </form>
  );
}
