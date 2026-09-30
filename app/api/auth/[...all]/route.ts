import { createAuth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { toNextJsHandler } from 'better-auth/next-js';

export const dynamic = 'force-dynamic';

export const GET = async (req: Request) => toNextJsHandler(createAuth(await getDB())).GET(req);
export const POST = async (req: Request) => toNextJsHandler(createAuth(await getDB())).POST(req);
