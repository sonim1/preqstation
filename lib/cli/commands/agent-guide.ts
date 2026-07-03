export function buildAgentGuide(engine?: string | null) {
  return {
    product: 'PreqStation',
    runtime_agnostic: true,
    engine: engine || null,
    rules: [
      'Read the task and work graph from Core before acting.',
      'Create or update work nodes for meaningful execution steps.',
      'Attach bounded evidence for commands, tests, changed files, PRs, and deployments.',
      'Use workflow memory for concise shared context, not private local notes.',
      'Return results through Core APIs instead of local-only files.',
    ],
  };
}
