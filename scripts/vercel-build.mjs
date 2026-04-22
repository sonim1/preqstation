import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function isTrue(value) {
  return value === 'true';
}

export function shouldRunDbMigrate(env = process.env) {
  if (env.VERCEL_ENV === 'production') {
    return true;
  }

  if (env.VERCEL_ENV === 'preview' && isTrue(env.MIGRATE_ON_PREVIEW)) {
    return true;
  }

  return false;
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function main(env = process.env) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  if (shouldRunDbMigrate(env)) {
    console.log('[vercel-build] Running database migrations before build.');
    run(npmCommand, ['run', 'db:migrate'], env);
  } else {
    console.log('[vercel-build] Skipping database migrations for this deployment.');
  }

  run(npmCommand, ['run', 'build'], env);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
