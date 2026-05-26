import { describe, expect, it } from 'vitest';

import {
  buildOpenClawProjectCommand,
  buildOpenClawQaCommand,
  buildOpenClawTaskCommand,
  encodeDispatchPromptMetadata,
  normalizeTelegramCommandMessage,
} from '@/lib/openclaw-command';

describe('lib/openclaw-command', () => {
  it('normalizes telegram commands with leading bang', () => {
    expect(normalizeTelegramCommandMessage('/preqstation dispatch status PROJ-1 using codex')).toBe(
      '!/preqstation dispatch status PROJ-1 using codex',
    );
  });

  it('builds todo command with unified preqstation dispatch syntax and branch metadata', () => {
    expect(
      buildOpenClawTaskCommand({
        taskKey: 'PROJ-1',
        status: 'todo',
        engineKey: 'codex',
        branchName: 'task/proj-1/implement-auth',
      }),
    ).toBe(
      '!/preqstation dispatch implement PROJ-1 using codex branch_name="task/proj-1/implement-auth"',
    );
  });

  it('adds model metadata only when a task model override is selected', () => {
    expect(
      buildOpenClawTaskCommand({
        taskKey: 'PROJ-1',
        status: 'todo',
        engineKey: 'codex',
        model: 'gpt-5-codex',
      }),
    ).toBe('!/preqstation dispatch implement PROJ-1 using codex model="gpt-5-codex"');

    expect(
      buildOpenClawTaskCommand({
        taskKey: 'PROJ-1',
        status: 'todo',
        engineKey: 'codex',
        model: '',
      }),
    ).toBe('!/preqstation dispatch implement PROJ-1 using codex');
  });

  it('maps ready tasks to review command', () => {
    expect(
      buildOpenClawTaskCommand({
        taskKey: 'PROJ-1',
        status: 'ready',
        engineKey: 'claude-code',
      }),
    ).toBe('!/preqstation dispatch review PROJ-1 using claude-code');
  });

  it('maps hold tasks back to implement command', () => {
    expect(
      buildOpenClawTaskCommand({
        taskKey: 'PROJ-1',
        status: 'hold',
        engineKey: 'codex',
      }),
    ).toBe('!/preqstation dispatch implement PROJ-1 using codex');
  });

  it('maps done tasks to status command', () => {
    expect(
      buildOpenClawTaskCommand({
        taskKey: 'PROJ-1',
        status: 'done',
        engineKey: 'gemini-cli',
      }),
    ).toBe('!/preqstation dispatch status PROJ-1 using gemini-cli');
  });

  it('builds ask command without deriving objective from workflow status', () => {
    expect(
      buildOpenClawTaskCommand({
        taskKey: 'PROJ-328',
        status: 'todo',
        engineKey: 'codex',
        objective: 'ask',
        askHint: 'Summarize around acceptance criteria',
      }),
    ).toBe(
      '!/preqstation dispatch ask PROJ-328 using codex ask_hint="Summarize around acceptance criteria"',
    );
  });

  it('allows explicit plan and qa task modes without deriving from workflow status', () => {
    expect(
      buildOpenClawTaskCommand({
        taskKey: 'PROJ-328',
        status: 'todo',
        engineKey: 'codex',
        objective: 'plan',
      }),
    ).toBe('!/preqstation dispatch plan PROJ-328 using codex');

    expect(
      buildOpenClawTaskCommand({
        taskKey: 'PROJ-328',
        status: 'done',
        engineKey: 'gemini-cli',
        objective: 'qa',
      }),
    ).toBe('!/preqstation dispatch qa PROJ-328 using gemini-cli');
  });

  it('allows explicit implement and review modes without deriving from workflow status', () => {
    expect(
      buildOpenClawTaskCommand({
        taskKey: 'PROJ-328',
        status: 'ready',
        engineKey: 'codex',
        objective: 'implement',
      }),
    ).toBe('!/preqstation dispatch implement PROJ-328 using codex');

    expect(
      buildOpenClawTaskCommand({
        taskKey: 'PROJ-328',
        status: 'todo',
        engineKey: 'gemini-cli',
        objective: 'review',
      }),
    ).toBe('!/preqstation dispatch review PROJ-328 using gemini-cli');
  });

  it('builds QA command with branch and run metadata', () => {
    expect(
      buildOpenClawQaCommand({
        projectKey: 'PROJ',
        engineKey: 'codex',
        branchName: 'main',
        qaRunId: 'run-123',
        qaTaskKeys: ['PROJ-1', 'PROJ-2'],
      }),
    ).toBe(
      '!/preqstation dispatch qa PROJ using codex branch_name="main" qa_run_id="run-123" qa_task_keys="PROJ-1,PROJ-2"',
    );
  });

  it('adds model metadata to QA commands when selected', () => {
    expect(
      buildOpenClawQaCommand({
        projectKey: 'PROJ',
        engineKey: 'gemini-cli',
        model: 'gemini-2.5-pro',
      }),
    ).toBe('!/preqstation dispatch qa PROJ using gemini-cli model="gemini-2.5-pro"');
  });

  it('encodes multiline dispatch prompt metadata safely', () => {
    expect(
      encodeDispatchPromptMetadata(
        'Break down the Connections page redesign\nAlso review the mobile flow',
      ),
    ).toBe(
      'QnJlYWsgZG93biB0aGUgQ29ubmVjdGlvbnMgcGFnZSByZWRlc2lnbgpBbHNvIHJldmlldyB0aGUgbW9iaWxlIGZsb3c=',
    );
  });

  it('builds project-level insight command with encoded prompt metadata', () => {
    expect(
      buildOpenClawProjectCommand({
        projectKey: 'proj',
        engineKey: 'codex',
        insightPrompt: 'Break down the Connections page redesign\nAlso review the mobile flow',
      }),
    ).toBe(
      '!/preqstation dispatch insight PROJ using codex insight_prompt_b64="QnJlYWsgZG93biB0aGUgQ29ubmVjdGlvbnMgcGFnZSByZWRlc2lnbgpBbHNvIHJldmlldyB0aGUgbW9iaWxlIGZsb3c="',
    );
  });

  it('adds model metadata to project insight commands when selected', () => {
    expect(
      buildOpenClawProjectCommand({
        projectKey: 'proj',
        engineKey: 'claude-code',
        model: 'sonnet',
      }),
    ).toBe('!/preqstation dispatch insight PROJ using claude-code model="sonnet"');
  });
});
