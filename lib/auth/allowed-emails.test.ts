import { describe, expect, it } from 'vitest';
import { isAdminEmail, isLoginAllowed, normalizeEmail, parseAdminEmails, resolveAccess } from './allowed-emails';

// Minimal D1 stand-in: returns the configured row for the members lookup.
function fakeDb(memberIdByEmail: Record<string, number>): D1Database {
  return {
    prepare: () => ({
      bind: (email: string) => ({
        first: async () => (email in memberIdByEmail ? { id: memberIdByEmail[email] } : null),
      }),
    }),
  } as unknown as D1Database;
}

describe('parseAdminEmails / isAdminEmail', () => {
  it('splits, trims and lowercases', () => {
    expect(parseAdminEmails(' A@x.com, b@Y.com ,, ')).toEqual(['a@x.com', 'b@y.com']);
  });

  it('handles unset env', () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(isAdminEmail('a@x.com', undefined)).toBe(false);
  });

  it('matches case-insensitively', () => {
    expect(isAdminEmail('ADMIN@Example.com', 'admin@example.com')).toBe(true);
    expect(isAdminEmail('other@example.com', 'admin@example.com')).toBe(false);
  });

  it('normalizes emails', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
});

describe('resolveAccess', () => {
  it('admin wins and keeps memberId when also a member', () => {
    expect(resolveAccess('a@x.com', 'a@x.com', 7)).toEqual({ role: 'admin', memberId: 7 });
    expect(resolveAccess('a@x.com', 'a@x.com', null)).toEqual({ role: 'admin', memberId: null });
  });

  it('active member gets member role', () => {
    expect(resolveAccess('m@x.com', 'a@x.com', 3)).toEqual({ role: 'member', memberId: 3 });
  });

  it('neither admin nor active member has no access', () => {
    expect(resolveAccess('m@x.com', 'a@x.com', null)).toBeNull();
  });

  it('a member cannot become admin through role resolution', () => {
    expect(resolveAccess('m@x.com', 'a@x.com', 3)?.role).toBe('member');
  });
});

describe('isLoginAllowed', () => {
  it('allows admin without a DB hit', async () => {
    expect(await isLoginAllowed(fakeDb({}), 'A@x.com', 'a@x.com')).toBe(true);
  });

  it('allows active members (lookup is lowercased)', async () => {
    expect(await isLoginAllowed(fakeDb({ 'm@x.com': 1 }), 'M@X.com', 'a@x.com')).toBe(true);
  });

  it('rejects unknown emails', async () => {
    expect(await isLoginAllowed(fakeDb({}), 'nobody@x.com', 'a@x.com')).toBe(false);
  });
});
