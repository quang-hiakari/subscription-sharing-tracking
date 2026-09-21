import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

// Expose D1 bindings (wrangler.toml) to `next dev` via getRequestContext().
// Needs ESM top-level await, so this config is .mjs (next.config.ts is CJS-transpiled).
// DEV_PERSIST_DIR points dev at a separate local D1 (e.g. for throwaway test data).
if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform(process.env.DEV_PERSIST_DIR ? { persist: { path: process.env.DEV_PERSIST_DIR } } : undefined);
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
