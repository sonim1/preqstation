import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { buildPrompt, OpenClawGuide } from '@/app/components/openclaw-guide';

function renderOpenClawGuide(
  projects: Array<{ projectKey: string; name: string; repoUrl: string | null }>,
) {
  return renderToStaticMarkup(
    <MantineProvider>
      <OpenClawGuide projects={projects} />
    </MantineProvider>,
  );
}

describe('app/components/openclaw-guide', () => {
  it('builds a shell-executable PREQ CLI setup command from linked project repos', () => {
    expect(
      buildPrompt([
        {
          projectKey: 'PROJ',
          name: 'Project One',
          repoUrl: 'git@github.com:sonim1/preqstation.git',
        },
        {
          projectKey: 'MISS',
          name: 'Missing Repo',
          repoUrl: null,
        },
      ]),
    ).toBe('preqstation setup auto PROJ=sonim1/preqstation');
  });

  it('renders a labeled copy control when projects are available', () => {
    const html = renderOpenClawGuide([
      {
        projectKey: 'PROJ',
        name: 'Project One',
        repoUrl: 'sonim1/preqstation',
      },
    ]);

    expect(html).toContain('data-openclaw-guide="true"');
    expect(html).toContain('Show setup prompt');
    expect(html).toContain(
      'Preview the exact command before copying it into the dispatcher host shell.',
    );
    expect(html).toContain('Copy PREQ CLI auto-setup command');
    expect(html).toContain('Copy a PREQ CLI setup command to auto-match local repos for dispatch');
    expect(html).toContain('preqstation setup auto PROJ=sonim1/preqstation');
  });

  it('stays hidden when there are no projects to map', () => {
    const html = renderOpenClawGuide([]);

    expect(html).not.toContain('Send to OpenClaw to auto-match local repos for agent execution');
    expect(html).not.toContain('mantine-ActionIcon-root');
  });

  it('stays hidden when no projects have linked repo URLs', () => {
    const html = renderOpenClawGuide([
      {
        projectKey: 'PROJ',
        name: 'Project One',
        repoUrl: null,
      },
    ]);

    expect(html).not.toContain('Send to OpenClaw to auto-match local repos for agent execution');
    expect(html).not.toContain('mantine-ActionIcon-root');
  });
});
