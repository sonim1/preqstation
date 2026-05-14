'use client';

import { ActionIcon, ColorPicker, ColorSwatch, Popover, Text, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useCallback, useId, useRef, useState } from 'react';

import settingsClasses from '@/app/(workspace)/(main)/settings/settings-page.module.css';
import { ConfirmActionButton } from '@/app/components/confirm-action-button';
import { SettingStatusMessage } from '@/app/components/setting-status-message';
import { useAutoSave } from '@/app/hooks/use-auto-save';
import { TODO_LABEL_NAME_MAX_LENGTH } from '@/lib/content-limits';
import { showErrorNotification, showSuccessNotification } from '@/lib/notifications';
import {
  parseTaskLabelColor,
  resolveTaskLabelSwatchColor,
  type TaskLabelColorValue,
} from '@/lib/task-meta';

type LabelActionState =
  | { ok: true }
  | { ok: false; message: string; field?: 'color' | 'form' | 'name' }
  | null;

type ProjectLabelTileProps = {
  label: { id: string; name: string; color: string; usageCount: number };
  usageCopy: string;
  deleteConfirmMessage: string;
  updateLabelAction: (prevState: unknown, formData: FormData) => Promise<LabelActionState>;
  deleteLabelAction: (prevState: unknown, formData: FormData) => Promise<LabelActionState>;
};

type FieldError = {
  field: 'color' | 'name';
  message: string;
};

export function ProjectLabelTile({
  label,
  usageCopy,
  deleteConfirmMessage,
  updateLabelAction,
  deleteLabelAction,
}: ProjectLabelTileProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState<TaskLabelColorValue>(parseTaskLabelColor(label.color));
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const feedbackId = useId();
  const deleteFormId = `project-label-delete-${label.id}`;
  const colorError = fieldError?.field === 'color';
  const nameError = fieldError?.field === 'name';

  const submitLabelUpdate = useCallback(
    async (form: HTMLFormElement) => {
      setFieldError(null);
      const result = await updateLabelAction(null, new FormData(form));

      if (!result || result.ok) {
        if (result?.ok) {
          showSuccessNotification('Label saved.');
        }
        return;
      }

      const message = result.message || 'Failed to save label.';
      if (result.field === 'name' || result.field === 'color') {
        setFieldError({ field: result.field, message });
      }
      showErrorNotification(message);
      throw new Error(message);
    },
    [updateLabelAction],
  );

  const { triggerSave } = useAutoSave(formRef, 700, {
    submit: submitLabelUpdate,
  });

  function queueColorSave(nextValue: string) {
    setColor(parseTaskLabelColor(nextValue));
    setFieldError(null);
    window.setTimeout(() => {
      triggerSave(0);
    }, 0);
  }

  return (
    <article
      className={settingsClasses.labelRow}
      data-label-row={label.id}
      data-label-tile={label.id}
    >
      <form
        ref={formRef}
        className={settingsClasses.labelRowEditor}
        data-slot="label-row-editor"
        onSubmit={(event) => {
          event.preventDefault();
          triggerSave(0);
        }}
      >
        <input type="hidden" name="id" value={label.id} />
        <input type="hidden" name="color" value={color} />
        <Popover width={240} position="bottom-start" withArrow shadow="md">
          <Popover.Target>
            <ActionIcon
              type="button"
              variant="default"
              size="sm"
              aria-label={`${label.name} label color`}
              aria-describedby={colorError ? feedbackId : undefined}
              aria-invalid={colorError || undefined}
              title="Change label color"
              className={settingsClasses.labelColorButton}
            >
              <ColorSwatch color={resolveTaskLabelSwatchColor(color)} size={16} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown className={settingsClasses.labelColorPicker}>
            <ColorPicker
              format="hex"
              fullWidth
              value={resolveTaskLabelSwatchColor(color)}
              onChange={(nextValue) => {
                setColor(parseTaskLabelColor(nextValue));
                setFieldError(null);
              }}
              onChangeEnd={queueColorSave}
            />
          </Popover.Dropdown>
        </Popover>
        <TextInput
          name="name"
          aria-label={`${label.name} label name`}
          aria-describedby={nameError ? feedbackId : undefined}
          aria-invalid={nameError || undefined}
          value={name}
          required
          maxLength={TODO_LABEL_NAME_MAX_LENGTH}
          className={settingsClasses.labelNameInput}
          size="xs"
          onChange={(event) => {
            setName(event.currentTarget.value);
            setFieldError(null);
            triggerSave();
          }}
          onBlur={() => {
            triggerSave(0);
          }}
        />
        <Text className={settingsClasses.labelRowMeta} size="xs" title={usageCopy}>
          {usageCopy}
        </Text>
        {fieldError ? (
          <SettingStatusMessage
            id={feedbackId}
            tone="error"
            message={fieldError.message}
            className={settingsClasses.labelRowFeedback}
          />
        ) : null}
      </form>

      <form
        id={deleteFormId}
        className={settingsClasses.labelRowDanger}
        onSubmit={(event) => {
          event.preventDefault();
          void deleteLabelAction(null, new FormData(event.currentTarget)).then((result) => {
            if (result && !result.ok) {
              showErrorNotification(result.message || 'Failed to delete label.');
            }
          });
        }}
      >
        <input type="hidden" name="id" value={label.id} />
        <ConfirmActionButton
          aria-label={`Delete ${label.name} label`}
          color="red"
          variant="subtle"
          size="xs"
          formId={deleteFormId}
          confirmTitle={`Delete ${label.name}?`}
          confirmMessage={deleteConfirmMessage}
          confirmLabel="Delete label"
          title={`Delete ${label.name} label`}
          className={settingsClasses.labelDeleteButton}
        >
          <IconTrash size={15} aria-hidden="true" />
        </ConfirmActionButton>
      </form>
    </article>
  );
}
