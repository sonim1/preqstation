'use client';

import { ActionIcon, Text } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import classes from './task-edit-header-title.module.css';

type TaskEditHeaderTitleProps = {
  dialogLabel?: string;
  formId: string;
  onTitleChange: (title: string) => void;
  placeholder: string;
  statusBadge?: ReactNode;
  title: string;
  titleLabel: string;
  onBlur: () => void;
  onChange: () => void;
};

export function TaskEditHeaderTitle({
  formId,
  onTitleChange,
  placeholder,
  statusBadge,
  title,
  titleLabel,
  onBlur,
  onChange,
}: TaskEditHeaderTitleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const beginEditing = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    onBlur();
    setIsEditing(false);
  };

  return (
    <div className={classes.root} data-slot="task-edit-header-title">
      <input readOnly className={classes.hiddenInput} form={formId} name="title" value={title} />

      <div className={classes.row}>
        {statusBadge ? <div className={classes.statusSlot}>{statusBadge}</div> : null}

        {isEditing ? (
          <div className={classes.editor}>
            <input
              ref={inputRef}
              className={classes.input}
              aria-label={titleLabel}
              placeholder={placeholder}
              value={title}
              onBlur={handleBlur}
              onChange={(event) => {
                onTitleChange(event.currentTarget.value);
                onChange();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.blur();
                  return;
                }

                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            />
          </div>
        ) : (
          <Text
            component="span"
            className={`${classes.titleText}${title ? '' : ` ${classes.placeholder}`}`}
          >
            {title || placeholder}
          </Text>
        )}

        <ActionIcon
          type="button"
          variant="subtle"
          color="gray"
          size="sm"
          radius="xl"
          aria-label={`Edit ${titleLabel.toLowerCase()}`}
          className={classes.editButton}
          onClick={beginEditing}
        >
          <IconPencil size={14} />
        </ActionIcon>
      </div>
    </div>
  );
}
