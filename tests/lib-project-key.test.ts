import { and, eq } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { projects } from '@/lib/db/schema';
import {
  assertValidProjectKeyInput,
  inferDefaultProjectKeyFromName,
  isProjectKeyTaken,
  isProjectKeyUniqueConstraintError,
  isValidProjectKey,
  normalizeProjectKey,
  ProjectKeyConflictError,
  ProjectKeyValidationError,
  resolveUniqueProjectKey,
} from '@/lib/project-key';

const dialect = new PgDialect();

function sqlSnapshot(value: Parameters<PgDialect['sqlToQuery']>[0]) {
  const { sql, params } = dialect.sqlToQuery(value);
  return { sql, params };
}

// ---------------------------------------------------------------------------
// Error Classes
// ---------------------------------------------------------------------------
describe('ProjectKeyValidationError', () => {
  it('is an instance of Error with correct name', () => {
    const err = new ProjectKeyValidationError('bad key');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ProjectKeyValidationError');
    expect(err.message).toBe('bad key');
  });
});

describe('ProjectKeyConflictError', () => {
  it('is an instance of Error with correct name', () => {
    const err = new ProjectKeyConflictError('conflict');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ProjectKeyConflictError');
    expect(err.message).toBe('conflict');
  });
});

// ---------------------------------------------------------------------------
// normalizeProjectKey
// ---------------------------------------------------------------------------
describe('normalizeProjectKey', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeProjectKey('proj')).toBe('PROJ');
  });

  it('trims and strips spaces', () => {
    expect(normalizeProjectKey('  ab cd  ')).toBe('ABCD');
  });

  it('strips non-alphanumeric and truncates to 4', () => {
    expect(normalizeProjectKey('hello-world!')).toBe('HELL');
  });

  it('returns empty for empty string', () => {
    expect(normalizeProjectKey('')).toBe('');
  });

  it('returns empty for null', () => {
    expect(normalizeProjectKey(null)).toBe('');
  });

  it('returns empty for undefined', () => {
    expect(normalizeProjectKey(undefined)).toBe('');
  });

  it('preserves short keys', () => {
    expect(normalizeProjectKey('AB')).toBe('AB');
  });

  it('truncates to 4 chars', () => {
    expect(normalizeProjectKey('ABCDE')).toBe('ABCD');
  });

  it('handles mixed alphanumeric', () => {
    expect(normalizeProjectKey('a1b2c3')).toBe('A1B2');
  });
});

// ---------------------------------------------------------------------------
// isValidProjectKey
// ---------------------------------------------------------------------------
describe('isValidProjectKey', () => {
  it('accepts 4 uppercase letters', () => {
    expect(isValidProjectKey('PROJ')).toBe(true);
  });

  it('accepts 3 chars', () => {
    expect(isValidProjectKey('ABC')).toBe(true);
  });

  it('rejects 2 chars (too short)', () => {
    expect(isValidProjectKey('AB')).toBe(false);
  });

  it('rejects 5 chars (too long)', () => {
    expect(isValidProjectKey('ABCDE')).toBe(false);
  });

  it('auto-uppercases lowercase input', () => {
    expect(isValidProjectKey('ab12')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidProjectKey('')).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidProjectKey(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidProjectKey(undefined)).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidProjectKey('AB-C')).toBe(false);
  });

  it('accepts digits', () => {
    expect(isValidProjectKey('A1B2')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// inferDefaultProjectKeyFromName
// ---------------------------------------------------------------------------
describe('inferDefaultProjectKeyFromName', () => {
  it('strips space and takes first 4 chars', () => {
    expect(inferDefaultProjectKeyFromName('My Project')).toBe('MYPR');
  });

  it('falls back to PROJ for empty string', () => {
    expect(inferDefaultProjectKeyFromName('')).toBe('PROJ');
  });

  it('falls back to PROJ for null', () => {
    expect(inferDefaultProjectKeyFromName(null)).toBe('PROJ');
  });

  it('falls back to PROJ for undefined', () => {
    expect(inferDefaultProjectKeyFromName(undefined)).toBe('PROJ');
  });

  it('pads short names with X', () => {
    expect(inferDefaultProjectKeyFromName('AB')).toBe('ABXX');
  });

  it('sanitizes special chars', () => {
    expect(inferDefaultProjectKeyFromName('hello-world!')).toBe('HELL');
  });

  it('preserves digits', () => {
    expect(inferDefaultProjectKeyFromName('1234567890')).toBe('1234');
  });
});

// ---------------------------------------------------------------------------
// assertValidProjectKeyInput
// ---------------------------------------------------------------------------
describe('assertValidProjectKeyInput', () => {
  it('returns normalized valid key', () => {
    expect(assertValidProjectKeyInput('PROJ')).toBe('PROJ');
  });

  it('normalizes and validates lowercase', () => {
    expect(assertValidProjectKeyInput('proj')).toBe('PROJ');
  });

  it('throws for 2-char input', () => {
    expect(() => assertValidProjectKeyInput('AB')).toThrow(ProjectKeyValidationError);
  });

  it('throws for empty string', () => {
    expect(() => assertValidProjectKeyInput('')).toThrow(ProjectKeyValidationError);
  });

  it('throws for null', () => {
    expect(() => assertValidProjectKeyInput(null)).toThrow(ProjectKeyValidationError);
  });

  it('throws for input that normalizes too short', () => {
    // "A!B" normalizes to "AB" which is only 2 chars
    expect(() => assertValidProjectKeyInput('A!B')).toThrow(ProjectKeyValidationError);
  });
});

// ---------------------------------------------------------------------------
// isProjectKeyTaken (async, mock DB)
// ---------------------------------------------------------------------------
describe('isProjectKeyTaken', () => {
  const mockDb = {
    query: {
      projects: { findFirst: vi.fn() },
    },
  };

  it('returns true when record exists', async () => {
    mockDb.query.projects.findFirst.mockResolvedValueOnce({ id: '123' });
    const result = await isProjectKeyTaken('owner1', 'PROJ', mockDb as never);
    expect(result).toBe(true);
  });

  it('returns false when no record exists', async () => {
    mockDb.query.projects.findFirst.mockResolvedValueOnce(null);
    const result = await isProjectKeyTaken('owner1', 'PROJ', mockDb as never);
    expect(result).toBe(false);
  });

  it('passes correct where clause', async () => {
    mockDb.query.projects.findFirst.mockResolvedValueOnce(null);
    await isProjectKeyTaken('owner-abc', 'TEST', mockDb as never);
    const call = mockDb.query.projects.findFirst.mock.calls[0]?.[0];
    expect(call.columns).toEqual({ id: true });
    expect(sqlSnapshot(call.where)).toEqual(
      sqlSnapshot(and(eq(projects.ownerId, 'owner-abc'), eq(projects.projectKey, 'TEST'))!),
    );
  });
});

// ---------------------------------------------------------------------------
// resolveUniqueProjectKey (async, mock DB)
// ---------------------------------------------------------------------------
describe('resolveUniqueProjectKey', () => {
  const mockDb = {
    query: {
      projects: { findFirst: vi.fn() },
    },
  };

  afterEach(() => {
    mockDb.query.projects.findFirst.mockReset();
  });

  it('returns preferred key when not taken', async () => {
    mockDb.query.projects.findFirst.mockResolvedValue(null);
    const result = await resolveUniqueProjectKey('owner1', 'PROJ', mockDb as never);
    expect(result).toBe('PROJ');
  });

  it('returns stem+suffix when preferred is taken', async () => {
    // First call: "PROJ" is taken. Second call: "PRO0" is available.
    mockDb.query.projects.findFirst
      .mockResolvedValueOnce({ id: 'existing' }) // PROJ taken
      .mockResolvedValueOnce(null); // PRO0 available
    const result = await resolveUniqueProjectKey('owner1', 'PROJ', mockDb as never);
    expect(result).toBe('PRO0');
  });

  it('skips taken suffixes and finds first available', async () => {
    // PROJ taken, PRO0 taken, PRO1 taken, PRO2 available
    mockDb.query.projects.findFirst
      .mockResolvedValueOnce({ id: '1' }) // PROJ
      .mockResolvedValueOnce({ id: '2' }) // PRO0
      .mockResolvedValueOnce({ id: '3' }) // PRO1
      .mockResolvedValueOnce(null); // PRO2
    const result = await resolveUniqueProjectKey('owner1', 'PROJ', mockDb as never);
    expect(result).toBe('PRO2');
  });

  it('throws ProjectKeyConflictError when all suffixes exhausted', async () => {
    // Preferred + all 36 suffixes are taken
    mockDb.query.projects.findFirst.mockResolvedValue({ id: 'taken' });
    await expect(resolveUniqueProjectKey('owner1', 'PROJ', mockDb as never)).rejects.toThrow(
      ProjectKeyConflictError,
    );
  });

  it('throws ProjectKeyValidationError for invalid input', async () => {
    await expect(resolveUniqueProjectKey('owner1', 'AB', mockDb as never)).rejects.toThrow(
      ProjectKeyValidationError,
    );
  });
});

// ---------------------------------------------------------------------------
// isProjectKeyUniqueConstraintError
// ---------------------------------------------------------------------------
describe('isProjectKeyUniqueConstraintError', () => {
  it('returns true for a project key unique index message', () => {
    const err = new Error(
      'duplicate key value violates unique constraint "projects_owner_id_project_key_idx"',
    );
    expect(isProjectKeyUniqueConstraintError(err)).toBe(true);
  });

  it('returns true for a duplicate detail mentioning project_key', () => {
    const err = new Error(
      'duplicate key value violates unique constraint "projects_owner_id_project_key_idx". Detail: Key (owner_id, project_key)=(owner1, PROJ) already exists.',
    );
    expect(isProjectKeyUniqueConstraintError(err)).toBe(true);
  });

  it('returns false for a duplicate key error on a different target', () => {
    const err = new Error('duplicate key value violates unique constraint "users_email_key"');
    expect(isProjectKeyUniqueConstraintError(err)).toBe(false);
  });

  it('returns false for a non-unique error that happens to mention project_key', () => {
    const err = new Error('request timed out while updating project_key');
    expect(isProjectKeyUniqueConstraintError(err)).toBe(false);
  });

  it('returns false for plain Error', () => {
    expect(isProjectKeyUniqueConstraintError(new Error('oops'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isProjectKeyUniqueConstraintError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isProjectKeyUniqueConstraintError(undefined)).toBe(false);
  });
});
