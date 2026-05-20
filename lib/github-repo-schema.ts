import { z } from 'zod';

import { normalizeGithubRepoReference } from '@/lib/github-repo';

export const githubRepoIdSchema = z
  .string()
  .trim()
  .transform((value) => normalizeGithubRepoReference(value))
  .refine((value): value is string => value !== null, {
    message: 'GitHub repo must use owner/repo format.',
  });

export const optionalGithubRepoIdSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? '' : normalizeGithubRepoReference(value)))
  .refine((value): value is string => value !== null, {
    message: 'GitHub repo must use owner/repo format.',
  });
