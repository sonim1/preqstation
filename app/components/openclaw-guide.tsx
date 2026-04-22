'use client';

import { ActionIcon, CopyButton, Group, Paper, Text, Tooltip } from '@mantine/core';
import { IconCheck, IconChevronDown, IconCopy, IconTerminal2 } from '@tabler/icons-react';

import cardStyles from '@/app/components/cards.module.css';

type OpenClawGuideProps = {
  projects: Array<{ projectKey: string; name: string; repoUrl: string | null }>;
};

function normalizeRepoUrl(repoUrl: string | null): string {
  if (!repoUrl) return '';

  return repoUrl
    .trim()
    .replace(/^git@github\.com:/iu, 'https://github.com/')
    .replace(/^ssh:\/\/git@github\.com\//iu, 'https://github.com/')
    .replace(/\.git$/iu, '')
    .replace(/\/$/u, '');
}

export function buildPrompt(
  projects: Array<{ projectKey: string; name: string; repoUrl: string | null }>,
): string {
  const pairs = projects
    .map((project) => {
      const repoUrl = normalizeRepoUrl(project.repoUrl);
      if (!repoUrl) return null;
      return `${project.projectKey.toUpperCase()}=${repoUrl}`;
    })
    .filter(Boolean);

  if (pairs.length === 0) return '';

  return ['/preqsetup auto', ...pairs].join(' ');
}

export function OpenClawGuide({ projects }: OpenClawGuideProps) {
  const prompt = buildPrompt(projects);

  if (!prompt) return null;

  return (
    <details className={cardStyles.guideDisclosure} data-openclaw-guide="true">
      <summary className={cardStyles.guideSummary}>
        <span className={cardStyles.guideSummaryCopy}>
          <IconTerminal2 size={16} color="var(--mantine-color-teal-5)" style={{ flexShrink: 0 }} />
          <Text size="xs" c="dimmed" truncate>
            Send to OpenClaw to auto-match local repos for agent execution
          </Text>
        </span>
        <span className={cardStyles.guideSummaryHint}>
          <Text size="xs" c="dimmed">
            Show setup prompt
          </Text>
          <IconChevronDown size={14} className={cardStyles.guideChevron} />
        </span>
      </summary>

      <Paper withBorder radius="md" p="xs" className={cardStyles.guideBar}>
        <div className={cardStyles.guideContent}>
          <Text size="xs" c="dimmed">
            Preview the exact prompt before copying it into OpenClaw.
          </Text>
          <Text
            component="pre"
            className={cardStyles.guidePrompt}
            data-openclaw-guide-prompt="true"
          >
            {prompt}
          </Text>
          <Group justify="flex-end">
            <CopyButton value={prompt} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy prompt'} withArrow>
                  <ActionIcon
                    variant="subtle"
                    color={copied ? 'teal' : 'gray'}
                    onClick={copy}
                    size="sm"
                    aria-label="Copy OpenClaw auto-setup prompt"
                  >
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        </div>
      </Paper>
    </details>
  );
}
