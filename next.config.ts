import type { NextConfig } from 'next';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(/[\n,]/)
  .map((v) => v.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(allowedOrigins.length > 0
    ? {
        experimental: {
          serverActions: {
            allowedOrigins,
          },
        },
      }
    : {}),
};

export default nextConfig;
