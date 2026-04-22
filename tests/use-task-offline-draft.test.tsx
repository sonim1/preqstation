// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  deleteDraft: vi.fn(),
  getDraft: vi.fn(),
  putDraft: vi.fn(),
}));

vi.mock('@/lib/offline/draft-store', () => ({
  deleteDraft: mocked.deleteDraft,
  getDraft: mocked.getDraft,
  putDraft: mocked.putDraft,
}));

import { useTaskOfflineDraft } from '@/app/hooks/use-task-offline-draft';

describe('app/hooks/use-task-offline-draft', () => {
  beforeEach(() => {
    mocked.deleteDraft.mockReset();
    mocked.getDraft.mockReset();
    mocked.putDraft.mockReset();
    mocked.getDraft.mockResolvedValue(null);
  });

  it('hydrates the saved title and note draft on load', async () => {
    mocked.getDraft.mockResolvedValue({
      fields: {
        title: '복구된 제목',
        note: '## Offline',
      },
    });

    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note'),
    );

    await waitFor(() => {
      expect(result.current.draftTitle).toBe('복구된 제목');
    });
    expect(result.current.draftNote).toBe('## Offline');
  });

  it('persists title and note edits under the deterministic task draft key', async () => {
    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note'),
    );

    await act(async () => {
      await result.current.updateTitleDraft('변경된 제목');
      await result.current.updateNoteDraft('## Updated note');
    });

    expect(mocked.putDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task:PROJ-310',
        entityKey: 'PROJ-310',
        fields: {
          title: '변경된 제목',
          note: '## Updated note',
        },
      }),
    );
  });

  it('clears the persisted draft for the active task key', async () => {
    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note'),
    );

    await act(async () => {
      await result.current.clearDraft();
    });

    expect(mocked.deleteDraft).toHaveBeenCalledWith('task:PROJ-310');
  });
});
