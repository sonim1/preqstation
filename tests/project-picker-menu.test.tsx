import { MantineProvider, Menu } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ProjectPickerMenuItems } from '@/app/components/project-picker-menu';

describe('app/components/project-picker-menu', () => {
  const allProjectsLabel = ['All', 'Projects'].join(' ');

  it('renders an unscoped all-projects option ahead of visible and paused boards', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <Menu opened withinPortal={false}>
          <Menu.Target>
            <button type="button">Boards</button>
          </Menu.Target>
          <ProjectPickerMenuItems
            projectOptions={[
              { id: 'project-1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
              { id: 'project-2', name: 'Beta', projectKey: 'BETA', status: 'paused' },
            ]}
            selectedProjectId="project-1"
            onSelect={vi.fn()}
          />
        </Menu>
      </MantineProvider>,
    );

    expect(html).toContain(`>${allProjectsLabel}<`);
    expect(html.indexOf(`>${allProjectsLabel}<`)).toBeLessThan(html.indexOf('>Alpha<'));
    expect(html).toContain('>Alpha<');
    expect(html).toContain('>Beta<');
    expect(html.indexOf('>Alpha<')).toBeLessThan(html.indexOf('>Paused<'));
    expect(html.indexOf('>Paused<')).toBeLessThan(html.indexOf('>Beta<'));
    expect(html).toContain('aria-current="page"');
  });
});
