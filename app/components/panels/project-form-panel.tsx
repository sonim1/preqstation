'use client';

import { Group, Stack, Text, TextInput } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import { LiveMarkdownEditor } from '@/app/components/live-markdown-editor';
import { ProjectBackgroundPicker } from '@/app/components/project-background-picker';
import controlClasses from '@/app/components/settings-controls.module.css';
import { SubmitButton } from '@/app/components/submit-button';
import { showErrorNotification } from '@/lib/notifications';

type ActionState = { ok: true; projectKey?: string } | { ok: false; message: string } | null;

type ProjectFormPanelProps = {
  createProjectAction: (prevState: unknown, formData: FormData) => Promise<ActionState>;
};

export function ProjectFormPanel({ createProjectAction }: ProjectFormPanelProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(createProjectAction, null);

  useEffect(() => {
    if (state && !state.ok) {
      showErrorNotification(state.message);
      return;
    }
    if (state?.ok) {
      router.replace(state.projectKey ? `/project/${state.projectKey}` : '/projects');
      router.refresh();
    }
  }, [router, state]);

  return (
    <form action={formAction} className={controlClasses.panelForm}>
      <Stack gap="md" className={controlClasses.panelStack}>
        <TextInput
          name="name"
          label="Project name"
          placeholder="Enter project name"
          required
          className={controlClasses.touchInput}
        />
        <TextInput
          name="projectKey"
          label="Project key"
          placeholder="AB12"
          description="3-4 uppercase letters/numbers. Leave empty to auto-generate from name. Immutable after creation."
          className={controlClasses.touchInput}
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
        <Group justify="flex-end">
          <SubmitButton className={controlClasses.touchButton}>Create Project</SubmitButton>
        </Group>
      </Stack>
    </form>
  );
}
