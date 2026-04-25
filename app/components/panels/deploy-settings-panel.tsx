'use client';

import {
  Accordion,
  Checkbox,
  Code,
  Group,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';

import { SubmitButton } from '@/app/components/submit-button';
import { showErrorNotification } from '@/lib/notifications';

type ActionState = { ok: true; message?: string } | { ok: false; message: string } | null;
type DeployStrategy = 'direct_commit' | 'feature_branch' | 'none';
const DEPLOY_STRATEGIES: DeployStrategy[] = ['direct_commit', 'feature_branch', 'none'];
const promptPreviewStyle = {
  maxWidth: '100%',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
} as const;

type DeploySettingsPanelProps = {
  action: (prevState: unknown, formData: FormData) => Promise<ActionState>;
  projects: Array<{
    id: string;
    name: string;
    deployStrategy: {
      strategy: DeployStrategy;
      default_branch: string;
      auto_pr: boolean;
      commit_on_review: boolean;
      squash_merge: boolean;
    };
  }>;
  defaultProjectId?: string;
  singleProject?: boolean;
};

const STRATEGY_LABELS: Record<DeployStrategy, string> = {
  direct_commit: 'Direct Commit',
  feature_branch: 'Feature Branch',
  none: 'None',
};

export function DeploySettingsPanel({
  action,
  projects,
  defaultProjectId,
  singleProject,
}: DeploySettingsPanelProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, null);
  const initialProjectId = defaultProjectId || projects[0]?.id || '';
  const initialProject =
    projects.find((project) => project.id === initialProjectId) || projects[0] || null;
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [strategy, setStrategy] = useState<DeployStrategy>(
    initialProject?.deployStrategy.strategy || 'none',
  );
  const [defaultBranch, setDefaultBranch] = useState(
    initialProject?.deployStrategy.default_branch || 'main',
  );
  const [autoPr, setAutoPr] = useState(Boolean(initialProject?.deployStrategy.auto_pr));
  const [commitOnReview, setCommitOnReview] = useState(
    initialProject?.deployStrategy.commit_on_review !== false,
  );
  const [squashMerge, setSquashMerge] = useState(
    initialProject?.deployStrategy.squash_merge !== false,
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId],
  );

  const isDirectCommit = strategy === 'direct_commit';
  const isFeatureBranch = strategy === 'feature_branch';

  const promptPreview = useMemo(() => {
    if (strategy === 'none') {
      return `strategy: none\nDo not run git commit/push/PR. Only code changes + task update.`;
    }
    const lines: string[] = [`strategy: ${strategy}`, `default_branch: ${defaultBranch}`];
    if (isDirectCommit) {
      lines.push(`squash_merge: ${squashMerge}`);
      lines.push('');
      lines.push('After completing work in worktree:');
      lines.push(`  git checkout ${defaultBranch}`);
      lines.push(`  git pull origin ${defaultBranch}`);
      if (squashMerge) {
        lines.push('  git merge --squash <worktree_branch>');
        lines.push('  git commit -m "<task_id>: <summary>"');
      } else {
        lines.push('  git merge <worktree_branch>');
      }
      lines.push(`  git push origin ${defaultBranch}`);
    }
    if (isFeatureBranch) {
      lines.push(`auto_pr: ${autoPr}`);
      lines.push('');
      lines.push('After completing work in worktree:');
      lines.push('  git push origin <worktree_branch>');
      if (autoPr) {
        lines.push(`  Create PR targeting ${defaultBranch}`);
      }
    }
    if (isDirectCommit || isFeatureBranch) {
      lines.push('');
      lines.push(
        commitOnReview
          ? 'commit_on_review: true — must push before moving to review'
          : 'commit_on_review: false — review allowed without push',
      );
    }
    return lines.join('\n');
  }, [
    strategy,
    defaultBranch,
    squashMerge,
    autoPr,
    commitOnReview,
    isDirectCommit,
    isFeatureBranch,
  ]);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      router.refresh();
      return;
    }
    showErrorNotification(state.message);
  }, [router, state]);

  if (projects.length === 0) {
    return <Text c="dimmed">Create a project first to configure deployment strategy.</Text>;
  }

  function handleProjectChange(nextProjectId: string) {
    setSelectedProjectId(nextProjectId);
    const nextProject = projects.find((project) => project.id === nextProjectId);
    if (!nextProject) return;
    setStrategy(nextProject.deployStrategy.strategy);
    setDefaultBranch(nextProject.deployStrategy.default_branch);
    setAutoPr(nextProject.deployStrategy.auto_pr);
    setCommitOnReview(nextProject.deployStrategy.commit_on_review);
    setSquashMerge(nextProject.deployStrategy.squash_merge);
  }

  return (
    <form action={formAction}>
      <Stack gap="md">
        {singleProject ? (
          <input type="hidden" name="projectId" value={selectedProject?.id || ''} />
        ) : (
          <NativeSelect
            name="projectId"
            label="Project"
            value={selectedProject?.id || ''}
            onChange={(event) => handleProjectChange(event.currentTarget.value)}
            data={projects.map((project) => ({ value: project.id, label: project.name }))}
            required
          />
        )}

        <NativeSelect
          name="deploy_strategy"
          label="Strategy"
          value={strategy}
          onChange={(event) => setStrategy(event.currentTarget.value as DeployStrategy)}
          data={DEPLOY_STRATEGIES.map((value) => ({
            value,
            label: STRATEGY_LABELS[value],
          }))}
          required
        />

        <TextInput
          name="deploy_default_branch"
          label="Default Branch"
          value={defaultBranch}
          onChange={(event) => setDefaultBranch(event.currentTarget.value)}
          placeholder="main"
          required
        />

        {isFeatureBranch ? (
          <>
            <input type="hidden" name="deploy_auto_pr" value={autoPr ? 'true' : 'false'} />
            <Group gap={6} align="center">
              <Checkbox
                checked={autoPr}
                onChange={(event) => setAutoPr(event.currentTarget.checked)}
                label="Auto-create PR on push"
              />
              <Tooltip
                label="Requires GitHub access on the coding agent (`gh auth` or GitHub MCP)"
                withArrow
                multiline
                w={240}
              >
                <IconInfoCircle
                  size={16}
                  color="var(--mantine-color-dimmed)"
                  title="Requires GitHub access on the coding agent (`gh auth` or GitHub MCP)"
                  aria-label="Requires GitHub access on the coding agent (`gh auth` or GitHub MCP)"
                />
              </Tooltip>
            </Group>
          </>
        ) : (
          <input type="hidden" name="deploy_auto_pr" value="false" />
        )}

        {isDirectCommit ? (
          <>
            <input
              type="hidden"
              name="deploy_squash_merge"
              value={squashMerge ? 'true' : 'false'}
            />
            <Group gap={6} align="center">
              <Checkbox
                checked={squashMerge}
                onChange={(event) => setSquashMerge(event.currentTarget.checked)}
                label="Enable squash merge to default branch"
              />
              <Tooltip
                label="Squash all worktree commits into a single commit when merging to the default branch"
                withArrow
                multiline
                w={260}
              >
                <IconInfoCircle size={16} color="var(--mantine-color-dimmed)" />
              </Tooltip>
            </Group>
          </>
        ) : (
          <input type="hidden" name="deploy_squash_merge" value="false" />
        )}

        {isDirectCommit || isFeatureBranch ? (
          <>
            <input
              type="hidden"
              name="deploy_commit_on_review"
              value={commitOnReview ? 'true' : 'false'}
            />
            <Checkbox
              checked={commitOnReview}
              onChange={(event) => setCommitOnReview(event.currentTarget.checked)}
              label="Commit required before In Review"
            />
          </>
        ) : (
          <input type="hidden" name="deploy_commit_on_review" value="false" />
        )}

        <SubmitButton>Save Settings</SubmitButton>

        <Accordion variant="subtle" chevronPosition="left">
          <Accordion.Item value="preview">
            <Accordion.Control>
              <Text size="sm" c="dimmed">
                Agent prompt preview
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Code block style={promptPreviewStyle}>
                {promptPreview}
              </Code>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    </form>
  );
}
