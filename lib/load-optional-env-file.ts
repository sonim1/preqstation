import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

interface LoadOptionalEnvFileOptions {
  exists?: (path: string) => boolean;
  load?: (path: string) => void;
}

export function loadOptionalEnvFile(path: string, options: LoadOptionalEnvFileOptions = {}) {
  const exists = options.exists ?? existsSync;
  const load = options.load ?? loadEnvFile;

  if (!exists(path)) {
    return;
  }

  load(path);
}
