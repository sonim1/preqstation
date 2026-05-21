'use client';

import { ActionIcon, CopyButton, Group, Paper, Text, Tooltip } from '@mantine/core';
import { IconCheck, IconChevronDown, IconCopy, IconTerminal2 } from '@tabler/icons-react';

import cardStyles from '@/app/components/cards.module.css';
import { normalizeGithubRepoReference } from '@/lib/github-repo';

type OpenClawGuideProps = {
  projects: Array<{ projectKey: string; name: string; repoUrl: string | null }>;
};

function normalizeRepoId(repoUrl: string | null): string {
  return normalizeGithubRepoReference(repoUrl) || '';
}

export function buildPrompt(
  projects: Array<{ projectKey: string; name: string; repoUrl: string | null }>,
): string {
  const pairs = projects
    .map((project) => {
      const repoId = normalizeRepoId(project.repoUrl);
      if (!repoId) return null;
      return `${project.projectKey.toUpperCase()}=${repoId}`;
    })
    .filter(Boolean);

  if (pairs.length === 0) return '';

  return ['/preqstation setup auto', ...pairs].join(' ');
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
            Copy a dispatcher setup command to auto-match local repos for Hermes execution
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
            Preview the exact command before copying it into the dispatcher host.
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
                    aria-label="Copy dispatcher auto-setup command"
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
