import { describe, expect, it } from 'vitest';

import {
  githubRepoIdToUrl,
  normalizeGithubRepoIdInput,
  normalizeGithubRepoReference,
} from '@/lib/github-repo';

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
    expect(normalizeGithubRepoReference('ssh://git@github.com/sonim1/preqstation.git')).toBe(
      'sonim1/preqstation',
    );
  });

  it('builds a public GitHub browser URL from a repo id', () => {
    expect(githubRepoIdToUrl('sonim1/preqstation')).toBe('https://github.com/sonim1/preqstation');
  });
});
