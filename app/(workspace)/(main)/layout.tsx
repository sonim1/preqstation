import { and, asc, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { EventPoller } from '@/app/components/event-poller';
import { OfflineBanner } from '@/app/components/offline-banner';
import { SignOutForm } from '@/app/components/sign-out-form';
import { WorkspaceShell } from '@/app/components/workspace-shell';
import { withOwnerDb } from '@/lib/db/rls';
import { projects } from '@/lib/db/schema';
import { getOwnerUserOrNull } from '@/lib/owner';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

const EVENT_POLLING_ENABLED = true;

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const [projectOptions, syncInterval] = await withOwnerDb(owner.id, async (client) =>
    Promise.all([
      client
        .select({ id: projects.id, name: projects.name, projectKey: projects.projectKey })
        .from(projects)
        .where(and(eq(projects.ownerId, owner.id), isNull(projects.deletedAt)))
        .orderBy(asc(projects.name)),
      getUserSetting(owner.id, SETTING_KEYS.SYNC_INTERVAL, client),
    ]),
  );

  if (projectOptions.length === 0) {
    redirect('/onboarding');
  }

  const parsedSyncInterval = Number.parseInt(syncInterval, 10);
  const intervalMs =
    Number.isFinite(parsedSyncInterval) && parsedSyncInterval > 0 ? parsedSyncInterval : undefined;

  return (
    <>
      {EVENT_POLLING_ENABLED ? <EventPoller intervalMs={intervalMs} /> : null}
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
    </>
  );
}
