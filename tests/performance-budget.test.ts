import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function readProjectFile(filePath: string) {
  return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

describe('performance budget guardrails', () => {
  it('keeps brand font setup hermetic for offline production builds', () => {
    const fontsSource = readProjectFile('app/fonts.ts');

    expect(fontsSource).not.toContain('next/font/google');
    expect(fontsSource).not.toContain('fonts.googleapis.com');
  });

  it('keeps the full command palette out of the workspace shell startup module', () => {
    const workspaceShellSource = readProjectFile('app/components/workspace-shell.tsx');

    expect(workspaceShellSource).toMatch(
      /dynamic<CommandPaletteProps>\(\s*\(\)\s*=>\s*import\('\.\/command-palette'\)/,
    );
    expect(workspaceShellSource).toContain("from './command-palette-trigger'");
    expect(workspaceShellSource).not.toMatch(
      /import\s+\{\s*CommandPalette,\s*CommandPaletteTrigger\s*\}\s+from\s+'\.\/command-palette'/,
    );
  });

  it('loads the notification drawer only after the user opens notifications', () => {
    const notificationCenterSource = readProjectFile('app/components/task-notification-center.tsx');

    expect(notificationCenterSource).toMatch(
      /dynamic\(\s*\(\)\s*=>\s*import\('\.\/task-notification-drawer'\)/,
    );
    expect(notificationCenterSource).toContain('{opened ? (');
    expect(notificationCenterSource).not.toMatch(
      /import\s+\{[^;]*TaskNotificationDrawer[^;]*\}\s+from\s+'\.\/task-notification-drawer'/,
    );
  });
});
