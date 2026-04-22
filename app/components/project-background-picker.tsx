'use client';

import { Alert, Anchor, Group, Loader, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';

import type { OpenversePickerPhoto } from '@/lib/openverse';
import {
  getProjectCardBgUrl,
  parseProjectBackgroundCredit,
  PROJECT_BG_PRESETS,
  type ProjectBackgroundCredit,
} from '@/lib/project-backgrounds';

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'empty' }
  | { status: 'error'; message: string };

type ProjectBackgroundPickerProps = {
  name: string;
  value?: string | null;
  credit?: ProjectBackgroundCredit | null;
  onValueChange?: (value: string) => void;
};

const OPENVERSE_ATTRIBUTION_URL = 'https://openverse.org';
const UNSPLASH_ATTRIBUTION_URL = 'https://unsplash.com/?utm_source=PREQSTATION&utm_medium=referral';
const SEARCH_DEBOUNCE_MS = 400;

function isPresetValue(value: string) {
  return PROJECT_BG_PRESETS.some((preset) => preset.id === value);
}

function formatCreditContributor(credit: ProjectBackgroundCredit) {
  if (credit.provider === 'openverse') {
    return `${credit.creatorName} · ${credit.license}`;
  }

  return `Image by: ${credit.creatorName}`;
}

export function ProjectBackgroundPicker({
  name,
  value,
  credit,
  onValueChange,
}: ProjectBackgroundPickerProps) {
  const [selectedValue, setSelectedValue] = useState(() => value ?? '');
  const [selectedCredit, setSelectedCredit] = useState<ProjectBackgroundCredit | null>(
    () => credit ?? null,
  );
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<OpenversePickerPhoto[]>([]);
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectingPhotoId, setSelectingPhotoId] = useState<string | null>(null);
  const creditInputName = `${name}Credit`;

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setPhotos([]);
      setSearchState({ status: 'idle' });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchState({ status: 'loading' });

      try {
        const response = await fetch(
          `/api/project-backgrounds/search?q=${encodeURIComponent(trimmedQuery)}`,
          {
            signal: controller.signal,
          },
        );
        const body = (await response.json().catch(() => null)) as {
          photos?: OpenversePickerPhoto[];
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(body?.error || 'Failed to search Openverse.');
        }

        if (cancelled) return;

        const nextPhotos = body?.photos ?? [];
        setPhotos(nextPhotos);
        setSearchState({ status: nextPhotos.length > 0 ? 'ready' : 'empty' });
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;

        setPhotos([]);
        setSearchState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to search Openverse.',
        });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const customPreviewUrl =
    selectedValue && !isPresetValue(selectedValue) ? getProjectCardBgUrl(selectedValue) : null;

  function commitValue(nextValue: string, nextCredit: ProjectBackgroundCredit | null) {
    setSelectionError(null);
    setSelectedValue(nextValue);
    setSelectedCredit(nextCredit);
    onValueChange?.(nextValue);
  }

  async function handleOpenverseSelect(photo: OpenversePickerPhoto) {
    if (selectingPhotoId) return;

    setSelectionError(null);
    setSelectingPhotoId(photo.id);

    try {
      const response = await fetch('/api/project-backgrounds/select', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          regularUrl: photo.regularUrl,
          credit: photo.credit,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        bgImage?: string;
        bgImageCredit?: ProjectBackgroundCredit;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to save background selection.');
      }

      const parsedCredit = parseProjectBackgroundCredit(body?.bgImageCredit);
      if (!body?.bgImage || !parsedCredit.ok) {
        throw new Error('Failed to save background selection.');
      }

      commitValue(body.bgImage, parsedCredit.value);
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : 'Failed to save background selection.',
      );
    } finally {
      setSelectingPhotoId(null);
    }
  }

  return (
    <Stack gap="sm" className="project-bg-picker">
      <input type="hidden" name={name} value={selectedValue} readOnly />
      <input
        type="hidden"
        name={creditInputName}
        value={selectedCredit ? JSON.stringify(selectedCredit) : ''}
        readOnly
      />

      <SimpleGrid cols={{ base: 3, sm: 5 }} spacing="xs">
        <button
          type="button"
          className={`project-bg-option${selectedValue === '' ? ' is-selected' : ''}`}
          aria-pressed={selectedValue === ''}
          onClick={() => commitValue('', null)}
        >
          <span className="project-bg-option-preview project-bg-option-preview-none">
            <Text size="xs" c="dimmed">
              None
            </Text>
          </span>
        </button>

        {PROJECT_BG_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`project-bg-option${selectedValue === preset.id ? ' is-selected' : ''}`}
            aria-pressed={selectedValue === preset.id}
            onClick={() => commitValue(preset.id, null)}
          >
            <span
              className="project-bg-option-preview"
              style={{
                backgroundImage: `url(${preset.url})`,
              }}
            />
            <span className="project-bg-option-label">{preset.label}</span>
            <span className="project-bg-option-meta">{formatCreditContributor(preset.credit)}</span>
          </button>
        ))}
      </SimpleGrid>

      {customPreviewUrl ? (
        <button
          type="button"
          className="project-bg-option is-selected project-bg-custom-selection"
          aria-pressed={true}
          onClick={() => commitValue(selectedValue, selectedCredit)}
        >
          <span
            className="project-bg-option-preview"
            style={{
              backgroundImage: `url(${customPreviewUrl})`,
            }}
          />
          <span className="project-bg-option-label">Current custom selection</span>
          {selectedCredit ? (
            <span className="project-bg-option-meta">
              {formatCreditContributor(selectedCredit)}
            </span>
          ) : null}
        </button>
      ) : null}

      <Stack gap={6}>
        <TextInput
          label="Search Openverse"
          placeholder="Forest trail, ocean cliffs, city skyline"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          description="Searches Openverse photographs with CC0 and CC BY licensing."
        />

        <div aria-live="polite">
          {searchState.status === 'loading' ? (
            <Group gap="xs">
              <Loader size="xs" />
              <Text size="sm" c="dimmed">
                Searching Openverse...
              </Text>
            </Group>
          ) : null}

          {searchState.status === 'empty' ? (
            <Text size="sm" c="dimmed">
              No Openverse photos found for “{query.trim()}”.
            </Text>
          ) : null}

          {searchState.status === 'error' ? (
            <Alert color="red" variant="light">
              {searchState.message}
            </Alert>
          ) : null}

          {selectionError ? (
            <Alert color="red" variant="light" mt={searchState.status === 'error' ? 'xs' : 0}>
              {selectionError}
            </Alert>
          ) : null}
        </div>
      </Stack>

      {photos.length > 0 ? (
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="xs">
          {photos.map((photo) => {
            const isSelected = selectedValue === photo.regularUrl;
            const isLoading = selectingPhotoId === photo.id;

            return (
              <button
                key={photo.id}
                type="button"
                className={`project-bg-option${isSelected ? ' is-selected' : ''}${isLoading ? ' is-loading' : ''}`}
                aria-pressed={isSelected}
                onClick={() => void handleOpenverseSelect(photo)}
                disabled={Boolean(selectingPhotoId)}
              >
                <span
                  className="project-bg-option-preview"
                  style={{
                    backgroundImage: `url(${photo.thumbUrl})`,
                  }}
                />
                <span className="project-bg-option-label">
                  {isLoading ? 'Saving...' : photo.alt}
                </span>
                <span className="project-bg-option-meta">
                  {formatCreditContributor(photo.credit)}
                </span>
              </button>
            );
          })}
        </SimpleGrid>
      ) : null}

      <Group gap="md">
        <Text size="xs" c="dimmed">
          <Anchor href={UNSPLASH_ATTRIBUTION_URL} target="_blank" rel="noreferrer">
            Preset photos from Unsplash
          </Anchor>
        </Text>
        <Text size="xs" c="dimmed">
          <Anchor href={OPENVERSE_ATTRIBUTION_URL} target="_blank" rel="noreferrer">
            Search results from Openverse
          </Anchor>
        </Text>
      </Group>
    </Stack>
  );
}
