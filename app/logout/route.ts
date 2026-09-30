import { redirect } from 'next/navigation';
import { createAuth } from '@/lib/auth';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  await createAuth(await getDB()).api.signOut({ headers: req.headers });
  redirect('/login');
}
