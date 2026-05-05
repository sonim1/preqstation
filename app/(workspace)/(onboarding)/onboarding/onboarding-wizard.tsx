'use client';

import {
  Alert,
  Badge,
  Button,
  Code,
  CopyButton,
  Divider,
  Group,
  List,
  Paper,
  Stack,
  Stepper,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconCheck,
  IconCircleCheck,
  IconCircleDashed,
  IconClipboard,
  IconPlugConnected,
} from '@tabler/icons-react';
import { useActionState, useEffect } from 'react';

import { SubmitButton } from '@/app/components/submit-button';
import { useTerminology } from '@/app/components/terminology-provider';
import { showErrorNotification } from '@/lib/notifications';

import type { OnboardingProjectResult, OnboardingTaskResult } from './actions';

type OnboardingWizardProps = {
  initialProject: { id: string; name: string; projectKey: string } | null;
  initialTask: { id: string; taskKey: string; title: string; status: string } | null;
  workerReadiness: {
    status: 'ready' | 'missing' | 'unknown';
    label: string;
    detail: string;
  };
  createProjectAction: (prevState: unknown, formData: FormData) => Promise<OnboardingProjectResult>;
  createTaskAction: (prevState: unknown, formData: FormData) => Promise<OnboardingTaskResult>;
};

export function OnboardingWizard({
  initialProject,
  initialTask,
  workerReadiness,
  createProjectAction,
  createTaskAction,
}: OnboardingWizardProps) {
  const terminology = useTerminology();

  const [projectState, projectFormAction] = useActionState(createProjectAction, null);
  const [taskState, taskFormAction] = useActionState(createTaskAction, null);

  // Derive step and project info from action states (no setState needed)
  const createdProject = projectState?.ok
    ? {
        id: projectState.projectId,
        name: projectState.projectName,
        projectKey: projectState.projectKey,
      }
    : initialProject;
  const createdTask = taskState?.ok
    ? {
        id: taskState.taskId,
        taskKey: taskState.taskKey,
        title: taskState.taskTitle,
        status: taskState.taskStatus,
      }
    : initialTask;
  const projectDone = Boolean(createdProject);
  const taskDone = Boolean(createdTask);
  const active = taskDone ? 3 : projectDone ? 2 : 1;
  const dashboardActions = (
    <Group justify="flex-end">
      <Button component="a" href="/dashboard" variant="subtle">
        Skip
      </Button>
      <Button component="a" href="/dashboard">
        Go to Dashboard
      </Button>
    </Group>
  );

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

  return (
    <Stack gap="xl">
      <Stepper active={active} size="sm">
        <Stepper.Step label="Model" />
        <Stepper.Step label="Project" />
        <Stepper.Step label={terminology.task.singular} />
        <Stepper.Step label="Worker" />
      </Stepper>

      {taskDone ? dashboardActions : null}

      <Paper withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Title order={3}>Start with a worker-first system.</Title>
          <Text c="dimmed" size="sm">
            Preqstation is the control plane: it stores projects, tasks, state, and work logs. A
            worker is the execution path that gets tasks done. The dispatcher is optional advanced
            automation after the worker path is clear.
          </Text>
          <List size="sm" spacing="xs">
            <List.Item>Control plane: source of truth for project and task state.</List.Item>
            <List.Item>Worker: execution path for completing assigned tasks.</List.Item>
            <List.Item>Dispatcher: optional queue automation for later scale.</List.Item>
          </List>
        </Stack>
      </Paper>

      <Paper withBorder radius="lg" p="lg">
        {projectDone ? (
          <Stack gap="xs">
            <Group gap="sm">
              <ThemeIcon variant="light" color="green" radius="xl">
                <IconCircleCheck size={16} />
              </ThemeIcon>
              <Title order={3}>Project confirmed</Title>
              <Badge variant="light">{createdProject?.projectKey}</Badge>
            </Group>
            <Text c="dimmed" size="sm">
              {createdProject?.name} is ready to hold the first worker task.
            </Text>
          </Stack>
        ) : (
          <form action={projectFormAction}>
            <Stack gap="md">
              <Title order={3}>Create Project</Title>
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
        )}
      </Paper>

      <Paper withBorder radius="lg" p="lg">
        {!projectDone ? (
          <Stack gap="xs">
            <Group gap="sm">
              <ThemeIcon variant="light" color="gray" radius="xl">
                <IconCircleDashed size={16} />
              </ThemeIcon>
              <Title order={3}>{`${terminology.task.singular} setup locked`}</Title>
            </Group>
            <Text c="dimmed" size="sm">
              Create a project first so the first worker task has a confirmed home.
            </Text>
          </Stack>
        ) : taskDone ? (
          <Stack gap="xs">
            <Group gap="sm">
              <ThemeIcon variant="light" color="green" radius="xl">
                <IconCircleCheck size={16} />
              </ThemeIcon>
              <Title order={3}>Task confirmed</Title>
              <Badge variant="light">{createdTask?.taskKey}</Badge>
            </Group>
            <Text c="dimmed" size="sm">
              {createdTask?.title} is the first concrete unit a worker can execute.
            </Text>
          </Stack>
        ) : (
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
        )}
      </Paper>

      <Paper withBorder radius="lg" p="lg">
        <Stack gap="lg">
          <Group gap="sm">
            <ThemeIcon
              variant="light"
              color={workerReadiness.status === 'ready' ? 'green' : 'yellow'}
              radius="xl"
            >
              {workerReadiness.status === 'ready' ? (
                <IconPlugConnected size={16} />
              ) : (
                <IconCircleDashed size={16} />
              )}
            </ThemeIcon>
            <Title order={3}>Worker readiness</Title>
            <Badge color={workerReadiness.status === 'ready' ? 'green' : 'yellow'} variant="light">
              {workerReadiness.label}
            </Badge>
          </Group>

          <Alert color={workerReadiness.status === 'ready' ? 'green' : 'yellow'} variant="light">
            {workerReadiness.detail}
          </Alert>

          {workerReadiness.status !== 'ready' ? (
            <Paper withBorder radius="md" p="md">
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Connect a worker
                </Text>
                <Text c="dimmed" size="xs">
                  Install the Preqstation skill in your worker runtime, then connect through MCP or
                  create an API token from Connections.
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
          ) : null}

          <Divider />

          <Stack gap="xs">
            <Text fw={600} size="sm">
              Dispatcher is optional
            </Text>
            <Text c="dimmed" size="xs">
              Use dispatcher automation after project, task, and worker state are understandable. It
              is not required for first success.
            </Text>
          </Stack>

          {dashboardActions}
        </Stack>
      </Paper>
    </Stack>
  );
}
