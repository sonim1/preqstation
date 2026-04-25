import { and, asc, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { OfflineBanner } from '@/app/components/offline-banner';
import { SignOutForm } from '@/app/components/sign-out-form';
import { WorkspaceShell } from '@/app/components/workspace-shell';
import { withOwnerDb } from '@/lib/db/rls';
import { projects } from '@/lib/db/schema';
import { getOwnerUserOrNull } from '@/lib/owner';
import { DEFAULT_PROJECT_STATUS, isProjectStatus } from '@/lib/project-meta';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const projectRows = await withOwnerDb(owner.id, async (client) =>
    client
      .select({
        id: projects.id,
        name: projects.name,
        projectKey: projects.projectKey,
        status: projects.status,
      })
      .from(projects)
      .where(and(eq(projects.ownerId, owner.id), isNull(projects.deletedAt)))
      .orderBy(asc(projects.name)),
  );
  const projectOptions = projectRows.map((project) => ({
    ...project,
    status: isProjectStatus(project.status) ? project.status : DEFAULT_PROJECT_STATUS,
  }));

  if (projectOptions.length === 0) {
    redirect('/onboarding');
  }

  return (
    <WorkspaceShell
      email={owner.email}
      projectOptions={projectOptions}
      dashboardHref="/dashboard"
      projectsHref="/projects"
      kanbanHref="/board"
      settingsHref="/settings"
      apiKeysHref="/connections"
      signOutControl={<SignOutForm />}
    >
      <OfflineBanner />
      {children}
    </WorkspaceShell>
  );
}
