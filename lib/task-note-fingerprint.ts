import { stripPreqChoiceBlocks } from '@/lib/markdown';

function normalizeTaskNoteText(value: string | null | undefined) {
  return stripPreqChoiceBlocks(value ?? '').trim();
}

function hashTaskNoteText(value: string) {
  let left = 0xdeadbeef ^ value.length;
  let right = 0x41c6ce57 ^ value.length;

  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index);
    left = Math.imul(left ^ charCode, 2654435761);
    right = Math.imul(right ^ charCode, 1597334677);
  }

  left =
    Math.imul(left ^ (left >>> 16), 2246822507) ^
    Math.imul(right ^ (right >>> 13), 3266489909);
  right =
    Math.imul(right ^ (right >>> 16), 2246822507) ^
    Math.imul(left ^ (left >>> 13), 3266489909);

  return (4294967296 * (2097151 & right) + (left >>> 0)).toString(16);
}

export function normalizeTaskNoteForComparison(value: string | null | undefined) {
  return normalizeTaskNoteText(value);
}

export function buildTaskNoteFingerprint(value: string | null | undefined) {
  const normalized = normalizeTaskNoteText(value);
  return `task-note:v1:${normalized.length}:${hashTaskNoteText(normalized)}`;
}
