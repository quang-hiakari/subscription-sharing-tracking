import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export const dynamic = 'force-dynamic';

// Landing route: sends each role to its home.
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  redirect(user.role === 'admin' ? '/admin' : '/me');
}
