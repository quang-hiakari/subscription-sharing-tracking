import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {};

export default nextConfig;

// Exposes D1 (wrangler.toml) bindings to `next dev` via getCloudflareContext().
// DEV_PERSIST_DIR points dev at a separate local D1 (e.g. for throwaway test data).
initOpenNextCloudflareForDev({
  persist: process.env.DEV_PERSIST_DIR ? { path: process.env.DEV_PERSIST_DIR } : undefined,
});
