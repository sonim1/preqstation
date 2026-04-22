import { MantineProvider, Menu } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ProjectPickerMenuItems } from '@/app/components/project-picker-menu';

describe('app/components/project-picker-menu', () => {
  it('marks the current board option with aria-current for assistive technology', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <Menu opened withinPortal={false}>
          <Menu.Target>
            <button type="button">Boards</button>
          </Menu.Target>
          <ProjectPickerMenuItems
            projectOptions={[
              { id: 'project-1', name: 'Alpha', projectKey: 'ALPHA' },
              { id: 'project-2', name: 'Beta', projectKey: 'BETA' },
            ]}
            hasSelectedProject={true}
            selectedProjectId="project-2"
            onSelect={vi.fn()}
          />
        </Menu>
      </MantineProvider>,
    );

    expect(html).toContain('>Alpha<');
    expect(html).toContain('>Beta<');
    expect(html).toContain('aria-current="page"');
  });
});
