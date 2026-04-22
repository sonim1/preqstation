'use client';

import { Stack, Text, TextInput } from '@mantine/core';
import { useActionState, useEffect } from 'react';

import { LiveMarkdownEditor } from '@/app/components/live-markdown-editor';
import { ProjectBackgroundPicker } from '@/app/components/project-background-picker';
import { SubmitButton } from '@/app/components/submit-button';
import { showErrorNotification } from '@/lib/notifications';

type ActionState = { ok: true } | { ok: false; message: string } | null;

type ProjectFormPanelProps = {
  createProjectAction: (prevState: unknown, formData: FormData) => Promise<ActionState>;
};

export function ProjectFormPanel({ createProjectAction }: ProjectFormPanelProps) {
  const [state, formAction] = useActionState(createProjectAction, null);

  useEffect(() => {
    if (state && !state.ok) {
      showErrorNotification(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <Stack gap="md">
        <TextInput name="name" label="Project name" placeholder="Enter project name" required />
        <TextInput
          name="projectKey"
          label="Project key"
          placeholder="AB12"
          description="3-4 uppercase letters/numbers. Leave empty to auto-generate from name. Immutable after creation."
        />
        <LiveMarkdownEditor
          name="descriptionMd"
          label="Project description (Markdown)"
          placeholder="# Goal\n- Build MVP\n- Harden security"
        />
        <div>
          <Text size="sm" fw={500} mb={4}>
            Background Image
          </Text>
          <ProjectBackgroundPicker name="bgImage" />
        </div>
        <SubmitButton>Create Project</SubmitButton>
      </Stack>
    </form>
  );
}
