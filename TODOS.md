# TODOS

## Work Graph

### Add workflow profile manual controls after contract dogfood

**What:** Add Advanced manual workflow controls and optional dispatch metadata after the contract-first workflow profile path is proven.

**Why:** Power users may need to force a workflow such as plan-first, spec-driven, review, QA, or a custom command without making PreqStation Core choose skills by default.

**Context:** The 2026-07-02 engineering review chose the contract-first slice: default workflow is `auto`, PreqStation does not append `workflow_profile` to existing dispatch commands yet, harnesses own semantic judgment, and resolved choices are recorded in `metadata.workflow_profile` on work nodes. Revisit this after at least one real harness run records `requested`, `resolved`, `resolved_command`, and `resolved_reason`. Start from `app/components/task-copy-actions.tsx`, `lib/openclaw-command.ts`, and `docs/workflow-profile-contract.md`.

**Effort:** M
**Priority:** P3
**Depends on:** Workflow profile contract implemented and dogfooded on at least one real run.

## Completed
