'use client';

import { Code, Stack, Text, Textarea } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import { SubmitButton } from '@/app/components/submit-button';
import { showErrorNotification, showSuccessNotification } from '@/lib/notifications';

type ActionState = { ok: true; message?: string } | { ok: false; message: string } | null;

const exampleCodeStyle = {
  maxWidth: '100%',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
} as const;

type AgentInstructionsPanelProps = {
  action: (prevState: unknown, formData: FormData) => Promise<ActionState>;
  projectId: string;
  value?: string | null;
};

export function AgentInstructionsPanel({ action, projectId, value }: AgentInstructionsPanelProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.message) showSuccessNotification(state.message);
      router.refresh();
      return;
    }
    showErrorNotification(state.message);
  }, [router, state]);

  return (
    <form action={formAction}>
      <Stack gap="md">
        <input type="hidden" name="projectId" value={projectId} />
        <Textarea
          key={`${projectId}:${value || ''}`}
          name="agent_instructions"
          label="Agent instructions"
          description="Saved with the project and attached to PREQ task payloads for coding agents."
          defaultValue={value || ''}
          placeholder="Always answer in Korean unless the user explicitly asks for another language."
          autosize
          minRows={4}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>
            Example
          </Text>
          <Code block style={exampleCodeStyle}>
            Always answer in Korean unless the user explicitly asks for another language.
          </Code>
        </div>
        <SubmitButton w="fit-content">Save Instructions</SubmitButton>
      </Stack>
    </form>
  );
}
