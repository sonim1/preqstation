'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { deleteDraft, getDraft, putDraft } from '@/lib/offline/draft-store';

type TaskOfflineDraftState = {
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
  const [draftTitle, setDraftTitle] = useState(serverTitle);
  const [draftNote, setDraftNote] = useState(serverNote ?? '');
  const [draftRevision, setDraftRevision] = useState(0);
  const draftRef = useRef<TaskOfflineDraftState>({
    title: serverTitle,
    note: serverNote ?? '',
  });
  const loadTokenRef = useRef(0);

  useEffect(() => {
    let active = true;
    const loadToken = loadTokenRef.current + 1;
    loadTokenRef.current = loadToken;
    const serverDraft = {
      title: serverTitle,
      note: serverNote ?? '',
    };
    const applyDraft = (nextDraft: TaskOfflineDraftState) => {
      draftRef.current = nextDraft;
      setDraftTitle(nextDraft.title);
      setDraftNote(nextDraft.note);
      setDraftRevision((currentRevision) => currentRevision + 1);
    };

    void Promise.resolve().then(async () => {
      if (!active || loadTokenRef.current !== loadToken) {
        return;
      }

      applyDraft(serverDraft);

      const record = await getDraft(buildTaskOfflineDraftId(taskKey));
      if (!active || loadTokenRef.current !== loadToken || !record) {
        return;
      }

      applyDraft({
        title: record.fields.title ?? serverDraft.title,
        note: record.fields.note ?? serverDraft.note,
      });
    });

    return () => {
      active = false;
    };
  }, [serverNote, serverTitle, taskKey]);

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
        fields: nextDraft,
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
    draftNote,
    draftRevision,
    draftTitle,
    updateNoteDraft,
    updateTitleDraft,
  };
}
