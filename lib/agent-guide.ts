export function buildAgentGuide(engine?: string | null) {
  return {
    product: 'PreqStation',
    runtime_agnostic: true,
    engine: engine || null,
    workflow_profile: {
      default: { requested: 'auto', manual_command: null },
      metadata_namespace: 'workflow_profile',
      core_chooses_workflow: false,
      dispatch_command_metadata: false,
      cli_metadata_file: '--metadata-file',
      resolved_fields: ['resolved', 'resolved_command', 'resolved_reason'],
    },
    rules: [
      'Read the task and work graph from Core before acting.',
      'Create or update work nodes for meaningful execution steps.',
      'When workflow profile is auto, the harness chooses the concrete workflow and records the resolved choice in metadata.workflow_profile.',
      'Attach bounded evidence for commands, tests, changed files, PRs, and deployments.',
      'Use workflow memory for concise shared context, not private local notes.',
      'Return results through Core APIs instead of local-only files.',
    ],
  };
}
