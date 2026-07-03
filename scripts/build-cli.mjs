import { build } from 'esbuild';

await build({
  entryPoints: ['lib/cli/bin.ts'],
  outfile: 'dist/preqstation-cli.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'info',
});
