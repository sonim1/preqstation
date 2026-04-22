'use server';

import { redirect } from 'next/navigation';

import { auth, createOwnerAccount, signInWithPassword } from '@/lib/auth';
import {
  buildMcpAuthorizationRedirect,
  consumeMcpLoginRequestCookie,
  issueMcpAuthorizationCode,
} from '@/lib/mcp/auth';

type LoginActionState = {
  error: string | null;
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
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return { error: 'Please enter your email and password.' };
  }

  let ok = false;
  try {
    ok = await signInWithPassword({ email, password, path: '/login' });
  } catch {
    return { error: 'An error occurred during login. Please try again later.' };
  }

  if (ok) {
    const session = await auth();
    if (!session?.user?.id || !session.user.isOwner) {
      return { error: 'Unable to continue login. Please try again.' };
    }

    await continueSuccessfulAuth(session.user, '/dashboard');
  }

  return { error: 'Invalid email or password.' };
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
  } catch {
    return { error: 'An error occurred during setup. Please try again later.' };
  }

  return { error: 'Unable to finish setup.' };
}
