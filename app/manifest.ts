import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Preq Station',
    short_name: 'Preq',
    description: 'Owner-only task control plane for Kanban, agent APIs, MCP, and execution logs',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#345fdd',
    icons: [
      {
        src: '/brand/preqstation-app-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
