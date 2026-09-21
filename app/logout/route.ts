import { redirect } from 'next/navigation';
import { createAuth } from '@/lib/auth';
import { getDB } from '@/lib/db';

export const runtime = 'edge';

export async function POST(req: Request) {
  await createAuth(getDB()).api.signOut({ headers: req.headers });
  redirect('/login');
}
