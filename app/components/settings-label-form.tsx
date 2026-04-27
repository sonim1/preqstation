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
  useActionState,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';

import { SettingStatusMessage } from '@/app/components/setting-status-message';
import controlClasses from '@/app/components/settings-controls.module.css';
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
  nameError: boolean;
  state: ActionState;
};

const SettingsLabelFormStateContext = createContext<SettingsLabelFormRenderProps | null>(null);

type SettingsLabelFormProps = {
  action: (prevState: unknown, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  id?: string;
};

export function SettingsLabelForm({ action, children, id }: SettingsLabelFormProps) {
  const [state, formAction] = useActionState(action, null);
  const feedbackId = useId();
  const hasError = Boolean(state && !state.ok);
  const errorField = state && !state.ok ? (state.field ?? 'form') : null;
  const nameError = errorField === 'name';
  const colorError = errorField === 'color';

  return (
    <SettingsLabelFormStateContext.Provider
      value={{ colorError, feedbackId, hasError, nameError, state }}
    >
      <form id={id} action={formAction}>
        {children}
        {hasError ? (
          <SettingStatusMessage
            id={feedbackId}
            tone="error"
            message={state && !state.ok ? state.message : 'Failed to save label.'}
          />
        ) : null}
      </form>
    </SettingsLabelFormStateContext.Provider>
  );
}

type SettingsLabelNameInputProps = ComponentProps<typeof TextInput>;

export function SettingsLabelNameInput(props: SettingsLabelNameInputProps) {
  const formState = useContext(SettingsLabelFormStateContext);
  const describedBy =
    props['aria-describedby'] ?? (formState?.nameError ? formState.feedbackId : undefined);
  const invalid = props['aria-invalid'] ?? (formState?.nameError || undefined);

  return <TextInput {...props} aria-describedby={describedBy} aria-invalid={invalid} />;
}

type TaskLabelColorFieldProps = {
  name?: string;
  defaultColor?: string;
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

export function TaskLabelColorField({
  name = 'color',
  defaultColor = 'blue',
  usedColors = [],
  label = 'Color',
  showLabel = true,
  size = 'md',
  ariaLabel,
  ariaDescribedBy,
  invalid,
}: TaskLabelColorFieldProps) {
  const formState = useContext(SettingsLabelFormStateContext);
  const [color, setColor] = useState<TaskLabelColorValue>(parseTaskLabelColor(defaultColor));

  useEffect(() => {
    setColor(parseTaskLabelColor(defaultColor));
  }, [defaultColor]);

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
          >
            {formatColorLabel(color)}
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="xs">
            <ColorPicker
              format="hex"
              fullWidth
              value={resolveTaskLabelSwatchColor(color)}
              swatches={swatches}
              onChange={(value) => setColor(parseTaskLabelColor(value))}
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
                      onClick={() => setColor(entry)}
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
      <input type="hidden" name={name} value={color} />
    </Stack>
  );
}
