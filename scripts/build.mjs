import { spawnSync } from 'node:child_process';

const CLOUDFLARE_MODE_ARG = '--cloudflare';
const OPENNEXT_BUILD_ENV = 'OPENNEXT_CLOUDFLARE_BUILDING';

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function shouldBuildForCloudflare(env = process.env, args = process.argv.slice(2)) {
  if (env[OPENNEXT_BUILD_ENV] === '1') {
    return false;
  }

  return args.includes(CLOUDFLARE_MODE_ARG) || env.WORKERS_CI === '1';
}

function getNextBuildArgs(env = process.env) {
  return env[OPENNEXT_BUILD_ENV] === '1' ? ['build', '--webpack'] : ['build'];
}

if (shouldBuildForCloudflare()) {
  console.log('[build] Running OpenNext Cloudflare build.');
  run('opennextjs-cloudflare', ['build'], {
    ...process.env,
    [OPENNEXT_BUILD_ENV]: '1',
  });
} else {
  console.log('[build] Running Next.js build.');
  run('next', getNextBuildArgs());
}
