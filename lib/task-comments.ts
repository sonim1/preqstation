import { desc } from 'drizzle-orm';

import { taskComments } from '@/lib/db/schema';

export const TASK_COMMENT_RUN_STATES = ['queued', 'working', 'done', 'failed'] as const;
export const TASK_COMMENT_AUTHOR_TYPES = ['user', 'agent', 'system'] as const;

export type TaskCommentRunState = (typeof TASK_COMMENT_RUN_STATES)[number];
export type TaskCommentAuthorType = (typeof TASK_COMMENT_AUTHOR_TYPES)[number];
export type TaskCommentRow = typeof taskComments.$inferSelect;

export const TASK_COMMENT_ORDER_DESC = [desc(taskComments.createdAt)];

export function normalizeTaskCommentRunState(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? '';
  return TASK_COMMENT_RUN_STATES.includes(normalized as TaskCommentRunState)
    ? (normalized as TaskCommentRunState)
    : null;
}

export function normalizeTaskCommentAuthorType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? '';
  return TASK_COMMENT_AUTHOR_TYPES.includes(normalized as TaskCommentAuthorType)
    ? (normalized as TaskCommentAuthorType)
    : null;
}

export function serializeTaskComment(comment: TaskCommentRow) {
  return {
    id: comment.id,
    task_id: comment.taskId,
    project_id: comment.projectId,
    parent_comment_id: comment.parentCommentId,
    author_type: comment.authorType,
    author_name: comment.authorName,
    body: comment.body,
    run_state: comment.runState,
    run_state_updated_at: comment.runStateUpdatedAt?.toISOString() ?? null,
    engine: comment.engine,
    dispatch_target: comment.dispatchTarget,
    error_message: comment.errorMessage,
    metadata: comment.metadata,
    created_at: comment.createdAt.toISOString(),
    updated_at: comment.updatedAt.toISOString(),
  };
}

export function renderTaskCommentWorkLogDetail(params: {
  userCommentBody: string;
  agentReplyBody?: string | null;
  errorMessage?: string | null;
  noteUpdated?: boolean;
  commentId: string;
  engine?: string | null;
}) {
  const sections = ['## Comment', params.userCommentBody.trim() || '(empty)'];

  if (params.agentReplyBody) {
    sections.push('## Agent reply', params.agentReplyBody.trim());
  }

  if (params.errorMessage) {
    sections.push('## Failure', params.errorMessage.trim());
  }

  sections.push(
    '## Result',
    [
      `- Updated note: ${params.noteUpdated ? 'yes' : 'no'}`,
      `- Comment ID: ${params.commentId}`,
      `- Engine: ${params.engine || 'unknown'}`,
    ].join('\n'),
  );

  return sections.join('\n\n');
}
