// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Alert, MantineProvider, Paper, Skeleton, Stepper, ThemeIcon } from '@mantine/core';
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  hasOwnerAccount: vi.fn(),
  useActionState: vi.fn(),
  useFormStatus: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();

  return {
    ...actual,
    useActionState: mocked.useActionState,
  };
});

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();

  return {
    ...actual,
    useFormStatus: mocked.useFormStatus,
  };
});

vi.mock('@/lib/auth', () => ({
  hasOwnerAccount: mocked.hasOwnerAccount,
}));

vi.mock('@/app/login/actions', () => ({
  loginAction: vi.fn(),
  registerOwnerAction: vi.fn(),
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    priority: _priority,
    src,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; src: string }) =>
    React.createElement('img', { alt, src, ...props }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => React.createElement('a', { href, ...props }, children),
}));

import WorkspaceErrorPage from '@/app/(workspace)/(main)/error';
import ProjectNotFoundPage from '@/app/(workspace)/(main)/project/[key]/not-found';
import OnboardingLayout from '@/app/(workspace)/(onboarding)/onboarding/layout';
import { OnboardingWizard } from '@/app/(workspace)/(onboarding)/onboarding/onboarding-wizard';
import AppErrorPage from '@/app/error';
import GlobalErrorPage from '@/app/global-error';
import { LoginForm } from '@/app/login/login-form';
import { OwnerSetupForm } from '@/app/login/owner-setup-form';
import LoginPage from '@/app/login/page';
import AppNotFoundPage from '@/app/not-found';

const globalsCss = readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
let globalsStyle: HTMLStyleElement | null = null;
const AlertFixture = Alert as React.ElementType;
const PaperFixture = Paper as React.ElementType;
const SkeletonFixture = Skeleton as React.ElementType;
const StepperFixture = Stepper as React.ElementType;
const StepperStepFixture = Stepper.Step as React.ElementType;
const ThemeIconFixture = ThemeIcon as React.ElementType;

function renderWithMantine(element: React.ReactElement) {
  return render(React.createElement(MantineProvider, null, element));
}

function getElement(container: ParentNode, selector: string) {
  const element = container.querySelector<HTMLElement>(selector);

  expect(element, `Expected rendered element for ${selector}`).not.toBeNull();

  return element!;
}

function expectComputedToken(element: HTMLElement, property: string, token: string) {
  const value = window.getComputedStyle(element).getPropertyValue(property);

  expect(value).toContain(`var(${token})`);
  expect(value).not.toContain('#');
  expect(value).not.toContain('rgba(132, 161, 202, 0.42)');
}

function expectNoColorOverride(container: ParentNode, selector: string) {
  for (const element of Array.from(container.querySelectorAll<HTMLElement>(selector))) {
    expect(element.getAttribute('data-color')).toBeNull();
  }
}

function getStyleRule(selector: string) {
  const sheet = globalsStyle?.sheet;

  expect(sheet).not.toBeNull();

  const rule = Array.from(sheet!.cssRules).find(
    (cssRule): cssRule is CSSStyleRule =>
      'selectorText' in cssRule && cssRule.selectorText === selector,
  );

  expect(rule, `Expected stylesheet rule for ${selector}`).not.toBeUndefined();

  return rule!.style;
}

async function renderLoginPage(reason?: string) {
  const page = await LoginPage({
    searchParams: Promise.resolve(reason ? { reason } : {}),
  });

  return renderWithMantine(page);
}

function renderOnboardingWizard() {
  return renderWithMantine(
    React.createElement(
      OnboardingLayout,
      null,
      React.createElement(OnboardingWizard, {
        initialProject: null,
        initialTask: null,
        workerReadiness: {
          status: 'missing',
          label: 'Missing',
          detail: 'Connect a worker before dispatching work.',
        },
        createProjectAction: vi.fn(),
        createTaskAction: vi.fn(),
      }),
    ),
  );
}

describe('auth onboarding and route state token contract', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    document.documentElement.setAttribute('data-mantine-color-scheme', 'light');
    globalsStyle = document.createElement('style');
    globalsStyle.textContent = globalsCss;
    document.head.appendChild(globalsStyle);
  });

  beforeEach(() => {
    mocked.hasOwnerAccount.mockReset();
    mocked.hasOwnerAccount.mockResolvedValue(true);
    mocked.useActionState.mockReset();
    mocked.useActionState.mockImplementation((_action, initialState) => [
      initialState,
      vi.fn(),
      false,
    ]);
    mocked.useFormStatus.mockReset();
    mocked.useFormStatus.mockReturnValue({ pending: false });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    globalsStyle?.remove();
    globalsStyle = null;
  });

  it('keeps auth pages on the shared app token shell', async () => {
    mocked.useActionState.mockImplementation((_action, initialState) => [
      initialState && typeof initialState === 'object'
        ? { error: 'Tokenized failure' }
        : initialState,
      vi.fn(),
      false,
    ]);

    const { container } = await renderLoginPage('auth');
    const shell = getElement(container, '.auth-shell');
    const card = getElement(container, '.auth-card');
    const warningAlert = getElement(container, '.auth-alert.auth-alert--warning');
    const dangerAlert = getElement(container, '.auth-alert.auth-alert--danger');
    const primaryAction = getElement(container, '.auth-primary-action');

    expectComputedToken(shell, 'color', '--ui-text');
    expectComputedToken(card, 'background', '--ui-state-shell-surface');
    expectComputedToken(card, 'color', '--ui-text');
    expectComputedToken(card, 'box-shadow', '--ui-elevation-3');
    expectComputedToken(warningAlert, 'color', '--ui-warning');
    expectComputedToken(dangerAlert, 'color', '--ui-danger');
    expectComputedToken(primaryAction, 'min-height', '--ui-action-min-height');
    expectNoColorOverride(container, '.auth-alert, .auth-primary-action');
  });

  it('keeps auth form alerts and actions on semantic classes', () => {
    mocked.useActionState.mockReturnValue([{ error: 'Tokenized failure' }, vi.fn(), false]);

    const loginForm = renderWithMantine(React.createElement(LoginForm));
    expect(getElement(loginForm.container, '.auth-alert.auth-alert--danger').textContent).toContain(
      'Tokenized failure',
    );
    expect(getElement(loginForm.container, '.auth-primary-action').textContent).toContain(
      'Sign in',
    );
    expectNoColorOverride(loginForm.container, '.auth-alert, .auth-primary-action');
    loginForm.unmount();

    const ownerSetupForm = renderWithMantine(React.createElement(OwnerSetupForm));
    expect(
      getElement(ownerSetupForm.container, '.auth-alert.auth-alert--danger').textContent,
    ).toContain('Tokenized failure');
    expect(getElement(ownerSetupForm.container, '.auth-primary-action').textContent).toContain(
      'Create Owner Account',
    );
    expectNoColorOverride(ownerSetupForm.container, '.auth-alert, .auth-primary-action');
  });

  it('keeps onboarding cards, status icons, alerts, and actions on semantic tokens', () => {
    const { container } = renderOnboardingWizard();
    const shell = getElement(container, '.onboarding-shell');
    const stepper = getElement(container, '.onboarding-stepper');
    const card = getElement(container, '.onboarding-card');
    const statusIcon = getElement(
      container,
      '.onboarding-status-icon.onboarding-status-icon--neutral',
    );
    const warningAlert = getElement(container, '.onboarding-alert.onboarding-alert--warning');
    const primaryAction = getElement(container, '.onboarding-primary-action');
    const secondaryAction = getElement(container, '.onboarding-secondary-action');

    expect(shell.textContent).toContain('Preq Station');
    expectComputedToken(shell, 'color', '--ui-text');
    expectComputedToken(stepper, 'background', '--ui-state-shell-muted-surface');
    expectComputedToken(card, 'background', '--ui-state-shell-surface');
    expectComputedToken(statusIcon, 'color', '--ui-neutral-strong');
    expectComputedToken(warningAlert, 'color', '--ui-warning');
    expectComputedToken(primaryAction, 'min-height', '--ui-action-min-height');
    expectComputedToken(secondaryAction, 'min-height', '--ui-action-min-height');
    expectNoColorOverride(container, '.onboarding-alert, .onboarding-status-icon');
  });

  it('uses the shared route-state shell for not-found and error routes', () => {
    const routeStates = [
      React.createElement(AppErrorPage, {
        error: Object.assign(new Error('Boom'), { digest: 'app-digest' }),
        reset: vi.fn(),
      }),
      React.createElement(AppNotFoundPage),
      React.createElement(WorkspaceErrorPage, {
        error: Object.assign(new Error('Boom'), { digest: 'workspace-digest' }),
        reset: vi.fn(),
      }),
      React.createElement(ProjectNotFoundPage),
    ];

    for (const routeState of routeStates) {
      const view = renderWithMantine(routeState);
      const page = getElement(view.container, '.route-state-page');
      const card = getElement(view.container, '.route-state-card');

      expectComputedToken(page, 'color', '--ui-text');
      expectComputedToken(card, 'background', '--ui-state-shell-surface');
      expectComputedToken(
        getElement(view.container, '.route-state-eyebrow'),
        'color',
        '--ui-muted-text',
      );
      expectComputedToken(
        getElement(view.container, '.route-state-primary-action'),
        'min-height',
        '--ui-action-min-height',
      );
      view.unmount();
    }

    const renderedGlobalError = renderToStaticMarkup(
      React.createElement(GlobalErrorPage, {
        error: Object.assign(new Error('Boom'), { digest: 'global-digest' }),
        reset: vi.fn(),
      }),
    );
    const globalErrorDocument = new DOMParser().parseFromString(renderedGlobalError, 'text/html');
    const globalPage = getElement(globalErrorDocument, '.route-state-page.route-state-global-page');
    const globalCard = getElement(globalErrorDocument, '.route-state-card.route-state-global-card');

    expect(globalPage.getAttribute('style')).toContain('var(--ui-surface-strong, #0b1220)');
    expect(globalPage.getAttribute('style')).toContain('var(--ui-surface, #0f172a)');
    expect(globalPage.getAttribute('style')).toContain('var(--ui-text, #e8effa)');
    expect(globalCard.getAttribute('style')).toContain(
      'var(--ui-state-shell-surface, rgba(17, 27, 44, 0.92))',
    );
    expect(globalCard.getAttribute('style')).toContain(
      'var(--ui-state-shell-border, rgba(142, 166, 203, 0.32))',
    );
    expect(getElement(globalErrorDocument, '.route-state-primary-action').textContent).toContain(
      'Try reload',
    );
  });

  it('maps app shell colors through shared root tokens', () => {
    const rootStyle = window.getComputedStyle(document.documentElement);

    expect(rootStyle.getPropertyValue('--mantine-color-body').trim()).toBe(
      'var(--ui-body-surface)',
    );
    expect(rootStyle.getPropertyValue('background')).toBe('var(--ui-body-background)');

    const globalPage = document.createElement('div');
    globalPage.className = 'route-state-global-page';
    document.body.appendChild(globalPage);
    const globalCard = document.createElement('main');
    globalCard.className = 'route-state-global-card';
    document.body.appendChild(globalCard);

    const globalPageBackground = window.getComputedStyle(globalPage).getPropertyValue('background');
    const globalCardStyle = window.getComputedStyle(globalCard);
    const globalCardRule = getStyleRule('.route-state-global-card');

    expect(globalPageBackground).not.toContain('#');
    expect(globalPageBackground).not.toContain('rgba(132, 161, 202, 0.42)');
    expect(globalCardStyle.getPropertyValue('border-top-style')).toBe('solid');
    expect(globalCardStyle.getPropertyValue('border-top-width')).toBe('1px');
    expect(globalCardRule.getPropertyValue('border-color').trim()).toBe(
      'var(--ui-state-shell-border)',
    );
    expect(globalCardRule.getPropertyValue('border')).not.toContain('rgba(132, 161, 202, 0.42)');

    globalPage.remove();
    globalCard.remove();
  });

  it('renders Mantine component bridge overrides with semantic tokens', () => {
    const { container, getByTestId } = renderWithMantine(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(PaperFixture, { withBorder: true, 'data-testid': 'paper' }, 'Paper'),
        React.createElement(AlertFixture, { 'data-testid': 'alert' }, 'Alert'),
        React.createElement(ThemeIconFixture, { 'data-testid': 'theme-icon' }, 'i'),
        React.createElement(
          StepperFixture,
          { active: 1, 'data-testid': 'stepper' },
          React.createElement(StepperStepFixture, { label: 'First' }),
          React.createElement(StepperStepFixture, { label: 'Second' }),
        ),
        React.createElement(SkeletonFixture, { 'data-testid': 'skeleton', height: 16 }),
      ),
    );

    expectComputedToken(getByTestId('paper'), 'color', '--ui-text');
    expectComputedToken(getByTestId('alert'), 'background', '--ui-state-shell-muted-surface');
    expectComputedToken(getByTestId('theme-icon'), 'background', '--ui-state-shell-muted-surface');
    expectComputedToken(getByTestId('stepper'), 'color', '--ui-text');
    expectComputedToken(getByTestId('skeleton'), 'background', '--ui-state-shell-muted-surface');
    expect(container.querySelector('.mantine-Stepper-stepIcon')).not.toBeNull();
  });
});
