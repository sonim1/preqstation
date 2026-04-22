import { redirect } from 'next/navigation';

import { getOwnerUserOrNull } from '@/lib/owner';

export default async function RootPage() {
  const owner = await getOwnerUserOrNull();
  if (owner) redirect('/dashboard');
  redirect('/login');
}
