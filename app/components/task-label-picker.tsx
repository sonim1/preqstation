'use client';

import {
  Button,
  ColorSwatch,
  Group,
  Popover,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck, IconChevronDown, IconPlus } from '@tabler/icons-react';
import {
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
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        width: '100%',
        padding: '0.625rem 0.875rem',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: '0.5rem',
        opacity: disabled ? 0.6 : 1,
      }}
      data-opened={opened ? 'true' : undefined}
    >
      <span>
        {hasSelectedLabels ? selectedLabels.map((label) => label.name).join(', ') : emptyStateLabel}
      </span>
      <Group gap={6} wrap="nowrap">
        {!hasSelectedLabels ? (
          <Text component="span" size="xs" c="dimmed">
            {triggerLabel}
          </Text>
        ) : null}
        <IconChevronDown size={14} />
      </Group>
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

  const toggleLabel = (labelId: string) => {
    const nextLabelIds = selectedLabelIds.includes(labelId)
      ? selectedLabelIds.filter((currentLabelId) => currentLabelId !== labelId)
      : [...selectedLabelIds, labelId];

    onChange(nextLabelIds);
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
      onChange(nextLabelIds);
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
          onClick={onTriggerClick}
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

      <Popover.Dropdown>
        <Stack gap="sm" miw={280}>
          <TextInput
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              if (createError) {
                setCreateError(null);
              }
            }}
            placeholder={searchPlaceholder}
            aria-label={`${triggerLabel} search`}
          />

          <Stack gap={4} mah={300} style={{ overflowY: 'auto' }}>
            {filteredLabelOptions.map((label) => {
              const isSelected = selectedLabelIds.includes(label.id);

              return (
                <Button
                  key={label.id}
                  type="button"
                  variant={isSelected ? 'light' : 'subtle'}
                  color="gray"
                  justify="space-between"
                  disabled={disabled}
                  leftSection={
                    <Group gap={8} wrap="nowrap">
                      <ColorSwatch color={resolveTaskLabelSwatchColor(label.color)} size={14} />
                      <Text component="span" size="sm">
                        {label.name}
                      </Text>
                    </Group>
                  }
                  rightSection={isSelected ? <IconCheck size={14} /> : null}
                  onClick={() => toggleLabel(label.id)}
                >
                  <span />
                </Button>
              );
            })}

            {filteredLabelOptions.length === 0 ? (
              <Text size="sm" c="dimmed">
                No matching labels.
              </Text>
            ) : null}
          </Stack>

          {canCreate ? (
            <Stack gap="xs">
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
            </Stack>
          ) : null}

          {createError ? (
            <Text size="sm" c="red">
              {createError}
            </Text>
          ) : null}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
