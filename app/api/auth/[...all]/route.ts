import { createAuth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { toNextJsHandler } from 'better-auth/next-js';

export const runtime = 'edge';

export const GET = (req: Request) => toNextJsHandler(createAuth(getDB())).GET(req);
export const POST = (req: Request) => toNextJsHandler(createAuth(getDB())).POST(req);
