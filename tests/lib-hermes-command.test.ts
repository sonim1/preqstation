import { describe, expect, it } from 'vitest';

import {
  buildHermesProjectInsightCommand,
  buildHermesQaCommand,
  buildHermesTaskCommand,
} from '@/lib/hermes-command';

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

  it('builds a structured Hermes project insight dispatch message', () => {
    expect(
      buildHermesProjectInsightCommand({
        projectKey: 'proj',
        engineKey: 'codex',
        insightPrompt: 'Connections 페이지 개편 작업을 나눠줘',
      }),
    ).toContain('/preq_dispatch@PreqHermesBot');
    expect(
      buildHermesProjectInsightCommand({
        projectKey: 'proj',
        engineKey: 'codex',
        insightPrompt: 'Connections 페이지 개편 작업을 나눠줘',
      }),
    ).toContain('objective=insight');
    expect(
      buildHermesProjectInsightCommand({
        projectKey: 'proj',
        engineKey: 'codex',
        insightPrompt: 'Connections 페이지 개편 작업을 나눠줘',
      }),
    ).toContain('insight_prompt_b64=');
  });

  it('builds Hermes QA dispatch messages with run metadata', () => {
    expect(
      buildHermesQaCommand({
        projectKey: 'PROJ',
        engineKey: 'claude-code',
        branchName: 'main',
        qaRunId: 'run-123',
        qaTaskKeys: ['PROJ-1', 'PROJ-2'],
      }),
    ).toBe(
      [
        '/preq_dispatch@PreqHermesBot',
        'project_key=PROJ',
        'objective=qa',
        'engine=claude-code',
        'branch_name=main',
        'qa_run_id=run-123',
        'qa_task_keys=PROJ-1,PROJ-2',
      ].join('\n'),
    );
  });
});
