import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';

const PROJECT_KEY_PATTERN = /^[A-Z0-9]{3,4}$/;
const PROJECT_KEY_SUFFIXES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class ProjectKeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectKeyValidationError';
  }
}

export class ProjectKeyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectKeyConflictError';
  }
}

function sanitizeProjectKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeProjectKey(input: string | null | undefined) {
  return sanitizeProjectKey((input || '').trim()).slice(0, 4);
}

export function isValidProjectKey(input: string | null | undefined) {
  return PROJECT_KEY_PATTERN.test((input || '').trim().toUpperCase());
}

export function inferDefaultProjectKeyFromName(name: string | null | undefined) {
  const cleaned = sanitizeProjectKey((name || '').trim());
  const base = (cleaned || 'PROJ').slice(0, 4);
  return base.padEnd(4, 'X');
}

export function assertValidProjectKeyInput(input: string | null | undefined) {
  const normalized = normalizeProjectKey(input);
  if (!isValidProjectKey(normalized)) {
    throw new ProjectKeyValidationError('Project key must be 3-4 uppercase letters or digits.');
  }
  return normalized;
}

export async function isProjectKeyTaken(
  ownerId: string,
  projectKey: string,
  client: DbClientOrTx = db,
) {
  const existing = await client.query.projects.findFirst({
    where: and(eq(projects.ownerId, ownerId), eq(projects.projectKey, projectKey)),
    columns: { id: true },
  });
  return !!existing;
}

export async function resolveUniqueProjectKey(
  ownerId: string,
  preferredKey: string,
  client: DbClientOrTx = db,
) {
  const normalized = assertValidProjectKeyInput(preferredKey);

  if (!(await isProjectKeyTaken(ownerId, normalized, client))) {
    return normalized;
  }

  const stem = normalized.slice(0, 3);
  for (const suffix of PROJECT_KEY_SUFFIXES) {
    const candidate = `${stem}${suffix}`;
    if (!(await isProjectKeyTaken(ownerId, candidate, client))) {
      return candidate;
    }
  }

  throw new ProjectKeyConflictError('Project key already exists.');
}

export function isProjectKeyUniqueConstraintError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message || '';
  if (!/unique constraint|duplicate key|already exists/i.test(message)) return false;
  return /project_key|projects_owner_id_project_key_idx?/i.test(message);
}
