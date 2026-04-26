import { stripPreqChoiceBlocks } from '@/lib/markdown';

const CYRB53_LEFT_SEED = 0xdeadbeef;
const CYRB53_RIGHT_SEED = 0x41c6ce57;

// cyrb53 mixes its two 32-bit accumulators with this multiplier pair.
const CYRB53_LEFT_MULTIPLIER = 2654435761;
const CYRB53_RIGHT_MULTIPLIER = 1597334677;

// MurmurHash3 finalizer constants drive the last avalanche step.
const MURMUR3_FINALIZER_1 = 2246822507;
const MURMUR3_FINALIZER_2 = 3266489909;

// cyrb53 returns a 53-bit value assembled from two 32-bit accumulators.
const UINT32_RANGE = 4294967296;
const HASH53_HIGH_MASK = 2097151;

function normalizeTaskNoteText(value: string | null | undefined) {
  return stripPreqChoiceBlocks(value ?? '').trim();
}

function hashTaskNoteText(value: string) {
  let left = CYRB53_LEFT_SEED ^ value.length;
  let right = CYRB53_RIGHT_SEED ^ value.length;

  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index);
    left = Math.imul(left ^ charCode, CYRB53_LEFT_MULTIPLIER);
    right = Math.imul(right ^ charCode, CYRB53_RIGHT_MULTIPLIER);
  }

  left =
    Math.imul(left ^ (left >>> 16), MURMUR3_FINALIZER_1) ^
    Math.imul(right ^ (right >>> 13), MURMUR3_FINALIZER_2);
  right =
    Math.imul(right ^ (right >>> 16), MURMUR3_FINALIZER_1) ^
    Math.imul(left ^ (left >>> 13), MURMUR3_FINALIZER_2);

  return (UINT32_RANGE * (HASH53_HIGH_MASK & right) + (left >>> 0)).toString(16);
}

export function normalizeTaskNoteForComparison(value: string | null | undefined) {
  return normalizeTaskNoteText(value);
}

export function buildTaskNoteFingerprint(value: string | null | undefined) {
  const normalized = normalizeTaskNoteText(value);
  return `task-note:v1:${normalized.length}:${hashTaskNoteText(normalized)}`;
}
