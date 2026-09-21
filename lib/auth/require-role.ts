import { redirect } from 'next/navigation';
import { getCurrentUser, type CurrentUser } from './get-current-user';

// Call these at the top of every page and Server Action. Enforcement lives here,
// not in middleware, so a missed route cannot silently become public.

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/me');
  return user;
}

export async function requireMember(): Promise<CurrentUser & { memberId: number }> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.memberId === null) redirect('/admin'); // admin who is not a member
  return { ...user, memberId: user.memberId };
}
