import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', () => {
  const List = ({ children }: { children?: React.ReactNode }) => <ul>{children}</ul>;
  function ListItem({ children }: { children?: React.ReactNode }) {
    return <li>{children}</li>;
  }
  List.Item = ListItem;

  const Stepper = ({ children }: { children?: React.ReactNode }) => <nav>{children}</nav>;
  function StepperStep({ label }: { label?: React.ReactNode }) {
    return <span>{label}</span>;
  }
  Stepper.Step = StepperStep;

  return {
    Alert: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
      <section>
        <strong>{title}</strong>
        {children}
      </section>
    ),
    Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Button: ({ children }: { children?: React.ReactNode }) => (
      <button type="button">{children}</button>
    ),
    Code: ({ children }: { children?: React.ReactNode }) => <code>{children}</code>,
    CopyButton: ({
      children,
    }: {
      children: (props: { copied: boolean; copy: () => void }) => React.ReactNode;
    }) => children({ copied: false, copy: vi.fn() }),
    Divider: () => <hr />,
    Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    List,
    Paper: ({ children }: { children?: React.ReactNode }) => <section>{children}</section>,
    Stack: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Stepper,
    Text: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    TextInput: ({
      label,
      description,
      name,
    }: {
      label?: React.ReactNode;
      description?: React.ReactNode;
      name?: string;
    }) => (
      <label>
        {label}
        <input name={name} />
        <small>{description}</small>
      </label>
    ),
    ThemeIcon: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  };
});

vi.mock('@tabler/icons-react', () => ({
  IconCheck: () => null,
  IconClipboard: () => null,
  IconCircleCheck: () => null,
  IconCircleDashed: () => null,
  IconPlugConnected: () => null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/app/components/submit-button', () => ({
  SubmitButton: ({ children }: { children?: React.ReactNode }) => (
    <button type="submit">{children}</button>
  ),
}));

vi.mock('@/app/components/terminology-provider', () => ({
  useTerminology: () => ({
    task: {
      singular: 'Task',
      singularLower: 'task',
      plural: 'Tasks',
      pluralLower: 'tasks',
    },
  }),
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: vi.fn(),
}));

import { OnboardingWizard } from '@/app/(workspace)/(onboarding)/onboarding/onboarding-wizard';

describe('OnboardingWizard', () => {
  const createProjectAction = vi.fn();
  const createTaskAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains the control plane, worker path, and optional dispatcher', () => {
    const html = renderToStaticMarkup(
      <OnboardingWizard
        createProjectAction={createProjectAction}
        createTaskAction={createTaskAction}
        initialProject={null}
        initialTask={null}
        workerReadiness={{
          status: 'missing',
          label: 'Worker not connected',
          detail: 'Connect a worker through MCP or an API token.',
        }}
      />,
    );

    expect(html).toContain('control plane');
    expect(html).toContain('worker is the execution path');
    expect(html).toContain('dispatcher is optional');
    expect(html).toContain('Worker not connected');
    expect(html).toContain('Connect a worker through MCP or an API token.');
    expect(html).toContain('Create Project');
  });

  it('shows existing project and task as confirmed before worker readiness', () => {
    const html = renderToStaticMarkup(
      <OnboardingWizard
        createProjectAction={createProjectAction}
        createTaskAction={createTaskAction}
        initialProject={{ id: 'project-1', name: 'Launch Ops', projectKey: 'OPS' }}
        initialTask={{ id: 'task-1', taskKey: 'OPS-1', title: 'Ship worker setup', status: 'todo' }}
        workerReadiness={{
          status: 'ready',
          label: 'Worker connected',
          detail: 'Codex MCP is connected for worker execution.',
        }}
      />,
    );

    expect(html).toContain('Project confirmed');
    expect(html).toContain('Launch Ops');
    expect(html).toContain('Task confirmed');
    expect(html).toContain('OPS-1');
    expect(html).toContain('Worker connected');
    expect(html).toContain('Go to Dashboard');
  });
});
