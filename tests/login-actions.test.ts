import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  createOwnerAccount: vi.fn(),
  auth: vi.fn(),
  redirect: vi.fn(),
  issueMcpAuthorizationCode: vi.fn(),
  consumeMcpLoginRequestCookie: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  signInWithPassword: mocked.signInWithPassword,
  createOwnerAccount: mocked.createOwnerAccount,
  auth: mocked.auth,
}));

vi.mock('@/lib/mcp/auth', () => ({
  consumeMcpLoginRequestCookie: mocked.consumeMcpLoginRequestCookie,
  issueMcpAuthorizationCode: mocked.issueMcpAuthorizationCode,
  buildMcpAuthorizationRedirect: (redirectUri: string, code: string, state: string) =>
    `${redirectUri}?code=${code}&state=${state}`,
}));

vi.mock('next/navigation', () => ({
  redirect: mocked.redirect,
}));

import { loginAction, registerOwnerAction } from '@/app/login/actions';

function buildLoginFormData() {
  const formData = new FormData();
  formData.set('email', 'owner@example.com');
  formData.set('password', 'plaintext-password-123');
  return formData;
}

function buildOwnerSetupFormData() {
  const formData = new FormData();
  formData.set('email', 'owner@example.com');
  formData.set('password', 'plaintext-password-123');
  formData.set('confirmPassword', 'plaintext-password-123');
  return formData;
}

describe('app/login/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.signInWithPassword.mockResolvedValue(true);
    mocked.auth.mockResolvedValue({
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        isOwner: true,
      },
    });
    mocked.createOwnerAccount.mockResolvedValue({
      ok: true,
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        isOwner: true,
      },
    });
    mocked.consumeMcpLoginRequestCookie.mockResolvedValue(null);
    mocked.issueMcpAuthorizationCode.mockResolvedValue('code-123');
  });

  it('redirects to /dashboard after a normal successful login', async () => {
    await loginAction({ error: null }, buildLoginFormData());

    expect(mocked.redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('continues oauth login when a pending MCP oauth request cookie exists', async () => {
    mocked.consumeMcpLoginRequestCookie.mockResolvedValueOnce({
      clientId: 'client-123',
      redirectUri: 'https://client.example/callback',
      state: 'opaque-state',
      codeChallenge: 'challenge-123',
      codeChallengeMethod: 'S256',
    });

    await loginAction({ error: null }, buildLoginFormData());

    expect(mocked.issueMcpAuthorizationCode).toHaveBeenCalledWith({
      userId: 'owner-1',
      clientId: 'client-123',
      codeChallenge: 'challenge-123',
      codeChallengeMethod: 'S256',
      redirectUri: 'https://client.example/callback',
    });
    expect(mocked.redirect).toHaveBeenCalledWith(
      'https://client.example/callback?code=code-123&state=opaque-state',
    );
  });

  it('redirects to /onboarding after creating the first owner account', async () => {
    await registerOwnerAction({ error: null }, buildOwnerSetupFormData());

    expect(mocked.createOwnerAccount).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'plaintext-password-123',
      path: '/login',
    });
    expect(mocked.redirect).toHaveBeenCalledWith('/onboarding');
  });

  it('continues oauth login after creating the first owner account', async () => {
    mocked.consumeMcpLoginRequestCookie.mockResolvedValueOnce({
      clientId: 'client-123',
      redirectUri: 'https://client.example/callback',
      state: 'opaque-state',
      codeChallenge: 'challenge-123',
      codeChallengeMethod: 'S256',
    });

    await registerOwnerAction({ error: null }, buildOwnerSetupFormData());

    expect(mocked.issueMcpAuthorizationCode).toHaveBeenCalledWith({
      userId: 'owner-1',
      clientId: 'client-123',
      codeChallenge: 'challenge-123',
      codeChallengeMethod: 'S256',
      redirectUri: 'https://client.example/callback',
    });
    expect(mocked.redirect).toHaveBeenCalledWith(
      'https://client.example/callback?code=code-123&state=opaque-state',
    );
  });

  it('returns an inline error when the passwords do not match', async () => {
    const formData = buildOwnerSetupFormData();
    formData.set('confirmPassword', 'different-password');

    const result = await registerOwnerAction({ error: null }, formData);

    expect(result).toEqual({ error: 'Passwords do not match.' });
    expect(mocked.createOwnerAccount).not.toHaveBeenCalled();
    expect(mocked.redirect).not.toHaveBeenCalled();
  });
});
