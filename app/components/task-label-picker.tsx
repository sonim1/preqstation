'use client';

import {
  Button,
  ColorSwatch,
  Popover,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck, IconChevronDown, IconPlus } from '@tabler/icons-react';
import {
  type CSSProperties,
  type MouseEventHandler,
  type PointerEventHandler,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useOfflineStatus } from '@/app/components/offline-status-provider';
import { TaskLabelColorPicker } from '@/app/components/settings-label-form';
import {
  createProjectLabelWithRecovery,
  type ProjectLabelOption,
  sortProjectLabelOptions,
  upsertProjectLabelOptions,
} from '@/lib/project-label-client';
import { resolveTaskLabelSwatchColor, type TaskLabelColorValue } from '@/lib/task-meta';

import styles from './task-label-picker.module.css';

type TaskLabelPickerProps = {
  labelOptions: ProjectLabelOption[];
  selectedLabelIds: string[];
  selectedLabels?: ProjectLabelOption[];
  projectId: string | null;
  disabled?: boolean;
  triggerAriaLabel: string;
  triggerLabel?: string;
  emptyStateLabel?: string;
  searchPlaceholder?: string;
  onTriggerPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onTriggerClick?: MouseEventHandler<HTMLButtonElement>;
  onChange: (labelIds: string[]) => void | Promise<void>;
  onOptionsChange?: (labelOptions: ProjectLabelOption[]) => void;
  onLabelCreated?: (label: ProjectLabelOption, labelOptions: ProjectLabelOption[]) => void;
  renderTrigger?: (args: {
    selectedLabels: ProjectLabelOption[];
    hasSelectedLabels: boolean;
    opened: boolean;
    disabled: boolean;
  }) => ReactNode;
};

type CreateActionStateArgs = {
  labelOptions: ProjectLabelOption[];
  projectId: string | null;
  online: boolean;
  search: string;
};

function normalizeLabelName(name: string) {
  return name.trim().toLocaleLowerCase();
}

export function shouldOfferTaskLabelCreateAction({
  labelOptions,
  projectId,
  online,
  search,
}: CreateActionStateArgs) {
  const trimmedSearch = search.trim();
  if (!trimmedSearch || !projectId || !online) {
    return false;
  }

  return !labelOptions.some(
    (label) => normalizeLabelName(label.name) === normalizeLabelName(trimmedSearch),
  );
}

function renderDefaultTrigger({
  selectedLabels,
  hasSelectedLabels,
  opened,
  disabled,
  triggerLabel = 'Labels',
  emptyStateLabel = 'Select labels',
}: {
  selectedLabels: ProjectLabelOption[];
  hasSelectedLabels: boolean;
  opened: boolean;
  disabled: boolean;
  triggerLabel?: string;
  emptyStateLabel?: string;
}) {
  return (
    <span
      className={styles.defaultTrigger}
      data-disabled={disabled ? 'true' : undefined}
      data-opened={opened ? 'true' : undefined}
      data-task-label-trigger="default"
    >
      <span className={styles.defaultTriggerLabel}>
        {hasSelectedLabels ? selectedLabels.map((label) => label.name).join(', ') : emptyStateLabel}
      </span>
      <span className={styles.defaultTriggerMeta}>
        {!hasSelectedLabels ? (
          <span className={styles.defaultTriggerHint}>{triggerLabel}</span>
        ) : null}
        <IconChevronDown size={14} />
      </span>
    </span>
  );
}

export function TaskLabelPicker({
  labelOptions,
  selectedLabelIds,
  selectedLabels = [],
  projectId,
  disabled = false,
  triggerAriaLabel,
  triggerLabel = 'Labels',
  emptyStateLabel = 'Select labels',
  searchPlaceholder = 'Search labels',
  onTriggerPointerDown,
  onTriggerClick,
  onChange,
  onOptionsChange,
  onLabelCreated,
  renderTrigger,
}: TaskLabelPickerProps) {
  const { online } = useOfflineStatus();
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState('');
  const [createColor, setCreateColor] = useState<TaskLabelColorValue>('blue');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [localLabelOptions, setLocalLabelOptions] = useState(() =>
    sortProjectLabelOptions(labelOptions),
  );

  useEffect(() => {
    setLocalLabelOptions(sortProjectLabelOptions(labelOptions));
  }, [labelOptions]);

  const labelLookup = useMemo(() => {
    const entries = new Map<string, ProjectLabelOption>();

    for (const label of selectedLabels) {
      entries.set(label.id, label);
    }

    for (const label of localLabelOptions) {
      entries.set(label.id, label);
    }

    return entries;
  }, [localLabelOptions, selectedLabels]);

  const resolvedSelectedLabels = selectedLabelIds
    .map((labelId) => labelLookup.get(labelId) ?? null)
    .filter((label): label is ProjectLabelOption => label !== null);
  const filteredLabelOptions = useMemo(() => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) {
      return localLabelOptions;
    }

    const normalizedSearch = normalizeLabelName(trimmedSearch);
    return localLabelOptions.filter((label) =>
      normalizeLabelName(label.name).includes(normalizedSearch),
    );
  }, [localLabelOptions, search]);
  const canCreate = shouldOfferTaskLabelCreateAction({
    labelOptions: localLabelOptions,
    projectId,
    online,
    search,
  });
  const hasSelectedLabels = resolvedSelectedLabels.length > 0;

  const commitLabelChange = (nextLabelIds: string[]) => {
    try {
      Promise.resolve(onChange(nextLabelIds)).catch(() => undefined);
    } catch {
      // Prevent synchronous label update failures from crashing the UI.
    }
  };

  const toggleLabel = (labelId: string) => {
    const nextLabelIds = selectedLabelIds.includes(labelId)
      ? selectedLabelIds.filter((currentLabelId) => currentLabelId !== labelId)
      : [...selectedLabelIds, labelId];

    commitLabelChange(nextLabelIds);
  };

  const handleTriggerClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (!disabled) {
      setOpened((currentOpened) => !currentOpened);
    }

    onTriggerClick?.(event);
  };

  const handleCreateLabel = async () => {
    if (!projectId || !canCreate || isCreating) {
      return;
    }

    const trimmedSearch = search.trim();
    if (!trimmedSearch) {
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await createProjectLabelWithRecovery({
        projectId,
        name: trimmedSearch,
        color: createColor,
      });
      const nextLabelOptions = result.syncedLabels
        ? sortProjectLabelOptions(result.syncedLabels)
        : upsertProjectLabelOptions(localLabelOptions, result.label);
      const nextLabelIds = selectedLabelIds.includes(result.label.id)
        ? selectedLabelIds
        : [...selectedLabelIds, result.label.id];

      setLocalLabelOptions(nextLabelOptions);
      onOptionsChange?.(nextLabelOptions);
      onLabelCreated?.(result.label, nextLabelOptions);
      commitLabelChange(nextLabelIds);
      setSearch('');
      setCreateColor('blue');
    } catch (error) {
      setCreateError(
        error instanceof Error && error.message ? error.message : 'Failed to create label.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      shadow="md"
      withinPortal={true}
    >
      <Popover.Target>
        <UnstyledButton
          type="button"
          aria-label={triggerAriaLabel}
          disabled={disabled}
          onPointerDown={onTriggerPointerDown}
          onClick={handleTriggerClick}
        >
          {renderTrigger
            ? renderTrigger({
                selectedLabels: resolvedSelectedLabels,
                hasSelectedLabels,
                opened,
                disabled,
              })
            : renderDefaultTrigger({
                selectedLabels: resolvedSelectedLabels,
                hasSelectedLabels,
                opened,
                disabled,
                triggerLabel,
                emptyStateLabel,
              })}
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown className={styles.dropdownPanel} data-task-label-dropdown="true">
        <div className={styles.dropdownBody}>
          <TextInput
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              if (createError) {
                setCreateError(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canCreate && !disabled) {
                event.preventDefault();
                void handleCreateLabel();
              }
            }}
            placeholder={searchPlaceholder}
            aria-label={`${triggerLabel} search`}
          />

          <div className={styles.optionList}>
            {filteredLabelOptions.map((label) => {
              const isSelected = selectedLabelIds.includes(label.id);
              const swatchColor = resolveTaskLabelSwatchColor(label.color);

              return (
                <UnstyledButton
                  key={label.id}
                  type="button"
                  className={styles.optionButton}
                  data-selected={isSelected ? 'true' : undefined}
                  data-task-label-option="true"
                  disabled={disabled}
                  style={{ '--task-label-accent': swatchColor } as CSSProperties}
                  onClick={() => toggleLabel(label.id)}
                >
                  <span className={styles.optionContent}>
                    <ColorSwatch color={swatchColor} size={14} />
                    <span className={styles.optionLabel}>{label.name}</span>
                  </span>
                  {isSelected ? <IconCheck size={14} className={styles.optionCheck} /> : null}
                </UnstyledButton>
              );
            })}

            {filteredLabelOptions.length === 0 ? (
              <Text size="sm" c="dimmed" className={styles.emptyState}>
                No matching labels.
              </Text>
            ) : null}
          </div>

          {canCreate ? (
            <div className={styles.createControls}>
              <TaskLabelColorPicker
                value={createColor}
                onChange={setCreateColor}
                label="New label color"
                ariaLabel="New label color"
                showLabel={false}
                usedColors={localLabelOptions.map((label) => label.color ?? '')}
              />
              <Button
                type="button"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  void handleCreateLabel();
                }}
                loading={isCreating}
                disabled={disabled || isCreating}
              >
                {`Add "${search.trim()}"`}
              </Button>
            </div>
          ) : null}

          {createError ? (
            <Text size="sm" c="red">
              {createError}
            </Text>
          ) : null}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
