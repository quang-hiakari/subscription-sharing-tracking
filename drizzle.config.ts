import { defineConfig } from 'drizzle-kit';

// Generates SQL migrations consumed by `wrangler d1 migrations apply`.
export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/db-schema.ts',
  out: './d1/migrations',
});
