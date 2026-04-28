// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTaskNoteFingerprint } from '@/lib/task-note-fingerprint';

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

  it('hydrates the saved title and note draft on load while offline', async () => {
    mocked.getDraft.mockResolvedValue({
      fields: {
        baseNoteFingerprint: buildTaskNoteFingerprint('## Server note'),
        title: '복구된 제목',
        note: '## Offline',
      },
    });

    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note', false),
    );

    await waitFor(() => {
      expect(result.current.draftTitle).toBe('복구된 제목');
    });
    expect(result.current.draftNote).toBe('## Offline');
    expect(result.current.canRestoreDraft).toBe(false);
  });

  it('keeps the latest server note when the saved draft only mirrors an older base note', async () => {
    const staleNote = '## Old plan';
    mocked.getDraft.mockResolvedValue({
      fields: {
        note: staleNote,
        baseNoteFingerprint: buildTaskNoteFingerprint(staleNote),
      },
    });

    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note', true),
    );

    await waitFor(() => {
      expect(result.current.draftNote).toBe('## Server note');
    });
    expect(result.current.hasNoteConflict).toBe(false);
    expect(result.current.canRestoreDraft).toBe(false);
  });

  it('suppresses a stale draft conflict when the saved draft already matches the latest server note', async () => {
    mocked.getDraft.mockResolvedValue({
      updatedAt: '2026-04-28T15:00:00.000Z',
      fields: {
        title: '원본 제목',
        note: '## Server note',
        baseNoteFingerprint: buildTaskNoteFingerprint('## Older note'),
      },
    });

    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note', true),
    );

    await waitFor(() => {
      expect(result.current.draftNote).toBe('## Server note');
    });
    expect(result.current.hasNoteConflict).toBe(false);
    expect(result.current.canRestoreDraft).toBe(false);
    expect(mocked.deleteDraft).toHaveBeenCalledWith('task:PROJ-310');
  });

  it('keeps a title-only stale draft restorable without surfacing a note conflict', async () => {
    mocked.getDraft.mockResolvedValue({
      fields: {
        title: '로컬 초안 제목',
        note: '## Server note',
        baseNoteFingerprint: buildTaskNoteFingerprint('## Older note'),
      },
    });

    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note', true),
    );

    await waitFor(() => {
      expect(result.current.canRestoreDraft).toBe(true);
    });
    expect(result.current.hasNoteConflict).toBe(false);
  });

  it('keeps the server note active online and exposes a restorable stale local draft', async () => {
    mocked.getDraft.mockResolvedValue({
      fields: {
        title: '로컬 초안 제목',
        note: '## Local rewrite',
        baseNoteFingerprint: buildTaskNoteFingerprint('## Old plan'),
      },
    });

    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note', true),
    );

    await waitFor(() => {
      expect(result.current.canRestoreDraft).toBe(true);
    });
    expect(result.current.draftTitle).toBe('원본 제목');
    expect(result.current.draftNote).toBe('## Server note');
    expect(result.current.hasNoteConflict).toBe(true);

    act(() => {
      result.current.restoreDraft();
    });

    await waitFor(() => {
      expect(result.current.draftTitle).toBe('로컬 초안 제목');
    });
    expect(result.current.draftNote).toBe('## Local rewrite');
    expect(result.current.hasNoteConflict).toBe(false);
    expect(result.current.canRestoreDraft).toBe(false);
  });

  it('exposes restore preview metadata for an online stale local draft', async () => {
    mocked.getDraft.mockResolvedValue({
      updatedAt: '2026-04-28T15:00:00.000Z',
      fields: {
        title: '로컬 초안 제목',
        note: '## Local rewrite\n\nSaved from browser draft.',
        baseNoteFingerprint: buildTaskNoteFingerprint('## Old plan'),
      },
    });

    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note', true),
    );

    await waitFor(() => {
      expect(result.current.canRestoreDraft).toBe(true);
    });

    expect(result.current.restoreDraftPreview).toEqual({
      title: '로컬 초안 제목',
      note: '## Local rewrite\n\nSaved from browser draft.',
      updatedAt: '2026-04-28T15:00:00.000Z',
    });

    act(() => {
      result.current.restoreDraft();
    });

    expect(result.current.restoreDraftPreview).toBeNull();
  });

  it('keeps an unsaved local note draft and surfaces a conflict while offline when the server note changed', async () => {
    mocked.getDraft.mockResolvedValue({
      fields: {
        note: '## Local rewrite',
        baseNoteFingerprint: buildTaskNoteFingerprint('## Old plan'),
      },
    });

    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note', false),
    );

    await waitFor(() => {
      expect(result.current.draftNote).toBe('## Local rewrite');
    });
    expect(result.current.hasNoteConflict).toBe(true);
  });

  it('preserves legacy local note drafts without a base fingerprint as conflicts instead of discarding them', async () => {
    mocked.getDraft.mockResolvedValue({
      fields: {
        note: '## Legacy local rewrite',
      },
    });

    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note', false),
    );

    await waitFor(() => {
      expect(result.current.draftNote).toBe('## Legacy local rewrite');
    });
    expect(result.current.hasNoteConflict).toBe(true);
  });

  it('persists title and note edits under the deterministic task draft key', async () => {
    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note', true),
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
          baseNoteFingerprint: buildTaskNoteFingerprint('## Server note'),
          title: '변경된 제목',
          note: '## Updated note',
        },
      }),
    );
  });

  it('clears the persisted draft for the active task key', async () => {
    const { result } = renderHook(() =>
      useTaskOfflineDraft('PROJ-310', '원본 제목', '## Server note', true),
    );

    await act(async () => {
      await result.current.clearDraft();
    });

    expect(mocked.deleteDraft).toHaveBeenCalledWith('task:PROJ-310');
  });
});
