import { redirect } from 'next/navigation';

import { TerminologyProvider } from '@/app/components/terminology-provider';
import { TimezoneProvider } from '@/app/components/timezone-provider';
import { getOwnerUserOrNull } from '@/lib/owner';
import { resolveTerminology } from '@/lib/terminology';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');

  const [kitchenMode, timeZone] = await Promise.all([
    getUserSetting(owner.id, SETTING_KEYS.KITCHEN_MODE),
    getUserSetting(owner.id, SETTING_KEYS.TIMEZONE),
  ]);
  const terminology = resolveTerminology(kitchenMode === 'true');

  return (
    <TerminologyProvider terminology={terminology}>
      <TimezoneProvider timeZone={timeZone}>{children}</TimezoneProvider>
    </TerminologyProvider>
  );
}
