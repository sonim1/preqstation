import { type MarkdownArtifact, splitMarkdownArtifacts } from '@/lib/markdown';

export const TASK_ARTIFACT_TYPES = ['image', 'video', 'document', 'link'] as const;
export type TaskArtifactType = (typeof TASK_ARTIFACT_TYPES)[number];

export type TaskArtifact = {
  access?: string | null;
  expires?: string | null;
  localPath?: string | null;
  metadata?: Record<string, unknown> | null;
  provider?: string | null;
  reason?: string | null;
  title: string;
  type: TaskArtifactType;
  url?: string | null;
};

export type TaskArtifactInput = Partial<
  Omit<TaskArtifact, 'metadata' | 'type'> & {
    expiration: string | null;
    local_path: string | null;
    metadata: unknown;
    type: string | null;
  }
>;

const MAX_ARTIFACTS = 50;
const MAX_TEXT_LENGTH = 2000;

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, MAX_TEXT_LENGTH) : null;
}

function normalizeArtifactType(value: unknown): TaskArtifactType | null {
  const normalized = normalizeText(value)?.toLowerCase();
  if (!normalized) return null;
  return TASK_ARTIFACT_TYPES.includes(normalized as TaskArtifactType)
    ? (normalized as TaskArtifactType)
    : null;
}

function normalizeArtifactUrl(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function normalizeTaskArtifact(input: unknown): TaskArtifact | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const value = input as TaskArtifactInput;
  const url = normalizeArtifactUrl(value.url);
  const localPath = normalizeText(value.localPath ?? value.local_path);
  const reason = normalizeText(value.reason);
  const type = normalizeArtifactType(value.type) ?? (url ? 'link' : null);
  if (!type) return null;
  if (!url && !localPath && !reason) return null;

  const title =
    normalizeText(value.title) ??
    (url ? 'Artifact' : localPath ? 'Local artifact' : 'Artifact publishing skipped');

  return {
    access: normalizeText(value.access),
    expires: normalizeText(value.expires ?? value.expiration),
    localPath,
    metadata: normalizeMetadata(value.metadata),
    provider: normalizeText(value.provider),
    reason,
    title,
    type,
    url,
  };
}

export function normalizeTaskArtifacts(input: unknown) {
  if (!Array.isArray(input)) return [];

  const artifacts: TaskArtifact[] = [];
  const seen = new Set<string>();

  for (const candidate of input) {
    const artifact = normalizeTaskArtifact(candidate);
    if (!artifact) continue;

    const key = [
      artifact.type,
      artifact.url ?? '',
      artifact.localPath ?? '',
      artifact.title.toLowerCase(),
    ].join('\u0000');
    if (seen.has(key)) continue;
    seen.add(key);
    artifacts.push(artifact);
    if (artifacts.length >= MAX_ARTIFACTS) break;
  }

  return artifacts;
}

export function splitTaskArtifactMarkdown(markdown?: string | null) {
  const split = splitMarkdownArtifacts(markdown);
  return {
    artifacts: normalizeTaskArtifacts(split.artifacts),
    markdown: split.markdown,
  };
}

export function mergeTaskArtifacts(...artifactLists: unknown[]) {
  return normalizeTaskArtifacts(artifactLists.flatMap((list) => (Array.isArray(list) ? list : [])));
}

export function legacyMarkdownArtifactToTaskArtifact(artifact: MarkdownArtifact): TaskArtifact {
  return normalizeTaskArtifact(artifact) as TaskArtifact;
}
