'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { deleteDraft, getDraft, putDraft } from '@/lib/offline/draft-store';
import { buildTaskNoteFingerprint } from '@/lib/task-note-fingerprint';

type TaskOfflineDraftState = {
  baseNoteFingerprint: string;
  note: string;
  title: string;
};

export function buildTaskOfflineDraftId(taskKey: string) {
  return `task:${taskKey}`;
}

export function useTaskOfflineDraft(
  taskKey: string,
  serverTitle: string,
  serverNote: string | null,
) {
  const serverBaseNoteFingerprint = buildTaskNoteFingerprint(serverNote);
  const [draftTitle, setDraftTitle] = useState(serverTitle);
  const [draftNote, setDraftNote] = useState(serverNote ?? '');
  const [draftBaseNoteFingerprint, setDraftBaseNoteFingerprint] = useState(serverBaseNoteFingerprint);
  const [draftRevision, setDraftRevision] = useState(0);
  const [hasNoteConflict, setHasNoteConflict] = useState(false);
  const draftRef = useRef<TaskOfflineDraftState>({
    baseNoteFingerprint: serverBaseNoteFingerprint,
    title: serverTitle,
    note: serverNote ?? '',
  });
  const loadTokenRef = useRef(0);

  useEffect(() => {
    let active = true;
    const loadToken = loadTokenRef.current + 1;
    loadTokenRef.current = loadToken;
    const serverDraft = {
      baseNoteFingerprint: serverBaseNoteFingerprint,
      title: serverTitle,
      note: serverNote ?? '',
    };
    const applyDraft = (nextDraft: TaskOfflineDraftState) => {
      draftRef.current = nextDraft;
      setDraftBaseNoteFingerprint(nextDraft.baseNoteFingerprint);
      setDraftTitle(nextDraft.title);
      setDraftNote(nextDraft.note);
      setDraftRevision((currentRevision) => currentRevision + 1);
    };

    void Promise.resolve().then(async () => {
      if (!active || loadTokenRef.current !== loadToken) {
        return;
      }

      applyDraft(serverDraft);
      setHasNoteConflict(false);

      const record = await getDraft(buildTaskOfflineDraftId(taskKey));
      if (!active || loadTokenRef.current !== loadToken || !record) {
        return;
      }

      const storedNote = record.fields.note ?? serverDraft.note;
      const storedNoteFingerprint = buildTaskNoteFingerprint(storedNote);
      const storedBaseNoteFingerprint = record.fields.baseNoteFingerprint?.trim() || null;
      const hasStaleBase =
        !!storedBaseNoteFingerprint && storedBaseNoteFingerprint !== serverDraft.baseNoteFingerprint;
      const hasLocalNoteEdits =
        !!storedBaseNoteFingerprint && storedNoteFingerprint !== storedBaseNoteFingerprint;
      const shouldApplyStoredNote =
        storedBaseNoteFingerprint === serverDraft.baseNoteFingerprint ||
        (!storedBaseNoteFingerprint && storedNoteFingerprint === serverDraft.baseNoteFingerprint) ||
        (hasStaleBase && hasLocalNoteEdits);

      setHasNoteConflict(hasStaleBase && hasLocalNoteEdits);

      applyDraft({
        title: record.fields.title ?? serverDraft.title,
        note: shouldApplyStoredNote ? storedNote : serverDraft.note,
        baseNoteFingerprint:
          shouldApplyStoredNote && storedBaseNoteFingerprint
            ? storedBaseNoteFingerprint
            : serverDraft.baseNoteFingerprint,
      });
    });

    return () => {
      active = false;
    };
  }, [serverBaseNoteFingerprint, serverNote, serverTitle, taskKey]);

  const writeDraft = useCallback(
    async (partialDraft: Partial<TaskOfflineDraftState>) => {
      loadTokenRef.current += 1;
      const nextDraft = {
        ...draftRef.current,
        ...partialDraft,
      };

      draftRef.current = nextDraft;
      setDraftTitle(nextDraft.title);
      setDraftNote(nextDraft.note);

      await putDraft({
        id: buildTaskOfflineDraftId(taskKey),
        scope: 'task-edit',
        entityKey: taskKey,
        fields: {
          title: nextDraft.title,
          note: nextDraft.note,
          baseNoteFingerprint: nextDraft.baseNoteFingerprint,
        },
        updatedAt: new Date().toISOString(),
      });
    },
    [taskKey],
  );

  const updateTitleDraft = useCallback(
    async (title: string) => {
      await writeDraft({ title });
    },
    [writeDraft],
  );

  const updateNoteDraft = useCallback(
    async (note: string) => {
      await writeDraft({ note });
    },
    [writeDraft],
  );

  const clearDraft = useCallback(async () => {
    await deleteDraft(buildTaskOfflineDraftId(taskKey));
  }, [taskKey]);

  return {
    clearDraft,
    draftBaseNoteFingerprint,
    draftNote,
    draftRevision,
    draftTitle,
    hasNoteConflict,
    updateNoteDraft,
    updateTitleDraft,
  };
}
