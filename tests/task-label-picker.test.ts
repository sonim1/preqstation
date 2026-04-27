import { describe, expect, it } from 'vitest';

import { shouldOfferTaskLabelCreateAction } from '@/app/components/task-label-picker';

const labelOptions = [
  { id: 'label-1', name: 'Bug', color: 'red' },
  { id: 'label-2', name: 'Ops', color: 'green' },
];

describe('app/components/task-label-picker', () => {
  it('offers create only for non-empty searches that do not case-insensitively match an existing label', () => {
    expect(
      shouldOfferTaskLabelCreateAction({
        labelOptions,
        projectId: 'project-1',
        online: true,
        search: 'Platform',
      }),
    ).toBe(true);
    expect(
      shouldOfferTaskLabelCreateAction({
        labelOptions,
        projectId: 'project-1',
        online: true,
        search: ' bug ',
      }),
    ).toBe(false);
  });

  it('suppresses create when the board is offline or no project is selected', () => {
    expect(
      shouldOfferTaskLabelCreateAction({
        labelOptions,
        projectId: 'project-1',
        online: false,
        search: 'Platform',
      }),
    ).toBe(false);
    expect(
      shouldOfferTaskLabelCreateAction({
        labelOptions,
        projectId: null,
        online: true,
        search: 'Platform',
      }),
    ).toBe(false);
  });
});
