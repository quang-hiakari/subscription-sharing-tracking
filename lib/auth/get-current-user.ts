import { headers } from 'next/headers';
import { createAuth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { findActiveMemberId, resolveAccess, type Role } from './allowed-emails';

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  /** Active member row for this email; null for an admin who is not also a member. */
  memberId: number | null;
}

/**
 * Session user with a role. Returns null when there is no session, or when the email
 * is no longer an admin or active member (so archiving a member cuts access at once).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const db = getDB();
  const session = await createAuth(db).api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const { id, email } = session.user;
  const memberId = await findActiveMemberId(db, email);
  const access = resolveAccess(email, process.env.ADMIN_EMAILS, memberId);
  if (!access) return null;

  if (memberId !== null) {
    // Link the member row to the auth user on first login.
    await db.prepare('UPDATE members SET user_id = ? WHERE id = ? AND user_id IS NULL').bind(id, memberId).run();
  }
  return { id, email, role: access.role, memberId: access.memberId };
}
