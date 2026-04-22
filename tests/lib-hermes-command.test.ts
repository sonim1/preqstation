import { describe, expect, it } from 'vitest';

import { buildHermesTaskCommand } from '@/lib/hermes-command';

describe('lib/hermes-command', () => {
  it('builds a structured Hermes task dispatch message', () => {
    expect(
      buildHermesTaskCommand({
        taskKey: 'PROJ-316',
        status: 'inbox',
        engineKey: 'codex',
        branchName: 'task/proj-316/dashboard-choejongbeojeoneulo-hwagjang',
        objective: 'plan',
      }),
    ).toBe(
      [
        '/preq_dispatch@PreqHermesBot',
        'project_key=PROJ',
        'task_key=PROJ-316',
        'objective=plan',
        'engine=codex',
        'branch_name=task/proj-316/dashboard-choejongbeojeoneulo-hwagjang',
      ].join('\n'),
    );
  });

  it('includes ask_hint only for ask dispatches', () => {
    expect(
      buildHermesTaskCommand({
        taskKey: 'PROJ-328',
        status: 'todo',
        engineKey: 'claude-code',
        objective: 'ask',
        askHint: 'Acceptance criteria 중심으로 정리해줘',
      }),
    ).toContain('ask_hint=Acceptance criteria 중심으로 정리해줘');

    expect(
      buildHermesTaskCommand({
        taskKey: 'PROJ-328',
        status: 'todo',
        engineKey: 'claude-code',
        objective: 'implement',
        askHint: 'Acceptance criteria 중심으로 정리해줘',
      }),
    ).not.toContain('ask_hint=');
  });
});
