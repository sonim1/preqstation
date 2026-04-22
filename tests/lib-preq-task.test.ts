import { describe, expect, it } from 'vitest';

import * as preqTask from '@/lib/preq-task';
import {
  generateBranchName,
  serializePreqTask,
  toInternalTaskStatus,
  toPreqTaskStatus,
} from '@/lib/preq-task';
import { PROJECT_SETTING_KEYS } from '@/lib/project-settings';

describe('generateBranchName', () => {
  it('generates branch from task key and title', () => {
    expect(generateBranchName('PROJ-43', 'Add user authentication')).toBe(
      'task/proj-43/add-user-authentication',
    );
  });

  it('lowercases the task key', () => {
    expect(generateBranchName('TEST-1', 'Fix bug')).toBe('task/test-1/fix-bug');
  });

  it('strips special characters', () => {
    expect(generateBranchName('PROJ-10', 'SEC-01: Error detail removal')).toBe(
      'task/proj-10/sec-01-error-detail-removal',
    );
  });

  it('replaces multiple spaces with single hyphen', () => {
    expect(generateBranchName('PROJ-5', 'fix   multiple   spaces')).toBe(
      'task/proj-5/fix-multiple-spaces',
    );
  });

  it('truncates slug to 50 characters', () => {
    const longTitle = 'a'.repeat(100);
    const result = generateBranchName('PROJ-1', longTitle);
    const slug = result.replace('task/proj-1/', '');
    expect(slug.length).toBeLessThanOrEqual(50);
  });

  it('handles empty title gracefully', () => {
    expect(generateBranchName('PROJ-1', '')).toBe('task/proj-1/');
  });

  it('transliterates Korean characters', () => {
    expect(generateBranchName('PROJ-184', '브랜치 이름 문제 수정')).toBe(
      'task/proj-184/beulaenchi-ileum-munje-sujeong',
    );
  });

  it('transliterates Japanese characters', () => {
    expect(generateBranchName('PROJ-5', 'ユーザー認証を追加')).toBe(
      'task/proj-5/yuzarenzhengozhuijia',
    );
  });

  it('transliterates mixed language title', () => {
    const result = generateBranchName('PROJ-10', 'fix 로그인 bug');
    expect(result).toBe('task/proj-10/fix-logeuin-bug');
  });
});

describe('PREQ task status mapping', () => {
  it('preserves inbox when serializing internal inbox status', () => {
    expect(toPreqTaskStatus('inbox')).toBe('inbox');
  });

  it('accepts inbox when converting external PREQ status', () => {
    expect(toInternalTaskStatus('inbox')).toBe('inbox');
  });

  it('rejects review alias', () => {
    expect(toInternalTaskStatus('review' as never)).toBeUndefined();
  });

  it('rejects blocked alias', () => {
    expect(toInternalTaskStatus('blocked' as never)).toBeUndefined();
  });

  it('rejects in_progress alias', () => {
    expect(toInternalTaskStatus('in_progress' as never)).toBeUndefined();
  });
});

describe('serializePreqTask', () => {
  it('exposes resolved agent instructions as a dedicated task field', () => {
    const serialized = serializePreqTask(
      {
        id: 'task-uuid',
        taskKey: 'PROJ-209',
        taskPrefix: 'PROJ',
        taskNumber: 209,
        title: 'preper language function',
        note: 'Ship the setting',
        status: 'todo',
        taskPriority: 'none',
        branch: 'task/proj-209/preper-language-function',
        engine: 'codex',
        runState: 'running',
        runStateUpdatedAt: new Date('2026-03-10T00:30:00.000Z'),
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        updatedAt: new Date('2026-03-10T01:00:00.000Z'),
        project: {
          repoUrl: 'https://github.com/example/repo',
          settings: [
            {
              key: PROJECT_SETTING_KEYS.AGENT_INSTRUCTIONS,
              value: '  Always answer in Korean unless asked otherwise.  ',
            },
          ],
        },
        labels: [],
      },
      'owner@example.com',
    );

    expect(serialized.agent_instructions).toBe('Always answer in Korean unless asked otherwise.');
    expect(serialized.run_state).toBe('working');
    expect(serialized.run_state_updated_at).toBe('2026-03-10T00:30:00.000Z');
  });

  it('includes dispatch target when present', () => {
    const serialized = serializePreqTask(
      {
        id: 'task-uuid',
        taskKey: 'PROJ-300',
        taskPrefix: 'PROJ',
        taskNumber: 300,
        title: 'Dispatch routing',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        branch: 'task/proj-300/dispatch-routing',
        engine: 'codex',
        runState: 'queued',
        dispatchTarget: 'claude-code-channel',
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        updatedAt: new Date('2026-03-10T01:00:00.000Z'),
        project: null,
        labels: [],
      } as never,
      'owner@example.com',
    );

    expect(serialized.dispatch_target).toBe('claude-code-channel');
  });

  it('preserves all labels in order', () => {
    const serialized = serializePreqTask(
      {
        id: 'task-1',
        taskKey: 'PROJ-211',
        taskPrefix: 'PROJ',
        taskNumber: 211,
        title: 'Label color update',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        branch: 'task/proj-211/label-color-update',
        engine: 'codex',
        createdAt: new Date('2026-03-10T12:00:00.000Z'),
        updatedAt: new Date('2026-03-10T12:30:00.000Z'),
        project: null,
        labels: [{ name: 'feature' }, { name: 'frontend' }],
      } as never,
      'owner@example.com',
    );

    expect(serialized.labels).toEqual(['feature', 'frontend']);
  });
});

describe('extractLatestPreqResultMeta', () => {
  it('extracts blocked reason and summary from PREQ result detail markdown', () => {
    const result = preqTask.extractLatestPreqResultMeta?.({
      title: 'PREQSTATION Result · Mobile issue',
      detail: [
        '**PROJ-222** · Mobile issue',
        '',
        'Keep the mobile empty panel stretched.',
        '',
        '**Blocked reason:** Swipe wrapper is outside the flex-height chain.',
        '',
        '---',
        '',
        'Blocked: 2026-03-14T10:00:00.000Z · Source: PREQSTATION Token',
      ].join('\n'),
      workedAt: new Date('2026-03-14T10:00:00.000Z'),
    });

    expect(result).toEqual({
      title: 'PREQSTATION Result · Mobile issue',
      summary: 'Keep the mobile empty panel stretched.',
      blocked_reason: 'Swipe wrapper is outside the flex-height chain.',
      worked_at: '2026-03-14T10:00:00.000Z',
    });
  });

  it('returns null blocked reason when the latest result detail has no blocked line', () => {
    const result = preqTask.extractLatestPreqResultMeta?.({
      title: 'PREQSTATION Result · Mobile issue',
      detail: [
        '**PROJ-222** · Mobile issue',
        '',
        'Completed successfully.',
        '',
        '---',
        '',
        'Completed: 2026-03-14T10:00:00.000Z · Source: PREQSTATION Token',
      ].join('\n'),
      workedAt: new Date('2026-03-14T10:00:00.000Z'),
    });

    expect(result).toEqual({
      title: 'PREQSTATION Result · Mobile issue',
      summary: 'Completed successfully.',
      blocked_reason: null,
      worked_at: '2026-03-14T10:00:00.000Z',
    });
  });
});
