const OWNER_RE = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/iu;
const REPO_RE = /^[a-z0-9._-]{1,100}$/iu;

function normalizeParts(owner: string, repo: string) {
  const nextOwner = owner.trim();
  const nextRepo = repo.trim().replace(/\.git$/iu, '');
  if (!OWNER_RE.test(nextOwner) || !REPO_RE.test(nextRepo)) return null;
  return `${nextOwner}/${nextRepo}`;
}

export function normalizeGithubRepoIdInput(value: string | null | undefined) {
  const input = (value || '').trim();
  if (!input || input.includes('://') || input.startsWith('git@')) return null;
  const parts = input.split('/');
  if (parts.length !== 2) return null;
  return normalizeParts(parts[0] || '', parts[1] || '');
}

export function normalizeGithubRepoReference(value: string | null | undefined) {
  const input = (value || '').trim();
  if (!input) return null;

  const direct = normalizeGithubRepoIdInput(input);
  if (direct) return direct;

  const httpsMatch = input.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:[/?#].*)?$/iu);
  if (httpsMatch) return normalizeParts(httpsMatch[1] || '', httpsMatch[2] || '');

  const sshMatch = input.match(/^(?:ssh:\/\/)?git@github\.com[:/]([^/]+)\/([^/#?]+?)(?:\/)?$/iu);
  if (sshMatch) return normalizeParts(sshMatch[1] || '', sshMatch[2] || '');

  return null;
}

export function githubRepoReferenceVariants(value: string | null | undefined) {
  const repoId = normalizeGithubRepoReference(value);
  if (!repoId) return [];

  const githubUrl = `https://github.com/${repoId}`;
  return Array.from(
    new Set([
      repoId,
      githubUrl,
      `${githubUrl}/`,
      `${githubUrl}.git`,
      `${githubUrl}.git/`,
      `git@github.com:${repoId}`,
      `git@github.com:${repoId}/`,
      `git@github.com:${repoId}.git`,
      `git@github.com:${repoId}.git/`,
      `ssh://git@github.com/${repoId}`,
      `ssh://git@github.com/${repoId}/`,
      `ssh://git@github.com/${repoId}.git`,
      `ssh://git@github.com/${repoId}.git/`,
    ]),
  );
}

export function githubRepoIdToUrl(value: string | null | undefined) {
  const repoId = normalizeGithubRepoReference(value);
  return repoId ? `https://github.com/${repoId}` : null;
}
