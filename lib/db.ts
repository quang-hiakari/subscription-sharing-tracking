import { getRequestContext } from '@cloudflare/next-on-pages';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db-schema';

export function getDB(): D1Database {
  return getRequestContext().env.DB;
}

export function getDrizzle() {
  return drizzle(getDB(), { schema });
}
