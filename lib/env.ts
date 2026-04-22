import { z } from 'zod';

const schema = z.object({
  AUTH_SECRET: z.string().min(16),
  DATABASE_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().optional(),
});

type Env = z.infer<typeof schema>;

let _cached: Env | undefined;

function getEnv(): Env {
  if (!_cached) {
    _cached = schema.parse({
      AUTH_SECRET: process.env.AUTH_SECRET,
      DATABASE_URL: process.env.DATABASE_URL,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    });
  }
  return _cached;
}

export const env: Env = new Proxy({} as Env, {
  get(_, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
