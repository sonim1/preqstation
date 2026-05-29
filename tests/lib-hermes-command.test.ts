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
        '/preqstation_dispatch',
        'project_key=PROJ',
        'task_key=PROJ-316',
        'objective=plan',
        'engine=codex',
        'branch_name=task/proj-316/dashboard-choejongbeojeoneulo-hwagjang',
      ].join(' '),
    );
  });

  it('adds a model field to Hermes task dispatches when selected', () => {
    expect(
      buildHermesTaskCommand({
        taskKey: 'PROJ-316',
        status: 'todo',
        engineKey: 'codex',
        model: 'gpt-5-codex',
      }),
    ).toBe(
      [
        '/preqstation_dispatch',
        'project_key=PROJ',
        'task_key=PROJ-316',
        'objective=implement',
        'engine=codex',
        'model=gpt-5-codex',
      ].join(' '),
    );
  });

  it('addresses the configured Hermes bot in the dispatch command mention', () => {
    expect(
      buildHermesTaskCommand({
        taskKey: 'PROJ-316',
        status: 'todo',
        engineKey: 'codex',
        botUsername: '@custom_hermes_bot',
      }),
    ).toBe(
      [
        '/preqstation_dispatch@custom_hermes_bot',
        'project_key=PROJ',
        'task_key=PROJ-316',
        'objective=implement',
        'engine=codex',
      ].join(' '),
    );
  });

  it('includes ask_hint only for ask dispatches', () => {
    expect(
      buildHermesTaskCommand({
        taskKey: 'PROJ-328',
        status: 'todo',
        engineKey: 'claude-code',
        objective: 'ask',
        askHint: 'Summarize around "acceptance criteria"',
      }),
    ).toContain('ask_hint="Summarize around \\"acceptance criteria\\""');

    expect(
      buildHermesTaskCommand({
        taskKey: 'PROJ-328',
        status: 'todo',
        engineKey: 'claude-code',
        objective: 'implement',
        askHint: 'Summarize around acceptance criteria',
      }),
    ).not.toContain('ask_hint=');
  });

  it('quotes ask hints that contain quote or backslash characters without whitespace', () => {
    expect(
      buildHermesTaskCommand({
        taskKey: 'PROJ-328',
        status: 'todo',
        engineKey: 'claude-code',
        objective: 'ask',
        askHint: 'check"this',
      }),
    ).toContain('ask_hint="check\\"this"');

    expect(
      buildHermesTaskCommand({
        taskKey: 'PROJ-328',
        status: 'todo',
        engineKey: 'claude-code',
        objective: 'ask',
        askHint: 'check\\this',
      }),
    ).toContain('ask_hint="check\\\\this"');
  });

  it('builds a structured Hermes project insight dispatch message', () => {
    expect(
      buildHermesProjectInsightCommand({
        projectKey: 'proj',
        engineKey: 'codex',
        insightPrompt: 'Break down the Connections page redesign',
      }),
    ).toContain('/preqstation_dispatch');
    expect(
      buildHermesProjectInsightCommand({
        projectKey: 'proj',
        engineKey: 'codex',
        insightPrompt: 'Break down the Connections page redesign',
      }),
    ).toContain('objective=insight');
    expect(
      buildHermesProjectInsightCommand({
        projectKey: 'proj',
        engineKey: 'codex',
        insightPrompt: 'Break down the Connections page redesign',
      }),
    ).toContain('insight_prompt_b64=');
  });

  it('adds a model field to Hermes project insight dispatches when selected', () => {
    expect(
      buildHermesProjectInsightCommand({
        projectKey: 'proj',
        engineKey: 'claude-code',
        model: 'sonnet',
      }),
    ).toContain('model=sonnet');
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
        '/preqstation_dispatch',
        'project_key=PROJ',
        'objective=qa',
        'engine=claude-code',
        'branch_name=main',
        'qa_run_id=run-123',
        'qa_task_keys=PROJ-1,PROJ-2',
      ].join(' '),
    );
  });

  it('adds a model field to Hermes QA dispatches when selected', () => {
    expect(
      buildHermesQaCommand({
        projectKey: 'PROJ',
        engineKey: 'gemini-cli',
        model: 'gemini-2.5-pro',
      }),
    ).toContain('model=gemini-2.5-pro');
  });
});
