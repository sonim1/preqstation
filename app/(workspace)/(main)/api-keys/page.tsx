import { redirect } from 'next/navigation';

export default function ApiKeysPage() {
  redirect('/connections?legacy=1');
}
