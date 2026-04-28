'use client';

import {
  Button,
  ColorPicker,
  ColorSwatch,
  Group,
  Popover,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  type ComponentProps,
  createContext,
  type FormEvent,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import { type SettingSaveState, SettingSaveStatus } from '@/app/components/setting-save-status';
import { SettingStatusMessage } from '@/app/components/setting-status-message';
import controlClasses from '@/app/components/settings-controls.module.css';
import { SubmitButton } from '@/app/components/submit-button';
import {
  normalizeTaskLabelColor,
  parseTaskLabelColor,
  resolveTaskLabelSwatchColor,
  TASK_LABEL_COLOR_SWATCHES,
  TASK_LABEL_COLORS,
  type TaskLabelColorValue,
} from '@/lib/task-meta';

type ActionState =
  | { ok: true }
  | { ok: false; message: string; field?: 'color' | 'form' | 'name' }
  | null;

type SettingsLabelFormRenderProps = {
  colorError: boolean;
  feedbackId: string;
  hasError: boolean;
  isDirty: boolean;
  isPending: boolean;
  markDirty: () => void;
  nameError: boolean;
  state: ActionState;
};

const SettingsLabelFormStateContext = createContext<SettingsLabelFormRenderProps | null>(null);
const disabledFieldsetStyle = {
  margin: 0,
  padding: 0,
  border: 0,
  minWidth: 0,
} as const;
const pendingPopoverStyle = {
  pointerEvents: 'none',
  opacity: 0.6,
} as const;

function serializeFormData(formData: FormData) {
  return JSON.stringify(
    Array.from(formData.entries()).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : value.name,
    ]),
  );
}

type SettingsLabelFormProps = {
  action: (prevState: unknown, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  showModeHint?: boolean;
  id?: string;
};

export function SettingsLabelForm({
  action,
  children,
  showModeHint = false,
  id,
}: SettingsLabelFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, setState] = useState<ActionState>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<SettingSaveState>('idle');
  const [isPending, startTransition] = useTransition();
  const isSubmittingRef = useRef(false);
  const baselineSnapshotRef = useRef('');
  const dirtyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackId = useId();
  const hasError = Boolean(state && !state.ok);
  const errorField = state && !state.ok ? (state.field ?? 'form') : null;
  const nameError = errorField === 'name';
  const colorError = errorField === 'color';
  const currentState =
    hasError && errorField !== 'form' ? 'idle' : isPending ? 'saving' : saveState;

  useEffect(
    () => () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
      if (dirtyTimerRef.current) {
        clearTimeout(dirtyTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!formRef.current) return;
    baselineSnapshotRef.current = serializeFormData(new FormData(formRef.current));
    setIsDirty(false);
  }, []);

  function syncDirtyState() {
    if (!formRef.current) return;
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    const nextIsDirty =
      serializeFormData(new FormData(formRef.current)) !== baselineSnapshotRef.current;
    setState((current) => (current && !current.ok ? null : current));
    setIsDirty(nextIsDirty);
    setSaveState(nextIsDirty ? 'dirty' : 'idle');
  }

  function markDirty() {
    if (dirtyTimerRef.current) {
      clearTimeout(dirtyTimerRef.current);
    }
    dirtyTimerRef.current = setTimeout(() => {
      dirtyTimerRef.current = null;
      syncDirtyState();
    }, 0);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || isSubmittingRef.current) return;
    const form = event.currentTarget;
    const formData = new FormData(form);

    isSubmittingRef.current = true;
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    setState(null);
    setSaveState('saving');

    startTransition(async () => {
      try {
        const result = await action(null, formData);
        setState(result);
        if (result?.ok) {
          baselineSnapshotRef.current = serializeFormData(formData);
          setIsDirty(false);
          setSaveState('saved');
          savedTimerRef.current = setTimeout(() => {
            setSaveState((current) => (current === 'saved' ? 'idle' : current));
            savedTimerRef.current = null;
          }, 2_000);
          return;
        }

        setSaveState(result ? 'error' : 'idle');
      } finally {
        isSubmittingRef.current = false;
      }
    });
  }

  return (
    <SettingsLabelFormStateContext.Provider
      value={{ colorError, feedbackId, hasError, isDirty, isPending, markDirty, nameError, state }}
    >
      <form
        id={id}
        ref={formRef}
        onSubmit={handleSubmit}
        onChangeCapture={syncDirtyState}
        onInputCapture={syncDirtyState}
      >
        <fieldset disabled={isPending} style={disabledFieldsetStyle}>
          {children}
        </fieldset>
        {hasError && errorField !== 'form' ? (
          <SettingStatusMessage
            id={feedbackId}
            tone="error"
            message={state && !state.ok ? state.message : 'Failed to save label.'}
          />
        ) : null}
        <SettingSaveStatus
          id={hasError && errorField === 'form' ? feedbackId : undefined}
          mode="manual"
          state={currentState}
          errorMessage={state && !state.ok ? state.message : undefined}
          showModeHint={showModeHint}
        />
      </form>
    </SettingsLabelFormStateContext.Provider>
  );
}

type SettingsLabelNameInputProps = ComponentProps<typeof TextInput>;

type SettingsLabelSubmitButtonProps = ComponentProps<typeof SubmitButton>;

export function SettingsLabelSubmitButton({
  children,
  disabled,
  loading,
  ...props
}: SettingsLabelSubmitButtonProps) {
  const formState = useContext(SettingsLabelFormStateContext);
  const isDisabled =
    Boolean(disabled) || (formState ? !formState.isDirty || formState.isPending : false);

  return (
    <SubmitButton {...props} disabled={isDisabled} loading={loading ?? formState?.isPending}>
      {children}
    </SubmitButton>
  );
}

export function SettingsLabelNameInput(props: SettingsLabelNameInputProps) {
  const formState = useContext(SettingsLabelFormStateContext);
  const describedBy =
    props['aria-describedby'] ?? (formState?.nameError ? formState.feedbackId : undefined);
  const invalid = props['aria-invalid'] ?? (formState?.nameError || undefined);

  return <TextInput {...props} aria-describedby={describedBy} aria-invalid={invalid} />;
}

type TaskLabelColorFieldProps = {
  value: TaskLabelColorValue;
  onChange: (value: TaskLabelColorValue) => void;
  usedColors?: string[];
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
};

function formatColorLabel(color: string) {
  if (color.startsWith('#')) return color.toUpperCase();
  return color.slice(0, 1).toUpperCase() + color.slice(1);
}

export function TaskLabelColorPicker({
  value,
  onChange,
  usedColors = [],
  label = 'Color',
  showLabel = true,
  size = 'md',
  ariaLabel,
  ariaDescribedBy,
  invalid,
}: TaskLabelColorFieldProps) {
  const formState = useContext(SettingsLabelFormStateContext);
  const color = parseTaskLabelColor(value);

  const swatches = useMemo(
    () => TASK_LABEL_COLORS.map((entry) => TASK_LABEL_COLOR_SWATCHES[entry]),
    [],
  );
  const usedColorValues = useMemo(
    () =>
      Array.from(
        new Set(
          usedColors
            .map((entry) => normalizeTaskLabelColor(entry))
            .filter((entry): entry is TaskLabelColorValue => entry !== null),
        ),
      ),
    [usedColors],
  );

  return (
    <Stack gap={showLabel ? 4 : 0}>
      {showLabel ? (
        <Text size={size === 'sm' ? 'xs' : 'sm'} fw={500}>
          {label}
        </Text>
      ) : null}
      <Popover width={260} position="bottom-start" withArrow shadow="md">
        <Popover.Target>
          <Button
            type="button"
            variant="default"
            size={size}
            justify="space-between"
            leftSection={<ColorSwatch color={resolveTaskLabelSwatchColor(color)} size={18} />}
            aria-label={ariaLabel ?? `${label}: ${formatColorLabel(color)}`}
            aria-describedby={
              ariaDescribedBy ?? (formState?.colorError ? formState.feedbackId : undefined)
            }
            aria-invalid={invalid ?? (formState?.colorError || undefined)}
            className={controlClasses.colorTrigger}
            disabled={formState?.isPending}
          >
            {formatColorLabel(color)}
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="xs" style={formState?.isPending ? pendingPopoverStyle : undefined}>
            <ColorPicker
              format="hex"
              fullWidth
              value={resolveTaskLabelSwatchColor(color)}
              swatches={swatches}
              onChange={(nextValue) => {
                onChange(parseTaskLabelColor(nextValue));
                formState?.markDirty();
              }}
            />
            {usedColorValues.length > 0 ? (
              <Stack gap={4}>
                <Text size="xs" c="dimmed">
                  Used colors
                </Text>
                <Group gap={6}>
                  {usedColorValues.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      disabled={formState?.isPending}
                      onClick={() => {
                        onChange(entry);
                        formState?.markDirty();
                      }}
                      style={{
                        padding: 0,
                        border: 0,
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                      aria-label={`Use ${formatColorLabel(entry)}`}
                      title={formatColorLabel(entry)}
                      className={controlClasses.swatchButton}
                    >
                      <ColorSwatch color={resolveTaskLabelSwatchColor(entry)} size={18} />
                    </button>
                  ))}
                </Group>
              </Stack>
            ) : null}
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Stack>
  );
}

type TaskLabelColorFieldStateProps = Omit<TaskLabelColorFieldProps, 'onChange' | 'value'> & {
  name?: string;
  defaultColor?: string;
};

export function TaskLabelColorField({
  name = 'color',
  defaultColor = 'blue',
  ...props
}: TaskLabelColorFieldStateProps) {
  const [color, setColor] = useState<TaskLabelColorValue>(parseTaskLabelColor(defaultColor));

  useEffect(() => {
    setColor(parseTaskLabelColor(defaultColor));
  }, [defaultColor]);

  return (
    <>
      <TaskLabelColorPicker {...props} value={color} onChange={setColor} />
      <input type="hidden" name={name} value={color} />
    </>
  );
}
