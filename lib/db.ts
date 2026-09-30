import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db-schema';

// Async mode: sync mode's context isn't reliably available in every scenario (e.g. a Server
// Action invoked from a dynamic route) — see https://github.com/opennextjs/opennextjs-cloudflare/issues/575.
export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

export async function getDrizzle() {
  return drizzle(await getDB(), { schema });
}
