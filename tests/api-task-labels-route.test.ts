import { describe, expect, it } from 'vitest';

import { GET, POST } from '@/app/api/task-labels/route';

import { TEST_BASE_URL } from './test-utils';

function postRequest() {
  return new Request(`${TEST_BASE_URL}/api/task-labels`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify({ name: 'Bug' }),
  });
}

describe('app/api/task-labels/route', () => {
  it('GET is gone after labels become project-owned', async () => {
    const response = await GET();

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: 'Task labels are project-owned. Use /api/projects/:id/labels.',
    });
  });

  it('POST is gone after labels become project-owned', async () => {
    const response = await POST(postRequest());

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: 'Task labels are project-owned. Use /api/projects/:id/labels.',
    });
  });
});
