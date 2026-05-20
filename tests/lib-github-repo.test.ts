import { describe, expect, it } from 'vitest';

import {
  githubRepoIdToUrl,
  githubRepoReferenceVariants,
  normalizeGithubRepoIdInput,
  normalizeGithubRepoReference,
} from '@/lib/github-repo';
import { githubRepoIdSchema, optionalGithubRepoIdSchema } from '@/lib/github-repo-schema';

describe('github repo helpers', () => {
  it('accepts canonical owner/repo input', () => {
    expect(normalizeGithubRepoIdInput(' sonim1/preqstation-landingpage ')).toBe(
      'sonim1/preqstation-landingpage',
    );
  });

  it('rejects URL and SSH input for new writes', () => {
    expect(normalizeGithubRepoIdInput('https://github.com/sonim1/preqstation')).toBeNull();
    expect(normalizeGithubRepoIdInput('git@github.com:sonim1/preqstation.git')).toBeNull();
  });

  it('normalizes legacy GitHub references for read compatibility', () => {
    expect(normalizeGithubRepoReference('https://github.com/sonim1/preqstation.git')).toBe(
      'sonim1/preqstation',
    );
    expect(normalizeGithubRepoReference('git@github.com:sonim1/preqstation.git/')).toBe(
      'sonim1/preqstation',
    );
    expect(normalizeGithubRepoReference('ssh://git@github.com/sonim1/preqstation.git')).toBe(
      'sonim1/preqstation',
    );
  });

  it('builds legacy repo reference variants for lookup compatibility', () => {
    expect(githubRepoReferenceVariants('sonim1/preqstation')).toEqual(
      expect.arrayContaining([
        'sonim1/preqstation',
        'https://github.com/sonim1/preqstation/',
        'git@github.com:sonim1/preqstation.git/',
        'ssh://git@github.com/sonim1/preqstation.git/',
      ]),
    );
  });

  it('builds a public GitHub browser URL from a repo id', () => {
    expect(githubRepoIdToUrl('sonim1/preqstation')).toBe('https://github.com/sonim1/preqstation');
  });

  it('normalizes GitHub reference variants in the shared repo schemas', () => {
    expect(githubRepoIdSchema.parse('https://github.com/sonim1/preqstation.git')).toBe(
      'sonim1/preqstation',
    );
    expect(githubRepoIdSchema.parse('git@github.com:sonim1/preqstation.git')).toBe(
      'sonim1/preqstation',
    );
    expect(optionalGithubRepoIdSchema.parse('')).toBe('');
    expect(optionalGithubRepoIdSchema.parse('ssh://git@github.com/sonim1/preqstation.git')).toBe(
      'sonim1/preqstation',
    );
  });
});
