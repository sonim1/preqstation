'use client';

import {
  Button,
  Code,
  CopyButton,
  Group,
  Paper,
  Stack,
  Stepper,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCheck, IconClipboard } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import { SubmitButton } from '@/app/components/submit-button';
import { useTerminology } from '@/app/components/terminology-provider';
import { showErrorNotification } from '@/lib/notifications';

import type { OnboardingProjectResult, OnboardingTaskResult } from './actions';

type OnboardingWizardProps = {
  createProjectAction: (prevState: unknown, formData: FormData) => Promise<OnboardingProjectResult>;
  createTaskAction: (prevState: unknown, formData: FormData) => Promise<OnboardingTaskResult>;
};

export function OnboardingWizard({ createProjectAction, createTaskAction }: OnboardingWizardProps) {
  const router = useRouter();
  const terminology = useTerminology();

  const [projectState, projectFormAction] = useActionState(createProjectAction, null);
  const [taskState, taskFormAction] = useActionState(createTaskAction, null);

  // Derive step and project info from action states (no setState needed)
  const createdProject = projectState?.ok
    ? { id: projectState.projectId, name: projectState.projectName }
    : null;
  const projectDone = projectState?.ok === true;
  const taskDone = taskState?.ok === true;
  const active = taskDone ? 2 : projectDone ? 1 : 0;

  // Show error notifications (same pattern as existing panels)
  useEffect(() => {
    if (projectState && !projectState.ok) {
      showErrorNotification(projectState.message);
    }
  }, [projectState]);

  useEffect(() => {
    if (taskState && !taskState.ok) {
      showErrorNotification(taskState.message);
    }
  }, [taskState]);

  const handleFinish = () => {
    router.push('/dashboard');
  };

  return (
    <Stack gap="xl">
      <Stepper active={active} size="sm">
        <Stepper.Step label="Create Project" />
        <Stepper.Step label={`Create ${terminology.task.singular}`} />
        <Stepper.Step label="Setup" />
      </Stepper>

      {active === 0 && (
        <Paper withBorder radius="lg" p="lg">
          <form action={projectFormAction}>
            <Stack gap="md">
              <Title order={3}>Welcome! Let&apos;s set up your first project.</Title>
              <Text c="dimmed" size="sm">
                {`A project groups your ${terminology.task.pluralLower} together. You can create more projects later.`}
              </Text>
              <TextInput name="name" label="Project Name" placeholder="My Project" required />
              <TextInput
                name="projectKey"
                label="Project Key"
                placeholder="e.g. PROJ (auto-generated if empty)"
                description={`3-4 uppercase letters. Used as a prefix for ${terminology.task.singularLower} IDs.`}
                maxLength={4}
                style={{ textTransform: 'uppercase' }}
              />
              <Group justify="flex-end">
                <SubmitButton>Create Project</SubmitButton>
              </Group>
            </Stack>
          </form>
        </Paper>
      )}

      {active === 1 && (
        <Paper withBorder radius="lg" p="lg">
          <form action={taskFormAction}>
            <Stack gap="md">
              <Title order={3}>{`Create your first ${terminology.task.singularLower}`}</Title>
              <Text c="dimmed" size="sm">
                {`Add a ${terminology.task.singularLower} to `}
                <strong>{createdProject?.name}</strong>
                {' to get started.'}
              </Text>
              <input type="hidden" name="projectId" value={createdProject?.id ?? ''} />
              <TextInput
                name="title"
                label={`${terminology.task.singular} Title`}
                placeholder="e.g. Set up CI/CD pipeline"
                required
              />
              <Group justify="flex-end">
                <SubmitButton>{`Create ${terminology.task.singular}`}</SubmitButton>
              </Group>
            </Stack>
          </form>
        </Paper>
      )}

      {active === 2 && (
        <Paper withBorder radius="lg" p="lg">
          <Stack gap="lg">
            <Title order={3}>You&apos;re all set!</Title>
            <Text c="dimmed" size="sm">
              Here are some optional setup steps to get the most out of Preq Station.
            </Text>

            <Paper withBorder radius="md" p="md">
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Install PREQ agent skill for Claude Code
                </Text>
                <Text c="dimmed" size="xs">
                  Install the core `preqstation` skill without relying on a shared bare-name
                  registry lookup.
                </Text>
                <Group gap="xs">
                  <Code block style={{ flex: 1 }}>
                    npx skills add sonim1/preqstation-skill -g -a claude-code
                  </Code>
                  <CopyButton value="npx skills add sonim1/preqstation-skill -g -a claude-code">
                    {({ copied, copy }) => (
                      <Button
                        variant="subtle"
                        size="compact-sm"
                        onClick={copy}
                        leftSection={copied ? <IconCheck size={14} /> : <IconClipboard size={14} />}
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Configure openclaw
                </Text>
                <Text c="dimmed" size="xs">
                  {`Set up your local development environment with openclaw for worktree-based ${terminology.task.singularLower} execution.`}
                </Text>
                <Text c="dimmed" size="xs">
                  More details coming soon.
                </Text>
              </Stack>
            </Paper>

            <Group justify="flex-end">
              <Button variant="subtle" onClick={handleFinish}>
                Skip
              </Button>
              <Button onClick={handleFinish}>Go to Dashboard</Button>
            </Group>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
