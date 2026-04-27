'use client';

import { Code, Stack, Text, Textarea } from '@mantine/core';
import { type FormEvent, useEffect, useRef, useState, useTransition } from 'react';

import { type SettingSaveState, SettingSaveStatus } from '@/app/components/setting-save-status';
import { SubmitButton } from '@/app/components/submit-button';

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
  const [draft, setDraft] = useState(value || '');
  const [savedValue, setSavedValue] = useState(value || '');
  const [saveState, setSaveState] = useState<SettingSaveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const submittedValueRef = useRef(value || '');

  useEffect(() => {
    const nextValue = value || '';
    submittedValueRef.current = nextValue;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- local draft state must resync when saved defaults change
    setDraft(nextValue);
    setSavedValue(nextValue);
    setSaveState('idle');
    setErrorMessage(null);
  }, [projectId, value]);

  const currentState = isPending ? 'saving' : saveState;
  const isDirty = draft !== savedValue;

  function handleChange(nextValue: string) {
    setDraft(nextValue);
    setErrorMessage(null);
    setSaveState(nextValue === savedValue ? 'idle' : 'dirty');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    submittedValueRef.current = draft;
    setErrorMessage(null);
    setSaveState('saving');

    startTransition(async () => {
      const result = await action(null, new FormData(form));
      if (result?.ok) {
        setSavedValue(submittedValueRef.current);
        setSaveState('saved');
        return;
      }

      setErrorMessage(result?.message || 'Failed to save agent instructions.');
      setSaveState('error');
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <SettingSaveStatus mode="manual" state={currentState} errorMessage={errorMessage} />
        <input type="hidden" name="projectId" value={projectId} />
        <Textarea
          name="agent_instructions"
          label="Agent instructions"
          description="Saved with the project and attached to PREQ task payloads for coding agents."
          value={draft}
          onChange={(event) => handleChange(event.currentTarget.value)}
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
        <SubmitButton w="fit-content" disabled={!isDirty || isPending}>
          Save Instructions
        </SubmitButton>
      </Stack>
    </form>
  );
}
