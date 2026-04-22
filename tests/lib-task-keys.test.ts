import { and, desc, eq } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { tasks } from '@/lib/db/schema';
import {
  isTaskKeyUniqueConstraintError,
  isUuidIdentifier,
  normalizeTaskIdentifier,
  normalizeTaskPrefix,
  parseTaskKey,
  resolveNextTaskKey,
  TaskKeyValidationError,
  taskWhereByIdentifier,
} from '@/lib/task-keys';

const dialect = new PgDialect();

function sqlSnapshot(value: Parameters<PgDialect['sqlToQuery']>[0]) {
  const { sql, params } = dialect.sqlToQuery(value);
  return { sql, params };
}

// ---------------------------------------------------------------------------
// TaskKeyValidationError
// ---------------------------------------------------------------------------
describe('TaskKeyValidationError', () => {
  it('is an instance of Error with correct name', () => {
    const err = new TaskKeyValidationError('bad key');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('TaskKeyValidationError');
    expect(err.message).toBe('bad key');
  });
});

// ---------------------------------------------------------------------------
// normalizeTaskPrefix
// ---------------------------------------------------------------------------
describe('normalizeTaskPrefix', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeTaskPrefix('proj')).toBe('PROJ');
  });

  it('removes special characters', () => {
    expect(normalizeTaskPrefix('my-task!')).toBe('MYTASK');
  });

  it('truncates to 10 chars', () => {
    expect(normalizeTaskPrefix('ABCDEFGHIJKLMNO')).toBe('ABCDEFGHIJ');
  });

  it('returns fallback when input is empty string', () => {
    expect(normalizeTaskPrefix('')).toBe('TASK');
  });

  it('returns fallback when input is null', () => {
    expect(normalizeTaskPrefix(null)).toBe('TASK');
  });

  it('returns fallback when input is undefined', () => {
    expect(normalizeTaskPrefix(undefined)).toBe('TASK');
  });

  it('returns custom fallback when input normalizes to empty', () => {
    expect(normalizeTaskPrefix('---', 'MYDEF')).toBe('MYDEF');
  });

  it('returns TASK when both input and fallback normalize to empty', () => {
    expect(normalizeTaskPrefix('---', '---')).toBe('TASK');
  });

  it('preserves digits', () => {
    expect(normalizeTaskPrefix('a1b2')).toBe('A1B2');
  });

  it('handles exactly 10 chars', () => {
    expect(normalizeTaskPrefix('ABCDEFGHIJ')).toBe('ABCDEFGHIJ');
  });
});

// ---------------------------------------------------------------------------
// parseTaskKey
// ---------------------------------------------------------------------------
describe('parseTaskKey', () => {
  it('parses valid key PROJ-12', () => {
    const result = parseTaskKey('PROJ-12');
    expect(result).not.toBeNull();
    expect(result?.taskPrefix).toBe('PROJ');
    expect(result?.taskNumber).toBe(12);
    expect(result?.taskKey).toBe('PROJ-12');
  });

  it('parses lowercase and normalizes', () => {
    const result = parseTaskKey('proj-5');
    expect(result).not.toBeNull();
    expect(result?.taskPrefix).toBe('PROJ');
    expect(result?.taskNumber).toBe(5);
    expect(result?.taskKey).toBe('PROJ-5');
  });

  it('returns null for empty string', () => {
    expect(parseTaskKey('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(parseTaskKey(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseTaskKey(undefined)).toBeNull();
  });

  it('returns null when no dash', () => {
    expect(parseTaskKey('PROJ12')).toBeNull();
  });

  it('returns null for -0 (zero not allowed)', () => {
    expect(parseTaskKey('PROJ-0')).toBeNull();
  });

  it('returns null for leading zero like PROJ-01', () => {
    expect(parseTaskKey('PROJ-01')).toBeNull();
  });

  it('returns null for negative number', () => {
    expect(parseTaskKey('PROJ--1')).toBeNull();
  });

  it('returns null when prefix is too long (> 10 chars)', () => {
    expect(parseTaskKey('ABCDEFGHIJK-1')).toBeNull();
  });

  it('returns null for dash-only', () => {
    expect(parseTaskKey('-')).toBeNull();
  });

  it('parses task number 1', () => {
    const result = parseTaskKey('T-1');
    expect(result).not.toBeNull();
    expect(result?.taskNumber).toBe(1);
  });

  it('trims whitespace before parsing', () => {
    const result = parseTaskKey('  PROJ-3  ');
    expect(result).not.toBeNull();
    expect(result?.taskKey).toBe('PROJ-3');
  });
});

// ---------------------------------------------------------------------------
// resolveNextTaskKey
// ---------------------------------------------------------------------------
describe('resolveNextTaskKey', () => {
  const mockDb = {
    query: {
      tasks: { findFirst: vi.fn() },
    },
  };

  afterEach(() => {
    mockDb.query.tasks.findFirst.mockReset();
  });

  it('returns *-1 when no existing tasks', async () => {
    mockDb.query.tasks.findFirst.mockResolvedValueOnce(null);
    const result = await resolveNextTaskKey({
      ownerId: 'owner1',
      taskPrefix: 'PROJ',
      db: mockDb as never,
    });
    expect(result.taskPrefix).toBe('PROJ');
    expect(result.taskNumber).toBe(1);
    expect(result.taskKey).toBe('PROJ-1');
  });

  it('increments from existing max task number', async () => {
    mockDb.query.tasks.findFirst.mockResolvedValueOnce({ taskNumber: 5 });
    const result = await resolveNextTaskKey({
      ownerId: 'owner1',
      taskPrefix: 'PROJ',
      db: mockDb as never,
    });
    expect(result.taskNumber).toBe(6);
    expect(result.taskKey).toBe('PROJ-6');
  });

  it('normalizes taskPrefix to uppercase', async () => {
    mockDb.query.tasks.findFirst.mockResolvedValueOnce(null);
    const result = await resolveNextTaskKey({
      ownerId: 'owner1',
      taskPrefix: 'proj',
      db: mockDb as never,
    });
    expect(result.taskPrefix).toBe('PROJ');
  });

  it('passes correct where clause to db', async () => {
    mockDb.query.tasks.findFirst.mockResolvedValueOnce(null);
    await resolveNextTaskKey({
      ownerId: 'owner-abc',
      taskPrefix: 'TEST',
      db: mockDb as never,
    });
    const call = mockDb.query.tasks.findFirst.mock.calls[0]?.[0];
    expect(call.columns).toEqual({ taskNumber: true });
    expect(sqlSnapshot(call.where)).toEqual(
      sqlSnapshot(and(eq(tasks.ownerId, 'owner-abc'), eq(tasks.taskPrefix, 'TEST'))!),
    );
    expect(sqlSnapshot(call.orderBy)).toEqual(sqlSnapshot(desc(tasks.taskNumber)));
  });
});

// ---------------------------------------------------------------------------
// isUuidIdentifier
// ---------------------------------------------------------------------------
describe('isUuidIdentifier', () => {
  it('returns true for a valid UUID v4', () => {
    expect(isUuidIdentifier('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('returns true for a valid UUID v1', () => {
    expect(isUuidIdentifier('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('returns true for UUID with uppercase letters', () => {
    expect(isUuidIdentifier('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('returns false for a task key like PROJ-12', () => {
    expect(isUuidIdentifier('PROJ-12')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isUuidIdentifier('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isUuidIdentifier(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isUuidIdentifier(undefined)).toBe(false);
  });

  it('returns false for random string', () => {
    expect(isUuidIdentifier('not-a-uuid')).toBe(false);
  });

  it('returns false for UUID missing dashes', () => {
    expect(isUuidIdentifier('550e8400e29b41d4a716446655440000')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeTaskIdentifier
// ---------------------------------------------------------------------------
describe('normalizeTaskIdentifier', () => {
  it('preserves a valid UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(normalizeTaskIdentifier(uuid)).toBe(uuid);
  });

  it('canonicalizes a task key to uppercase', () => {
    expect(normalizeTaskIdentifier('proj-5')).toBe('PROJ-5');
  });

  it('returns empty string for null', () => {
    expect(normalizeTaskIdentifier(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(normalizeTaskIdentifier(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(normalizeTaskIdentifier('')).toBe('');
  });

  it('uppercases non-uuid, non-task-key identifiers', () => {
    expect(normalizeTaskIdentifier('someRandomId')).toBe('SOMERANDOMID');
  });

  it('trims whitespace before processing', () => {
    expect(normalizeTaskIdentifier('  PROJ-3  ')).toBe('PROJ-3');
  });
});

// ---------------------------------------------------------------------------
// taskWhereByIdentifier
// ---------------------------------------------------------------------------
describe('taskWhereByIdentifier', () => {
  it('returns {ownerId, id} for a UUID identifier', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = taskWhereByIdentifier('owner1', uuid);
    expect(sqlSnapshot(result)).toEqual(
      sqlSnapshot(and(eq(tasks.ownerId, 'owner1'), eq(tasks.id, uuid))!),
    );
  });

  it('returns {ownerId, taskKey} for a task key identifier', () => {
    const result = taskWhereByIdentifier('owner1', 'PROJ-12');
    expect(sqlSnapshot(result)).toEqual(
      sqlSnapshot(and(eq(tasks.ownerId, 'owner1'), eq(tasks.taskKey, 'PROJ-12'))!),
    );
  });

  it('normalizes lowercase task key', () => {
    const result = taskWhereByIdentifier('owner1', 'proj-3');
    expect(sqlSnapshot(result)).toEqual(
      sqlSnapshot(and(eq(tasks.ownerId, 'owner1'), eq(tasks.taskKey, 'PROJ-3'))!),
    );
  });

  it('uses ownerId correctly', () => {
    const result = taskWhereByIdentifier('my-owner-id', 'TASK-1');
    expect(sqlSnapshot(result)).toEqual(
      sqlSnapshot(and(eq(tasks.ownerId, 'my-owner-id'), eq(tasks.taskKey, 'TASK-1'))!),
    );
  });
});

// ---------------------------------------------------------------------------
// isTaskKeyUniqueConstraintError
// ---------------------------------------------------------------------------
describe('isTaskKeyUniqueConstraintError', () => {
  it('returns true for a task key unique index message', () => {
    const err = new Error(
      'duplicate key value violates unique constraint "tasks_owner_id_task_key_idx"',
    );
    expect(isTaskKeyUniqueConstraintError(err)).toBe(true);
  });

  it('returns true for a composite task sequence unique index message', () => {
    const err = new Error(
      'duplicate key value violates unique constraint "tasks_owner_id_task_prefix_task_number_unique_idx"',
    );
    expect(isTaskKeyUniqueConstraintError(err)).toBe(true);
  });

  it('returns true for duplicate detail mentioning task_key', () => {
    const err = new Error(
      'duplicate key value violates unique constraint "tasks_owner_id_task_key_idx". Detail: Key (owner_id, task_key)=(owner1, PROJ-1) already exists.',
    );
    expect(isTaskKeyUniqueConstraintError(err)).toBe(true);
  });

  it('returns true for duplicate detail mentioning task_prefix and task_number', () => {
    const err = new Error(
      'duplicate key value violates unique constraint "tasks_owner_id_task_prefix_task_number_unique_idx". Detail: Key (owner_id, task_prefix, task_number)=(owner1, PROJ, 1) already exists.',
    );
    expect(isTaskKeyUniqueConstraintError(err)).toBe(true);
  });

  it('returns false for a duplicate key error on a different target', () => {
    const err = new Error('duplicate key value violates unique constraint "users_email_key"');
    expect(isTaskKeyUniqueConstraintError(err)).toBe(false);
  });

  it('returns false for a non-unique error that mentions task_key', () => {
    const err = new Error('failed to process task_key because request timed out');
    expect(isTaskKeyUniqueConstraintError(err)).toBe(false);
  });

  it('returns false for plain Error', () => {
    expect(isTaskKeyUniqueConstraintError(new Error('oops'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isTaskKeyUniqueConstraintError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isTaskKeyUniqueConstraintError(undefined)).toBe(false);
  });
});
