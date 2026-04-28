'use client';

import {
  Accordion,
  Checkbox,
  Code,
  Group,
  NativeSelect,
  Paper,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { type FormEvent, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { type SettingSaveState, SettingSaveStatus } from '@/app/components/setting-save-status';
import { SubmitButton } from '@/app/components/submit-button';

type ActionState = { ok: true; message?: string } | { ok: false; message: string } | null;
type DeployStrategy = 'direct_commit' | 'feature_branch';
const DEPLOY_STRATEGIES: DeployStrategy[] = ['direct_commit', 'feature_branch'];
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
};

const STRATEGY_DETAILS: Record<
  DeployStrategy,
  {
    title: string;
    description: string;
    summary: (args: {
      defaultBranch: string;
      autoPr: boolean;
      commitOnReview: boolean;
      squashMerge: boolean;
    }) => string;
  }
> = {
  direct_commit: {
    title: 'Ship straight to the default branch',
    description:
      'Use this when PREQ should merge finished work directly into the main branch without a PR handoff.',
    summary: ({ defaultBranch, squashMerge, commitOnReview }) =>
      `PREQ merges into ${defaultBranch}. ${
        squashMerge
          ? 'Worktree commits are collapsed into one branch commit.'
          : 'The full merge history is preserved.'
      } ${
        commitOnReview
          ? 'Review waits until the push is complete.'
          : 'Review can happen before the push.'
      }`,
  },
  feature_branch: {
    title: 'Push a task branch and review work in a PR',
    description:
      'Use this when operators want a remote branch checkpoint and an optional PR before review.',
    summary: ({ defaultBranch, autoPr, commitOnReview }) =>
      `PREQ pushes the worktree branch and targets ${defaultBranch}. ${
        autoPr
          ? 'A pull request can be opened automatically before review.'
          : 'Operators open the PR manually when they are ready.'
      } ${
        commitOnReview
          ? 'Review waits for the branch push and any required PR.'
          : 'Review can proceed before the branch is pushed.'
      }`,
  },
};

type DeployDraft = {
  projectId: string;
  strategy: DeployStrategy;
  defaultBranch: string;
  autoPr: boolean;
  commitOnReview: boolean;
  squashMerge: boolean;
};

function buildDraft(project: DeploySettingsPanelProps['projects'][number] | null): DeployDraft {
  return {
    projectId: project?.id || '',
    strategy: project?.deployStrategy.strategy || 'direct_commit',
    defaultBranch: project?.deployStrategy.default_branch || 'main',
    autoPr: Boolean(project?.deployStrategy.auto_pr),
    commitOnReview: project?.deployStrategy.commit_on_review !== false,
    squashMerge: project?.deployStrategy.squash_merge !== false,
  };
}

function draftsMatch(left: DeployDraft, right: DeployDraft) {
  return (
    left.projectId === right.projectId &&
    left.strategy === right.strategy &&
    left.defaultBranch === right.defaultBranch &&
    left.autoPr === right.autoPr &&
    left.commitOnReview === right.commitOnReview &&
    left.squashMerge === right.squashMerge
  );
}

export function DeploySettingsPanel({
  action,
  projects,
  defaultProjectId,
  singleProject,
}: DeploySettingsPanelProps) {
  const initialProjectId = defaultProjectId || projects[0]?.id || '';
  const initialProject =
    projects.find((project) => project.id === initialProjectId) || projects[0] || null;
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [strategy, setStrategy] = useState<DeployStrategy>(
    initialProject?.deployStrategy.strategy || 'direct_commit',
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
  const [savedDraft, setSavedDraft] = useState<DeployDraft>(() => buildDraft(initialProject));
  const [saveState, setSaveState] = useState<SettingSaveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const submittedDraftRef = useRef<DeployDraft>(buildDraft(initialProject));

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId],
  );
  const selectedProjectRevision = selectedProject
    ? JSON.stringify({
        id: selectedProject.id,
        strategy: selectedProject.deployStrategy.strategy,
        defaultBranch: selectedProject.deployStrategy.default_branch,
        autoPr: selectedProject.deployStrategy.auto_pr,
        commitOnReview: selectedProject.deployStrategy.commit_on_review,
        squashMerge: selectedProject.deployStrategy.squash_merge,
      })
    : null;

  const isDirectCommit = strategy === 'direct_commit';
  const isFeatureBranch = strategy === 'feature_branch';
  const strategyDetails = STRATEGY_DETAILS[strategy];
  const strategySummary = strategyDetails.summary({
    defaultBranch,
    autoPr,
    commitOnReview,
    squashMerge,
  });
  const currentDraft: DeployDraft = {
    projectId: selectedProject?.id || selectedProjectId,
    strategy,
    defaultBranch,
    autoPr,
    commitOnReview,
    squashMerge,
  };
  const isDirty = !draftsMatch(currentDraft, savedDraft);
  const currentState: SettingSaveState = isPending
    ? 'saving'
    : saveState === 'error'
      ? 'error'
      : isDirty
        ? 'dirty'
        : saveState === 'saved'
          ? 'saved'
          : 'idle';

  const promptPreview = useMemo(() => {
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
    lines.push('');
    lines.push(
      commitOnReview
        ? 'commit_on_review: true — must push before moving to review'
        : 'commit_on_review: false — review allowed without push',
    );
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
    if (!selectedProjectRevision || !selectedProject) return;
    const nextDraft = buildDraft(selectedProject);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- local draft state must resync when saved defaults change
    setSelectedProjectId(nextDraft.projectId);
    setStrategy(nextDraft.strategy);
    setDefaultBranch(nextDraft.defaultBranch);
    setAutoPr(nextDraft.autoPr);
    setCommitOnReview(nextDraft.commitOnReview);
    setSquashMerge(nextDraft.squashMerge);
    setSavedDraft(nextDraft);
    setSaveState('idle');
    setErrorMessage(null);
  }, [selectedProject, selectedProjectRevision]);

  if (projects.length === 0) {
    return <Text c="dimmed">Create a project first to configure deployment strategy.</Text>;
  }

  function handleProjectChange(nextProjectId: string) {
    setSelectedProjectId(nextProjectId);
    const nextProject = projects.find((project) => project.id === nextProjectId);
    if (!nextProject) return;
    const nextDraft = buildDraft(nextProject);
    setStrategy(nextDraft.strategy);
    setDefaultBranch(nextDraft.defaultBranch);
    setAutoPr(nextDraft.autoPr);
    setCommitOnReview(nextDraft.commitOnReview);
    setSquashMerge(nextDraft.squashMerge);
    setSavedDraft(nextDraft);
    setSaveState('idle');
    setErrorMessage(null);
  }

  function updateSaveState(nextDraft: DeployDraft) {
    setErrorMessage(null);
    setSaveState(draftsMatch(nextDraft, savedDraft) ? 'idle' : 'dirty');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    submittedDraftRef.current = currentDraft;
    setErrorMessage(null);
    setSaveState('saving');

    startTransition(async () => {
      const result = await action(null, new FormData(form));
      if (result?.ok) {
        setSavedDraft(submittedDraftRef.current);
        setSaveState('saved');
        return;
      }

      setErrorMessage(result?.message || 'Failed to save deployment settings.');
      setSaveState('error');
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <SettingSaveStatus mode="manual" state={currentState} errorMessage={errorMessage} />
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
          onChange={(event) => {
            const nextStrategy = event.currentTarget.value as DeployStrategy;
            setStrategy(nextStrategy);
            updateSaveState({ ...currentDraft, strategy: nextStrategy });
          }}
          data={DEPLOY_STRATEGIES.map((value) => ({
            value,
            label: STRATEGY_LABELS[value],
          }))}
          required
        />

        <Paper withBorder radius="md" p="sm">
          <Stack gap={4}>
            <Text fw={600}>{strategyDetails.title}</Text>
            <Text size="sm" c="dimmed">
              {strategyDetails.description}
            </Text>
            <Text size="sm">{strategySummary}</Text>
          </Stack>
        </Paper>

        <TextInput
          name="deploy_default_branch"
          label="Default Branch"
          value={defaultBranch}
          onChange={(event) => {
            const nextBranch = event.currentTarget.value;
            setDefaultBranch(nextBranch);
            updateSaveState({ ...currentDraft, defaultBranch: nextBranch });
          }}
          placeholder="main"
          required
        />

        {isFeatureBranch ? (
          <>
            <input type="hidden" name="deploy_auto_pr" value={autoPr ? 'true' : 'false'} />
            <Stack gap={4}>
              <Group gap={6} align="center">
                <Checkbox
                  checked={autoPr}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.checked;
                    setAutoPr(nextValue);
                    updateSaveState({ ...currentDraft, autoPr: nextValue });
                  }}
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
              <Text size="sm" c="dimmed">
                If review requires a push, missing GitHub auth will block the run until the branch
                and PR can be created.
              </Text>
            </Stack>
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
            <Stack gap={4}>
              <Group gap={6} align="center">
                <Checkbox
                  checked={squashMerge}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.checked;
                    setSquashMerge(nextValue);
                    updateSaveState({ ...currentDraft, squashMerge: nextValue });
                  }}
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
              <Text size="sm" c="dimmed">
                Squash merge combines worktree commits into one default-branch commit. Disable this
                only when operators need the full merge history on the default branch.
              </Text>
            </Stack>
          </>
        ) : (
          <input type="hidden" name="deploy_squash_merge" value="false" />
        )}

        <input
          type="hidden"
          name="deploy_commit_on_review"
          value={commitOnReview ? 'true' : 'false'}
        />
        <Checkbox
          checked={commitOnReview}
          onChange={(event) => {
            const nextValue = event.currentTarget.checked;
            setCommitOnReview(nextValue);
            updateSaveState({ ...currentDraft, commitOnReview: nextValue });
          }}
          label="Commit required before In Review"
        />
        <Text size="sm" c="dimmed">
          When this is enabled, PREQ cannot move the task into review until the required remote push
          succeeds.
        </Text>

        <SubmitButton disabled={!isDirty || isPending}>Save Settings</SubmitButton>

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
