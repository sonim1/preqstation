export const TASK_DISPATCH_TARGETS = ['telegram', 'hermes-telegram'] as const;
export type TaskDispatchTarget = (typeof TASK_DISPATCH_TARGETS)[number];

export function normalizeTaskDispatchTarget(
  value: string | null | undefined,
): TaskDispatchTarget | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return null;
  return TASK_DISPATCH_TARGETS.includes(normalized as TaskDispatchTarget)
    ? (normalized as TaskDispatchTarget)
    : null;
}
