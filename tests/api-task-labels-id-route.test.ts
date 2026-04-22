import { describe, expect, it } from 'vitest';

import { DELETE, PATCH } from '@/app/api/task-labels/[id]/route';

import { TEST_BASE_URL } from './test-utils';

function patchRequest() {
  return new Request(`${TEST_BASE_URL}/api/task-labels/label-1`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify({ name: 'Bug' }),
  });
}

function deleteRequest() {
  return new Request(`${TEST_BASE_URL}/api/task-labels/label-1`, {
    method: 'DELETE',
    headers: { origin: TEST_BASE_URL },
  });
}

describe('app/api/task-labels/[id]/route', () => {
  it('PATCH is gone after labels become project-owned', async () => {
    const response = await PATCH(patchRequest(), {
      params: Promise.resolve({ id: 'label-1' }),
    });

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: 'Task labels are project-owned. Use /api/projects/:id/labels/:labelId.',
    });
  });

  it('DELETE is gone after labels become project-owned', async () => {
    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: 'label-1' }),
    });

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: 'Task labels are project-owned. Use /api/projects/:id/labels/:labelId.',
    });
  });
});
