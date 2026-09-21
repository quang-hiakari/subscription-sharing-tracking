// Who may log in. Pure helpers plus one D1 lookup; no Next imports.
//  - admin: email listed in ADMIN_EMAILS (comma-separated, case-insensitive)
//  - member: non-archived row in `members` with that email

export type Role = 'admin' | 'member';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseAdminEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
}

export function isAdminEmail(email: string, rawAdminEmails: string | undefined): boolean {
  return parseAdminEmails(rawAdminEmails).includes(normalizeEmail(email));
}

/**
 * Resolves access for a signed-in email. `memberId` is the non-archived member row
 * (or null). Returns null when the email is neither admin nor an active member,
 * which also revokes stale sessions of archived/removed members.
 */
export function resolveAccess(
  email: string,
  rawAdminEmails: string | undefined,
  memberId: number | null,
): { role: Role; memberId: number | null } | null {
  if (isAdminEmail(email, rawAdminEmails)) return { role: 'admin', memberId };
  if (memberId !== null) return { role: 'member', memberId };
  return null;
}

export async function findActiveMemberId(db: D1Database, email: string): Promise<number | null> {
  const row = await db
    .prepare('SELECT id FROM members WHERE email = ? AND archived = 0')
    .bind(normalizeEmail(email))
    .first<{ id: number }>();
  return row?.id ?? null;
}

export async function isLoginAllowed(
  db: D1Database,
  email: string,
  rawAdminEmails: string | undefined,
): Promise<boolean> {
  if (isAdminEmail(email, rawAdminEmails)) return true;
  return (await findActiveMemberId(db, email)) !== null;
}
