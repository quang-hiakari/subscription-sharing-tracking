import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Every page in this app is dynamic (no static generation/ISR to cache), so no incremental
// cache override is needed.
export default defineCloudflareConfig();
