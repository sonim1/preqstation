import { and, eq, isNull, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { withOwnerDb } from '@/lib/db/rls';
import { projects } from '@/lib/db/schema';
import { getOwnerUserOrNull } from '@/lib/owner';

import { createOnboardingProject, createOnboardingTask } from './actions';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage() {
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const [{ count: projectCount }] = await withOwnerDb(owner.id, async (client) =>
    client
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(and(eq(projects.ownerId, owner.id), isNull(projects.deletedAt))),
  );

  if (projectCount > 0) {
    redirect('/dashboard');
  }

  return (
    <OnboardingWizard
      createProjectAction={createOnboardingProject}
      createTaskAction={createOnboardingTask}
    />
  );
}
