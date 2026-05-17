import type { ProjectPortfolioCardSummary } from './project-portfolio-card';

export type ProjectFilterStatus = 'all' | 'active' | 'paused' | 'archived';

export type ProjectFilterChip = {
  label: string;
  value: number;
  filter: ProjectFilterStatus;
  active?: boolean;
};

export function getProjectFilterStatus(value: string): ProjectFilterStatus {
  switch (value.toLowerCase()) {
    case 'active':
    case 'paused':
    case 'archived':
      return value.toLowerCase() as ProjectFilterStatus;
    default:
      return 'all';
  }
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function compactSearchValue(value: string) {
  return normalizeSearchValue(value).replace(/[^a-z0-9]+/g, '');
}

function getSearchTokens(value: string) {
  return normalizeSearchValue(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isSubsequence(needle: string, haystack: string) {
  if (!needle) return true;
  if (needle.length < 3) return false;

  for (let start = 0; start < haystack.length; start += 1) {
    if (haystack[start] !== needle[0]) continue;

    let haystackIndex = start;
    let matched = true;
    for (let needleIndex = 1; needleIndex < needle.length; needleIndex += 1) {
      let nextIndex = -1;
      const searchEnd = Math.min(haystack.length - 1, haystackIndex + 4);
      for (let candidate = haystackIndex + 1; candidate <= searchEnd; candidate += 1) {
        if (haystack[candidate] === needle[needleIndex]) {
          nextIndex = candidate;
          break;
        }
      }

      if (nextIndex === -1) {
        matched = false;
        break;
      }

      haystackIndex = nextIndex;
    }

    if (matched) return true;
  }

  return false;
}

function matchesSearchToken(searchText: string, token: string) {
  const normalizedText = normalizeSearchValue(searchText);
  if (normalizedText.includes(token)) return true;

  const compactText = compactSearchValue(searchText);
  const compactToken = compactSearchValue(token);
  return compactText.includes(compactToken) || isSubsequence(compactToken, compactText);
}

function matchesFilter(card: ProjectPortfolioCardSummary, selectedFilter: ProjectFilterStatus) {
  if (selectedFilter === 'all') return true;
  if (selectedFilter === 'active') return !card.isPaused && !card.isArchived;
  if (selectedFilter === 'paused') return card.isPaused;
  return card.isArchived;
}

export function filterProjectCards(
  cards: ProjectPortfolioCardSummary[],
  selectedFilter: ProjectFilterStatus,
  searchQuery: string,
) {
  const searchTokens = getSearchTokens(searchQuery.trim());

  return cards.filter((card) => {
    if (!matchesFilter(card, selectedFilter)) return false;
    if (searchTokens.length === 0) return true;

    const searchableValues = [
      card.name,
      card.projectKey,
      card.description,
      card.repoLabel,
      card.repoUrl ?? '',
      card.vercelUrl ?? '',
    ];

    return searchTokens.every((token) =>
      searchableValues.some((value) => matchesSearchToken(value, token)),
    );
  });
}
