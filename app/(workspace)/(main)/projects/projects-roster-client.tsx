'use client';

import { Button, SimpleGrid, TextInput } from '@mantine/core';
import { IconFolderPlus, IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/app/components/empty-state';
import { LinkButton } from '@/app/components/link-button';

import { ProjectPortfolioCard, type ProjectPortfolioCardSummary } from './project-portfolio-card';
import {
  filterProjectCards,
  type ProjectFilterChip,
  type ProjectFilterStatus,
} from './project-roster-filter';
import styles from './projects-page.module.css';

type ProjectsRosterClientProps = {
  allCards: ProjectPortfolioCardSummary[];
  deleteProjectAction: (formData: FormData) => Promise<void>;
  filterChips: ProjectFilterChip[];
  initialState: {
    activeAgentCount: number;
    searchQuery: string;
    selectedProjectFilter: ProjectFilterStatus;
    terminologyTaskPluralLower: string;
  };
  pauseProjectAction: (formData: FormData) => Promise<void>;
};

function syncProjectsUrl(searchQuery: string, selectedFilter: ProjectFilterStatus) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const trimmedQuery = searchQuery.trim();
  if (trimmedQuery) {
    url.searchParams.set('q', trimmedQuery);
  } else {
    url.searchParams.delete('q');
  }

  if (selectedFilter === 'all') {
    url.searchParams.delete('status');
  } else {
    url.searchParams.set('status', selectedFilter);
  }

  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function ProjectsRosterClient({
  allCards,
  deleteProjectAction,
  filterChips,
  initialState,
  pauseProjectAction,
}: ProjectsRosterClientProps) {
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState(
    initialState.selectedProjectFilter,
  );
  const filteredCards = useMemo(
    () => filterProjectCards(allCards, selectedProjectFilter, searchQuery),
    [allCards, searchQuery, selectedProjectFilter],
  );

  const updateSearchQuery = (nextSearchQuery: string) => {
    setSearchQuery(nextSearchQuery);
    syncProjectsUrl(nextSearchQuery, selectedProjectFilter);
  };

  const updateSelectedFilter = (nextFilter: ProjectFilterStatus) => {
    setSelectedProjectFilter(nextFilter);
    syncProjectsUrl(searchQuery, nextFilter);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedProjectFilter('all');
    syncProjectsUrl('', 'all');
  };

  return (
    <>
      <div className={styles.toolbar} data-project-filter-mode="client">
        <TextInput
          aria-label="Find a project"
          className={styles.searchInput}
          leftSection={<IconSearch size={14} />}
          onChange={(event) => updateSearchQuery(event.currentTarget.value)}
          placeholder="Find a project"
          size="xs"
          value={searchQuery}
          variant="filled"
        />
        <div className={styles.filterChips} aria-label="Project filters">
          {filterChips.map((chip) => {
            const active = chip.filter === selectedProjectFilter;
            return (
              <button
                key={chip.label}
                aria-pressed={active}
                className={styles.filterChip}
                data-active={active}
                onClick={() => updateSelectedFilter(chip.filter)}
                type="button"
                value={chip.filter}
              >
                {chip.label} {chip.value}
              </button>
            );
          })}
        </div>
        <span className={styles.agentStatus} data-active={initialState.activeAgentCount > 0}>
          {initialState.activeAgentCount} agents running
        </span>
      </div>

      {allCards.length === 0 ? (
        <EmptyState
          icon={<IconFolderPlus size={24} />}
          title="No projects yet"
          description={`Create your first project to start tracking ${initialState.terminologyTaskPluralLower} and progress.`}
          action={<LinkButton href="/dashboard?panel=project">Create Project</LinkButton>}
        />
      ) : filteredCards.length === 0 ? (
        <EmptyState
          icon={<IconSearch size={24} />}
          title="No matching projects"
          description="Adjust the search or project filter to see more repos."
          action={
            <Button onClick={clearFilters} size="xs" type="button" variant="default">
              Clear filters
            </Button>
          }
        />
      ) : (
        <section className={styles.portfolioSection} data-project-section="roster">
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm" className={styles.rosterGrid}>
            {filteredCards.map((card) => (
              <ProjectPortfolioCard
                key={card.id}
                card={card}
                deleteAction={deleteProjectAction}
                pauseAction={pauseProjectAction}
              />
            ))}
          </SimpleGrid>
        </section>
      )}
    </>
  );
}
