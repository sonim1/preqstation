import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function readAppFile(filePath: string) {
  return readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

const globalsCss = readAppFile('app/globals.css');
const loginPageSource = readAppFile('app/login/page.tsx');
const loginFormSource = readAppFile('app/login/login-form.tsx');
const ownerSetupFormSource = readAppFile('app/login/owner-setup-form.tsx');
const onboardingLayoutSource = readAppFile('app/(workspace)/(onboarding)/onboarding/layout.tsx');
const onboardingWizardSource = readAppFile(
  'app/(workspace)/(onboarding)/onboarding/onboarding-wizard.tsx',
);
const globalErrorSource = readAppFile('app/global-error.tsx');
const appErrorSource = readAppFile('app/error.tsx');
const appNotFoundSource = readAppFile('app/not-found.tsx');
const workspaceErrorSource = readAppFile('app/(workspace)/(main)/error.tsx');
const projectNotFoundSource = readAppFile('app/(workspace)/(main)/project/[key]/not-found.tsx');

describe('auth onboarding and route state token contract', () => {
  it('keeps auth pages on the shared app token shell', () => {
    expect(loginPageSource).toContain('auth-shell');
    expect(loginPageSource).toContain('auth-card');
    expect(loginPageSource).toContain('auth-alert auth-alert--warning');
    expect(loginFormSource).toContain('auth-alert auth-alert--danger');
    expect(ownerSetupFormSource).toContain('auth-alert auth-alert--danger');
    expect(loginFormSource).toContain('auth-primary-action');
    expect(ownerSetupFormSource).toContain('auth-primary-action');

    for (const source of [loginPageSource, loginFormSource, ownerSetupFormSource]) {
      expect(source).not.toMatch(/<Alert[\s\S]*?color=/);
    }
  });

  it('keeps onboarding cards, status icons, alerts, and actions on semantic tokens', () => {
    expect(onboardingLayoutSource).toContain('onboarding-shell');
    expect(onboardingWizardSource).toContain('onboarding-stepper');
    expect(onboardingWizardSource).toContain('onboarding-card');
    expect(onboardingWizardSource).toContain('onboarding-status-icon');
    expect(onboardingWizardSource).toContain('onboarding-alert');
    expect(onboardingWizardSource).toContain('onboarding-primary-action');
    expect(onboardingWizardSource).toContain('onboarding-secondary-action');

    expect(onboardingWizardSource).not.toMatch(/<ThemeIcon[\s\S]*?color=/);
    expect(onboardingWizardSource).not.toMatch(/<Alert[\s\S]*?color=/);
  });

  it('uses the shared route-state shell for not-found and error routes', () => {
    for (const source of [
      appErrorSource,
      appNotFoundSource,
      workspaceErrorSource,
      projectNotFoundSource,
      globalErrorSource,
    ]) {
      expect(source).toContain('route-state-page');
      expect(source).toContain('route-state-card');
      expect(source).toContain('route-state-eyebrow');
      expect(source).toContain('route-state-primary-action');
    }

    expect(globalErrorSource).not.toContain('style={{');
  });

  it('defines token bridges for Mantine primitives used by auth and onboarding', () => {
    for (const selector of [
      '.auth-card',
      '.auth-alert',
      '.onboarding-card',
      '.onboarding-alert',
      '.onboarding-status-icon',
      '.route-state-card',
      '.route-state-primary-action',
      '.mantine-Paper-root',
      '.mantine-Alert-root',
      '.mantine-ThemeIcon-root',
      '.mantine-Stepper-root',
      '.mantine-Skeleton-root',
    ]) {
      expect(globalsCss).toContain(selector);
    }

    expect(globalsCss).toContain('--ui-state-shell-surface');
    expect(globalsCss).toContain('--ui-state-shell-border');
    expect(globalsCss).toContain('--ui-field-min-height');
    expect(globalsCss).toContain('--ui-action-min-height');
  });
});
