'use server';

import { redirect } from 'next/navigation';

import { completeTwoFactorSignIn, createOwnerAccount, signInWithPassword } from '@/lib/auth';
import {
  buildMcpAuthorizationRedirect,
  consumeMcpLoginRequestCookie,
  issueMcpAuthorizationCode,
} from '@/lib/mcp/auth';
import { isNextRedirectError } from '@/lib/next-utils';

type LoginActionState = {
  error: string | null;
  twoFactorRequired?: boolean;
};

async function continueSuccessfulAuth(user: { id: string; isOwner: boolean }, redirectTo: string) {
  const pendingOauthRequest = await consumeMcpLoginRequestCookie();
  if (pendingOauthRequest) {
    if (!user.id || !user.isOwner) {
      return { error: 'Unable to continue OAuth login. Please try again.' };
    }

    const code = await issueMcpAuthorizationCode({
      userId: user.id,
      clientId: pendingOauthRequest.clientId,
      codeChallenge: pendingOauthRequest.codeChallenge,
      codeChallengeMethod: pendingOauthRequest.codeChallengeMethod,
      redirectUri: pendingOauthRequest.redirectUri,
    });
    if (!code) {
      return { error: 'Unable to continue OAuth login. Please try again.' };
    }

    redirect(
      buildMcpAuthorizationRedirect(
        pendingOauthRequest.redirectUri,
        code,
        pendingOauthRequest.state,
      ),
    );
  }

  redirect(redirectTo);
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const intent = String(formData.get('intent') || 'password');

  if (intent === 'two-factor') {
    const code = String(formData.get('totpCode') || '');
    if (!code) {
      return { error: 'Please enter your authentication code.', twoFactorRequired: true };
    }

    try {
      const result = await completeTwoFactorSignIn({ code, path: '/login' });
      if (result.ok) {
        await continueSuccessfulAuth(result.user, '/dashboard');
      }
    } catch {
      return {
        error: 'An error occurred during login. Please try again later.',
        twoFactorRequired: true,
      };
    }

    return { error: 'Invalid authentication code.', twoFactorRequired: true };
  }

  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return { error: 'Please enter your email and password.' };
  }

  let result: Awaited<ReturnType<typeof signInWithPassword>>;
  try {
    result = await signInWithPassword({ email, password, path: '/login' });
  } catch {
    return { error: 'An error occurred during login. Please try again later.' };
  }

  if (!result.ok) {
    return { error: 'Invalid email or password.' };
  }

  if (result.twoFactorRequired) {
    return { error: null, twoFactorRequired: true };
  }

  await continueSuccessfulAuth(result.user, '/dashboard');
  return { error: 'Unable to finish login.' };
}

export async function registerOwnerAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (!email || !password || !confirmPassword) {
    return { error: 'Please fill in all fields.' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  try {
    const result = await createOwnerAccount({ email, password, path: '/login' });
    if (!result.ok) {
      return { error: 'Owner account is already configured.' };
    }

    await continueSuccessfulAuth(result.user, '/onboarding');
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('Failed to register owner:', error);
    return { error: 'An error occurred during setup. Please try again later.' };
  }

  return { error: 'Unable to finish setup.' };
}
