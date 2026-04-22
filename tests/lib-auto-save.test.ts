import type { RefObject } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { preserveTightHeadingParagraphSpacing } from '@/lib/markdown';

const useCallbackMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const useRefMock = vi.hoisted(() => vi.fn());
const useStateMock = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: useCallbackMock,
    useEffect: useEffectMock,
    useRef: useRefMock,
    useState: useStateMock,
  };
});

import {
  hasAutoSaveChanges,
  resolveAutoSaveContentChange,
  serializeAutoSaveFormData,
  shouldFlushAutoSaveOnBlur,
  shouldPropagateAutoSaveContentChange,
  syncAutoSaveSnapshot,
  useAutoSave,
} from '@/app/hooks/use-auto-save';

function createAutoSaveHarness(formRef: RefObject<HTMLFormElement | null>) {
  const refs: Array<{ current: unknown }> = [];
  const stateValues: unknown[] = [];
  let refIndex = 0;
  let stateIndex = 0;

  useRefMock.mockImplementation((initialValue: unknown) => {
    const currentIndex = refIndex++;
    if (!refs[currentIndex]) {
      refs[currentIndex] = { current: initialValue };
    }
    return refs[currentIndex];
  });

  useStateMock.mockImplementation((initialValue: unknown) => {
    const currentIndex = stateIndex++;
    if (!(currentIndex in stateValues)) {
      stateValues[currentIndex] = initialValue;
    }

    const setValue = (value: unknown) => {
      stateValues[currentIndex] =
        typeof value === 'function'
          ? (value as (current: unknown) => unknown)(stateValues[currentIndex])
          : value;
    };

    return [stateValues[currentIndex], setValue];
  });

  return {
    useHook() {
      refIndex = 0;
      stateIndex = 0;
      return useAutoSave(formRef);
    },
  };
}

describe('app/hooks/use-auto-save helpers', () => {
  beforeEach(() => {
    useCallbackMock.mockReset();
    useEffectMock.mockReset();
    useRefMock.mockReset();
    useStateMock.mockReset();

    useCallbackMock.mockImplementation(<T>(callback: T) => callback);
    useEffectMock.mockImplementation(() => undefined);
  });

  it('serializes form data deterministically regardless of field insertion order', () => {
    const first = new FormData();
    first.set('title', 'Task');
    first.set('noteMd', 'Body');
    first.set('projectId', 'project-1');

    const second = new FormData();
    second.set('projectId', 'project-1');
    second.set('noteMd', 'Body');
    second.set('title', 'Task');

    expect(serializeAutoSaveFormData(first)).toBe(serializeAutoSaveFormData(second));
  });

  it('detects when the current snapshot matches the last submitted snapshot', () => {
    const formData = new FormData();
    formData.set('title', 'Task');
    formData.set('noteMd', 'Body');

    const snapshot = serializeAutoSaveFormData(formData);

    expect(hasAutoSaveChanges(snapshot, snapshot)).toBe(false);
  });

  it('detects when a field value changed since the last submit', () => {
    const before = new FormData();
    before.set('title', 'Task');
    before.set('noteMd', 'Before');

    const after = new FormData();
    after.set('title', 'Task');
    after.set('noteMd', 'After');

    expect(
      hasAutoSaveChanges(serializeAutoSaveFormData(before), serializeAutoSaveFormData(after)),
    ).toBe(true);
  });

  it('does not flush autosave on blur when nothing is dirty yet', () => {
    expect(shouldFlushAutoSaveOnBlur(false)).toBe(false);
  });

  it('flushes autosave on blur when the form has pending changes', () => {
    expect(shouldFlushAutoSaveOnBlur(true)).toBe(true);
  });

  it('can replace the autosave baseline after mounted field normalization', () => {
    expect(syncAutoSaveSnapshot('before', 'after')).toBe('after');
  });

  it('ignores editor bootstrap updates that do not come from a user content change', () => {
    expect(
      shouldPropagateAutoSaveContentChange({
        hasBootstrapped: false,
        previousMarkdown: 'hello',
        nextMarkdown: 'hello',
      }),
    ).toBe(false);
  });

  it('keeps the current markdown state when live editor bootstrap normalizes spacing', () => {
    expect(
      resolveAutoSaveContentChange({
        currentMarkdown: '## sample title\n- item',
        hasBootstrapped: false,
        previousMarkdown: '## sample title\n- item',
        nextMarkdown: '## sample title\n\n- item',
      }),
    ).toEqual({
      markdown: '## sample title\n- item',
      shouldPropagate: false,
    });
  });

  it('commits markdown state after a real live editor content change', () => {
    expect(
      resolveAutoSaveContentChange({
        currentMarkdown: '## sample title\n- item',
        hasBootstrapped: true,
        previousMarkdown: '## sample title\n- item',
        nextMarkdown: '## sample title\n- item\n- next',
      }),
    ).toEqual({
      markdown: '## sample title\n- item\n- next',
      shouldPropagate: true,
    });
  });

  it('treats formatter-only heading paragraph spacing as unchanged after reconciliation', () => {
    const currentMarkdown = '## sample title\nParagraph';
    const nextMarkdown = preserveTightHeadingParagraphSpacing(
      currentMarkdown,
      '## sample title\n\nParagraph',
    );

    expect(
      resolveAutoSaveContentChange({
        currentMarkdown,
        hasBootstrapped: true,
        previousMarkdown: currentMarkdown,
        nextMarkdown,
      }),
    ).toEqual({
      markdown: '## sample title\nParagraph',
      shouldPropagate: false,
    });
  });

  it('reports dirty state after markDirty and clears it after syncSnapshot', () => {
    const formRef = { current: null } as RefObject<HTMLFormElement | null>;
    const harness = createAutoSaveHarness(formRef);

    let hook = harness.useHook();

    hook.markDirty();
    hook = harness.useHook();
    expect(hook.isDirty).toBe(true);

    hook.syncSnapshot();
    hook = harness.useHook();
    expect(hook.isDirty).toBe(false);
  });
});
