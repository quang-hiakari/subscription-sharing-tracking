import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  // Inline object stops Vite from loading Next's string-plugin postcss.config.mjs.
  css: { postcss: {} },
  test: { include: ['**/*.test.ts'], exclude: ['**/node_modules/**', '.next/**'] },
});
