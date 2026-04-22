import {
  generateKeyBetween as rawGenerateKeyBetween,
  generateNKeysBetween,
} from 'fractional-indexing';

export { generateNKeysBetween };

/**
 * Fractional indexing keys must start with a letter (a-z).
 * Legacy zero-padded values like "0000000003" from the
 * priority-to-sort_order migration are invalid and would throw.
 */
export function isFractionalOrderKey(key: string | null | undefined): key is string {
  if (!key) return false;
  return /^[a-zA-Z]/.test(key);
}

function safeOrderKey(key: string | null | undefined): string | null {
  if (!isFractionalOrderKey(key)) return null;
  return key;
}

export function generateKeyBetween(
  lower: string | null | undefined,
  upper: string | null | undefined,
): string {
  return rawGenerateKeyBetween(safeOrderKey(lower), safeOrderKey(upper));
}

const SORT_ORDER_MAX_LENGTH = 50;

export function needsRebalancing(sortOrder: string): boolean {
  return sortOrder.length > SORT_ORDER_MAX_LENGTH;
}

export function rebalanceKeys(count: number): string[] {
  return generateNKeysBetween(null, null, count);
}
