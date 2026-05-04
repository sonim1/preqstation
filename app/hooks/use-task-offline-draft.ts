'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { deleteDraft, getDraft, putDraft } from '@/lib/offline/draft-store';
import { buildTaskNoteFingerprint, buildTaskTitleFingerprint } from '@/lib/task-note-fingerprint';

const LEGACY_NOTE_CONFLICT_BASE_FINGERPRINT_PREFIX = 'task-note:legacy-conflict:';

type TaskOfflineDraftState = {
  baseNoteFingerprint: string;
  baseTitleFingerprint: string;
  note: string;
  title: string;
};

type RestorableTaskOfflineDraft = TaskOfflineDraftState & {
  updatedAt: string | null;
};

function hasDraftChanges(nextDraft: TaskOfflineDraftState, serverDraft: TaskOfflineDraftState) {
  return (
    nextDraft.title !== serverDraft.title ||
    buildTaskNoteFingerprint(nextDraft.note) !== buildTaskNoteFingerprint(serverDraft.note)
  );
}

function hasDraftContentChanges(
  nextDraft: TaskOfflineDraftState,
  serverDraft: TaskOfflineDraftState,
) {
  return nextDraft.title !== serverDraft.title || nextDraft.note !== serverDraft.note;
}

export function buildTaskOfflineDraftId(taskKey: string) {
  return `task:${taskKey}`;
}

export function useTaskOfflineDraft(
  taskKey: string,
  serverTitle: string,
  serverNote: string | null,
  online: boolean,
) {
  const serverBaseNoteFingerprint = buildTaskNoteFingerprint(serverNote);
  const serverBaseTitleFingerprint = buildTaskTitleFingerprint(serverTitle);
  const [draftTitle, setDraftTitle] = useState(serverTitle);
  const [draftNote, setDraftNote] = useState(serverNote ?? '');
  const [draftBaseNoteFingerprint, setDraftBaseNoteFingerprint] =
    useState(serverBaseNoteFingerprint);
  const [draftBaseTitleFingerprint, setDraftBaseTitleFingerprint] = useState(
    serverBaseTitleFingerprint,
  );
  const [draftRevision, setDraftRevision] = useState(0);
  const [hasNoteConflict, setHasNoteConflict] = useState(false);
  const [hasTitleConflict, setHasTitleConflict] = useState(false);
  const [restorableDraft, setRestorableDraft] = useState<RestorableTaskOfflineDraft | null>(null);
  const [autoSaveDraft, setAutoSaveDraft] = useState<RestorableTaskOfflineDraft | null>(null);
  const [failedAutoSaveDraftKey, setFailedAutoSaveDraftKey] = useState<string | null>(null);
  const draftRef = useRef<TaskOfflineDraftState>({
    baseNoteFingerprint: serverBaseNoteFingerprint,
    baseTitleFingerprint: serverBaseTitleFingerprint,
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
      baseTitleFingerprint: serverBaseTitleFingerprint,
      title: serverTitle,
      note: serverNote ?? '',
    };
    const applyDraft = (nextDraft: TaskOfflineDraftState) => {
      draftRef.current = nextDraft;
      setDraftBaseNoteFingerprint(nextDraft.baseNoteFingerprint);
      setDraftBaseTitleFingerprint(nextDraft.baseTitleFingerprint);
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
      setHasTitleConflict(false);
      setRestorableDraft(null);
      setAutoSaveDraft(null);

      const record = await getDraft(buildTaskOfflineDraftId(taskKey));
      if (!active || loadTokenRef.current !== loadToken || !record) {
        return;
      }

      const storedNote = record.fields.note ?? serverDraft.note;
      const storedTitle = record.fields.title ?? serverDraft.title;
      const storedNoteFingerprint = buildTaskNoteFingerprint(storedNote);
      const storedTitleFingerprint = buildTaskTitleFingerprint(storedTitle);
      const storedBaseNoteFingerprint = record.fields.baseNoteFingerprint?.trim() || null;
      const storedBaseTitleFingerprint = record.fields.baseTitleFingerprint?.trim() || null;
      const legacyConflictBaseNoteFingerprint = `${LEGACY_NOTE_CONFLICT_BASE_FINGERPRINT_PREFIX}${storedNoteFingerprint}`;
      const hasStaleBase =
        !!storedBaseNoteFingerprint &&
        storedBaseNoteFingerprint !== serverDraft.baseNoteFingerprint;
      const hasStaleTitleBase =
        !!storedBaseTitleFingerprint &&
        storedBaseTitleFingerprint !== serverDraft.baseTitleFingerprint;
      const hasLocalNoteEdits =
        !!storedBaseNoteFingerprint && storedNoteFingerprint !== storedBaseNoteFingerprint;
      const hasLocalTitleEdits =
        !!storedBaseTitleFingerprint && storedTitleFingerprint !== storedBaseTitleFingerprint;
      const hasLegacyConflict =
        !storedBaseNoteFingerprint && storedNoteFingerprint !== serverDraft.baseNoteFingerprint;
      const noteMatchesServer = storedNoteFingerprint === serverDraft.baseNoteFingerprint;
      const titleMatchesServer = storedTitleFingerprint === serverDraft.baseTitleFingerprint;
      const shouldApplyStoredNote =
        storedBaseNoteFingerprint === serverDraft.baseNoteFingerprint ||
        (!storedBaseNoteFingerprint && storedNoteFingerprint === serverDraft.baseNoteFingerprint) ||
        (hasStaleBase && hasLocalNoteEdits) ||
        hasLegacyConflict;
      const resolvedDraft = {
        title: storedTitle,
        note: shouldApplyStoredNote ? storedNote : serverDraft.note,
        baseTitleFingerprint:
          storedBaseTitleFingerprint && !titleMatchesServer
            ? storedBaseTitleFingerprint
            : serverDraft.baseTitleFingerprint,
        baseNoteFingerprint:
          !shouldApplyStoredNote || noteMatchesServer
            ? serverDraft.baseNoteFingerprint
            : storedBaseNoteFingerprint
              ? storedBaseNoteFingerprint
              : hasLegacyConflict
                ? legacyConflictBaseNoteFingerprint
                : serverDraft.baseNoteFingerprint,
      };
      const hasNoteConflict =
        ((hasStaleBase && hasLocalNoteEdits) || hasLegacyConflict) && !noteMatchesServer;
      const hasTitleConflict = hasStaleTitleBase && hasLocalTitleEdits && !titleMatchesServer;
      const hasConflict = hasNoteConflict || hasTitleConflict;
      const nextRestorableDraft = {
        title: resolvedDraft.title,
        note: resolvedDraft.note,
        baseTitleFingerprint: resolvedDraft.baseTitleFingerprint,
        baseNoteFingerprint: serverDraft.baseNoteFingerprint,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
      };
      const hasRestorableDraft = hasDraftChanges(nextRestorableDraft, serverDraft);
      const hasPersistedDraftChanges = hasDraftContentChanges(nextRestorableDraft, serverDraft);
      const nextAutoSaveDraft =
        online &&
        storedBaseTitleFingerprint &&
        storedBaseNoteFingerprint &&
        storedBaseTitleFingerprint === serverDraft.baseTitleFingerprint &&
        storedBaseNoteFingerprint === serverDraft.baseNoteFingerprint &&
        hasDraftChanges(
          {
            title: storedTitle,
            note: storedNote,
            baseTitleFingerprint: storedBaseTitleFingerprint,
            baseNoteFingerprint: storedBaseNoteFingerprint,
          },
          serverDraft,
        )
          ? {
              title: storedTitle,
              note: storedNote,
              baseTitleFingerprint: storedBaseTitleFingerprint,
              baseNoteFingerprint: storedBaseNoteFingerprint,
              updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
            }
          : null;
      const autoSaveDraftKey = nextAutoSaveDraft
        ? `${taskKey}:${nextAutoSaveDraft.baseTitleFingerprint}:${nextAutoSaveDraft.baseNoteFingerprint}:${nextAutoSaveDraft.title}:${buildTaskNoteFingerprint(nextAutoSaveDraft.note)}`
        : null;

      setHasNoteConflict(hasNoteConflict);
      setHasTitleConflict(hasTitleConflict);

      if (!hasConflict && !hasRestorableDraft && !hasPersistedDraftChanges && !nextAutoSaveDraft) {
        void Promise.resolve()
          .then(() => deleteDraft(buildTaskOfflineDraftId(taskKey)))
          .catch(() => undefined);
        return;
      }

      if (online) {
        if (nextAutoSaveDraft && autoSaveDraftKey !== failedAutoSaveDraftKey) {
          setAutoSaveDraft(nextAutoSaveDraft);
          setRestorableDraft(null);
          return;
        }

        setAutoSaveDraft(null);
        setRestorableDraft(hasRestorableDraft ? nextRestorableDraft : null);
        return;
      }

      applyDraft(resolvedDraft);
    });

    return () => {
      active = false;
    };
  }, [
    failedAutoSaveDraftKey,
    online,
    serverBaseNoteFingerprint,
    serverBaseTitleFingerprint,
    serverNote,
    serverTitle,
    taskKey,
  ]);

  const writeDraft = useCallback(
    async (partialDraft: Partial<TaskOfflineDraftState>) => {
      loadTokenRef.current += 1;
      const nextDraft = {
        ...draftRef.current,
        ...partialDraft,
      };

      draftRef.current = nextDraft;
      setDraftBaseNoteFingerprint(nextDraft.baseNoteFingerprint);
      setDraftBaseTitleFingerprint(nextDraft.baseTitleFingerprint);
      setDraftTitle(nextDraft.title);
      setDraftNote(nextDraft.note);
      setHasNoteConflict(false);
      setHasTitleConflict(false);
      setRestorableDraft(null);
      setAutoSaveDraft(null);

      await putDraft({
        id: buildTaskOfflineDraftId(taskKey),
        scope: 'task-edit',
        entityKey: taskKey,
        fields: {
          title: nextDraft.title,
          note: nextDraft.note,
          baseTitleFingerprint: nextDraft.baseTitleFingerprint,
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

  const restoreDraft = useCallback(() => {
    if (!restorableDraft) {
      return;
    }

    loadTokenRef.current += 1;
    const { updatedAt: _updatedAt, ...nextDraft } = restorableDraft;
    draftRef.current = nextDraft;
    setDraftBaseNoteFingerprint(nextDraft.baseNoteFingerprint);
    setDraftBaseTitleFingerprint(nextDraft.baseTitleFingerprint);
    setDraftTitle(nextDraft.title);
    setDraftNote(nextDraft.note);
    setDraftRevision((currentRevision) => currentRevision + 1);
    setHasNoteConflict(false);
    setHasTitleConflict(false);
    setRestorableDraft(null);
  }, [restorableDraft]);

  const markAutoSaveDraftFailed = useCallback(() => {
    if (!autoSaveDraft) {
      return;
    }

    setFailedAutoSaveDraftKey(
      `${taskKey}:${autoSaveDraft.baseTitleFingerprint}:${autoSaveDraft.baseNoteFingerprint}:${autoSaveDraft.title}:${buildTaskNoteFingerprint(autoSaveDraft.note)}`,
    );
    setAutoSaveDraft(null);
    setRestorableDraft(autoSaveDraft);
  }, [autoSaveDraft, taskKey]);

  return {
    autoSaveDraft,
    canRestoreDraft: restorableDraft !== null,
    clearDraft,
    draftBaseNoteFingerprint,
    draftBaseTitleFingerprint,
    draftNote,
    draftRevision,
    draftTitle,
    hasNoteConflict,
    hasTitleConflict,
    markAutoSaveDraftFailed,
    restoreDraft,
    restoreDraftPreview: restorableDraft
      ? {
          title: restorableDraft.title,
          note: restorableDraft.note,
          updatedAt: restorableDraft.updatedAt,
        }
      : null,
    updateNoteDraft,
    updateTitleDraft,
  };
}
