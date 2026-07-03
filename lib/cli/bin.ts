import { runPreqstationCli } from '@/lib/cli';

runPreqstationCli({ argv: process.argv.slice(2) })
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
