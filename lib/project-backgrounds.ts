import { z } from 'zod';

import { PROJECT_BG_PRESETS, type ProjectBackgroundCredit } from '@/lib/project-backgrounds-shared';

export type { ProjectBackgroundCredit } from '@/lib/project-backgrounds-shared';
export {
  getBgUrlFromValue,
  getProjectBoardBgUrl,
  getProjectCardBgUrl,
  getProjectPortfolioBgUrl,
  isValidBgValue,
  PROJECT_BG_PRESETS,
} from '@/lib/project-backgrounds-shared';

const HTTPS_URL_SCHEMA = z
  .string()
  .trim()
  .url()
  .transform((value) => new URL(value).toString())
  .refine((value) => new URL(value).protocol === 'https:');

export const projectBackgroundCreditSchema = z.object({
  provider: z.enum(['unsplash', 'openverse']),
  creatorName: z.string().trim().min(1).max(200),
  creatorUrl: HTTPS_URL_SCHEMA.nullable(),
  sourceName: z.string().trim().min(1).max(120),
  sourceUrl: HTTPS_URL_SCHEMA,
  license: z.string().trim().min(1).max(120),
  licenseUrl: HTTPS_URL_SCHEMA.nullable(),
});

export function parseProjectBackgroundCredit(input: unknown) {
  if (input == null) {
    return { ok: true as const, value: null };
  }

  if (typeof input === 'string') {
    const text = input.trim();
    if (!text) {
      return { ok: true as const, value: null };
    }

    try {
      const parsed = JSON.parse(text);
      const result = projectBackgroundCreditSchema.safeParse(parsed);
      return result.success
        ? { ok: true as const, value: result.data }
        : { ok: false as const, value: null };
    } catch {
      return { ok: false as const, value: null };
    }
  }

  const result = projectBackgroundCreditSchema.safeParse(input);
  return result.success
    ? { ok: true as const, value: result.data }
    : { ok: false as const, value: null };
}

export function getProjectBackgroundCredit(
  value: string | null | undefined,
  storedCredit: unknown,
): ProjectBackgroundCredit | null {
  if (!value) return null;

  const preset = PROJECT_BG_PRESETS.find((item) => item.id === value);
  if (preset) {
    return preset.credit;
  }

  const parsedCredit = parseProjectBackgroundCredit(storedCredit);
  return parsedCredit.ok ? parsedCredit.value : null;
}
