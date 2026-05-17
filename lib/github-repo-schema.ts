import { z } from 'zod';

import { normalizeGithubRepoIdInput } from '@/lib/github-repo';

export const githubRepoIdSchema = z
  .string()
  .trim()
  .refine((value) => normalizeGithubRepoIdInput(value) !== null, {
    message: 'GitHub repo must use owner/repo format.',
  })
  .transform((value) => normalizeGithubRepoIdInput(value) || value);

export const optionalGithubRepoIdSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || normalizeGithubRepoIdInput(value) !== null, {
    message: 'GitHub repo must use owner/repo format.',
  })
  .transform((value) => (value === '' ? '' : normalizeGithubRepoIdInput(value) || value));
