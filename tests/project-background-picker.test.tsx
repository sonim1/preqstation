import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProjectBackgroundPicker } from '@/app/components/project-background-picker';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

describe('app/components/project-background-picker', () => {
  it('defines an in-bounds focus treatment for background option buttons', () => {
    expect(globalsCss).toMatch(
      /\.project-bg-option:focus-visible\s*\{[\s\S]*outline:\s*none;[\s\S]*box-shadow:/,
    );
  });

  it('renders Openverse search copy while keeping Unsplash preset attribution and custom credit metadata', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ProjectBackgroundPicker
          name="bgImage"
          value="https://cdn.openverse.org/photo-1.jpg"
          credit={{
            provider: 'openverse',
            creatorName: 'Jane Doe',
            creatorUrl: 'https://example.com/jane',
            sourceName: 'Flickr',
            sourceUrl: 'https://example.com/photo-1',
            license: 'CC BY 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
          }}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Current custom selection');
    expect(html).toContain('Search Openverse');
    expect(html).toContain('Searches Openverse photographs with CC0 and CC BY licensing.');
    expect(html).toContain('Jane Doe · CC BY 4.0');
    expect(html).toContain('Preset photos from Unsplash');
    expect(html).toContain('Search results from Openverse');
    expect(html).not.toContain('Unsplash Access Key');
    expect(html).not.toContain('developers.unsplash.com');
  });
});
