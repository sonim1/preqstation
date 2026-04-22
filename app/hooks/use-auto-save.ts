'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type AutoSaveStatus = 'idle' | 'saving' | 'saved';

type AutoSaveContentChange = {
  hasBootstrapped: boolean;
  previousMarkdown: string;
  nextMarkdown: string;
};

type AutoSaveContentStateChange = AutoSaveContentChange & {
  currentMarkdown: string;
};

export function serializeAutoSaveFormData(formData: FormData) {
  const entries = Array.from(formData.entries())
    .map(([key, value]) => [key, typeof value === 'string' ? value : value.name] as const)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return JSON.stringify(entries);
}

export function hasAutoSaveChanges(lastSubmittedSnapshot: string | null, nextSnapshot: string) {
  return lastSubmittedSnapshot !== nextSnapshot;
}

export function shouldFlushAutoSaveOnBlur(isDirty: boolean) {
  return isDirty;
}

export function syncAutoSaveSnapshot(
  _previousSnapshot: string | null,
  nextSnapshot: string | null,
) {
  return nextSnapshot;
}

export function shouldPropagateAutoSaveContentChange({
  hasBootstrapped,
  previousMarkdown,
  nextMarkdown,
}: AutoSaveContentChange) {
  return hasBootstrapped && previousMarkdown !== nextMarkdown;
}

export function resolveAutoSaveContentChange({
  currentMarkdown,
  ...contentChange
}: AutoSaveContentStateChange) {
  const shouldPropagate = shouldPropagateAutoSaveContentChange(contentChange);

  return {
    markdown: shouldPropagate ? contentChange.nextMarkdown : currentMarkdown,
    shouldPropagate,
  };
}

export function useAutoSave(formRef: React.RefObject<HTMLFormElement | null>, delay = 800) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  const isDirtyRef = useRef(false);
  const lastSubmittedSnapshotRef = useRef<string | null>(null);

  const getSnapshot = useCallback(() => {
    const form = formRef.current;
    if (!form) return null;
    return serializeAutoSaveFormData(new FormData(form));
  }, [formRef]);

  const cleanup = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, []);

  const doSubmit = useCallback(() => {
    const form = formRef.current;
    if (!form || submittingRef.current) return;

    const nextSnapshot = getSnapshot();
    if (!nextSnapshot || !hasAutoSaveChanges(lastSubmittedSnapshotRef.current, nextSnapshot)) {
      isDirtyRef.current = false;
      setIsDirty(false);
      setStatus('idle');
      return;
    }

    submittingRef.current = true;
    isDirtyRef.current = false;
    setIsDirty(false);
    lastSubmittedSnapshotRef.current = nextSnapshot;
    setStatus('saving');

    form.requestSubmit();

    setTimeout(() => {
      submittingRef.current = false;
      setStatus('saved');
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setStatus('idle'), 2000);
    }, 500);
  }, [formRef, getSnapshot]);

  const triggerSave = useCallback(
    (immediateDelay?: number) => {
      isDirtyRef.current = true;
      setIsDirty(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const actualDelay = immediateDelay ?? delay;
      debounceRef.current = setTimeout(() => {
        doSubmit();
      }, actualDelay);
    },
    [delay, doSubmit],
  );

  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
    setIsDirty(true);
  }, []);

  const syncSnapshot = useCallback(() => {
    cleanup();
    isDirtyRef.current = false;
    setIsDirty(false);
    lastSubmittedSnapshotRef.current = syncAutoSaveSnapshot(
      lastSubmittedSnapshotRef.current,
      getSnapshot(),
    );
    setStatus('idle');
  }, [cleanup, getSnapshot]);

  const flushSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (isDirtyRef.current) {
      doSubmit();
    }
  }, [doSubmit]);

  useEffect(() => {
    const snapshot = getSnapshot();
    if (snapshot) {
      lastSubmittedSnapshotRef.current = snapshot;
    }
  }, [getSnapshot]);

  // beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current || debounceRef.current) {
        flushSave();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanup();
    };
  }, [cleanup, flushSave]);

  return { markDirty, triggerSave, flushSave, syncSnapshot, status, isDirty, isDirtyRef };
}
