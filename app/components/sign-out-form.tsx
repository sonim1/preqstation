import { SubmitButton } from '@/app/components/submit-button';
import { signOut } from '@/lib/auth';

export function SignOutForm() {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/login' });
      }}
    >
      <SubmitButton variant="default" size="xs" className="workspace-signout-btn">
        Sign out
      </SubmitButton>
    </form>
  );
}
