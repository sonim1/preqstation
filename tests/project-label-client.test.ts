import { describe, expect, it, vi } from 'vitest';

import { createProjectLabelWithRecovery } from '@/lib/project-label-client';

describe('lib/project-label-client', () => {
  it('returns the created label when the POST succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          label: { id: 'label-2', name: 'Ops', color: 'green' },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await createProjectLabelWithRecovery({
      projectId: 'project-1',
      name: 'Ops',
      color: 'green',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith('/api/projects/project-1/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name: 'Ops', color: 'green' }),
    });
    expect(result).toEqual({
      label: { id: 'label-2', name: 'Ops', color: 'green' },
    });
  });

  it('reloads project labels on a conflict and returns the case-insensitive match', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Label already exists' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            labels: [
              { id: 'label-1', name: 'Bug', color: 'red' },
              { id: 'label-2', name: 'Ops', color: 'green' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    const result = await createProjectLabelWithRecovery({
      projectId: 'project-1',
      name: 'bug',
      color: 'blue',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/api/projects/project-1/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name: 'bug', color: 'blue' }),
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, '/api/projects/project-1/labels', {
      method: 'GET',
      credentials: 'same-origin',
    });
    expect(result).toEqual({
      label: { id: 'label-1', name: 'Bug', color: 'red' },
      syncedLabels: [
        { id: 'label-1', name: 'Bug', color: 'red' },
        { id: 'label-2', name: 'Ops', color: 'green' },
      ],
    });
  });
});
